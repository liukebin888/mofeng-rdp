package com.mofeng.rdp.domain.audit;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 审计引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 {@code app/tests/domain.spec.ts}「基线与审计哈希链」审计部分用例同构。
 * 同一套输入、同一套期望，一致率 100%。</p>
 */
class AuditEngineTest {

    private static final AuditEngine.Actor ACT =
        new AuditEngine.Actor("U1", "测试", "研发项目经理", "T", "2026-10-31T10:00:00+08:00");

    @Test
    void 审计链append与verify连续() {
        List<AuditEngine.Row> rows = new ArrayList<>();
        AuditEngine.appendAudit(rows, ACT, new AuditEngine.Entry("CREATE", "项目", "P1", null, null, null));
        AuditEngine.appendAudit(rows, ACT, new AuditEngine.Entry("FREEZE", "基线", "B1", null, null, null));
        AuditEngine.ChainResult r = AuditEngine.verifyChain(rows);
        assertTrue(r.ok());
    }

    @Test
    void 篡改可定位() {
        List<AuditEngine.Row> rows = new ArrayList<>();
        AuditEngine.appendAudit(rows, ACT, new AuditEngine.Entry("CREATE", "项目", "P1", null, null, null));
        AuditEngine.appendAudit(rows, ACT, new AuditEngine.Entry("FREEZE", "基线", "B1", null, null, null));

        // 篡改首条记录的 after 字段（用新 Entry 重新构造首条，其余保持），模拟篡改
        AuditEngine.Row first = rows.get(0);
        // 直接构造一条被篡改的链：把首行的 after 改为不同值
        List<AuditEngine.Row> tampered = new ArrayList<>();
        tampered.add(new AuditEngine.Row(first.seq(), first.occurredAt(), first.actorId(), first.actorName(),
            first.actorRole(), first.action(), first.objType(), first.objId(),
            Map.of("tampered", true), first.after(), first.result(), first.tenantId(),
            first.prevHash(), first.rowHash())); // rowHash 不变，但 before 变了 → 校验失败
        tampered.add(rows.get(1));

        AuditEngine.ChainResult r = AuditEngine.verifyChain(tampered);
        assertFalse(r.ok());
        assertEquals(1, r.brokenAt());
    }

    @Test
    void appendOnly改删被拒() {
        assertThrows(AuditEngine.AuditImmutableError.class, AuditEngine::guardImmutable);
    }

    @Test
    void 字段级diff() {
        List<AuditEngine.FieldDiff> diffs = AuditEngine.diffFields(
            Map.of("code", "SG-1", "status", "草稿"),
            Map.of("code", "SG-1", "status", "已批准"));
        assertEquals(1, diffs.size());
        assertEquals("status", diffs.get(0).field());
        assertEquals("草稿", diffs.get(0).from());
        assertEquals("已批准", diffs.get(0).to());
    }
}
