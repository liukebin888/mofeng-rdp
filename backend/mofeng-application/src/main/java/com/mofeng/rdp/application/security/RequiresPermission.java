package com.mofeng.rdp.application.security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 声明某 Controller 方法所需的最小动作权限（应用层权限校验入口，ARC-001）。
 *
 * <p>切面 {@link PermissionAspect} 拦截标注了本注解的方法，从 {@link CurrentUserContext}
 * 取当前角色，调用领域层 {@code RbacEngine.can(roleCode, action)} 判定。判定复用领域层
 * 权威（18 角色矩阵 + 动作 ●/○/—），应用层不自行维护权限表。</p>
 *
 * <p>动作取值与领域层 {@code Role.action(key)} 对齐：view / create / update / delete /
 * approve / export。</p>
 *
 * <p>语义：{@code ●}（允许）放行；{@code ○}（受限允许）放行但可经
 * {@code RbacEngine.can()} 的 {@code conditional} 标志追溯受限原因；{@code —}（禁止）拒绝。
 * 受限允许的「具体限制」由领域层 {@code Role.limits} 承载，需在业务方法内按需进一步校验。</p>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequiresPermission {

    /** 所需动作：view / create / update / delete / approve / export。 */
    String action();
}
