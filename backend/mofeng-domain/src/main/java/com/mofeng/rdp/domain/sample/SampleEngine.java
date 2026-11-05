package com.mofeng.rdp.domain.sample;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 样件试制与物料引擎（SRS 第 18 章 / FUN-007）。
 *
 * 覆盖 HW-001/002/004/006/008/010/011/012/013/014/015/016（R1 批次）。
 * 落实 P-03「先 BOM 后样件」：样件需求必须挂已发布 EBOM，无 EBOM 不得下达试制。
 *
 * 迁移自 app/src/domain/sample.ts + kitting.ts，同一套测试用例验收。
 */
public final class SampleEngine {

    private SampleEngine() {
    }

    // ------------------------------------------------------------------
    // 常量
    // ------------------------------------------------------------------

    public static final List<String> SAMPLE_TYPES = List.of("A", "B", "C", "OTS");
    public static final List<String> SAMPLE_STATUSES =
        List.of("草稿", "待下达", "试制中", "检验中", "已交付", "已拒收", "已关闭");

    private static final List<String> SAMPLE_REQUIRED_FIELDS =
        List.of("projectId", "code", "type", "qty", "needDate", "ebomVersion");

    // ------------------------------------------------------------------
    // HW-001 样件需求字段齐全率
    // ------------------------------------------------------------------

    public static FieldResult validateSampleOrder(Map<String, Object> order) {
        List<String> missing = new ArrayList<>();
        for (String f : SAMPLE_REQUIRED_FIELDS) {
            Object v = order.get(f);
            if ("qty".equals(f)) {
                if (!(v instanceof Number) || ((Number) v).doubleValue() <= 0) missing.add(f);
            } else if (v == null || "".equals(v)) {
                missing.add(f);
            }
        }
        return new FieldResult(missing.isEmpty(), missing);
    }

    public static final class FieldResult {
        public final boolean ok;
        public final List<String> missing;

        FieldResult(boolean ok, List<String> missing) {
            this.ok = ok;
            this.missing = missing;
        }
    }

    // ------------------------------------------------------------------
    // HW-002 样件状态机（ARC-005：五元组配置表驱动，与前端 SAMPLE_TRANSITIONS 同构）
    // ------------------------------------------------------------------

    /** 状态迁移配置表：from -> (event -> to)。非法迁移在表中无记录，统一拒绝。 */
    private static final Map<String, Map<String, String>> SAMPLE_TRANSITIONS = buildSampleTransitions();

    private static Map<String, Map<String, String>> buildSampleTransitions() {
        Map<String, Map<String, String>> t = new HashMap<>();
        put(t, "草稿", "submit", "待下达");
        put(t, "待下达", "start", "试制中");
        put(t, "待下达", "close", "已关闭");
        put(t, "试制中", "finish", "检验中");
        put(t, "试制中", "rework", "试制中");
        put(t, "检验中", "inspectPass", "已交付");
        put(t, "检验中", "rework", "试制中");
        put(t, "检验中", "reject", "已拒收");
        put(t, "已交付", "close", "已关闭");
        put(t, "已拒收", "rework", "试制中");
        put(t, "已拒收", "close", "已关闭");
        return t;
    }

    private static void put(Map<String, Map<String, String>> t, String from, String event, String to) {
        t.computeIfAbsent(from, k -> new HashMap<>()).put(event, to);
    }

    /** 状态迁移（HW-002），五元组查表执行器；非法迁移返回 reason。 */
    public static Transition transitionSample(String status, String event) {
        Map<String, String> row = SAMPLE_TRANSITIONS.get(status);
        String next = row == null ? null : row.get(event);
        if (next == null) {
            return new Transition(false, null, "状态「" + status + "」不接受事件「" + event + "」");
        }
        return new Transition(true, next, null);
    }

    public static final class Transition {
        public final boolean ok;
        public final String to;
        public final String reason;

        Transition(boolean ok, String to, String reason) {
            this.ok = ok;
            this.to = to;
            this.reason = reason;
        }
    }

