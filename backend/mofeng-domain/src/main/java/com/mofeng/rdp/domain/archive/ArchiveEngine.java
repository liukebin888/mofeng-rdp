package com.mofeng.rdp.domain.archive;

/**
 * 归档引擎（DOC-010 / PRJ-014 / PRJ-021 / DOC-005）。
 *
 * <p>归档领域规则的单一权威来源：</p>
 * <ul>
 *   <li>DOC-010：结项归档后只读，归档后修改被拒</li>
 *   <li>PRJ-014：项目归档前必须「计划已冻结」（planFrozen），否则拒</li>
 *   <li>PRJ-021：解除归档须留审批记录，恢复可写</li>
 *   <li>DOC-005：已作废对象不得归档、不得下载</li>
 * </ul>
 *
 * 纯函数、零框架依赖。迁移自 app/src/domain/docEngine.ts + stateMachine.ts 的归档语义。
 */
public final class ArchiveEngine {

    private ArchiveEngine() {
    }

    /** 归档操作结果。 */
    public static final class Verdict {
        public final boolean ok;
        public final String code; // OK / OBSOLETE / NOT_FROZEN / ALREADY_ARCHIVED
        public final String note;

        Verdict(boolean ok, String code, String note) {
            this.ok = ok;
            this.code = code;
            this.note = note;
        }
    }

    /**
     * 归档判定（DOC-010 + PRJ-014）。
     *
     * @param status        当前状态（策划中/进行中/已归档/已作废）
     * @param planFrozen    计划是否已冻结（项目归档前置，PRJ-014）
     * @param alreadyArchived 是否已归档（幂等校验）
     */
    public static Verdict canArchive(String status, boolean planFrozen, boolean alreadyArchived) {
        if ("已作废".equals(status)) {
            return new Verdict(false, "OBSOLETE", "已作废对象不得归档（DOC-005）");
        }
        if (alreadyArchived || "已归档".equals(status)) {
            return new Verdict(false, "ALREADY_ARCHIVED", "对象已归档，不可重复归档");
        }
        if (!planFrozen) {
            return new Verdict(false, "NOT_FROZEN", "归档前必须计划已冻结（PRJ-014）");
        }
        return new Verdict(true, "OK", "满足归档条件");
    }

    /**
     * 解除归档判定（PRJ-021）：须留审批记录，且仅「已归档」态可解除。
     */
    public static Verdict canUnarchive(String status, boolean hasApproval) {
        if (!"已归档".equals(status)) {
            return new Verdict(false, "NOT_ARCHIVED", "仅已归档对象可解除归档");
        }
        if (!hasApproval) {
            return new Verdict(false, "NO_APPROVAL", "解除归档须留审批记录（PRJ-021）");
        }
        return new Verdict(true, "OK", "可解除归档，恢复可写");
    }

    /** 归档后只读守卫（DOC-010）：已归档对象禁止任何修改。 */
    public static boolean isReadOnly(String status) {
        return "已归档".equals(status);
    }

    /** 作废后禁下载（DOC-005）。 */
    public static boolean canDownload(String status) {
        return !"已作废".equals(status);
    }

    /**
     * 数据保留期限判定（NFR-019 归档策略）：给定归档时间与保留月数，计算到期日。
     * 用于容量规划与归档清理触发，纯函数可测。
     */
    public static String retentionDue(String archivedAt, int retentionMonths) {
        // archivedAt 形如 "2026-11-01"，解析年月，加保留月数后取当月最后一天
        String[] parts = archivedAt.split("-");
        int y = Integer.parseInt(parts[0]);
        int m = Integer.parseInt(parts[1]);
        int total = y * 12 + (m - 1) + retentionMonths;
        int dy = total / 12;
        int dm = total % 12 + 1;
        int lastDay = daysInMonth(dy, dm);
        return String.format("%04d-%02d-%02d", dy, dm, lastDay);
    }

    private static int daysInMonth(int year, int month) {
        switch (month) {
            case 2:
                boolean leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
                return leap ? 29 : 28;
            case 4: case 6: case 9: case 11:
                return 30;
            default:
                return 31;
        }
    }
}
