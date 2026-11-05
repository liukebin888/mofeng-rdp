package com.mofeng.rdp.domain.plan;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 四级计划告警引擎独立 QA 用例（PLN-ALERT：四段式时点编排）。
 *
 * <p>与方案《四级计划告警统一模板 V1.0》第 4 章语义同构：S1 提醒/S2 预警/S3 报警/S4 抱怨，
 * 阈值收紧（R-08）、幂等键（R-09）、阶段跃迁。</p>
 */
class PlanAlertEngineTest {

    private static final PlanAlertEngine.Threshold BASE = PlanAlertEngine.Threshold.baseline(); // 7/3/1/7

    @Test
    void 距到期8天未到提醒窗口() {
        // dueDate 比 today 晚 8 天 → remain=8 > T_remind 7 → null
        assertNull(PlanAlertEngine.stageOf("2026-12-08", "2026-11-30", BASE));
    }

    @Test
    void 距到期7天触发S1提醒() {
        assertEquals("S1", PlanAlertEngine.stageOf("2026-12-07", "2026-11-30", BASE));
    }

    @Test
    void 距到期3天触发S2预警() {
        assertEquals("S2", PlanAlertEngine.stageOf("2026-12-03", "2026-11-30", BASE));
    }

    @Test
    void 距到期1天仍是S2预警() {
        // remain=1，落在 [0, T_warn=3] 区间 → S2
        assertEquals("S2", PlanAlertEngine.stageOf("2026-12-01", "2026-11-30", BASE));
    }

    @Test
    void 逾期1天触发S3报警() {
        // today 比 dueDate 晚 1 天 → overdue=1 ≥ T_alarm=1 → S3
        assertEquals("S3", PlanAlertEngine.stageOf("2026-11-30", "2026-12-01", BASE));
    }

    @Test
    void 逾期6天仍是S3报警未到PRR() {
        // overdue=6 < T_prr=7 → S3
        assertEquals("S3", PlanAlertEngine.stageOf("2026-11-30", "2026-12-06", BASE));
    }

    @Test
    void 逾期7天触发S4抱怨() {
        // overdue=7 ≥ T_prr=7 → S4
        assertEquals("S4", PlanAlertEngine.stageOf("2026-11-30", "2026-12-07", BASE));
    }

    @Test
    void 级别映射S1NORMAL_S2URGENT_S3S4CRITICAL() {
        assertEquals("NORMAL", PlanAlertEngine.levelOf("S1"));
        assertEquals("URGENT", PlanAlertEngine.levelOf("S2"));
        assertEquals("CRITICAL", PlanAlertEngine.levelOf("S3"));
        assertEquals("CRITICAL", PlanAlertEngine.levelOf("S4"));
    }

    @Test
    void 阈值收紧校验基线合法() {
        PlanAlertEngine.ThresholdVerdict v = PlanAlertEngine.validateThreshold(BASE);
        assertTrue(v.valid);
    }

    @Test
    void 报警阈值放宽被拒绝R08() {
        PlanAlertEngine.Threshold t = new PlanAlertEngine.Threshold(7, 3, 30, 7); // alarm=30 放宽
        PlanAlertEngine.ThresholdVerdict v = PlanAlertEngine.validateThreshold(t);
        assertFalse(v.valid);
        assertTrue(v.message.contains("T_alarm"));
    }

    @Test
    void PRR阈值被锁定不可调() {
        PlanAlertEngine.Threshold t = new PlanAlertEngine.Threshold(7, 3, 1, 10); // prr=10 放宽
        PlanAlertEngine.ThresholdVerdict v = PlanAlertEngine.validateThreshold(t);
        assertFalse(v.valid);
        assertTrue(v.message.contains("T_prr"));
    }

    @Test
    void 预警阈值不得大于提醒阈值() {
        PlanAlertEngine.Threshold t = new PlanAlertEngine.Threshold(3, 7, 1, 7); // warn=7 > remind=3
        PlanAlertEngine.ThresholdVerdict v = PlanAlertEngine.validateThreshold(t);
        assertFalse(v.valid);
        assertTrue(v.message.contains("T_warn"));
    }

    @Test
    void 幂等键同对象同阶段同日期同阈值一致() {
        String k1 = PlanAlertEngine.idempotencyKey("PLAN", "n1", "S3", "2026-11-30", "remind=7,warn=3,alarm=1,prr=7");
        String k2 = PlanAlertEngine.idempotencyKey("PLAN", "n1", "S3", "2026-11-30", "remind=7,warn=3,alarm=1,prr=7");
        assertEquals(k1, k2);
    }

