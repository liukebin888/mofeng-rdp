-- ============================================================
-- V10__rule_definition.sql  可配置规则表（ARC-006 规则配置驱动 + 版本化 + 生效期 + 灰度）
-- 对应方案 SOLUTION §12.3 规则引擎：分级判定、门禁准入、预警阈值、偏差阈值以规则配置表达，
--   支持版本化与灰度生效，规则变更全程留痕。
--
-- 领域判定权威仍在 com.mofeng.rdp.domain.* 引擎（纯函数、可单测，ARC-001），
-- 本表只做「规则版本外置存储 + 生效期 + 灰度 + 快照留痕」，
-- 判定引擎通过 rule_version + snapshot_hash 锁定执行时的规则版本（K1 复算）。
-- ============================================================

-- 规则定义表（一条记录 = 一类规则的一个版本）
CREATE TABLE IF NOT EXISTS rule_definition (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    rule_type        VARCHAR(32)  NOT NULL COMMENT '规则类型：GRADING 分级 / GATE 门禁 / ALERT 预警阈值 / DEVIATION 偏差阈值',
    rule_code        VARCHAR(64)  NOT NULL COMMENT '规则编码（如 GRADING_TRUTH_TABLE / GATE_G1 / ALERT_THRESHOLD）',
    version          INT          NOT NULL COMMENT '版本号（递增，同一 rule_code 内唯一）',
    content_json     JSON         NOT NULL COMMENT '规则内容（结构化 JSON，如真值表行 / 门禁 item / 阈值）',
    snapshot_hash    CHAR(64)     NOT NULL COMMENT '规则内容确定性快照哈希（SHA-256，K1 复算）',
    effective_from   DATE         NOT NULL COMMENT '生效起始日（含当日）',
    effective_to     DATE         NULL COMMENT '生效截止日（含当日，null=长期有效）',
    gray_mode        VARCHAR(16)  NOT NULL DEFAULT 'OFF' COMMENT '灰度：OFF 全量 / TENANT 按租户 / LEVEL 按项目等级',
    gray_scope       VARCHAR(512) NULL COMMENT '灰度范围（gray_mode=TENANT 时存租户 id 列表；=LEVEL 时存等级列表，逗号分隔）',
    enabled          TINYINT      NOT NULL DEFAULT 1 COMMENT '是否启用（0=禁用，禁用版本不参与生效判定）',
    created_by       VARCHAR(64)  NULL COMMENT '创建人',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_rule_version (rule_code, version),
    KEY idx_rule_effective (rule_type, rule_code, effective_from, effective_to, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='可配置规则表（分级/门禁/预警/偏差阈值，版本化+生效期+灰度）';

-- 规则变更留痕表（ARC-006：规则变更全程留痕）
CREATE TABLE IF NOT EXISTS rule_change_log (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    rule_code        VARCHAR(64)  NOT NULL COMMENT '规则编码',
    from_version     INT          NULL COMMENT '变更前版本（null=首次创建）',
    to_version       INT          NOT NULL COMMENT '变更后版本',
    change_type      VARCHAR(16)  NOT NULL COMMENT '变更类型：CREATE/UPDATE/DISABLE/GRAY_SWITCH',
    changed_by       VARCHAR(64)  NULL COMMENT '操作人',
    snapshot_hash    CHAR(64)     NOT NULL COMMENT '变更后规则内容快照哈希',
    note             VARCHAR(255) NULL COMMENT '变更说明',
    changed_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rule_change_code (rule_code, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则变更留痕表（ARC-006 全程留痕）';
