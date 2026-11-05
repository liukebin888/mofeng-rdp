package com.mofeng.rdp.application.rule;

import com.mofeng.rdp.infrastructure.persistence.rule.RuleDefinitionEntity;
import com.mofeng.rdp.infrastructure.persistence.rule.RuleDefinitionRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 可配置规则应用服务测试（ARC-006）。
 */
class RuleApplicationServiceTest {

    private static final class StubRuleRepository implements RuleDefinitionRepository {
        final List<RuleDefinitionEntity> saved = new ArrayList<>();

        @Override public void save(RuleDefinitionEntity entity) { saved.add(entity); }

        @Override public List<RuleDefinitionEntity> listByCode(String ruleCode) {
            List<RuleDefinitionEntity> out = new ArrayList<>();
            for (RuleDefinitionEntity e : saved) {
                if (e.getRuleCode().equals(ruleCode)) out.add(e);
            }
            return out;
        }

        @Override public List<RuleDefinitionEntity> listEffective(String ruleType, String todayStr) {
            LocalDate today = LocalDate.parse(todayStr);
            List<RuleDefinitionEntity> out = new ArrayList<>();
            for (RuleDefinitionEntity e : saved) {
                if (!e.getRuleType().equals(ruleType)) continue;
                if (e.getEnabled() == null || e.getEnabled() != 1) continue;
                if (e.getEffectiveFrom() != null && today.isBefore(e.getEffectiveFrom())) continue;
                if (e.getEffectiveTo() != null && today.isAfter(e.getEffectiveTo())) continue;
                out.add(e);
            }
            return out;
        }
    }

    private RuleSaveRequest req(String code, int version, String content,
                                String from, String to, String grayMode) {
        RuleSaveRequest r = new RuleSaveRequest();
        r.setRuleType("GATE");
        r.setRuleCode(code);
        r.setVersion(version);
        r.setContentJson(content);
        r.setEffectiveFrom(from);
        r.setEffectiveTo(to);
        r.setGrayMode(grayMode);
        r.setCreatedBy("pm");
        return r;
    }

    @Test
    void 合法规则版本保存成功并计算快照哈希() {
        StubRuleRepository repo = new StubRuleRepository();
        RuleApplicationService svc = new RuleApplicationService(repo);

        RuleApplicationService.SaveResult r = svc.save(req("GATE_G1", 1, "{\"items\":[]}", "2026-11-01", null, "OFF"));

        assertTrue(r.isValid());
        assertEquals(64, r.getSnapshotHash().length());
        assertEquals(1, repo.saved.size());
    }

    @Test
    void 非法版本号拒绝() {
        StubRuleRepository repo = new StubRuleRepository();
        RuleApplicationService svc = new RuleApplicationService(repo);

        RuleApplicationService.SaveResult r = svc.save(req("GATE_G1", 0, "{}", "2026-11-01", null, "OFF"));

        assertFalse(r.isValid());
        assertEquals(0, repo.saved.size());
    }

    @Test
    void 生效截止早于起始拒绝() {
        StubRuleRepository repo = new StubRuleRepository();
        RuleApplicationService svc = new RuleApplicationService(repo);

        RuleApplicationService.SaveResult r = svc.save(req("GATE_G1", 1, "{}", "2026-11-10", "2026-11-01", "OFF"));

        assertFalse(r.isValid());
        assertEquals(0, repo.saved.size());
    }

    @Test
    void 非法灰度模式拒绝() {
        StubRuleRepository repo = new StubRuleRepository();
        RuleApplicationService svc = new RuleApplicationService(repo);

        RuleApplicationService.SaveResult r = svc.save(req("GATE_G1", 1, "{}", "2026-11-01", null, "BAD"));

        assertFalse(r.isValid());
        assertEquals(0, repo.saved.size());
    }

    @Test
    void 生效规则查询只返回当日启用且生效期内版本() {
        StubRuleRepository repo = new StubRuleRepository();
        RuleApplicationService svc = new RuleApplicationService(repo);

        svc.save(req("GATE_G1", 1, "{\"v\":1}", "2026-11-01", "2026-11-03", "OFF")); // 已过期
        svc.save(req("GATE_G1", 2, "{\"v\":2}", "2026-11-04", null, "OFF"));        // 当日生效
        svc.save(req("GATE_G2", 1, "{\"v\":3}", "2026-11-04", null, "OFF"));        // 其它 code

        List<RuleResult> effective = svc.listEffective("GATE", "2026-11-04");

        assertEquals(2, effective.size()); // GATE_G1 v2 + GATE_G2 v1
        assertTrue(effective.stream().anyMatch(r -> r.getRuleCode().equals("GATE_G1") && r.getVersion() == 2));
    }
}
