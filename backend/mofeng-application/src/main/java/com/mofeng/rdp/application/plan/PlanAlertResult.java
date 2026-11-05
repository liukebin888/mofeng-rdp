package com.mofeng.rdp.application.plan;

import java.util.ArrayList;
import java.util.List;

/**
 * 四级计划告警巡检结果（PLN-ALERT 巡检）。
 *
 * <p>聚合一次巡检的中间指标（防「零告警」假阳性）与逐条告警明细：
 * 巡检节点数 / 命中节点数 / 新发告警数 / 幂等跳过数。当 {@code scannedNodes == 0}
 * 时「新发告警数为 0」才有意义，调用方须据此披露而非直接宣称「无告警」。</p>
 */
public class PlanAlertResult {

    private final String projectId;
    private final String today;
    /** 巡检覆盖的计划节点总数。 */
    private final int scannedNodes;
    /** 命中告警窗口的节点数（可能重复跨阶段）。 */
    private final int hitNodes;
    /** 本次新登记的告警流水数（阶段跃迁去重后）。 */
    private final int fired;
    /** 因幂等键已存在而跳过的告警数。 */
    private final int skipped;
    /** 逐条告警明细（阶段/级别/对象/接收人/渠道）。 */
    private final List<AlertItem> items;

    public PlanAlertResult(String projectId, String today, int scannedNodes, int hitNodes,
                           int fired, int skipped, List<AlertItem> items) {
        this.projectId = projectId;
        this.today = today;
        this.scannedNodes = scannedNodes;
        this.hitNodes = hitNodes;
        this.fired = fired;
        this.skipped = skipped;
        this.items = items == null ? List.of() : items;
    }

    /** 单条告警明细。 */
    public static final class AlertItem {
        public final String stage;
        public final String level;
        public final String objType;
        public final String objId;
        public final String planLevel;
        public final String receiverIds;
        public final String channelMask;
        public final long remainDays;
        public final boolean prrTriggered;

        public AlertItem(String stage, String level, String objType, String objId,
                         String planLevel, String receiverIds, String channelMask,
                         long remainDays, boolean prrTriggered) {
            this.stage = stage;
            this.level = level;
            this.objType = objType;
            this.objId = objId;
            this.planLevel = planLevel;
            this.receiverIds = receiverIds;
            this.channelMask = channelMask;
            this.remainDays = remainDays;
            this.prrTriggered = prrTriggered;
        }
    }

    public String getProjectId() { return projectId; }
    public String getToday() { return today; }
    public int getScannedNodes() { return scannedNodes; }
    public int getHitNodes() { return hitNodes; }
    public int getFired() { return fired; }
    public int getSkipped() { return skipped; }
    public List<AlertItem> getItems() { return items; }

    /** 便捷构造：无告警空结果。 */
    public static PlanAlertResult empty(String projectId, String today, int scannedNodes) {
        return new PlanAlertResult(projectId, today, scannedNodes, 0, 0, 0, new ArrayList<>());
    }
}
