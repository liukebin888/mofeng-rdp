-- =============================================================
-- MOFENG-RDP 追溯闭包表（ARC-007 / TRC-004）
-- 关系表 trace_link + 闭包表 trace_closure 双写
-- 目标：5 跳查询 P95≤500ms，闭包与逐跳推导一致率 100%
-- 数据库：MySQL 8.0（utf8mb4）
-- =============================================================

-- -------------------------------------------------------------
-- 1. 追溯关系表（关系表：五类链路 SG→FSR→TSR/HSR/SSSR→TC→VER）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trace_link (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    tenant_id     VARCHAR(64)  NOT NULL                COMMENT '租户ID（多租户隔离）',
    project_id    VARCHAR(64)  NOT NULL                COMMENT '项目ID',
    src_type      VARCHAR(16)  NOT NULL                COMMENT '源类型 REQ/TC/VER',
    src_id        VARCHAR(64)  NOT NULL                COMMENT '源对象ID',
    dst_type      VARCHAR(16)  NOT NULL                COMMENT '目标类型 REQ/TC/VER',
    dst_id        VARCHAR(64)  NOT NULL                COMMENT '目标对象ID',
    link_type     VARCHAR(16)  NOT NULL                COMMENT '关系类型 derive/verify/implement',
    baseline_id   VARCHAR(64)  DEFAULT NULL            COMMENT '所属基线ID（可空）',
    status        TINYINT      NOT NULL DEFAULT 1      COMMENT '状态 0无效/1有效',
    created_by    VARCHAR(64)  NOT NULL                COMMENT '创建人',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_link_tenant_project (tenant_id, project_id),
    KEY idx_link_src (tenant_id, src_type, src_id),
    KEY idx_link_dst (tenant_id, dst_type, dst_id),
    KEY idx_link_baseline (tenant_id, baseline_id),
    CONSTRAINT uk_link UNIQUE (tenant_id, src_type, src_id, dst_type, dst_id, link_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='追溯关系表（ARC-007）';

-- -------------------------------------------------------------
-- 2. 追溯闭包表（预计算可达性 + 最短跳数，加速 ≤6 跳查询）
--    每行表示 ancestor 到 descendant 的最短跳数（depth≥1）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trace_closure (
    id                 BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
    tenant_id          VARCHAR(64) NOT NULL                COMMENT '租户ID',
    ancestor_type      VARCHAR(16) NOT NULL                COMMENT '祖先类型',
    ancestor_id        VARCHAR(64) NOT NULL                COMMENT '祖先对象ID',
    descendant_type    VARCHAR(16) NOT NULL                COMMENT '后代类型',
    descendant_id      VARCHAR(64) NOT NULL                COMMENT '后代对象ID',
    depth              INT         NOT NULL                COMMENT '最短跳数（≥1）',
    created_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_closure_ancestor (tenant_id, ancestor_type, ancestor_id, depth),
    KEY idx_closure_descendant (tenant_id, descendant_type, descendant_id),
    CONSTRAINT uk_closure UNIQUE (tenant_id, ancestor_type, ancestor_id, descendant_type, descendant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='追溯闭包表（ARC-007，预计算可达性+最短跳数）';
