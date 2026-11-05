-- ============================================================
-- V7__four_level_plan.sql  四级计划体系落表（P0）
-- 对应方案《项目管理计划-四级体系-解决方案 V1.0》+《四级计划告警统一模板 V1.0》
--
-- 领域判定权威：com.mofeng.rdp.domain.plan.FourLevelPlanEngine
--   （effectiveDueDate / sortByLevel / orphanUpperNodes R-COVER /
--     alignResults R-NOLAG / deriveUpperStatus R-COMPLETE / validateFourLevelPlan）
-- 本表只做四级计划节点与承接关系的持久化，不承载判定逻辑（ARC-001）。
--
-- 设计说明：
--   - 统一 prj_plan_node 表承载 L1~L4 四级节点（plan_level 区分），
--     承接关系通过 prj_plan_node_link 显式落库（upper_node_id → lower_node_id），
--     避免单表自引用带来的层级漂移，R-COVER 校验直接数 link 记录即可。
--   - L1 客户计划节点不可直接编辑（baseline_date 经变更流程批准后写入），
--     L2/L3/L4 可直接编辑（date 即计划日）。
--   - 生效基准日统一口径 = COALESCE(baseline_date, node_date)，由领域层 effectiveDueDate 保证。
-- ============================================================

-- 四级计划节点主表（L1/L2/L3/L4 统一）
CREATE TABLE IF NOT EXISTS prj_plan_node (
    id              VARCHAR(64)  NOT NULL COMMENT '节点 id',
    project_id      VARCHAR(64)  NOT NULL COMMENT '所属项目 id',
    plan_level      VARCHAR(4)   NOT NULL COMMENT '层级：L1/L2/L3/L4',
    code            VARCHAR(64)  NOT NULL COMMENT '节点编码',
    name            VARCHAR(256) NOT NULL COMMENT '节点名称',
    node_date       DATE         NOT NULL COMMENT '计划完成日',
    baseline_date   DATE         NULL COMMENT '变更批准后的基准日（L1 专用，其余层可空）',
    actual_date     DATE         NULL COMMENT '实际达成日（R-COMPLETE 推导依据）',
    milestone       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否里程碑',
    specialty_type  VARCHAR(32)  NULL COMMENT 'L4 专项类型（STRUCTURE/HARDWARE/SOFTWARE/TEST/PROCESS/TST/PURCHASE/PROTOTYPE/MOLD/LINE）',
    owner_name      VARCHAR(64)  NULL COMMENT '责任人',
    owner_role      VARCHAR(64)  NULL COMMENT '责任角色',
    tenant_id       VARCHAR(64)  NOT NULL DEFAULT 'default' COMMENT '租户隔离',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id, tenant_id),
    KEY idx_plan_node_project (project_id, plan_level),
    KEY idx_plan_node_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='四级计划节点主表（L1 客户/L2 公司/L3 项目控制/L4 专项）';

-- 四级计划承接关系表（R-COVER 映射依据：上级必须有下级显式承接）
CREATE TABLE IF NOT EXISTS prj_plan_node_link (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    project_id      VARCHAR(64)  NOT NULL COMMENT '所属项目 id',
    upper_node_id   VARCHAR(64)  NOT NULL COMMENT '上级节点 id（L1/L2/L3）',
    lower_node_id   VARCHAR(64)  NOT NULL COMMENT '下级节点 id（承接者）',
    link_type       VARCHAR(16)  NOT NULL DEFAULT 'COVER' COMMENT '关系类型：COVER 承接',
    tenant_id       VARCHAR(64)  NOT NULL DEFAULT 'default' COMMENT '租户隔离',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_link (upper_node_id, lower_node_id, tenant_id),
    KEY idx_plan_link_upper (upper_node_id),
    KEY idx_plan_link_lower (lower_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='四级计划承接关系表（R-COVER 校验依据）';
