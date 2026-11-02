package com.mofeng.rdp.domain.project;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 项目控制判据引擎（PRJ-002/004/012、TEN-014）。
 *
 * 编码唯一性 + 8 字段必填、任务依赖循环检测、交付物缺件阻断、多币种汇率快照。
 *
 * 迁移自 app/src/domain/projectControl.ts，同一套测试用例验收。
 */
public final class ProjectControlEngine {

    private ProjectControlEngine() {
    }

    // ------------------------------------------------------------------
    // PRJ-002 编码唯一性 + 必填字段
    // ------------------------------------------------------------------

    public static final List<String> PROJECT_REQUIRED_FIELDS =
        List.of("code", "name", "customer", "productLine", "owner", "start", "end", "budget");

    public static final class ProjectCodeResult {
        public final boolean ok;
        public final String reason;
        public final List<String> missingFields;

        ProjectCodeResult(boolean ok, String reason, List<String> missingFields) {
            this.ok = ok;
            this.reason = reason;
            this.missingFields = missingFields;
        }
    }

    public static ProjectCodeResult validateProjectCode(
            String code, List<String> existingCodes, Map<String, Object> fields) {
        if (existingCodes.contains(code)) {
            return new ProjectCodeResult(false, "编码 " + code + " 重复被拒（PRJ-002）", new ArrayList<>());
        }
        List<String> missingFields = new ArrayList<>();
        for (String f : PROJECT_REQUIRED_FIELDS) {
            Object v = fields.get(f);
            if (v == null || "".equals(v)) missingFields.add(f);
        }
        if (!missingFields.isEmpty()) {
            return new ProjectCodeResult(false, "必填字段缺 " + missingFields.size() + " 项（PRJ-002）", missingFields);
        }
        return new ProjectCodeResult(true, "编码唯一且必填齐全", new ArrayList<>());
    }

    // ------------------------------------------------------------------
    // PRJ-004 任务依赖循环检测
    // ------------------------------------------------------------------

    public static final class Dep {
        public final String predId;

        public Dep(String predId) {
            this.predId = predId;
        }
    }

    public static final class Node {
        public final String id;
        public final List<Dep> deps;

        public Node(String id, List<Dep> deps) {
            this.id = id;
            this.deps = deps;
        }
    }

    public static final class CycleResult {
        public final boolean hasCycle;
        public final List<String> cycleNodes;

        CycleResult(boolean hasCycle, List<String> cycleNodes) {
            this.hasCycle = hasCycle;
            this.cycleNodes = cycleNodes;
        }
    }

    public static CycleResult detectDependencyCycle(List<Node> nodes) {
        Map<String, Node> byId = new java.util.HashMap<>();
        for (Node n : nodes) byId.put(n.id, n);
        Map<String, Integer> color = new java.util.HashMap<>();
        List<String> cycleNodes = new ArrayList<>();
        for (Node n : nodes) {
            if (!color.containsKey(n.id)) {
                List<String> stack = new ArrayList<>();
                if (visit(n.id, byId, color, stack, cycleNodes)) break;
            }
        }
        return new CycleResult(!cycleNodes.isEmpty(), cycleNodes);
    }

    private static boolean visit(String id, Map<String, Node> byId, Map<String, Integer> color,
                                 List<String> stack, List<String> cycleNodes) {
        color.put(id, 1); // GRAY
        stack.add(id);
        Node node = byId.get(id);
        if (node != null) {
            for (Dep dep : node.deps) {
                String pred = dep.predId;
                Integer c = color.getOrDefault(pred, 0);
                if (c == 1) {
                    int idx = stack.indexOf(pred);
                    if (idx >= 0) {
                        cycleNodes.addAll(stack.subList(idx, stack.size()));
                    }
                    return true;
                }
                if (c == 0 && visit(pred, byId, color, stack, cycleNodes)) return true;
            }
        }
        stack.remove(stack.size() - 1);
        color.put(id, 2); // BLACK
        return false;
    }

