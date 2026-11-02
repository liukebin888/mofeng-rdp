package com.mofeng.rdp.application.sample;

import com.mofeng.rdp.domain.sample.SampleEngine;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 样件试制处理应用服务（C-8 端到端闭环：样件 → 齐套 → 检验）。
 *
 * <p>编排链路：字段齐全率（validateSampleOrder，HW-001）→ 试制下达资格
 * （canReleaseTrial，P-03 先 BOM 后样件 / K9 齐套门 / HW-012 工装）→
 * EBOM 齐套（checkKitting，HW-010）→ 状态机流转（transitionSample，HW-002）→
 * 检验（problemTicketIdFor + canReleaseInspection，HW-013/014）。
 * 应用层只做编排，判定一律调领域引擎（ARC-001），不承载任何规则。</p>
 *
 * <p>fail-closed 语义：字段缺项、EBOM 未冻结、齐套不满足、工装未就绪、
 * 不合格未闭环，任一即阻断相应阶段。</p>
 */
@Service
public class SampleApplicationService {

    /**
     * 处理样件试制：字段齐全率 → 下达资格 → 齐套 → 状态机 → 检验。
     */
    public SampleResult process(SampleRequest request) {
        // 1. 字段齐全率（HW-001）
        SampleEngine.FieldResult field = SampleEngine.validateSampleOrder(toOrderMap(request));

        // 2. 试制下达资格（P-03 / K9 / HW-012）
        SampleEngine.ReleaseResult release = SampleEngine.canReleaseTrial(
            request.isEbomFrozen(), request.isKitBlocked(), request.isToolingReady());

        // 3. EBOM 齐套（HW-010）
        SampleEngine.KittingResult kitting = SampleEngine.checkKitting(
            toBomNodes(request.getBom()), request.getQty());

        // 4. 状态机流转（HW-002）
        SampleEngine.Transition transition = SampleEngine.transitionSample(
            request.getStatus(), request.getEvent());

        // 5. 检验（HW-013 不合格生成问题单 + HW-014 不合格闭环放行）
        String problemTicketId = SampleEngine.problemTicketIdFor(
            request.getOrderId(), request.getConclusion());
        SampleEngine.ReleaseResult inspection = SampleEngine.canReleaseInspection(
            toNonconformities(request.getNonconformityIds()));

        return new SampleResult(
            request.getOrderId(),
            field.ok, field.missing,
            release.ok, release.blockers,
            kitting.ok, kitting.rate, kitting.shortages,
            transition.ok, transition.to, transition.reason,
            problemTicketId, inspection.ok, inspection.blockers);
    }

    /** 样件需求 DTO → 字段映射（领域引擎 validateSampleOrder 的输入）。 */
    private Map<String, Object> toOrderMap(SampleRequest req) {
        Map<String, Object> m = new HashMap<>();
        m.put("projectId", req.getProjectId());
        m.put("code", req.getCode());
        m.put("type", req.getType());
        m.put("qty", req.getQty());
        m.put("needDate", req.getNeedDate());
        m.put("ebomVersion", req.getEbomVersion());
        return m;
    }

    /** BOM 节点 DTO → 领域 BomNode。 */
    private List<SampleEngine.BomNode> toBomNodes(List<SampleRequest.BomNodeDto> bom) {
        List<SampleEngine.BomNode> out = new ArrayList<>();
        if (bom == null) return out;
        for (SampleRequest.BomNodeDto d : bom) {
            out.add(new SampleEngine.BomNode(
                d.getMaterialCode(), d.getName(), d.getParentMaterialCode(),
                d.getQty(), d.getStock(), d.getIncoming()));
        }
        return out;
    }

    /** 未闭环问题单 id 列表 → 领域 Nonconformity（status=未闭环）。 */
    private List<SampleEngine.Nonconformity> toNonconformities(List<String> ncIds) {
        List<SampleEngine.Nonconformity> out = new ArrayList<>();
        if (ncIds == null) return out;
        for (String id : ncIds) {
            out.add(new SampleEngine.Nonconformity(id, "未闭环"));
        }
        return out;
    }
}
