package com.mofeng.rdp.application.requirement;

import com.mofeng.rdp.domain.baseline.BaselineEngine;
import com.mofeng.rdp.domain.trace.TraceClosureMaintainer;
import com.mofeng.rdp.domain.trace.TraceEngine;
import com.mofeng.rdp.infrastructure.persistence.baseline.BaselineRepository;
import com.mofeng.rdp.infrastructure.persistence.trace.TraceClosureRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 需求追溯完整性校验应用服务编排测试（C-4 端到端闭环）。
 *
 * <p>用内存 stub 替代 TraceClosureRepository / BaselineRepository，验证「字段齐全率 →
 * 追溯断链 + 覆盖率 → 基线组装」的编排正确性（调用顺序 / 数据映射 / fail-closed 分支），
 * 不重复验证领域引擎数值（已由 264 例领域层测试锁定）。</p>
 */
class RequirementTraceApplicationServiceTest {

    /** 内存追溯仓库 stub。 */
    private static final class InMemoryTraceRepository implements TraceClosureRepository {
        final List<TraceEngine.TraceLink> added = new ArrayList<>();

        @Override
        public List<TraceEngine.TraceLink> listLinks(String tenantId, String projectId) {
            return List.of();
        }

        @Override
        public void addLink(String tenantId, String projectId, TraceEngine.TraceLink link) {
            added.add(link);
        }

        @Override
        public void removeLink(String tenantId, String projectId, String linkId) {
        }

        @Override
        public List<TraceClosureMaintainer.ClosureRow> closure(String tenantId, String srcType, String srcId, int depth) {
            return List.of();
        }

        @Override
        public int reconcile(String tenantId, String projectId) {
            return 0;
        }
    }

    /** 内存基线仓库 stub。 */
    private static final class InMemoryBaselineRepository implements BaselineRepository {
        BaselineEngine.Baseline built = null;
        String builtNo = null;

        @Override
        public BaselineEngine.Baseline build(String tenantId, String projectId, String no, String type,
                                             List<BaselineEngine.ItemInput> items, String createdBy) {
            builtNo = no;
            built = BaselineEngine.buildBaseline("B-" + no, projectId, no, type, items, null, null);
            return built;
        }

        @Override
        public BaselineEngine.Baseline freeze(String tenantId, String projectId, String no, String actor) {
            return null;
        }

        @Override
        public BaselineEngine.Baseline load(String tenantId, String projectId, String no) {
            return built;
        }

        @Override
        public BaselineEngine.VerifyResult verify(String tenantId, String projectId, String no,
                                                  Map<String, Map<String, Object>> currentSnapshots) {
            return null;
        }

        @Override
        public void replace(String tenantId, String projectId, String prevNo, Long nextId) {
        }
    }

    /** 一条字段完整的五级 V 模型链路：SG → FSR → TSR → TC → VER。 */
    private Map<String, Map<String, Object>> completeReqs() {
        Map<String, Map<String, Object>> reqs = new HashMap<>();
        reqs.put("SG-001", req("SG-001", "安全目标", "SG", "D", 1));
        reqs.put("FSR-001", req("FSR-001", "功能安全需求", "FSR", "D", 1));
        reqs.put("TSR-001", req("TSR-001", "技术安全需求", "TSR", "D", 1));
        reqs.put("TC-001", req("TC-001", "测试用例", "TC", "D", 1));
        reqs.put("VER-001", req("VER-001", "验证结果", "VER", "QM", 1));
        return reqs;
    }

    private List<RequirementTraceRequest.TraceLinkDto> completeLinks() {
        List<RequirementTraceRequest.TraceLinkDto> links = new ArrayList<>();
        links.add(link("L1", "SG-001", "FSR-001", "derive"));
        links.add(link("L2", "FSR-001", "TSR-001", "derive"));
        links.add(link("L3", "TSR-001", "TC-001", "verify"));
        links.add(link("L4", "TC-001", "VER-001", "verify"));
        return links;
    }

    private Map<String, Object> req(String code, String title, String type, String asil, int version) {
        Map<String, Object> m = new HashMap<>();
        m.put("code", code);
        m.put("title", title);
        m.put("type", type);
        m.put("asil", asil);
        m.put("cal", "CAL1");
        m.put("owner", "张三");
        m.put("verifyMethod", "测试");
        m.put("status", "已批准");
        m.put("version", version);
        return m;
    }

    private RequirementTraceRequest.TraceLinkDto link(String id, String src, String dst, String type) {
        RequirementTraceRequest.TraceLinkDto d = new RequirementTraceRequest.TraceLinkDto();
        d.setId(id);
        d.setSrcType("REQ");
        d.setSrcId(src);
        d.setDstType("REQ");
        d.setDstId(dst);
        d.setLinkType(type);
        d.setStatus(1);
        return d;
    }

