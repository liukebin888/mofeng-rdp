package com.mofeng.rdp.domain.archive;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ArchiveEngineTest {

    @Test
    void 已作废不得归档() {
        ArchiveEngine.Verdict v = ArchiveEngine.canArchive("已作废", true, false);
        assertFalse(v.ok);
        assertEquals("OBSOLETE", v.code);
    }

    @Test
    void 未冻结不得归档() {
        ArchiveEngine.Verdict v = ArchiveEngine.canArchive("进行中", false, false);
        assertFalse(v.ok);
        assertEquals("NOT_FROZEN", v.code);
    }

    @Test
    void 冻结后可归档() {
        assertTrue(ArchiveEngine.canArchive("进行中", true, false).ok);
    }

    @Test
    void 已归档不可重复归档() {
        ArchiveEngine.Verdict v = ArchiveEngine.canArchive("进行中", true, true);
        assertFalse(v.ok);
        assertEquals("ALREADY_ARCHIVED", v.code);
    }

    @Test
    void 解除归档须审批() {
        assertFalse(ArchiveEngine.canUnarchive("已归档", false).ok);
        assertTrue(ArchiveEngine.canUnarchive("已归档", true).ok);
        assertFalse(ArchiveEngine.canUnarchive("进行中", true).ok);
    }

    @Test
    void 归档只读与禁下载() {
        assertTrue(ArchiveEngine.isReadOnly("已归档"));
        assertFalse(ArchiveEngine.isReadOnly("进行中"));
        assertFalse(ArchiveEngine.canDownload("已作废"));
        assertTrue(ArchiveEngine.canDownload("已发布"));
    }

    @Test
    void 保留期限计算() {
        assertEquals("2027-11-30", ArchiveEngine.retentionDue("2026-11-01", 12));
        assertEquals("2026-12-31", ArchiveEngine.retentionDue("2026-11-01", 1));
        // 2026-11 + 16 个月 = 2028-03，最后一天 31 日
        assertEquals("2028-03-31", ArchiveEngine.retentionDue("2026-11-01", 16));
        // 跨闰年 2 月：2025-11 + 3 个月 = 2026-02，非闰年 28 日
        assertEquals("2026-02-28", ArchiveEngine.retentionDue("2025-11-15", 3));
        // 闰年 2 月：2023-11 + 3 个月 = 2024-02，闰年 29 日
        assertEquals("2024-02-29", ArchiveEngine.retentionDue("2023-11-15", 3));
    }
}