    // ------------------------------------------------------------------
    // P-03 先 BOM 后样件 + HW-010 齐套门（K9）
    // ------------------------------------------------------------------

    public static ReleaseResult canReleaseTrial(boolean ebomFrozen, boolean kitBlocked, boolean toolingReady) {
        List<String> blockers = new ArrayList<>();
        if (!ebomFrozen) blockers.add("EBOM 未冻结发布（P-03：先 BOM 后样件）");
        if (kitBlocked) blockers.add("齐套不满足（HW-010 / K9）");
        if (!toolingReady) blockers.add("工装夹具未就绪（HW-012）");
        return new ReleaseResult(blockers.isEmpty(), blockers);
    }

    public static final class ReleaseResult {
        public final boolean ok;
        public final List<String> blockers;

        ReleaseResult(boolean ok, List<String> blockers) {
            this.ok = ok;
            this.blockers = blockers;
        }
    }

    // ------------------------------------------------------------------
    // HW-006 EBOM 冻结
    // ------------------------------------------------------------------

    public static CheckResult canEditEbom(boolean frozen, boolean viaEcr) {
        if (!frozen) return new CheckResult(true, null);
        if (viaEcr) return new CheckResult(true, null);
        return new CheckResult(false, "EBOM 已冻结，须经 ECR 产生新版本方可编辑（HW-006）");
    }

    public static final class CheckResult {
        public final boolean ok;
        public final String reason;

        CheckResult(boolean ok, String reason) {
            this.ok = ok;
            this.reason = reason;
        }
    }

    // ------------------------------------------------------------------
    // HW-008 试制采购与 EBOM 行一一对应
    // ------------------------------------------------------------------

    public static final class TrialPurchaseTask {
        public final String materialCode;
        public final double qty;

        public TrialPurchaseTask(String materialCode, double qty) {
            this.materialCode = materialCode;
            this.qty = qty;
        }
    }

    public static final class BomLine {
        public final String materialCode;
        public final double requiredQty;

        public BomLine(String materialCode, double requiredQty) {
            this.materialCode = materialCode;
            this.requiredQty = requiredQty;
        }
    }

    public static PurchaseResult validateTrialPurchase(List<TrialPurchaseTask> tasks, List<BomLine> bomLines) {
        Map<String, Double> bomMap = new HashMap<>();
        for (BomLine l : bomLines) bomMap.put(l.materialCode, l.requiredQty);
        List<String> matched = new ArrayList<>();
        List<String> unmatched = new ArrayList<>();
        for (TrialPurchaseTask t : tasks) {
            Double required = bomMap.get(t.materialCode);
            if (required == null) {
                unmatched.add(t.materialCode + "（无对应 EBOM 行）");
            } else if (Math.round((t.qty - required) * 1000) / 1000.0 != 0) {
                unmatched.add(t.materialCode + "（任务 " + t.qty + " ≠ EBOM " + required + "）");
            } else {
                matched.add(t.materialCode);
            }
        }
        return new PurchaseResult(unmatched.isEmpty(), unmatched, matched);
    }

    public static final class PurchaseResult {
        public final boolean ok;
        public final List<String> unmatched;
        public final List<String> matched;

        PurchaseResult(boolean ok, List<String> unmatched, List<String> matched) {
            this.ok = ok;
            this.unmatched = unmatched;
            this.matched = matched;
        }
    }

    // ------------------------------------------------------------------
    // HW-012 工装夹具
    // ------------------------------------------------------------------

    public static final class Tooling {
        public final String name;
        public final String status;
        public final List<String> changeLog;

        public Tooling(String name, String status) {
            this(name, status, new ArrayList<>());
        }

        public Tooling(String name, String status, List<String> changeLog) {
            this.name = name;
            this.status = status;
            this.changeLog = changeLog;
        }

        public Tooling withStatus(String newStatus, List<String> newLog) {
            return new Tooling(this.name, newStatus, newLog);
        }
    }

