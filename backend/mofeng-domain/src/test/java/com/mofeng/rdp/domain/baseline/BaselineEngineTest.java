package com.mofeng.rdp.domain.baseline;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 基线引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 {@code app/tests/domain.spec.ts}「基线与审计哈希链」基线部分用例同构。
 * 同一套输入、同一套期望，一致率 100%。</p>
 */
class BaselineEngineTest {

    @Test
    void 基线manifest与逐项rowHash一致冻结后修改被拒() {
        BaselineEngine.Baseline b = BaselineEngine.buildBaseline("B1", "P", "BL-1", "需求基线",
            List.of(new BaselineEngine.ItemInput("需求", "R1", 1, Map.of("code", "SG-1"))),
            null, null);
        BaselineEngine.Baseline frozen = BaselineEngine.freeze(b, "配置管理员", "2026-11-02T00:00:00Z");
        assertThrows(BaselineEngine.BaselineImmutableError.class, () -> BaselineEngine.freeze(frozen, "x", "2026-11-02T00:00:00Z"));

        BaselineEngine.VerifyResult ok = BaselineEngine.verifyBaseline(frozen, Map.of("需求:R1", Map.of("code", "SG-1")));
        assertTrue(ok.ok());

        BaselineEngine.VerifyResult tampered = BaselineEngine.verifyBaseline(frozen, Map.of("需求:R1", Map.of("code", "SG-1-被篡改")));
        assertFalse(tampered.ok());
        assertEquals("R1", tampered.mismatches().get(0).objId());
    }

    @Test
    void 组建中可冻结已冻结状态正确() {
        BaselineEngine.Baseline b = BaselineEngine.buildBaseline("B1", "P", "BL-1", "需求基线",
            List.of(new BaselineEngine.ItemInput("需求", "R1", 1, Map.of("code", "SG-1"))),
            null, null);
        assertEquals("组建中", b.status());
        BaselineEngine.Baseline frozen = BaselineEngine.freeze(b, "配置管理员", "2026-11-02T00:00:00Z");
        assertEquals("已冻结", frozen.status());
        assertEquals("配置管理员", frozen.frozenBy());
    }

    @Test
    void 替代冻结基线标记已被替代() {
        BaselineEngine.Baseline b = BaselineEngine.buildBaseline("B1", "P", "BL-1", "需求基线",
            List.of(new BaselineEngine.ItemInput("需求", "R1", 1, Map.of("code", "SG-1"))),
            null, null);
        BaselineEngine.Baseline frozen = BaselineEngine.freeze(b, "配置管理员", "2026-11-02T00:00:00Z");
        BaselineEngine.Baseline replaced = BaselineEngine.replace(frozen, "B2");
        assertEquals("已被替代", replaced.status());
        assertEquals("B2", replaced.replacedBy());
    }

    @Test
    void 对象不存在报不一致() {
        BaselineEngine.Baseline b = BaselineEngine.buildBaseline("B1", "P", "BL-1", "需求基线",
            List.of(new BaselineEngine.ItemInput("需求", "R1", 1, Map.of("code", "SG-1"))),
            null, null);
        BaselineEngine.Baseline frozen = BaselineEngine.freeze(b, "配置管理员", "2026-11-02T00:00:00Z");
        BaselineEngine.VerifyResult r = BaselineEngine.verifyBaseline(frozen, Map.of());
        assertFalse(r.ok());
        assertEquals("(对象不存在)", r.mismatches().get(0).actual());
    }
}