    // ------------------------------------------------------------------
    // PRJ-012 交付物缺件阻断
    // ------------------------------------------------------------------

    public static final class Deliverable {
        public final String id;
        public final String gate;
        public final boolean required;
        public final boolean provided;

        public Deliverable(String id, String gate, boolean required, boolean provided) {
            this.id = id;
            this.gate = gate;
            this.required = required;
            this.provided = provided;
        }
    }

    public static final class DeliverableBlock {
        public final boolean blocked;
        public final List<Deliverable> missingRequired;
        public final String reason;

        DeliverableBlock(boolean blocked, List<Deliverable> missingRequired, String reason) {
            this.blocked = blocked;
            this.missingRequired = missingRequired;
            this.reason = reason;
        }
    }

    public static DeliverableBlock gateSubmitBlocked(List<Deliverable> deliverables, String gate) {
        List<Deliverable> missingRequired = new ArrayList<>();
        for (Deliverable d : deliverables) {
            if (gate.equals(d.gate) && d.required && !d.provided) missingRequired.add(d);
        }
        if (!missingRequired.isEmpty()) {
            return new DeliverableBlock(true, missingRequired,
                "Gate " + gate + " 缺 " + missingRequired.size() + " 项必交交付物，提交被拒（PRJ-012）");
        }
        return new DeliverableBlock(false, new ArrayList<>(), "交付物齐备");
    }

    // ------------------------------------------------------------------
    // TEN-014 多币种汇率快照
    // ------------------------------------------------------------------

    public static final class ExchangeRateSnapshot {
        public final String id;
        public final String from;
        public final String to;
        public final double rate;
        public final String effectiveDate;

        public ExchangeRateSnapshot(String id, String from, String to, double rate, String effectiveDate) {
            this.id = id;
            this.from = from;
            this.to = to;
            this.rate = rate;
            this.effectiveDate = effectiveDate;
        }
    }

    public static final class ConvertResult {
        public final double amount;
        public final double rate;
        public final String rateId;
        public final boolean usedHistorical;
        public final String note;
        public final String error;

        ConvertResult(double amount, double rate, String rateId, boolean usedHistorical, String note, String error) {
            this.amount = amount;
            this.rate = rate;
            this.rateId = rateId;
            this.usedHistorical = usedHistorical;
            this.note = note;
            this.error = error;
        }

        public static ConvertResult error(String error) {
            return new ConvertResult(0, 0, null, false, null, error);
        }
    }

    public static ConvertResult convertWithSnapshot(
            List<ExchangeRateSnapshot> snapshots, String from, String to, double amount, String tradeDate) {
        List<ExchangeRateSnapshot> candidates = new ArrayList<>();
        for (ExchangeRateSnapshot s : snapshots) {
            if (s.from.equals(from) && s.to.equals(to) && s.effectiveDate.compareTo(tradeDate) <= 0) {
                candidates.add(s);
            }
        }
        candidates.sort((a, b) -> b.effectiveDate.compareTo(a.effectiveDate));
        if (candidates.isEmpty()) {
            return ConvertResult.error("无 " + from + "→" + to + " 在 " + tradeDate + " 或之前的汇率快照");
        }
        ExchangeRateSnapshot snap = candidates.get(0);
        boolean sameDay = false;
        for (ExchangeRateSnapshot s : snapshots) {
            if (s.from.equals(from) && s.to.equals(to) && s.effectiveDate.equals(tradeDate)) {
                sameDay = true;
                break;
            }
        }
        boolean usedHistorical = !sameDay && snap.effectiveDate.compareTo(tradeDate) < 0;
        double amt = Math.round(amount * snap.rate * 100) / 100.0;
        String note = usedHistorical
            ? "使用 " + snap.effectiveDate + " 历史快照折算（TEN-014，历史值不受后续变更影响）"
            : "使用最新快照折算";
        return new ConvertResult(amt, snap.rate, snap.id, usedHistorical, note, null);
    }
}