    public static CheckResult canRegisterStart(Tooling tooling) {
        if (!"就绪".equals(tooling.status)) {
            return new CheckResult(false, "工装「" + tooling.name + "」状态为「" + tooling.status + "」，禁止开工登记（HW-012）");
        }
        return new CheckResult(true, null);
    }

    public static final class ToolingChangeResult {
        public final boolean ok;
        public final String reason;
        public final Tooling tooling;

        ToolingChangeResult(boolean ok, String reason, Tooling tooling) {
            this.ok = ok;
            this.reason = reason;
            this.tooling = tooling;
        }
    }

    public static ToolingChangeResult changeToolingStatus(Tooling tooling, String to, String by, String reason) {
        if (reason == null || reason.trim().isEmpty()) {
            return new ToolingChangeResult(false, "工装状态变更必须填写原因（HW-012）", null);
        }
        if (to.equals(tooling.status)) {
            return new ToolingChangeResult(false, "新状态与原状态相同", null);
        }
        List<String> log = new ArrayList<>(tooling.changeLog);
        log.add(by + ":" + tooling.status + "→" + to + ":" + reason);
        return new ToolingChangeResult(true, null, tooling.withStatus(to, log));
    }

    // ------------------------------------------------------------------
    // HW-013 检验登记
    // ------------------------------------------------------------------

    /** 检验登记：不合格自动生成问题单。返回问题单 id（合格为 null）。 */
    public static String problemTicketIdFor(String sampleOrderId, String conclusion) {
        if ("不合格".equals(conclusion)) {
            return "Q-" + sampleOrderId + "-" + System.currentTimeMillis();
        }
        return null;
    }

    // ------------------------------------------------------------------
    // HW-014 不合格闭环
    // ------------------------------------------------------------------

    public static final class Nonconformity {
        public final String id;
        public final String status;

        public Nonconformity(String id, String status) {
            this.id = id;
            this.status = status;
        }
    }

    public static ReleaseResult canReleaseInspection(List<Nonconformity> ncList) {
        List<String> blockers = new ArrayList<>();
        for (Nonconformity n : ncList) {
            if ("未闭环".equals(n.status)) blockers.add(n.id);
        }
        return new ReleaseResult(blockers.isEmpty(), blockers);
    }

    // ------------------------------------------------------------------
    // HW-015 送样确认
    // ------------------------------------------------------------------

    public static CheckResult submitSampleApproval(String verdict, String riskAssessmentId) {
        if ("让步接收".equals(verdict) && (riskAssessmentId == null || riskAssessmentId.isEmpty())) {
            return new CheckResult(false, "让步接收必须关联风险评估单，未关联时提交被拒（HW-015）");
        }
        return new CheckResult(true, null);
    }

    // ------------------------------------------------------------------
    // HW-016 发运签收
    // ------------------------------------------------------------------

    public static CheckResult completeReceipt(
            String orderId, String shipmentOrderId, String receiptShipmentId) {
        if (!shipmentOrderId.equals(orderId)) {
            return new CheckResult(false, "发运单与样件需求不匹配");
        }
        if (!receiptShipmentId.equals(shipmentOrderId)) {
            return new CheckResult(false, "签收单与发运单不匹配");
        }
        return new CheckResult(true, null);
    }

    // ------------------------------------------------------------------
    // HW-004 / HW-010 齐套（复用 kitting.explodeBom / kitRate）
    // ------------------------------------------------------------------

    /** BOM 节点（与 types.BomNode 同构）。 */
    public static final class BomNode {
        public final String materialCode;
        public final String name;
        public final String parentMaterialCode;
        public final double qty;
        public final double stock;
        public final double incoming;

        public BomNode(String materialCode, String name, String parentMaterialCode,
                       double qty, double stock, double incoming) {
            this.materialCode = materialCode;
            this.name = name;
            this.parentMaterialCode = parentMaterialCode;
            this.qty = qty;
            this.stock = stock;
            this.incoming = incoming;
        }
    }

