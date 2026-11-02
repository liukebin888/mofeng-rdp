-- =====================================================================
-- V4__tenant.sql  —— B1-4 多租户三模式数据层落地（ARC-010 / TEN-002/003）
-- =====================================================================
-- 租户注册表：集团—子租户两级 + 三隔离模式（SHARED/SCHEMA/INSTANCE）
-- 该表承载租户元数据，隔离判定权威仍在领域层 TenantEngine（纯函数）。
-- 本表仅做持久化，不做业务判断（ARC-001）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS `tenant` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    `code`            VARCHAR(64)  NOT NULL COMMENT '租户编码（唯一业务键）',
    `name`            VARCHAR(128) NOT NULL COMMENT '租户名称',
    `type`            VARCHAR(16)  NOT NULL COMMENT '租户类型：集团租户/子租户',
    `isolation`       VARCHAR(16)  NOT NULL COMMENT '隔离模式：SHARED/SCHEMA/INSTANCE（TEN-003）',
    `parent_code`     VARCHAR(64)  NULL COMMENT '父租户 code（子租户必填；集团租户为空）',
    `shared_metrics`  JSON         NULL COMMENT '集团视图下钻白名单指标（TEN-008）',
    `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1启用 0停用',
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tenant_code` (`code`),
    KEY `idx_tenant_parent` (`parent_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户注册表（集团-子租户两级 + 三隔离模式）';
