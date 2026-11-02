package com.mofeng.rdp.domain.event;

import com.mofeng.rdp.domain.HashUtil;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class EventBusEngineTest {

    private DomainEvent event(String type, String aggregateId, String idemKey,
                              String causationId, Map<String, Object> payload) {
        return DomainEvent.of(DomainEvent.Type.valueOf(type), "2026-11-02T03:00:00Z", "t1",
            "REQUIREMENT", aggregateId, idemKey, causationId, "corr-1", payload);
    }

    @Test
    void 白名单已登记事件类型通过() {
        assertTrue(EventBusEngine.isRegistered("REQUIREMENT_FROZEN"));
        assertTrue(EventBusEngine.isRegistered("GATE_PASSED"));
        assertFalse(EventBusEngine.isRegistered("NON_EXISTENT_TYPE"));
    }

    @Test
    void 同一业务事实派生出同一事件id() {
        DomainEvent a = event("REQUIREMENT_FROZEN", "REQ-1", "freeze-1", HashUtil.ZERO_HASH,
            Map.of("version", "V1"));
        DomainEvent b = event("REQUIREMENT_FROZEN", "REQ-1", "freeze-1", HashUtil.ZERO_HASH,
            Map.of("version", "V1"));
        assertEquals(a.header().eventId(), b.header().eventId());
    }

    @Test
    void 不同幂等键派生出不同事件id() {
        DomainEvent a = event("REQUIREMENT_FROZEN", "REQ-1", "freeze-1", HashUtil.ZERO_HASH,
            Map.of("version", "V1"));
        DomainEvent b = event("REQUIREMENT_FROZEN", "REQ-1", "freeze-2", HashUtil.ZERO_HASH,
            Map.of("version", "V1"));
        assertNotEquals(a.header().eventId(), b.header().eventId());
    }

    @Test
    void 幂等去重同一事件第二次判重() {
        Set<String> processed = new HashSet<>();
        DomainEvent e = event("REQUIREMENT_FROZEN", "REQ-1", "freeze-1", HashUtil.ZERO_HASH,
            Map.of("version", "V1"));
        String id = e.header().eventId();
        assertFalse(EventBusEngine.checkIdempotency(processed, id).duplicate());
        processed.add(id);
        assertTrue(EventBusEngine.checkIdempotency(processed, id).duplicate());
    }

    @Test
    void 溯源链连续判定通过() {
        DomainEvent e1 = event("REQUIREMENT_FROZEN", "REQ-1", "k1", HashUtil.ZERO_HASH, Map.of());
        DomainEvent e2 = event("REQUIREMENT_DEPRECATED", "REQ-1", "k2", e1.header().eventId(), Map.of());
        DomainEvent e3 = event("AUDIT_APPENDED", "REQ-1", "k3", e2.header().eventId(), Map.of());
        assertTrue(EventBusEngine.verifyCausalChain(List.of(e1, e2, e3)).continuous());
    }

    @Test
    void 溯源链断裂判定失败() {
        DomainEvent e1 = event("REQUIREMENT_FROZEN", "REQ-1", "k1", HashUtil.ZERO_HASH, Map.of());
        DomainEvent e2 = event("REQUIREMENT_DEPRECATED", "REQ-1", "k2", "SOME_OTHER_ID", Map.of());
        EventBusEngine.CausalResult r = EventBusEngine.verifyCausalChain(List.of(e1, e2));
        assertFalse(r.continuous());
        assertEquals(e2.header().eventId(), r.brokenAt());
    }

    @Test
    void 按因果关系重排乱序事件() {
        DomainEvent e1 = event("REQUIREMENT_FROZEN", "REQ-1", "k1", HashUtil.ZERO_HASH, Map.of());
        DomainEvent e2 = event("REQUIREMENT_DEPRECATED", "REQ-1", "k2", e1.header().eventId(), Map.of());
        DomainEvent e3 = event("AUDIT_APPENDED", "REQ-1", "k3", e2.header().eventId(), Map.of());
        // 乱序输入
        List<DomainEvent> ordered = EventBusEngine.orderByCausation(List.of(e3, e1, e2));
        assertEquals(e1.header().eventId(), ordered.get(0).header().eventId());
        assertEquals(e2.header().eventId(), ordered.get(1).header().eventId());
        assertEquals(e3.header().eventId(), ordered.get(2).header().eventId());
    }

    @Test
    void 事件可序列化为map() {
        DomainEvent e = event("GATE_PASSED", "GATE-1", "k1", HashUtil.ZERO_HASH,
            Map.of("gate", "B5"));
        Map<String, Object> m = e.toMap();
        assertEquals(e.header().eventId(), m.get("eventId"));
        assertEquals("t1", m.get("tenantId"));
        assertEquals("GATE_PASSED", m.get("eventType"));
    }
}