    /** 齐套行（与 kitting.KitLine 同构）。 */
    public static final class KitLine {
        public final String materialCode;
        public final String name;
        public final int level;
        public final double requiredQty;
        public final double available;
        public final double shortage;
        public final boolean ok;

        KitLine(String materialCode, String name, int level, double requiredQty,
                double available, double shortage, boolean ok) {
            this.materialCode = materialCode;
            this.name = name;
            this.level = level;
            this.requiredQty = requiredQty;
            this.available = available;
            this.shortage = shortage;
            this.ok = ok;
        }
    }

    /** 展开 EBOM：自下而上汇总用量（HW-004）。 */
    public static List<KitLine> explodeBom(List<BomNode> bom, double sampleQty) {
        Map<String, BomNode> byCode = new HashMap<>();
        for (BomNode b : bom) byCode.put(b.materialCode, b);
        Map<String, List<BomNode>> children = new HashMap<>();
        for (BomNode b : bom) {
            if (b.parentMaterialCode == null) continue;
            children.computeIfAbsent(b.parentMaterialCode, k -> new ArrayList<>()).add(b);
        }
        List<KitLine> lines = new ArrayList<>();
        for (BomNode root : bom) {
            if (root.parentMaterialCode == null) {
                walkNode(root.materialCode, 1.0, 1, byCode, children, lines, sampleQty);
            }
        }
        return lines;
    }

    private static void walkNode(String code, double mult, int level,
                                 Map<String, BomNode> byCode, Map<String, List<BomNode>> children,
                                 List<KitLine> lines, double sampleQty) {
        BomNode node = byCode.get(code);
        if (node == null) return;
        double requiredQty = Math.round(node.qty * mult * sampleQty * 1000) / 1000.0;
        double available = node.stock + node.incoming;
        lines.add(new KitLine(node.materialCode, node.name, level, requiredQty, available,
            Math.max(0, Math.round((requiredQty - available) * 1000) / 1000.0),
            available >= requiredQty));
        List<BomNode> cs = children.get(code);
        if (cs != null) {
            for (BomNode c : cs) {
                walkNode(c.materialCode, mult * node.qty, level + 1, byCode, children, lines, sampleQty);
            }
        }
    }

    public static final class KitRateResult {
        public final double rate;
        public final boolean blocked;
        public final List<KitLine> shortages;

        KitRateResult(double rate, boolean blocked, List<KitLine> shortages) {
            this.rate = rate;
            this.blocked = blocked;
            this.shortages = shortages;
        }
    }

    public static KitRateResult kitRate(List<KitLine> lines) {
        if (lines.isEmpty()) return new KitRateResult(100, false, new ArrayList<>());
        int okCount = 0;
        List<KitLine> shortages = new ArrayList<>();
        for (KitLine l : lines) {
            if (l.ok) okCount++;
            else shortages.add(l);
        }
        double rate = Math.round((okCount * 1.0 / lines.size()) * 10000) / 100.0;
        return new KitRateResult(rate, !shortages.isEmpty(), shortages);
    }

    /** 齐套校验（HW-010）：不齐套禁止下达试制。 */
    public static final class KittingResult {
        public final boolean ok;
        public final double rate;
        public final List<String> shortages;

        KittingResult(boolean ok, double rate, List<String> shortages) {
            this.ok = ok;
            this.rate = rate;
            this.shortages = shortages;
        }
    }

    public static KittingResult checkKitting(List<BomNode> bom, double sampleQty) {
        List<KitLine> lines = explodeBom(bom, sampleQty);
        KitRateResult r = kitRate(lines);
        List<String> shortages = new ArrayList<>();
        for (KitLine s : r.shortages) {
            shortages.add(s.name + "（缺 " + s.shortage + "）");
        }
        return new KittingResult(!r.blocked, r.rate, shortages);
    }

    /** EBOM 用量汇总（HW-004）。 */
    public static List<KitLine> summarizeBomUsage(List<BomNode> bom, double sampleQty) {
        return explodeBom(bom, sampleQty);
    }
}
