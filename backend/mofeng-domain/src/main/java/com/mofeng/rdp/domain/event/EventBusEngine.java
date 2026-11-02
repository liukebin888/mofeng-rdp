package com.mofeng.rdp.domain.event;

import com.mofeng.rdp.domain.HashUtil;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 事件总线引擎（SRS 12.3 / ARC-003：跨模块事务仅经领域事件或补偿）。
 *
 * <p>事件溯源 + 消费端幂等 + 跨域最终一致的领域判定权威。
 * 与前端 TS 引擎 {@code app/src/domain/eventBus.ts} 语义同构。</p>
 *
 * <p>职责边界（ARC-001）：本引擎只做「事件是否已处理 / 溯源链是否连续 / 事件是否符合白名单」
 * 的纯函数判定，不做实际投递（那是基础设施层 Kafka 适配器的事）。</p>
 */
public final class EventBusEngine {

    private EventBusEngine() {
    }

    /** 事件溯源链校验结果。 */
    public static final class CausalResult {
        private final boolean continuous;
        private final String brokenAt;   // 断裂处事件 id（连续时为 null）
        private final int checked;

        CausalResult(boolean continuous, String brokenAt, int checked) {
            this.continuous = continuous;
            this.brokenAt = brokenAt;
            this.checked = checked;
        }

        public boolean continuous() { return continuous; }
        public String brokenAt() { return brokenAt; }
        public int checked() { return checked; }
    }

    /** 幂等去重结果。 */
    public static final class IdempotencyVerdict {
        private final boolean duplicate;
        private final String reason;

        IdempotencyVerdict(boolean duplicate, String reason) {
            this.duplicate = duplicate;
            this.reason = reason;
        }

        public boolean duplicate() { return duplicate; }
        public String reason() { return reason; }
    }

    /** 事件白名单校验（ARC-003：未登记事件类型拒绝投递）。 */
    public static boolean isRegistered(String eventType) {
        for (DomainEvent.Type t : DomainEvent.Type.values()) {
            if (t.name().equals(eventType)) return true;
        }
        return false;
    }

    /**
     * 消费端幂等判定（至少一次投递下的去重）。
     *
     * <p>判据：同一 eventId（确定性 id，同事实同 id）只处理一次。
     * 已处理集合命中即视为重复，跳过处理——保证「至少一次投递 + 消费端幂等」。</p>
     */
    public static IdempotencyVerdict checkIdempotency(Set<String> processedEventIds, String eventId) {
        if (eventId == null || eventId.isBlank()) {
            return new IdempotencyVerdict(false, "missing eventId");
        }
        if (processedEventIds.contains(eventId)) {
            return new IdempotencyVerdict(true, "duplicate event (at-least-once redelivery)");
        }
        return new IdempotencyVerdict(false, null);
    }

    /**
     * 事件溯源链校验（causation 链连续性）。
     *
     * <p>每事件的 causationId 必须等于链上前一事件的 eventId；首事件 causationId 为 ZERO_HASH。
     * 链不连续即判断链——用于发现「丢失事件」或「乱序投递」。</p>
     */
    public static CausalResult verifyCausalChain(List<DomainEvent> events) {
        String expectPrev = HashUtil.ZERO_HASH;
        for (int i = 0; i < events.size(); i++) {
            DomainEvent e = events.get(i);
            if (!e.header().causationId().equals(expectPrev)) {
                return new CausalResult(false, e.header().eventId(), i + 1);
            }
            expectPrev = e.header().eventId();
        }
        return new CausalResult(true, null, events.size());
    }

    /** 事件溯源链快照：从事件列表提取 (eventId, causationId) 序列，供落库/审计。 */
    public static List<String> causalChain(List<DomainEvent> events) {
        List<String> chain = new ArrayList<>();
        for (DomainEvent e : events) {
            chain.add(e.header().eventId());
        }
        return chain;
    }

    /**
     * 重放判定：按因果关系给一组乱序事件排序（拓扑：causationId → eventId）。
     *
     * <p>返回稳定有序序列；若存在悬空 causationId（无对应源事件且非 ZERO_HASH），
     * 该事件被标记为 orphan（无法定序），置于末尾并保留——由调用方决定补偿或告警。</p>
     */
    public static List<DomainEvent> orderByCausation(List<DomainEvent> events) {
        Set<String> ids = new HashSet<>();
        for (DomainEvent e : events) ids.add(e.header().eventId());

        List<DomainEvent> ordered = new ArrayList<>();
        List<DomainEvent> orphans = new ArrayList<>();
        Set<String> placed = new HashSet<>();

        // 反复取「causation 已就位或首事件」者，直至稳定
        boolean progressed = true;
        while (progressed) {
            progressed = false;
            for (DomainEvent e : events) {
                if (placed.contains(e.header().eventId())) continue;
                String c = e.header().causationId();
                boolean isFirst = c.equals(HashUtil.ZERO_HASH);
                boolean causePlaced = placed.contains(c);
                boolean causeInSet = ids.contains(c);
                if (isFirst || causePlaced || !causeInSet) {
                    ordered.add(e);
                    placed.add(e.header().eventId());
                    progressed = true;
                }
            }
        }
        // 剩余即循环/悬空引用 → 归入 orphan（保序）
        for (DomainEvent e : events) {
            if (!placed.contains(e.header().eventId())) {
                orphans.add(e);
            }
        }
        ordered.addAll(orphans);
        return ordered;
    }
}
