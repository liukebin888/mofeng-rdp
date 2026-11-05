package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertPolicyRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 四级计划告警阈值项目级覆盖编排测试（PLN-ALERT 阈值覆盖，方向 4 第 2 项）。
 *
 * <p>验证阈值收紧校验（R-08）服务端权威：合法覆盖落库、放宽类覆盖被拒（fail-closed），
 * 不依赖真实数据库（内存 stub）。</p>
 */
class PlanAlertPolicyApplicationServiceTest {

    private static final class StubPlanAlertPolicyRepository implements PlanAlertPolicyRepository {
        PlanAlertEngine.Threshold override;
        Integer savedRemind;
        Integer savedWarn;
        Integer savedAlarm;

        @Override public PlanAlertEngine.Threshold findOverride(String tenantId, String projectId) {
            return override;
        }

        @Override public void saveOverride(String tenantId, String projectId, Integer remindDays,
                                           Integer warnDays, Integer alarmDays) {
            this.savedRemind = remindDays;
            this.savedWarn = warnDays;
            this.savedAlarm = alarmDays;
        }
    }

    private PlanAlertPolicyApplicationService svc(StubPlanAlertPolicyRepository repo) {
        return new PlanAlertPolicyApplicationService(repo);
    }

    private PlanAlertPolicyRequest req(Integer remind, Integer warn, Integer alarm) {
        PlanAlertPolicyRequest r = new PlanAlertPolicyRequest();
        r.setTenantId("t1");
        r.setProjectId("P1");
        r.setRemindDays(remind);
        r.setWarnDays(warn);
        r.setAlarmDays(alarm);
        return r;
    }

    @Test
    void 无覆盖时回落基线阈值() {
        StubPlanAlertPolicyRepository repo = new StubPlanAlertPolicyRepository();
        PlanAlertPolicyResult r = svc(repo).get("t1", "P1");

        assertEquals(7, r.getRemindDays());
        assertEquals(3, r.getWarnDays());
        assertEquals(1, r.getAlarmDays());
        assertEquals(7, r.getPrrDays());
        assertFalse(r.isOverridden());
    }

    @Test
    void 合法覆盖落库并收紧提醒窗口() {
        StubPlanAlertPolicyRepository repo = new StubPlanAlertPolicyRepository();
        PlanAlertPolicyApplicationService.PolicySaveResult r = svc(repo).save(req(5, 3, 1));

        assertTrue(r.isValid());
        assertEquals(5, r.getRemindDays());
        assertEquals(5, repo.savedRemind);
        assertEquals(3, repo.savedWarn);
        assertEquals(1, repo.savedAlarm);
    }

    @Test
    void 放宽报警天数被拒绝() {
        StubPlanAlertPolicyRepository repo = new StubPlanAlertPolicyRepository();
        // alarmDays=2 > 默认 1 → R-08 拒绝（只允许收紧）
        PlanAlertPolicyApplicationService.PolicySaveResult r = svc(repo).save(req(7, 3, 2));

        assertFalse(r.isValid());
        assertNotNull(r.getMessage());
        assertNull(repo.savedRemind);          // 未落库（fail-closed）
    }

    @Test
    void 预警天数大于提醒天数被拒绝() {
        StubPlanAlertPolicyRepository repo = new StubPlanAlertPolicyRepository();
        // warnDays=8 > remindDays=5 → R-08 拒绝
        PlanAlertPolicyApplicationService.PolicySaveResult r = svc(repo).save(req(5, 8, 1));

        assertFalse(r.isValid());
        assertNull(repo.savedRemind);
    }
}
