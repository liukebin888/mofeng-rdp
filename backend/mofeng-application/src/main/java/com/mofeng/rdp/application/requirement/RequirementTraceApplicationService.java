package com.mofeng.rdp.application.requirement;

import com.mofeng.rdp.domain.baseline.BaselineEngine;
import com.mofeng.rdp.domain.requirement.RequirementEngine;
import com.mofeng.rdp.domain.trace.TraceEngine;
import com.mofeng.rdp.infrastructure.persistence.baseline.BaselineRepository;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import com.mofeng.rdp.infrastructure.persistence.trace.TraceClosureRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 需求追溯完整性校验应用服务（C-4 端到端闭环：需求 → 追溯 → 基线）。
 *
 * <p>编排链路：字段齐全率（RequirementEngine）→ 追溯断链 + 覆盖率（TraceEngine）→
 * 基线哈希链组装（BaselineEngine，可选）。应用层只做编排，判定一律调领域引擎（ARC-001）。</p>
 *
 * <p>fail-closed 语义：字段缺项或存在 BLOCK 级断链或覆盖率不达标时，零写入、零组装基线，
 * 与「先 BOM 后样件」「缺项阻断」的纪律一致。</p>
 */
@Service
public class RequirementTraceApplicationService {

    private final TraceClosureRepository traceClosureRepository;
    private final BaselineRepository baselineRepository;

    public RequirementTraceApplicationService(TraceClosureRepository traceClosureRepository,
                                              BaselineRepository baselineRepository) {
        this.traceClosureRepository = traceClosureRepository;
        this.baselineRepository = baselineRepository;
    }

    /**
     * 需求追溯完整性校验闭环。
     *
     * <p>事务边界在方法上：追溯关系双写、基线组装同事务，保证「写关系 + 写闭包 + 写基线」
     * 本地原子性（K5）。</p>
     */
    @Transactional
    public RequirementTraceResult check(RequirementTraceRequest request) {
        TenantContextHolder.setTenantId(request.getTenantId());
        try {
            return doCheck(request);
        } finally {
            TenantContextHolder.clear();
        }
    }

    private RequirementTraceResult doCheck(RequirementTraceRequest request) {
        // 1. 字段齐全率（领域层 RequirementEngine，缺项阻断）
        Map<String, Map<String, Object>> reqs = request.getRequirements() == null
            ? Map.of() : request.getRequirements();
        RequirementEngine.BatchResult field = RequirementEngine.batchCompleteness(reqs);

        // 2. 追溯关系转领域值对象
        List<TraceEngine.Requirement> domainReqs = toDomainRequirements(reqs);
        List<TraceEngine.TraceLink> domainLinks = toDomainLinks(request.getLinks());

        // 3. 追溯断链检测（领域层 TraceEngine，BLOCK 阻断）
        List<TraceEngine.BreakItem> breakItems = TraceEngine.detectBreaks(domainReqs, domainLinks);
        boolean hasBlock = breakItems.stream().anyMatch(b -> "BLOCK".equals(b.severity));

        // 4. 覆盖率（领域层 TraceEngine，安全≥100% 且整体≥95% 才 pass）
        TraceEngine.Coverage coverage = TraceEngine.coverage(domainReqs, domainLinks, null);

        boolean passed = field.complete && !hasBlock && coverage.pass;

        // 5. 基线组装（仅通过时，且请求要求组装）
        String baselineNo = null;
        String manifestHash = null;
        String baselineStatus = null;
        if (passed && request.isBuildBaseline()) {
            BaselineEngine.Baseline baseline = baselineRepository.build(
                request.getTenantId(), request.getProjectId(), request.getBaselineNo(),
                "需求基线", toBaselineItems(reqs), request.getUserName());
            baselineNo = baseline.no();
            manifestHash = baseline.manifestHash();
            baselineStatus = baseline.status();
        }

        List<RequirementTraceResult.BreakDto> breakDtos = new ArrayList<>();
        for (TraceEngine.BreakItem b : breakItems) {
            breakDtos.add(new RequirementTraceResult.BreakDto(b.kind, b.reqCode, b.detail, b.severity));
        }

        return new RequirementTraceResult(
            request.getProjectId(), passed,
            field.complete, field.rate, field.badIds,
            breakDtos,
            coverage.denominator, coverage.numerator,
            coverage.overall, coverage.safety,
            baselineNo, manifestHash, baselineStatus);
    }

    /** 字段映射 → 领域 Requirement（仅保留追溯引擎所需字段，type/asil/status/version 从字段映射提取）。 */
    private List<TraceEngine.Requirement> toDomainRequirements(Map<String, Map<String, Object>> reqs) {
        List<TraceEngine.Requirement> out = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> e : reqs.entrySet()) {
            Map<String, Object> f = e.getValue();
            String type = str(f.get("type"));
            String asil = str(f.get("asil"));
            String status = str(f.get("status"));
            if (status == null || status.isEmpty()) status = "已批准";
            int version = f.get("version") instanceof Number n ? n.intValue() : 1;
            String baselineId = str(f.get("baselineId"));
            out.add(new TraceEngine.Requirement(e.getKey(), str(f.get("code")), type, asil, version, status, baselineId));
        }
        return out;
    }

    private List<TraceEngine.TraceLink> toDomainLinks(List<RequirementTraceRequest.TraceLinkDto> links) {
        List<TraceEngine.TraceLink> out = new ArrayList<>();
        if (links == null) return out;
        for (RequirementTraceRequest.TraceLinkDto d : links) {
            out.add(new TraceEngine.TraceLink(d.getId(), d.getSrcType(), d.getSrcId(),
                d.getDstType(), d.getDstId(), d.getLinkType(), d.getBaselineId(), d.getStatus()));
        }
        return out;
    }

    /** 字段映射 → 基线项输入（objType=需求类型，snapshot=字段快照）。 */
    private List<BaselineEngine.ItemInput> toBaselineItems(Map<String, Map<String, Object>> reqs) {
        List<BaselineEngine.ItemInput> out = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> e : reqs.entrySet()) {
            Map<String, Object> f = e.getValue();
            String type = str(f.get("type"));
            int version = f.get("version") instanceof Number n ? n.intValue() : 1;
            Map<String, Object> snap = new HashMap<>(f);
            snap.remove("version");
            out.add(new BaselineEngine.ItemInput(type == null ? "REQ" : type, e.getKey(), version, snap));
        }
        return out;
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
