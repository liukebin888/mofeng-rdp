package com.mofeng.rdp.application.security;

import com.mofeng.rdp.application.web.PermissionDeniedException;
import com.mofeng.rdp.application.web.UnauthorizedException;
import com.mofeng.rdp.domain.rbac.RbacEngine;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 权限切面测试（C-12 应用层权限校验入口）。
 *
 * <p>聚焦切面「取主体 + 调领域层 RbacEngine + 未授权即拒」的编排正确性，
 * 角色×动作矩阵数值由领域层 RbacEngineTest 锁定（本测试不重复验证矩阵）。
 * 语义：未认证→401（UnauthorizedException），无权限→403（PermissionDeniedException）。</p>
 */
class PermissionAspectTest {

    @Test
    void 未认证拒绝401() {
        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
            () -> PermissionAspect.authorize(null, "create"));
        assertTrue(ex.getMessage().contains("未认证"));
    }

    @Test
    void 允许动作放行() {
        // PM（研发项目经理）create 动作 = ● 允许
        assertDoesNotThrow(() -> PermissionAspect.authorize("PM", "create"));
    }

    @Test
    void 禁止动作拒绝() {
        // SE（系统工程师）delete 动作 = — 禁止
        PermissionDeniedException ex = assertThrows(PermissionDeniedException.class,
            () -> PermissionAspect.authorize("SE", "delete"));
        assertTrue(ex.getMessage().contains("delete"));
    }

    @Test
    void 受限允许放行() {
        // PM delete = ○ 受限允许（删除仅限本人草稿）——切面放行，具体限制由业务方法按 Role.limits 校验
        RbacEngine.CanResult r = RbacEngine.can("PM", "delete");
        assertTrue(r.allowed && r.conditional);

        assertDoesNotThrow(() -> PermissionAspect.authorize("PM", "delete"));
    }

    @Test
    void 未登记角色拒绝() {
        // 未登记于附录 D 的角色 → SEC-006 拒绝
        PermissionDeniedException ex = assertThrows(PermissionDeniedException.class,
            () -> PermissionAspect.authorize("GHOST_ROLE", "view"));
        assertTrue(ex.getMessage().contains("未登记"));
    }
}
