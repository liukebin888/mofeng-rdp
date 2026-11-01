package com.mofeng.rdp.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 受控对象统一抽象单元测试（SRS ARC-004）。
 *
 * <p>对应前端 TS 引擎 types.ts 的受控对象五要素语义：状态机 / 版本 / 基线绑定 / 审计 /
 * 权限范围。本测试是「同一套测试用例」迁移验收的第一个样本——TS 侧已有同构判据。</p>
 */
class ControlledObjectTest {

    /** 一个可实例化的受控对象示例（需求条目）。 */
    static final class Requirement extends ControlledObject<String> {
        Requirement(String id) { super(id); }

        void changeState(String s) { state(s); }
        void setAudit(String hash) { auditChainHash(hash); }
        void setScope(String tenant, String org, String project) {
            tenantId(tenant);
            orgId(org);
            projectId(project);
        }
        void bumpVersion(String reason, String by) { revise(reason, by); }
    }

    /** 构造一个五要素齐备的需求对象。 */
    private static Requirement completeRequirement() {
        Requirement r = new Requirement("REQ-001");
        r.setAudit("hash-0000");
        r.setScope("T-1001", "ORG-A", "P-001");
        r.bumpVersion("初版", "需求工程师");
        return r;
    }

    @Test
    void completeObjectPassesCompletenessCheck() {
        Requirement r = completeRequirement();
        assertTrue(r.checkCompleteness().complete(), "五要素齐备对象应通过齐全性校验");
    }

    @Test
    void objectMissingAuditChainHashIsRejected() {
        Requirement r = new Requirement("REQ-002");
        r.setScope("T-1001", "ORG-A", "P-001");
        r.bumpVersion("初版", "需求工程师");
        // 未设置 auditChainHash
        ControlledObject.CompletenessCheck check = r.checkCompleteness();
        assertFalse(check.complete(), "缺审计字段对象不得入库");
        assertTrue(check.missingElements().contains("审计.auditChainHash"));
    }

    @Test
    void objectMissingTenantScopeIsRejected() {
        Requirement r = new Requirement("REQ-003");
        r.setAudit("hash-0001");
        r.bumpVersion("初版", "需求工程师");
        // 未设置权限范围
        ControlledObject.CompletenessCheck check = r.checkCompleteness();
        assertFalse(check.complete());
        assertTrue(check.missingElements().contains("权限范围.tenantId"));
    }

    @Test
    void frozenObjectRequiresBaselineId() {
        Requirement r = completeRequirement();
        // 冻结但未指定基线 → 应抛异常
        assertThrows(IllegalArgumentException.class, () -> r.freeze(null));
        assertThrows(IllegalArgumentException.class, () -> r.freeze("  "));
    }

    @Test
    void freezeBindsBaselineAndSetsReadOnly() {
        Requirement r = completeRequirement();
        r.freeze("BL-001");
        assertTrue(r.frozen());
        assertEquals("BL-001", r.baselineId());
    }

    @Test
    void frozenObjectRejectsModification() {
        Requirement r = completeRequirement();
        r.freeze("BL-001");
        // 冻结后任何修改被拒（ARC-008 语义：冻结后修改任一成员立即报不一致）
        assertThrows(IllegalStateException.class, () -> r.bumpVersion("改", "某人"));
        assertThrows(IllegalStateException.class, () -> r.changeState("新状态"));
    }

    @Test
    void reviseIncrementsVersionAndRecordsMetadata() {
        Requirement r = completeRequirement();
        int before = r.version();
        r.bumpVersion("补充验收要点", "需求工程师");
        assertEquals(before + 1, r.version());
        assertEquals("补充验收要点", r.revisionReason());
        assertEquals("需求工程师", r.revisionBy());
        assertTrue(r.revisionAt().isBefore(Instant.now().plusSeconds(1)));
    }

    @Test
    void idCannotBeNull() {
        assertThrows(NullPointerException.class, () -> new Requirement(null));
    }
}
