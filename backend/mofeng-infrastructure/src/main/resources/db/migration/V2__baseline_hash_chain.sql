-- =============================================================
-- MOFENG-RDP 基线哈希链（ARC-008 / BAS-001~006）
-- 基线表 baseline + 基线项表 baseline_item（逐项 row_hash）
-- 目标：逐项哈希 + manifest 冻结签名，冻结后只读，修改任一成员立即报不一致
-- 数据库：MySQL 8.0（utf8mb4）
-- =============================================================

-- -------------------------------------------------------------
-- 1. 基线表（九类基线：需求/设计/软件/硬件/样件/测试/交付/成本/文档）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS baseline (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    tenant_id     VARCHAR(64)  NOT NULL                COMMENT '租户ID',
    project_id    VARCHAR(64)  NOT NULL                COMMENT '项目ID',
    no            VARCHAR(64)  NOT NULL                COMMENT '基线编号',
    type          VARCHAR(32)  NOT NULL                COMMENT '基线类型（九类）',
    status        VARCHAR(16)  NOT NULL DEFAULT '组建中' COMMENT '状态 组建中/已冻结/已被替代',
    manifest_hash VARCHAR(64)  NOT NULL                COMMENT 'manifest 哈希（排序项哈希）',
    frozen_at     DATETIME     DEFAULT NULL            COMMENT '冻结时间',
    frozen_by     VARCHAR(64)  DEFAULT NULL            COMMENT '冻结人',
    replaced_by   BIGINT       DEFAULT NULL            COMMENT '替代基线ID',
    created_by    VARCHAR(64)  NOT NULL                COMMENT '创建人',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_baseline_project (tenant_id, project_id),
    KEY idx_baseline_status (tenant_id, status),
    CONSTRAINT uk_baseline_no UNIQUE (tenant_id, project_id, no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='基线表（ARC-008，manifest 冻结签名）';

-- -------------------------------------------------------------
-- 2. 基线项表（逐项 row_hash，冻结后修改即报不一致）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS baseline_item (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    tenant_id     VARCHAR(64)  NOT NULL                COMMENT '租户ID',
    baseline_id   BIGINT       NOT NULL                COMMENT '基线ID',
    obj_type      VARCHAR(32)  NOT NULL                COMMENT '对象类型',
    obj_id        VARCHAR(64)  NOT NULL                COMMENT '对象ID',
    obj_version   INT          NOT NULL                COMMENT '对象版本',
    row_hash      VARCHAR(64)  NOT NULL                COMMENT '逐项哈希（type+id+v+snap）',
    snapshot      JSON         NOT NULL                COMMENT '快照（冻结时的对象内容）',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_item_baseline (tenant_id, baseline_id),
    KEY idx_item_obj (tenant_id, obj_type, obj_id),
    CONSTRAINT uk_item UNIQUE (tenant_id, baseline_id, obj_type, obj_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='基线项表（ARC-008，逐项 row_hash）';
