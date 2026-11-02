-- =====================================================================
-- V5__partition_archive.sql  —— B1-5 分区与归档落地（NFR-019）
-- =====================================================================
-- 面向「年 3000 项目」数据量：核心事务表按时间窗 RANGE 分区，
-- 归档数据落 archive 表，保留期限可配置（retention_months）。
--
-- 容量计算书（NFR-019 判据：压测偏差 ≤20%）：
--   - 单项目平均受控对象约 5000 条（需求/变更/样件/缺陷/文档/追溯等）
--   - 年 3000 项目 × 5000 条 = 1500 万条/年
--   - 单行约 2KB → 约 30GB/年 热数据
--   - 按季度分区，每分区约 375 万条（约 7.5GB），单分区可控
--   - 归档后冷数据移入 archive，热表保持近 N 年数据（默认 3 年）
-- =====================================================================

-- -------------------------------------------------------------------
-- 受控对象归档表（冷数据，DOC-010 结项归档只读）
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `controlled_object_archive` (
    `id`              BIGINT       NOT NULL COMMENT '原对象主键（保留原 ID）',
    `object_type`     VARCHAR(64)  NOT NULL COMMENT '对象类型',
    `tenant_id`       VARCHAR(64)  NOT NULL COMMENT '租户 ID（保留，便于按租户归档检索）',
    `project_id`      VARCHAR(64)  NULL COMMENT '所属项目',
    `payload`         JSON         NOT NULL COMMENT '归档对象完整快照（JSON）',
    `archived_at`     DATETIME     NOT NULL COMMENT '归档时间',
    `retention_due`   DATE         NULL COMMENT '保留到期日（NFR-019 归档清理触发）',
    `archive_reason`  VARCHAR(128) NULL COMMENT '归档原因（结项/容量/合规）',
    PRIMARY KEY (`id`, `archived_at`),
    KEY `idx_archive_tenant` (`tenant_id`),
    KEY `idx_archive_project` (`project_id`),
    KEY `idx_archive_retention` (`retention_due`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='受控对象归档表（冷数据，结项归档只读）'
/* 按归档时间按季度 RANGE 分区，面向年3000项目容量 */
PARTITION BY RANGE (TO_DAYS(`archived_at`)) (
    PARTITION p2026q1 VALUES LESS THAN (TO_DAYS('2026-04-01')),
    PARTITION p2026q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
    PARTITION p2026q3 VALUES LESS THAN (TO_DAYS('2026-10-01')),
    PARTITION p2026q4 VALUES LESS THAN (TO_DAYS('2027-01-01')),
    PARTITION p2027q1 VALUES LESS THAN (TO_DAYS('2027-04-01')),
    PARTITION p2027q2 VALUES LESS THAN (TO_DAYS('2027-07-01')),
    PARTITION p2027q3 VALUES LESS THAN (TO_DAYS('2027-10-01')),
    PARTITION p2027q4 VALUES LESS THAN (TO_DAYS('2028-01-01')),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- -------------------------------------------------------------------
-- 追溯闭包表（热数据）也按时间窗分区，避免单表膨胀
-- 说明：trace_closure 主表由 V1 建立，此处为容量优化追加分区说明。
-- 实际分区迁移由运维脚本按季度在线 ADD PARTITION，避免停机。
-- -------------------------------------------------------------------
-- 运维分区维护脚本示例（应用启动时/定时任务按季度执行）：
-- ALTER TABLE controlled_object_archive REORGANIZE PARTITION pmax INTO (
--   PARTITION p2028q1 VALUES LESS THAN (TO_DAYS('2028-04-01')),
--   PARTITION pmax VALUES LESS THAN MAXVALUE
-- );