    @Test
    void 幂等键不同日期快照不同() {
        String k1 = PlanAlertEngine.idempotencyKey("PLAN", "n1", "S3", "2026-11-30", "x");
        String k2 = PlanAlertEngine.idempotencyKey("PLAN", "n1", "S3", "2026-12-01", "x");
        assertFalse(k1.equals(k2));
    }

    @Test
    void 逾期7天告警结果标记PRR() {
        PlanAlertEngine.AlertResult r = PlanAlertEngine.alertResult("PLAN", "n1", "2026-11-30", "2026-12-07", BASE);
        assertTrue(r.prrTriggered);
        assertEquals("S4", r.stage);
        assertEquals("CRITICAL", r.level);
    }

    @Test
    void 阶段跃迁补齐未发阶段() {
        // 逾期 7 天 → 当前应命中 S4，已发只有 S3，则补发尚未发的 S1/S2/S4（S3 已发不再补）
        List<String> pending = PlanAlertEngine.pendingStages("2026-11-30", "2026-12-07", BASE, List.of("S3"));
        assertEquals(List.of("S1", "S2", "S4"), pending);
    }

    @Test
    void 阶段跃迁从零补齐全部阶段() {
        List<String> pending = PlanAlertEngine.pendingStages("2026-11-30", "2026-12-07", BASE, List.of());
        assertEquals(List.of("S1", "S2", "S3", "S4"), pending);
    }

    @Test
    void 阈值合并无覆盖回落基线() {
        PlanAlertEngine.Threshold merged = PlanAlertEngine.Threshold.merge(null);
        assertEquals(7, merged.remindDays);
        assertEquals(3, merged.warnDays);
        assertEquals(1, merged.alarmDays);
        assertEquals(7, merged.prrDays);
    }

    @Test
    void 阈值合并覆盖生效且锁定PRR() {
        PlanAlertEngine.Threshold merged = PlanAlertEngine.Threshold.merge(new PlanAlertEngine.Threshold(5, 2, 1, 99));
        assertEquals(5, merged.remindDays);
        assertEquals(2, merged.warnDays);
        assertEquals(1, merged.alarmDays);
        assertEquals(7, merged.prrDays); // prr 锁定 7，覆盖 99 被忽略
    }

    @Test
    void 阈值合并非法覆盖回落基线() {
        // remindDays=0 非法 → 回落基线 7；warnDays=99 非法 → 回落基线 3
        PlanAlertEngine.Threshold merged = PlanAlertEngine.Threshold.merge(new PlanAlertEngine.Threshold(0, 99, 1, 7));
        assertEquals(7, merged.remindDays);
        assertEquals(3, merged.warnDays);
        assertEquals(1, merged.alarmDays);
    }

    @Test
    void PRR单构建幂等键同对象同日一致() {
        PlanAlertEngine.PrrIssue a = PlanAlertEngine.buildPrrIssue("PLAN", "n1", "2026-10-20", "节点A", "责任人");
        PlanAlertEngine.PrrIssue b = PlanAlertEngine.buildPrrIssue("PLAN", "n1", "2026-10-20", "节点A", "责任人");
        assertEquals(a.idempotencyKey, b.idempotencyKey);
        assertEquals(a.code, b.code);
    }

    @Test
    void PRR单不同逾期日幂等键不同() {
        PlanAlertEngine.PrrIssue a = PlanAlertEngine.buildPrrIssue("PLAN", "n1", "2026-10-20", "节点A", "责任人");
        PlanAlertEngine.PrrIssue b = PlanAlertEngine.buildPrrIssue("PLAN", "n1", "2026-10-21", "节点A", "责任人");
        assertNotEquals(a.idempotencyKey, b.idempotencyKey);
    }

    @Test
    void PRR单编号与标题确定性派生() {
        PlanAlertEngine.PrrIssue r = PlanAlertEngine.buildPrrIssue("PLAN", "n1", "2026-10-20", "节点A", "责任人");
        assertEquals("PRR-n1-20261020", r.code);
        assertTrue(r.title.contains("节点A"));
        assertTrue(r.title.contains("2026-10-20"));
        assertEquals("CRITICAL", r.severity);
    }
}
