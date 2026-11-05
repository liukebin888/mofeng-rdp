-- ============================================================
-- V9__plan_prr_issue.sql  四级计划告警 PRR 抱怨单落表（P0）
-- 对应方案《项目管理计划-四级体系-解决方案 V1.0》第 4 章 S4 抱怨阶段
--
-- 领域判定权威：com.mofeng.rdp.domain.plan.PlanAlertEngine#buildPrrIssue
--   （PRR 单幂等键 objType|objId|dueDate，同一对象同一逾期日只生成一张）
-- 本表只做 PRR 抱怨单的持久化，不承载判定逻辑（ARC-001）。
-- ============================================================

-- 四级计划告警 PRR 抱怨单表（S4 抱怨阶段自动生成）
CREATE TABLE IF NOT EXISTS prj_plan_prr_issue (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    project_id       VARCHAR(64)  NOT NULL COMMENT '所属项目 id',
    prr_code         VARCHAR(64)  NOT NULL COMMENT 'PRR 编号（确定性派生）',
    title            VARCHAR(255) NOT NULL COMMENT '标题（含对象名与逾期信息）',
    obj_type         VARCHAR(16)  NOT NULL COMMENT '对象类型：CUSTOMER_NODE/COMPANY_NODE/PLAN/TASK',
    obj_id           VARCHAR(64)  NOT NULL COMMENT '对象 id（节点 id）',
    due_date_snapshot DATE         NOT NULL COMMENT '逾期到期日快照',
    severity         VARCHAR(16)  NOT NULL COMMENT '严重度：CRITICAL',
    receivers        VARCHAR(255) NULL COMMENT '接收人（角色描述）',
    status           VARCHAR(16)  NOT NULL DEFAULT 'OPEN' COMMENT '状态：OPEN/CLOSED',
    tenant_id        VARCHAR(64)  NOT NULL DEFAULT 'default' COMMENT '租户隔离',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_prr_issue (obj_type, obj_id, due_date_snapshot),
    KEY idx_prr_project (project_id),
    KEY idx_prr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='四级计划告警 PRR 抱怨单表（S4 自动生成）';