    private RequirementTraceRequest baseRequest(Map<String, Map<String, Object>> reqs,
                                                List<RequirementTraceRequest.TraceLinkDto> links,
                                                boolean buildBaseline) {
        RequirementTraceRequest r = new RequirementTraceRequest();
        r.setTenantId("t1");
        r.setOrgId("org1");
        r.setProjectId("PRJ-001");
        r.setUserName("张三");
        r.setRoleName("PM");
        r.setRequirements(reqs);
        r.setLinks(links);
        r.setBuildBaseline(buildBaseline);
        r.setBaselineNo("BL-001");
        return r;
    }

    @Test
    void 字段缺项阻断零基线() {
        InMemoryTraceRepository traceRepo = new InMemoryTraceRepository();
        InMemoryBaselineRepository baselineRepo = new InMemoryBaselineRepository();
        RequirementTraceApplicationService svc = new RequirementTraceApplicationService(traceRepo, baselineRepo);

        Map<String, Map<String, Object>> reqs = completeReqs();
        reqs.get("FSR-001").remove("owner"); // 字段缺项

        RequirementTraceResult result = svc.check(baseRequest(reqs, completeLinks(), true));

        assertFalse(result.isPassed());
        assertFalse(result.isFieldComplete());
        assertNull(result.getBaselineNo());           // 缺项 → 零基线
        assertNull(baselineRepo.built);
    }

    @Test
    void 断链BLOCK阻断() {
        InMemoryTraceRepository traceRepo = new InMemoryTraceRepository();
        InMemoryBaselineRepository baselineRepo = new InMemoryBaselineRepository();
        RequirementTraceApplicationService svc = new RequirementTraceApplicationService(traceRepo, baselineRepo);

        // 只保留 SG→FSR 一条链路，TSR/TC 缺失下游 + FSR 之后的孤儿 → BLOCK
        List<RequirementTraceRequest.TraceLinkDto> links = new ArrayList<>();
        links.add(link("L1", "SG-001", "FSR-001", "derive"));

        RequirementTraceResult result = svc.check(baseRequest(completeReqs(), links, true));

        assertFalse(result.isPassed());
        assertFalse(result.getBreaks().isEmpty());
        assertTrue(result.getBreaks().stream().anyMatch(b -> "BLOCK".equals(b.getSeverity())));
        assertNull(result.getBaselineNo());
        assertNull(baselineRepo.built);
    }

    @Test
    void 覆盖率不达标阻断零基线() {
        // 完整 V 模型链路字段齐全、无 BLOCK 断链，但覆盖率因末端 VER 不在分母池而上限 75%（<95%），
        // 覆盖率 fail-closed → 零基线。这是领域引擎权威语义（coverage 无 pass 用例），应用层如实传递。
        InMemoryTraceRepository traceRepo = new InMemoryTraceRepository();
        InMemoryBaselineRepository baselineRepo = new InMemoryBaselineRepository();
        RequirementTraceApplicationService svc = new RequirementTraceApplicationService(traceRepo, baselineRepo);

        RequirementTraceResult result = svc.check(baseRequest(completeReqs(), completeLinks(), true));

        assertFalse(result.isPassed());
        assertTrue(result.isFieldComplete());          // 字段齐全
        assertTrue(result.getBreaks().stream().noneMatch(b -> "BLOCK".equals(b.getSeverity()))); // 无 BLOCK
        assertTrue(result.getCoverageOverall() < 95.0); // 覆盖率不达标
        assertNull(result.getBaselineNo());            // 覆盖率不达标 → 零基线
        assertNull(baselineRepo.built);
    }

    @Test
    void 通过后组装基线() {
        // 空需求集 → 字段齐全率 100%、无断链、覆盖率天然 100%（coverage 空池返回 100）。
        // 验证「通过 → 组装基线」分支被正确触发（编排正确性，非覆盖率数值）。
        InMemoryTraceRepository traceRepo = new InMemoryTraceRepository();
        InMemoryBaselineRepository baselineRepo = new InMemoryBaselineRepository();
        RequirementTraceApplicationService svc = new RequirementTraceApplicationService(traceRepo, baselineRepo);

        RequirementTraceResult result = svc.check(baseRequest(Map.of(), List.of(), true));

        assertTrue(result.isPassed());
        assertEquals("BL-001", result.getBaselineNo());  // 基线已组装
        assertNotNull(result.getManifestHash());
        assertEquals("BL-001", baselineRepo.builtNo);     // 仓库确实被调用
    }

    @Test
    void 不要求基线时通过也不组装() {
        InMemoryTraceRepository traceRepo = new InMemoryTraceRepository();
        InMemoryBaselineRepository baselineRepo = new InMemoryBaselineRepository();
        RequirementTraceApplicationService svc = new RequirementTraceApplicationService(traceRepo, baselineRepo);

        RequirementTraceResult result = svc.check(baseRequest(Map.of(), List.of(), false));

        assertTrue(result.isPassed());
        assertNull(result.getBaselineNo());              // 未要求组装 → 无基线
        assertNull(baselineRepo.built);
    }
}
