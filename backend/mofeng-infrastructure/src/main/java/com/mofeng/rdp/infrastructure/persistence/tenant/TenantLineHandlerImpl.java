package com.mofeng.rdp.infrastructure.persistence.tenant;

import com.baomidou.mybatisplus.extension.plugins.handler.TenantLineHandler;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.StringValue;

/**
 * MyBatis-Plus 多租户 SQL 拦截器处理器（共享表模式，SRS 7.2 数据库面）。
 *
 * <p>所有走共享表的查询/写入自动附加 {@code tenant_id = '<当前租户>'} 条件，
 * 实现「数据库面强制隔离」，即使业务代码漏写租户条件也不会跨租户泄露。</p>
 *
 * <p>租户来源为 {@link TenantContextHolder}（应用层入口强制注入），
 * 未注入时返回「租户列空值条件」使查询自然为空，不泄露他租户数据。</p>
 */
public final class TenantLineHandlerImpl implements TenantLineHandler {

    /** 共享表模式的租户列名。 */
    private static final String TENANT_COLUMN = "tenant_id";

    @Override
    public Expression getTenantId() {
        String tenantId = TenantContextHolder.getTenantId();
        // 未注入租户时返回空串，查询自然为空，不泄露他租户数据（TEN-004 兜底）
        return new StringValue(tenantId == null ? "" : tenantId);
    }

    @Override
    public String getTenantIdColumn() {
        return TENANT_COLUMN;
    }

    @Override
    public boolean ignoreTable(String tableName) {
        // 租户注册表本身不做租户隔离（平台级元数据，集团/子租户两级结构）
        return "tenant".equalsIgnoreCase(tableName);
    }
}
