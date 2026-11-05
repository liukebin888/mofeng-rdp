package com.mofeng.rdp.domain.plan;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 四级计划告警引擎（PLN-ALERT-001~005：四段式时点编排）。
 *
 * <p>依据：四级计划告警统一模板 V1.0 + 项目管理计划四级体系解决方案 V1.0（第 4 章告警机制）。
 * 与前端/方案语义同构，纯函数单一权威，禁止调用方自造时点判定。</p>
 *
 * <p>四段式时点（以节点计划完成日 {@code dueDate} 与当前日期 {@code today} 的差值判定）：</p>
 * <pre>
 *   S1 提醒  0 ≤ dueDate - today ≤ T_remind（默认 7）   NORMAL    责任人
 *   S2 预警  0 ≤ dueDate - today ≤ T_warn （默认 3）   URGENT    责任人 + 直属上级
 *   S3 报警  today - dueDate ≥ T_alarm（默认 1）       CRITICAL  责任人 + 上级 + 部门总监
 *   S4 抱怨  today - dueDate ≥ T_prr  （默认 7，锁定） CRITICAL+PRR 责任人+项目经理+总监+经理
 * </pre>
 *
 * <p>红线（ARC-001 纯对象零框架依赖；R-08 阈值收紧）：</p>
 * <ul>
 *   <li>阈值收紧校验：T_alarm 只允许 ≤ 默认值（1）收紧、T_prr 锁定为 7 不可调；
 *       T_warn 必须 ≤ T_remind。放宽类修改一律拒绝（fail-closed）。</li>
 *   <li>到期日统一走 {@link FourLevelPlanEngine#effectiveDueDate} 口径，禁止各处自取 node_date。</li>
 * </ul>
 */
public final class PlanAlertEngine {

    private PlanAlertEngine() {
    }

    /** 四段式阶段。 */
    public static final String S1_REMIND = "S1";
    public static final String S2_WARN = "S2";
    public static final String S3_ALARM = "S3";
    public static final String S4_PRR = "S4";

    /** 告警级别。 */
    public static final String NORMAL = "NORMAL";
    public static final String URGENT = "URGENT";
    public static final String CRITICAL = "CRITICAL";

    /** 系统基线阈值（不可逾越的默认值）。 */
    public static final int DEFAULT_REMIND_DAYS = 7;
    public static final int DEFAULT_WARN_DAYS = 3;
    public static final int DEFAULT_ALARM_DAYS = 1;
    public static final int DEFAULT_PRR_DAYS = 7;

    /** 告警阈值（全局默认 + 项目级覆盖后生效）。 */
    public static final class Threshold {
        public final int remindDays;
        public final int warnDays;
        public final int alarmDays;
        public final int prrDays;

        public Threshold(int remindDays, int warnDays, int alarmDays, int prrDays) {
            this.remindDays = remindDays;
            this.warnDays = warnDays;
            this.alarmDays = alarmDays;
            this.prrDays = prrDays;
        }

        /** 系统基线阈值（7/3/1/7）。 */
        public static Threshold baseline() {
            return new Threshold(DEFAULT_REMIND_DAYS, DEFAULT_WARN_DAYS, DEFAULT_ALARM_DAYS, DEFAULT_PRR_DAYS);
        }

        /**
         * 项目级覆盖与全局基线合并（单一权威，R-08 收紧语义）。
         *
         * <p>null / 非法（≤0 或超出合法域）的覆盖项回落到基线对应值，保证任一覆盖不破坏
         * 阈值合法域；prrDays 始终回落基线（T_prr 锁定 7 不可调）。合并结果由调用方再经
         * {@link PlanAlertEngine#validateThreshold} 校验（fail-closed）。</p>
         *
         * @param override 项目级覆盖（可为 null 表示无覆盖）
         */
        public static Threshold merge(Threshold override) {
            if (override == null) return baseline();
            int remind = legal(override.remindDays, DEFAULT_REMIND_DAYS);
            int warn = legal(override.warnDays, DEFAULT_WARN_DAYS);
            int alarm = legal(override.alarmDays, DEFAULT_ALARM_DAYS);
            // T_prr 锁定，忽略覆盖
            return new Threshold(remind, warn, alarm, DEFAULT_PRR_DAYS);
        }

        private static int legal(int value, int fallback) {
            return (value >= 1 && value <= 30) ? value : fallback;
        }

        /** 阈值快照（幂等键用），如 "remind=7,warn=3,alarm=1,prr=7"。 */
        public String snapshot() {
            return "remind=" + remindDays + ",warn=" + warnDays + ",alarm=" + alarmDays + ",prr=" + prrDays;
        }
    }

    /** 告警判定结果（单节点单阶段）。 */
    public static final class AlertResult {
        public final String stage;       // S1/S2/S3/S4
        public final String level;       // NORMAL/URGENT/CRITICAL
        public final String objType;     // CUSTOMER_NODE/COMPANY_NODE/PLAN/TASK
        public final String objId;
        public final String dueDateSnapshot;
        public final String thresholdSnapshot;
        public final long remainDays;    // 正值=距到期天数，负值=已逾期天数
        public final boolean prrTriggered; // 是否 S4 需发起 PRR 抱怨单
        public final String idempotencyKey; // 幂等键

        AlertResult(String stage, String level, String objType, String objId,
                    String dueDateSnapshot, String thresholdSnapshot, long remainDays,
                    boolean prrTriggered, String idempotencyKey) {
            this.stage = stage;
            this.level = level;
            this.objType = objType;
            this.objId = objId;
            this.dueDateSnapshot = dueDateSnapshot;
            this.thresholdSnapshot = thresholdSnapshot;
            this.remainDays = remainDays;
            this.prrTriggered = prrTriggered;
            this.idempotencyKey = idempotencyKey;
        }
    }

    /** 阈值收紧校验结果（R-08）。 */
    public static final class ThresholdVerdict {
        public final boolean valid;
        public final String message;

        ThresholdVerdict(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }
    }

    /**
     * PRR 抱怨单（S4 抱怨阶段产物，PLN-ALERT PRR 问题域打通）。
     *
     * <p>由 {@link #buildPrrIssue} 生成，同一「对象 + 逾期日期」只生成一张（幂等键去重）。
     * 编号/接收人/标题均为确定性推导，便于落表后回填告警流水的 {@code prr_issue_id}。</p>
     */
    public static final class PrrIssue {
        public final String idempotencyKey; // 幂等键：objType|objId|dueDate
        public final String code;           // PRR 编号（确定性）
        public final String title;          // 标题（含对象名与逾期天数）
        public final String objType;        // 对象类型
        public final String objId;          // 对象 id
        public final String dueDate;        // 逾期到期日快照
        public final String severity;       // CRITICAL
        public final String receivers;      // 接收人（角色描述）

        PrrIssue(String idempotencyKey, String code, String title, String objType, String objId,
                 String dueDate, String severity, String receivers) {
            this.idempotencyKey = idempotencyKey;
            this.code = code;
            this.title = title;
            this.objType = objType;
            this.objId = objId;
            this.dueDate = dueDate;
            this.severity = severity;
            this.receivers = receivers;
        }
    }

    /**
     * 构建 PRR 抱怨单（S4 阶段单一权威，纯函数）。
     *
     * <p>幂等键 = {@code objType|objId|dueDate}：同一对象同一逾期日只生成一张 PRR 单，
     * 避免 cron 反复巡检重复建单（R-09 延伸）。编号确定性派生自对象与日期，
     * 便于无状态重建。</p>
     *
     * @param nodeName 节点名称（用于标题）
     * @param receivers 接收人（角色描述，由投递通道服务给出）
     */
    public static PrrIssue buildPrrIssue(String objType, String objId, String dueDate,
                                         String nodeName, String receivers) {
        String key = objType + "|" + objId + "|" + (dueDate == null ? "NULL" : dueDate);
        String code = "PRR-" + objId + "-" + (dueDate == null ? "NA" : dueDate.replace("-", ""));
        String name = (nodeName == null || nodeName.isBlank()) ? objId : nodeName;
        String title = "计划节点「" + name + "」逾期未达成，触发 PRR 抱怨单（到期日 " + dueDate + "）";
        return new PrrIssue(key, code, title, objType, objId, dueDate, CRITICAL, receivers);
    }

    /**
     * 阈值收紧校验（R-08，服务端强校验，单一权威）。
     *
     * <ul>
     *   <li>1 ≤ T_remind ≤ 30，可松可紧</li>
     *   <li>1 ≤ T_warn ≤ 30 且 T_warn ≤ T_remind</li>
     *   <li>T_alarm 只允许收紧（≤ 默认值 1，即恒等于 1）</li>
     *   <li>T_prr 锁定为 7 不可调</li>
     * </ul>
     */
    public static ThresholdVerdict validateThreshold(Threshold t) {
        if (t.remindDays < 1 || t.remindDays > 30) {
            return new ThresholdVerdict(false, "T_remind 须在 1~30 之间");
        }
        if (t.warnDays < 1 || t.warnDays > 30) {
            return new ThresholdVerdict(false, "T_warn 须在 1~30 之间");
        }
        if (t.warnDays > t.remindDays) {
            return new ThresholdVerdict(false, "T_warn 不得大于 T_remind");
        }
        if (t.alarmDays > DEFAULT_ALARM_DAYS) {
            return new ThresholdVerdict(false, "T_alarm 只允许收紧（当前默认 " + DEFAULT_ALARM_DAYS + " 天），不得放宽");
        }
        if (t.alarmDays < 1) {
            return new ThresholdVerdict(false, "T_alarm 不得小于 1");
        }
        if (t.prrDays != DEFAULT_PRR_DAYS) {
            return new ThresholdVerdict(false, "T_prr 锁定为 " + DEFAULT_PRR_DAYS + " 天不可调，放宽须走变更审批");
        }
        return new ThresholdVerdict(true, null);
    }

    /**
     * 判定单节点应命中的告警阶段（取最高严重度阶段）。
     *
     * <p>判定口径：remain = dueDate - today（正=未到期，负=已逾期）。</p>
     * <ul>
     *   <li>逾期 ≥ T_prr → S4 抱怨</li>
     *   <li>逾期 ≥ T_alarm → S3 报警</li>
     *   <li>0 ≤ 距到期 ≤ T_warn → S2 预警</li>
     *   <li>0 ≤ 距到期 ≤ T_remind → S1 提醒</li>
     *   <li>其余 → null（未到告警窗口）</li>
     * </ul>
     */
    public static String stageOf(String dueDate, String today, Threshold t) {
        long remain = daysBetween(today, dueDate); // dueDate - today
        long overdue = -remain;                    // 逾期天数 = today - dueDate
        if (overdue >= t.prrDays) return S4_PRR;
        if (overdue >= t.alarmDays) return S3_ALARM;
        if (remain >= 0 && remain <= t.warnDays) return S2_WARN;
        if (remain >= 0 && remain <= t.remindDays) return S1_REMIND;
        return null;
    }

    /** 级别映射：S1→NORMAL、S2→URGENT、S3/S4→CRITICAL。 */
    public static String levelOf(String stage) {
        if (S1_REMIND.equals(stage)) return NORMAL;
        if (S2_WARN.equals(stage)) return URGENT;
        if (S3_ALARM.equals(stage) || S4_PRR.equals(stage)) return CRITICAL;
        return NORMAL;
    }

    /**
     * 幂等键推导（R-09）：同一「对象 + 阶段 + 该阶段判定所依据的日期与阈值」只发一次。
     */
    public static String idempotencyKey(String objType, String objId, String stage,
                                        String dueDateSnapshot, String thresholdSnapshot) {
        return objType + "|" + objId + "|" + stage + "|"
                + (dueDateSnapshot == null ? "NULL" : dueDateSnapshot) + "|"
                + (thresholdSnapshot == null ? "NULL" : thresholdSnapshot);
    }

    /**
     * 构建告警结果（单节点命中某阶段时）。
     */
    public static AlertResult alertResult(String objType, String objId, String dueDate,
                                          String today, Threshold t) {
        String stage = stageOf(dueDate, today, t);
        if (stage == null) return null;
        long remain = daysBetween(today, dueDate);
        boolean prr = S4_PRR.equals(stage);
        return new AlertResult(stage, levelOf(stage), objType, objId, dueDate,
                t.snapshot(), remain, prr,
                idempotencyKey(objType, objId, stage, dueDate, t.snapshot()));
    }

    /** 比较两个 yyyy-MM-dd，返回 dateA - dateB 的天数差（无法解析返回 0）。 */
    private static long daysBetween(String dateA, String dateB) {
        try {
            return ChronoUnit.DAYS.between(LocalDate.parse(dateA), LocalDate.parse(dateB));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    /** 供外部复用的日期差值（today 为基准）。 */
    public static long daysBetweenDates(String today, String dueDate) {
        return daysBetween(today, dueDate);
    }

    // ------------------------------------------------------------------
    // 阶段跃迁（用于 cron 巡检时识别「应发但未发」的新阶段）
    // ------------------------------------------------------------------

    /** 阶段跃迁判定：返回「已发阶段集合」到「当前应命中阶段」的跃迁列表。 */
    public static List<String> pendingStages(String dueDate, String today, Threshold t,
                                             List<String> alreadyFiredStages) {
        String current = stageOf(dueDate, today, t);
        if (current == null) return List.of();
        List<String> out = new ArrayList<>();
        for (String s : allStagesUpTo(current)) {
            if (!contains(alreadyFiredStages, s)) {
                out.add(s);
            }
        }
        return out;
    }

    /** 按严重度升序列出 S1..S4 中不晚于给定阶段的所有阶段。 */
    private static List<String> allStagesUpTo(String stage) {
        List<String> order = List.of(S1_REMIND, S2_WARN, S3_ALARM, S4_PRR);
        List<String> out = new ArrayList<>();
        for (String s : order) {
            out.add(s);
            if (Objects.equals(s, stage)) break;
        }
        return out;
    }

    private static boolean contains(List<String> list, String s) {
        return list != null && list.contains(s);
    }
}
