package com.mofeng.rdp.domain.rule;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 规则版本值对象测试（ARC-006）。
 */
class RuleVersionTest {

    @Test
    void 快照哈希确定性且内容不同哈希不同() {
        String h1 = RuleVersion.snapshotHashOf("GATE", "GATE_G1", 1, "{\"items\":[]}");
        String h2 = RuleVersion.snapshotHashOf("GATE", "GATE_G1", 1, "{\"items\":[]}");
        String h3 = RuleVersion.snapshotHashOf("GATE", "GATE_G1", 2, "{\"items\":[]}");
        String h4 = RuleVersion.snapshotHashOf("GATE", "GATE_G1", 1, "{\"items\":[{}]}");
        assertEquals(h1, h2);
        assertEquals(64, h1.length()); // SHA-256 hex
        assertFalse(h1.equals(h3));    // 版本不同 → 哈希不同
        assertFalse(h1.equals(h4));    // 内容不同 → 哈希不同
    }

    @Test
    void 生效期判定含当日() {
        assertTrue(RuleVersion.isEffective("2026-11-04", "2026-11-01", null));
        assertTrue(RuleVersion.isEffective("2026-11-04", "2026-11-04", "2026-11-04"));
        assertTrue(RuleVersion.isEffective("2026-11-04", "2026-11-01", "2026-11-10"));
        assertFalse(RuleVersion.isEffective("2026-11-04", "2026-11-05", null)); // 未到起始
        assertFalse(RuleVersion.isEffective("2026-11-04", "2026-11-01", "2026-11-03")); // 已过截止
        assertFalse(RuleVersion.isEffective("2026-11-04", null, null)); // 无起始非法
    }

    @Test
    void 规则唯一标识() {
        RuleVersion rv = new RuleVersion("GATE", "GATE_G1", 1, "hash");
        assertEquals("GATE|GATE_G1", rv.key());
    }
}
