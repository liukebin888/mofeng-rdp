-- ============================================================
-- V8__plan_alert.sql  四级计划告警（四段式时点编排）落表（P0）
-- 对应方案《项目管理计划-四级体系-解决方案 V1.0》第 4 章告警机制
--
-- 领域判定权威：com.mofeng.rdp.domain.plan.PlanAlertEngine
--   （stageOf 四段式时点 / levelOf 级别映射 / validateThreshold 阈值收紧 R-08 /
--     idempotencyKey 幂等键 R-09 / pendingStages 阶段跃迁）
-- 本表只做告警流水与阈值覆盖的持久化，不承载判定逻辑（ARC-001）。
--
-- 四段式：S1 提醒（NORMAL）/ S2 预警（URGENT）/ S3 报警（CRITICAL）/ S4 抱怨（CRITICAL+PRR）
-- 幂等键：uk_stage (obj_type, obj_id, stage, due_date_snapshot, threshold_snapshot)
--         —— 同一「对象 + 阶段 + 该阶段判定所依据的日期与阈值」只发一次（R-09）。
-- ============================================================

-- 四级计划告警流水表（幂等，四段式分阶段留痕）
CREATE TABLE IF NOT EXISTS prj_plan_alert_log (
    id                BIGINT       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    project_id        VARCHAR(64)  NOT NULL COMMENT '所属项目 id',
    obj_type          VARCHAR(16)  NOT NULL COMMENT '对象类型：CUSTOMER_NODE/COMPANY_NODE/PLAN/TASK',
    obj_id            VARCHAR(64)  NOT NULL COMMENT '对象 id（节点/任务 id）',
    stage             VARCHAR(8)   NOT NULL COMMENT '阶段：S1/S2/S3/S4',
    due_date_snapshot DATE         NULL COMMENT '触发本次告警时该对象的计划完成日快照',
    threshold_snapshot VARCHAR(64) NULL COMMENT '触发本次告警时生效阈值快照（如 remind=7,warn=3,alarm=1,prr=7）',
    plan_level        VARCHAR(4)   NULL COMMENT '节点层级 L1/L2/L3/L4',
    notify_level      VARCHAR(8)   NOT NULL COMMENT '级别：NORMAL/URGENT/CRITICAL',
    channel_mask      VARCHAR(64)  NULL COMMENT '实际投递渠道（站内信/邮件/企微/短信）',
    receiver_ids      VARCHAR(255) NULL COMMENT '接收人 id 逗号分隔',
    prr_issue_id      VARCHAR(64)  NULL COMMENT 'S4 关联的 PRR 问题单 id',
    fired_at          DATETIME     NOT NULL COMMENT '触发时间',
    tenant_id         VARCHAR(64)  NOT NULL DEFAULT 'default' COMMENT '租户隔离',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stage (obj_type, obj_id, stage, due_date_snapshot, threshold_snapshot),
    KEY idx_alert_project (project_id),
    KEY idx_alert_prr (prr_issue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='四级计划告警流水表（四段式幂等）';

-- 四级计划告警阈值项目级覆盖表（优先级：项目级覆盖 → 全局 sys_config 默认）
CREATE TABLE IF NOT EXISTS prj_plan_alert_policy (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    project_id      VARCHAR(64)  NOT NULL COMMENT '所属项目 id',
    remind_days     INT          NULL COMMENT '覆盖提醒天数，NULL=用全局（默认 7）',
    warn_days       INT          NULL COMMENT '覆盖预警天数，NULL=用全局（默认 3，须 ≤ remind）',
    alarm_days      INT          NULL COMMENT '覆盖报警天数，NULL=用全局（默认 1，只允许收紧）',
    prr_days        INT          NULL COMMENT '覆盖 PRR 天数，NULL=用全局（默认 7，锁定）',
    tenant_id       VARCHAR(64)  NOT NULL DEFAULT 'default' COMMENT '租户隔离',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_alert_policy_project (project_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='四级计划告警阈值项目级覆盖表';
