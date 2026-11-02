package com.mofeng.rdp.domain.software;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SoftwareEngineTest {

    @Test
    void sci完整性() {
        SoftwareEngine.SciResult r = SoftwareEngine.sciCompleteness(
            "SCI-1", "制动控制", List.of("a1"), List.of("s1"));
        assertTrue(r.complete);
    }

    @Test
    void sci缺安全需求关联() {
        SoftwareEngine.SciResult r = SoftwareEngine.sciCompleteness(
            "SCI-1", "x", List.of("a1"), List.of());
        assertFalse(r.complete);
        assertTrue(r.missing.contains("关联安全需求 <1"));
    }

    @Test
    void 版本对象十二类关联() {
        SoftwareEngine.VersionRelationResult r = SoftwareEngine.versionRelations(List.of("架构"));
        assertFalse(r.complete);
        assertTrue(r.missingTypes.contains("安全需求"));
    }

    @Test
    void 补丁分支拒新功能() {
        assertFalse(SoftwareEngine.branchCommitAllowed("补丁分支", "新功能").allowed);
        assertTrue(SoftwareEngine.branchCommitAllowed("补丁分支", "缺陷修复").allowed);
        assertTrue(SoftwareEngine.branchCommitAllowed("主分支", "新功能").allowed);
    }

    @Test
    void 变体差异对比() {
        Map<String, String> a = Map.of("总线", "CAN", "车型", "SUV");
        Map<String, String> b = Map.of("总线", "CAN-FD", "车型", "SUV");
        SoftwareEngine.VariantResult r = SoftwareEngine.compareVariants(a, b);
        assertTrue(r.same.contains("车型"));
        assertArrayEquals(new String[]{"CAN", "CAN-FD"}, r.different.get("总线"));
    }

    @Test
    void 快照冻结拦截Gate4() {
        assertTrue(SoftwareEngine.gate4DeliveryOnSnapshot(true).allowed);
        assertFalse(SoftwareEngine.gate4DeliveryOnSnapshot(false).allowed);
    }

    @Test
    void 版本差异四类齐全() {
        List<SoftwareEngine.FileEntry> oldFiles = List.of(
            new SoftwareEngine.FileEntry("a.c", "1"),
            new SoftwareEngine.FileEntry("b.c", "2"),
            new SoftwareEngine.FileEntry("c.c", "3"));
        List<SoftwareEngine.FileEntry> newFiles = List.of(
            new SoftwareEngine.FileEntry("a.c", "1"),
            new SoftwareEngine.FileEntry("b.c", "9"),
            new SoftwareEngine.FileEntry("d.c", "4"));
        SoftwareEngine.VersionDiffResult r = SoftwareEngine.diffVersions(oldFiles, newFiles);
        assertEquals(List.of("d.c"), r.addedFiles);
        assertEquals(List.of("c.c"), r.removedFiles);
        assertEquals(List.of("b.c"), r.modifiedFiles);
        assertEquals(List.of("a.c"), r.unchangedFiles);
    }

    @Test
    void 刷写兼容回滚() {
        assertFalse(SoftwareEngine.flashingAllowed(List.of(), List.of(), null, false).allowed);
        assertFalse(SoftwareEngine.flashingAllowed(List.of("hw1"), List.of("CAN"), null, true).allowed);
        assertTrue(SoftwareEngine.flashingAllowed(List.of("hw1"), List.of("CAN"), "回滚脚本已验证", true).allowed);
    }

    @Test
    void 发布双签() {
        assertFalse(SoftwareEngine.releaseSignoffComplete("A", "").allowed);
        assertTrue(SoftwareEngine.releaseSignoffComplete("A", "B").allowed);
    }

    @Test
    void 组合基线互查() {
        SoftwareEngine.CombinedBaselineResult r =
            SoftwareEngine.combinedBaselineLookup(true, "sw1", "hw1", "software");
        assertTrue(r.found);
        assertEquals("hw1", r.peer);
        assertFalse(SoftwareEngine.combinedBaselineLookup(false, "sw1", "hw1", "software").found);
    }
}
