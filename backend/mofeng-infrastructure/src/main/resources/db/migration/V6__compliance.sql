-- ============================================================
-- V6__compliance.sql  等保三级 / 密评 / 数据分类分级合规台账
-- 对应 SRS 第 23 章 NFR-009/010/011、SEC-012/013，控制点 C-30
--
-- 领域判定权威：com.mofeng.rdp.domain.compliance.ComplianceEngine
-- （assessItem / evaluateCompliance / complianceGate / summarizeCompliance）
-- 本表只做证据链持久化，不承载判定逻辑（ARC-001）。
--
-- 判定优先级（assessItem）：到期未重评 > 结论未通过 > 高风险 > 整改未闭环 > 符合率<90%
-- 硬闸门（complianceGate）：等保三级 / 商用密码(密评) / 国密传输 任一 FAIL 阻断上线；
--   数据分类分级（NFR-011，R2/P1）仅告警不阻断。
-- ============================================================

-- 合规测评证据主表
CREATE TABLE IF NOT EXISTS compliance_item (
    id                VARCHAR(64)  NOT NULL COMMENT '证据 id',
    kind              VARCHAR(32)  NOT NULL COMMENT '测评类型：等保三级/商用密码(密评)/数据分类分级/国密传输',
    ref               VARCHAR(32)  NOT NULL COMMENT '关联需求条目号（NFR-009/010/011、SEC-012）',
    agency            VARCHAR(128) NOT NULL COMMENT '测评机构（外部权威源，非平台自身）',
    report_no         VARCHAR(128) NOT NULL COMMENT '测评报告编号（可追溯权威凭证）',
    conclusion        VARCHAR(16)  NOT NULL COMMENT '结论：通过/未通过/待整改',
    compliance_rate   DECIMAL(5,2) NOT NULL COMMENT '符合率（%，判据≥90 且高风险 0）',
    high_risk_count   INT          NOT NULL DEFAULT 0 COMMENT '高风险项数（判据：高风险 0）',
    assessed_at       DATE         NOT NULL COMMENT '测评日期',
    valid_until       DATE         NOT NULL COMMENT '有效期至（到期须重评）',
    tenant_id         VARCHAR(64)  NOT NULL DEFAULT 'default' COMMENT '租户隔离',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id, tenant_id),
    KEY idx_compliance_kind (kind),
    KEY idx_compliance_tenant_valid (tenant_id, valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规测评证据主表（C-30 证据链驱动）';

-- 整改项表
CREATE TABLE IF NOT EXISTS compliance_rectification (
    id          VARCHAR(64)  NOT NULL COMMENT '整改项 id',
    item_id     VARCHAR(64)  NOT NULL COMMENT '归属证据 id',
    issue       VARCHAR(512) NOT NULL COMMENT '整改问题描述',
    severity    VARCHAR(8)   NOT NULL COMMENT '高/中/低',
    status      VARCHAR(16)  NOT NULL COMMENT '开放/整改中/已闭环/接受风险',
    deadline    DATE         NOT NULL COMMENT '整改截止日',
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default' COMMENT '租户隔离',
    PRIMARY KEY (id, tenant_id),
    KEY idx_rect_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规整改项（未闭环项影响 CONDITIONAL 判定）';
