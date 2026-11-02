package com.mofeng.rdp.domain.requirement;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class RequirementEngineTest {

    private static Map<String, Object> baseReq() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", "REQ-SG-001");
        m.put("title", "车辆不得产生意外加速");
        m.put("type", "SG");
        m.put("asil", "D");
        m.put("cal", 3);
        m.put("owner", "安全工程师A");
        m.put("verifyMethod", "测试");
        return m;
    }

    @Test
    void 字段齐全率100() {
        RequirementEngine.FieldResult r = RequirementEngine.fieldCompleteness(baseReq());
        assertTrue(r.complete);
        assertEquals(100, r.rate, 0.001);
    }

    @Test
    void 缺title字段被识别() {
        Map<String, Object> req = baseReq();
        req.put("title", "");
        RequirementEngine.FieldResult r = RequirementEngine.fieldCompleteness(req);
        assertFalse(r.complete);
        assertTrue(r.missing.contains("title"));
    }

    @Test
    void 批量完整率() {
        Map<String, Map<String, Object>> reqs = new LinkedHashMap<>();
        String[] types = {"SG", "FSR", "TSR", "HSR"};
        for (int i = 0; i < types.length; i++) {
            Map<String, Object> r = baseReq();
            r.put("type", types[i]);
            reqs.put("r" + i, r);
        }
        RequirementEngine.BatchResult r = RequirementEngine.batchCompleteness(reqs);
        assertTrue(r.complete);
        assertEquals(100, r.rate, 0.001);
        assertEquals(0, r.badIds.size());
    }

    @Test
    void 批量混入缺字段项() {
        Map<String, Map<String, Object>> reqs = new LinkedHashMap<>();
        String[] types = {"SG", "FSR", "TSR", "HSR"};
        for (int i = 0; i < types.length; i++) {
            Map<String, Object> r = baseReq();
            r.put("type", types[i]);
            if (i == 2) r.put("owner", "");
            reqs.put("r" + i, r);
        }
        RequirementEngine.BatchResult r = RequirementEngine.batchCompleteness(reqs);
        assertFalse(r.complete);
        assertTrue(r.badIds.contains("r2"));
    }

    @Test
    void hara双向齐全() {
        RequirementEngine.HaraResult r = RequirementEngine.haraBidirectional(
            List.of("sg1"), List.of("sg1"), List.of("sg1"));
        assertTrue(r.complete);
    }

    @Test
    void hara缺反向链路() {
        RequirementEngine.HaraResult r = RequirementEngine.haraBidirectional(
            List.of("sg1"), List.of(), List.of("sg1"));
        assertFalse(r.complete);
        assertTrue(r.missing.stream().anyMatch(m -> m.contains("hara->req")));
    }

    @Test
    void tara无关联() {
        Map<String, List<String>> secReqs = Map.of("sec1", List.of());
        RequirementEngine.TaraResult r = RequirementEngine.taraBidirectional(secReqs, Set.of());
        assertFalse(r.complete);
        assertTrue(r.missing.get(0).contains("未关联"));
    }

    @Test
    void tara无反向链路() {
        Map<String, List<String>> secReqs = Map.of("sec1", List.of("t1"));
        RequirementEngine.TaraResult r = RequirementEngine.taraBidirectional(secReqs, Set.of());
        assertFalse(r.complete);
        assertTrue(r.missing.get(0).contains("无反向链路"));
    }

    @Test
    void tara双向齐全() {
        Map<String, List<String>> secReqs = Map.of("sec1", List.of("t1"));
        RequirementEngine.TaraResult r = RequirementEngine.taraBidirectional(secReqs, Set.of("sec1:t1"));
        assertTrue(r.complete);
    }

    @Test
    void 标识批量生成() {
        RequirementEngine.IdGenResult r = RequirementEngine.generateRequirementIds("REQ", 1, 1000, 4);
        assertEquals(1000, r.ids.size());
        assertTrue(r.unique);
        assertTrue(r.compliant);
        assertEquals("REQ-0001", r.ids.get(0));
        assertEquals("REQ-1000", r.ids.get(999));
    }

    @Test
    void 安全评审缺安全经理() {
        RequirementEngine.ReviewResult r = RequirementEngine.reviewSafetyRequirement(
            "A", List.of("B"), "");
        assertFalse(r.pass);
        assertTrue(r.reason.contains("安全经理"));
    }

    @Test
    void 单人批准被拒() {
        RequirementEngine.ReviewResult r = RequirementEngine.reviewSafetyRequirement(
            "A", List.of("A"), "A");
        assertFalse(r.pass);
        assertTrue(r.reason.contains("单人批准被拒"));
    }

    @Test
    void 多评审人通过() {
        RequirementEngine.ReviewResult r = RequirementEngine.reviewSafetyRequirement(
            "A", List.of("B", "SM"), "SM");
        assertTrue(r.pass);
    }

    @Test
    void 需求废弃审批() {
        RequirementEngine.AbandonResult noApprover = RequirementEngine.abandonRequirement("", "不再需要");
        assertFalse(noApprover.allowed);
        assertTrue(noApprover.reason.contains("无审批"));
        assertTrue(noApprover.historyRetained);

        RequirementEngine.AbandonResult ok = RequirementEngine.abandonRequirement("张总", "需求取消");
        assertTrue(ok.allowed);
        assertTrue(ok.historyRetained);
    }

    @Test
    void 逐行diff() {
        RequirementEngine.DiffResult r = RequirementEngine.diffLines("a\nb\nc", "a\nc\nd");
        assertEquals(List.of("b"), r.removed);
        assertEquals(List.of("d"), r.added);
        assertTrue(r.unchanged.contains("a"));
    }
}
