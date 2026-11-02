package com.mofeng.rdp.application.security;

import com.mofeng.rdp.application.web.PermissionDeniedException;
import com.mofeng.rdp.domain.rbac.RbacEngine;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

/**
 * 权限校验切面（应用层权限校验入口，ARC-001）。
 *
 * <p>拦截标注 {@link RequiresPermission} 的方法，从 {@link CurrentUserContext} 取当前角色，
 * 调用领域层 {@code RbacEngine.can(roleCode, action)} 判定。判定逻辑复用领域层权威
 * （18 角色矩阵），应用层只做「取主体 + 调引擎 + 未授权即拒」的编排。</p>
 *
 * <p>判定语义（收敛于 {@link #authorize(String, String)}，可独立测试）：</p>
 * <ul>
 *   <li>未认证（无当前角色）→ 抛 {@link PermissionDeniedException}（403，未登录）；</li>
 *   <li>{@code can().allowed == false}（角色未登记 / 动作 —）→ 抛 403（无权限）；</li>
 *   <li>{@code allowed == true}（● 允许 / ○ 受限允许）→ 放行，受限原因由领域层承载。</li>
 * </ul>
 */
@Aspect
@Component
@Order(0)
public class PermissionAspect {

    @Before("@annotation(com.mofeng.rdp.application.security.RequiresPermission)")
    public void checkPermission(org.aspectj.lang.JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        RequiresPermission annotation = method.getAnnotation(RequiresPermission.class);
        if (annotation == null) {
            return;
        }
        authorize(CurrentUserContext.roleCode(), annotation.action());
    }

    /**
     * 权限判定核心（纯编排，可独立测试）：
     * 未认证 / 无权限抛 {@link PermissionDeniedException}，允许（含 ○ 受限）静默放行。
     */
    static void authorize(String roleCode, String action) {
        if (roleCode == null) {
            throw new PermissionDeniedException("未认证：缺失当前用户身份（SEC-001）");
        }
        RbacEngine.CanResult result = RbacEngine.can(roleCode, action);
        if (!result.allowed) {
            throw new PermissionDeniedException(result.reason + "（动作 " + action + "）");
        }
        // allowed == true（含 ○ 受限允许）放行；受限原因见 RbacEngine.can 的 conditional/limits
    }
}
