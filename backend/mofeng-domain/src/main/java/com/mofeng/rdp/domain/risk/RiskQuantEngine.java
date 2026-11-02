package com.mofeng.rdp.domain.risk;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 风险量化基础引擎（SRS 11.10 / RQA-001、RQA-005、RQA-011）。
 *
 * <p>三点估算（PERT）、风险关联、留痕与复算。不含蒙特卡洛模拟（simulation/contingency）。
 * 与前端 TS 引擎 {@code app/src/domain/riskQuant.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class RiskQuantEngine {

    private RiskQuantEngine() {
    }

    /** 三点估算输入。 */
    public static final class ThreePoint {
        private final Double optimistic;   // null = 缺失
        private final Double mostLikely;
        private final Double pessimistic;

        public ThreePoint(Double optimistic, Double mostLikely, Double pessimistic) {
            this.optimistic = optimistic;
            this.mostLikely = mostLikely;
            this.pessimistic = pessimistic;
        }

        public Double optimistic() { return optimistic; }
        public Double mostLikely() { return mostLikely; }
        public Double pessimistic() { return pessimistic; }
    }

    /** PERT 结果。 */
    public static final class PertResult {
        private final double expected;
        private final double stdDev;
        private final boolean complete;
        private final List<String> missing;

        PertResult(double expected, double stdDev, boolean complete, List<String> missing) {
            this.expected = expected;
            this.stdDev = stdDev;
            this.complete = complete;
            this.missing = List.copyOf(missing);
        }

        public double expected() { return expected; }
        public double stdDev() { return stdDev; }
        public boolean complete() { return complete; }
        public List<String> missing() { return missing; }
    }

    private static double r2(double n) {
        return Math.round(n * 100.0) / 100.0;
    }

    /** PERT 期望 = (O + 4M + P) / 6，标准差 = (P − O) / 6。 */
    public static PertResult pert(ThreePoint tp) {
        List<String> missing = new ArrayList<>();
        if (tp.optimistic() == null || tp.optimistic() <= 0) missing.add("乐观");
        if (tp.mostLikely() == null || tp.mostLikely() <= 0) missing.add("最可能");
        if (tp.pessimistic() == null || tp.pessimistic() <= 0) missing.add("悲观");
        if (!missing.isEmpty()) {
            return new PertResult(0, 0, false, missing);
        }
        double expected = r2((tp.optimistic() + 4 * tp.mostLikely() + tp.pessimistic()) / 6.0);
        double stdDev = r2((tp.pessimistic() - tp.optimistic()) / 6.0);
        return new PertResult(expected, stdDev, true, missing);
    }

    /** 三点估算齐全才允许进入定量分析。 */
    public static boolean canQuantify(ThreePoint tp) {
        return pert(tp).complete();
    }

    /** 风险关联。 */
    public static final class RiskLink {
        private final String riskId;
        private final String activityId;
        private final String costItemId;

        public RiskLink(String riskId, String activityId, String costItemId) {
            this.riskId = riskId;
            this.activityId = activityId;
            this.costItemId = costItemId;
        }

        public String riskId() { return riskId; }
        public String activityId() { return activityId; }
        public String costItemId() { return costItemId; }
    }

    /** 判定风险是否已关联（活动或成本项至少关联其一）。 */
    public static boolean isRiskLinked(RiskLink link) {
        if (link == null) return false;
        return isNotBlank(link.activityId()) || isNotBlank(link.costItemId());
    }

    /** 高 RPN 关联率。 */
    public static final class Linkage {
        private final int total;
        private final int linked;
        private final double rate;
        private final List<RiskEngine.Risk> unlinked;

        Linkage(int total, int linked, double rate, List<RiskEngine.Risk> unlinked) {
            this.total = total;
            this.linked = linked;
            this.rate = rate;
            this.unlinked = List.copyOf(unlinked);
        }

        public int total() { return total; }
        public int linked() { return linked; }
        public double rate() { return rate; }
        public List<RiskEngine.Risk> unlinked() { return unlinked; }
    }

    /** 高 RPN（≥200）风险关联率：高 RPN 风险必须 100% 关联。 */
    public static Linkage highRpnLinkage(List<RiskEngine.Risk> risks, Map<String, RiskLink> links) {
        List<RiskEngine.Risk> high = new ArrayList<>();
        for (RiskEngine.Risk r : risks) {
            if (r.severity() * r.occurrence() * r.detection() >= 200) high.add(r);
        }
        List<RiskEngine.Risk> unlinked = new ArrayList<>();
        for (RiskEngine.Risk r : high) {
            if (!isRiskLinked(links.get(r.id()))) unlinked.add(r);
        }
        int linked = high.size() - unlinked.size();
        double rate = high.isEmpty() ? 100 : r2((linked / (double) high.size()) * 100);
        return new Linkage(high.size(), linked, rate, unlinked);
    }

    /** 过滤结果。 */
    public static final class Filtered {
        private final List<LinkedRisk> included;
        private final List<RiskEngine.Risk> excluded;

        Filtered(List<LinkedRisk> included, List<RiskEngine.Risk> excluded) {
            this.included = List.copyOf(included);
            this.excluded = List.copyOf(excluded);
        }

        public List<LinkedRisk> included() { return included; }
        public List<RiskEngine.Risk> excluded() { return excluded; }
    }

    /** 已关联的风险 + 关联。 */
    public static final class LinkedRisk {
        private final RiskEngine.Risk risk;
        private final RiskLink link;

        LinkedRisk(RiskEngine.Risk risk, RiskLink link) {
            this.risk = risk;
            this.link = link;
        }

        public RiskEngine.Risk risk() { return risk; }
        public RiskLink link() { return link; }
    }

    /** 模拟输入过滤：未关联的风险被排除。 */
    public static Filtered filterLinkedRisks(List<RiskEngine.Risk> risks, Map<String, RiskLink> links) {
        List<LinkedRisk> included = new ArrayList<>();
        List<RiskEngine.Risk> excluded = new ArrayList<>();
        for (RiskEngine.Risk r : risks) {
            RiskLink link = links.get(r.id());
            if (isRiskLinked(link)) {
                included.add(new LinkedRisk(r, link));
            } else {
                excluded.add(r);
            }
        }
        return new Filtered(included, excluded);
    }

    /** 模型版本（复算同版本须一致）。 */
    public static final String QUANT_MODEL_VERSION = "RQA-2026.11.1";

    /** 确定性伪随机数生成器（可复现：同 seed 同序列）。 */
    public static final class SeededRandom {
        private long s;

        public SeededRandom(long seed) {
            this.s = seed & 0xffffffffL;
        }

        public double next() {
            s = (s * 1664525L + 1013904223L) & 0xffffffffL;
            return s / 4294967296.0;
        }
    }

    /** 输入快照：对输入序列做稳定哈希（复算一致性锚点）。 */
    public static String snapshotHash(List<Object> inputs) {
        String stable = com.mofeng.rdp.domain.HashUtil.stableStringify(inputs);
        long hash = 0x811c9dc5L;
        for (int i = 0; i < stable.length(); i++) {
            hash ^= stable.charAt(i);
            hash = Math.multiplyExact(hash & 0xffffffffL, 0x01000193L) & 0xffffffffL;
        }
        return String.format("%08x", hash);
    }

    /** 复算校验：同版本、同快照、同种子，结果应一致。 */
    public static boolean verifyReproducibility(Meta a, Meta b) {
        return a.version().equals(b.version()) && a.snapshot().equals(b.snapshot()) && a.seed() == b.seed();
    }

    /** 复算元信息。 */
    public static final class Meta {
        private final String version;
        private final String snapshot;
        private final long seed;

        public Meta(String version, String snapshot, long seed) {
            this.version = version;
            this.snapshot = snapshot;
            this.seed = seed;
        }

        public String version() { return version; }
        public String snapshot() { return snapshot; }
        public long seed() { return seed; }
    }

    private static boolean isNotBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
