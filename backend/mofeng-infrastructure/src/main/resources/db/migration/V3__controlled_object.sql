-- =============================================================
-- MOFENG-RDP 受控对象统一基表（ARC-004）
-- 五要素：状态机 / 版本 / 基线绑定 / 审计 / 权限范围，缺一不得入库
-- 目标：所有受控对象（需求/变更单/样件/评审/基线/风险）共用统一基表，
--       在持久化层强制五要素齐全性，口径不漂移。
-- 数据库：MySQL 8.0（utf8mb4）
-- =============================================================

-- -------------------------------------------------------------
-- 受控对象统一基表（承载五要素公共列，具体对象经 object_type 区分）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS controlled_object (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    tenant_id        VARCHAR(64)  NOT NULL                COMMENT '权限范围.租户ID',
    org_id           VARCHAR(64)  NOT NULL                COMMENT '权限范围.组织ID',
    project_id       VARCHAR(64)  NOT NULL                COMMENT '权限范围.项目ID',
    object_type      VARCHAR(32)  NOT NULL                COMMENT '对象类型（需求/变更单/样件/评审/基线/风险等）',
    object_id        VARCHAR(64)  NOT NULL                COMMENT '业务对象ID（领域对象标识）',
    state            VARCHAR(32)  NOT NULL DEFAULT '初始' COMMENT '状态机.当前状态',
    version          INT          NOT NULL DEFAULT 1      COMMENT '版本.版本号',
    revision_reason  VARCHAR(512) DEFAULT NULL            COMMENT '版本.修订原因',
    revision_by      VARCHAR(64)  NOT NULL                COMMENT '版本.修订人',
    revision_at      DATETIME     NOT NULL                COMMENT '版本.修订时间',
    baseline_id      VARCHAR(64)  DEFAULT NULL            COMMENT '基线绑定.所属基线（null=未入基线）',
    frozen           TINYINT      NOT NULL DEFAULT 0      COMMENT '基线绑定.冻结标记（1=只读）',
    audit_chain_hash VARCHAR(64)  NOT NULL                COMMENT '审计.变更前后值哈希链锚点',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_co_scope (tenant_id, org_id, project_id),
    KEY idx_co_type (tenant_id, object_type, object_id),
    KEY idx_co_baseline (tenant_id, baseline_id),
    CONSTRAINT uk_controlled_object UNIQUE (tenant_id, object_type, object_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='受控对象统一基表（ARC-004，五要素缺一不得入库）';
