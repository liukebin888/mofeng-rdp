package com.mofeng.rdp.domain.event;

import com.mofeng.rdp.domain.HashUtil;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/**
 * 领域事件（SRS 12.3 / ARC-003：跨模块事务仅经领域事件或补偿）。
 *
 * <p>不可变事件对象，携带事件头（id/类型/发生时间/租户/幂等键/溯源链）与载荷。
 * 事件 id 由载荷 + 幂等键确定性派生（SHA-256），保证「同一业务事实」只产生「同一事件」，
 * 从而支撑消费端幂等去重。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class DomainEvent {

    /** 事件类型集合（领域事件白名单，ARC-003）。 */
    public enum Type {
        // 需求与追溯
        REQUIREMENT_CREATED, REQUIREMENT_FROZEN, REQUIREMENT_DEPRECATED,
        // 基线
        BASELINE_FROZEN, BASELINE_BROKEN,
        // 变更
        CHANGE_SUBMITTED, CHANGE_APPROVED, CHANGE_CLOSED,
        // 门禁
        GATE_PASSED, GATE_BLOCKED,
        // 供应链
        SAMPLE_SHIPPED, SUPPLIER_QUALIFIED, DEFECT_CLOSED,
        // 审计（事件溯源锚点）
        AUDIT_APPENDED
    }

    /** 事件头。 */
    public static final class Header {
        private final String eventId;
        private final String eventType;
        private final String occurredAt;
        private final String tenantId;
        private final String aggregateType;
        private final String aggregateId;
        private final String idempotencyKey;
        private final String causationId;   // 溯源：触发本事件的上游事件 id（首事件为 ZERO_HASH）
        private final String correlationId; // 关联：同一业务线程的事件链 id

        Header(String eventId, String eventType, String occurredAt, String tenantId,
               String aggregateType, String aggregateId, String idempotencyKey,
               String causationId, String correlationId) {
            this.eventId = eventId;
            this.eventType = eventType;
            this.occurredAt = occurredAt;
            this.tenantId = tenantId;
            this.aggregateType = aggregateType;
            this.aggregateId = aggregateId;
            this.idempotencyKey = idempotencyKey;
            this.causationId = causationId;
            this.correlationId = correlationId;
        }

        public String eventId() { return eventId; }
        public String eventType() { return eventType; }
        public String occurredAt() { return occurredAt; }
        public String tenantId() { return tenantId; }
        public String aggregateType() { return aggregateType; }
        public String aggregateId() { return aggregateId; }
        public String idempotencyKey() { return idempotencyKey; }
        public String causationId() { return causationId; }
        public String correlationId() { return correlationId; }
    }

    private final Header header;
    private final Map<String, Object> payload;

    private DomainEvent(Header header, Map<String, Object> payload) {
        this.header = header;
        this.payload = payload;
    }

    public Header header() { return header; }
    public Map<String, Object> payload() { return payload; }

    /** 事件载荷规范化哈希（确定性，用于溯源链校验）。 */
    public static String payloadHash(Map<String, Object> payload) {
        return HashUtil.hashOf(new TreeMap<>(payload));
    }

    /** 确定性事件 id（幂等键 + 聚合 + 类型 + 载荷），同事实同 id。 */
    public static String eventId(String eventType, String aggregateId,
                                 String idempotencyKey, Map<String, Object> payload) {
        Map<String, Object> seed = new TreeMap<>();
        seed.put("type", eventType);
        seed.put("aggregateId", aggregateId);
        seed.put("idempotency", idempotencyKey);
        seed.put("payload", new TreeMap<>(payload));
        return HashUtil.hashOf(seed);
    }

    /**
     * 事件工厂（领域层唯一事件构造入口，保证头字段一致性与确定性 id）。
     *
     * @param causationId 上游事件 id；首事件传 {@link HashUtil#ZERO_HASH}
     */
    public static DomainEvent of(Type type, String occurredAt, String tenantId,
                                 String aggregateType, String aggregateId,
                                 String idempotencyKey, String causationId,
                                 String correlationId, Map<String, Object> payload) {
        String id = eventId(type.name(), aggregateId, idempotencyKey, payload);
        Header h = new Header(id, type.name(), occurredAt, tenantId, aggregateType,
            aggregateId, idempotencyKey, causationId, correlationId);
        return new DomainEvent(h, new LinkedHashMap<>(payload));
    }

    /** 快照为可序列化 Map（基础设施层投递时使用）。 */
    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("eventId", header.eventId());
        m.put("eventType", header.eventType());
        m.put("occurredAt", header.occurredAt());
        m.put("tenantId", header.tenantId());
        m.put("aggregateType", header.aggregateType());
        m.put("aggregateId", header.aggregateId());
        m.put("idempotencyKey", header.idempotencyKey());
        m.put("causationId", header.causationId());
        m.put("correlationId", header.correlationId());
        m.put("payload", new LinkedHashMap<>(payload));
        return m;
    }
}
