package com.mofeng.rdp.domain.resource;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 资源冲突与资源池引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 resourceConflict/overallocation/resourcePool 相关用例同构，一致率 100%。</p>
 */
class ResourceEngineTest {

    private static ResourceConflictEngine.HourRecord hr(String userId, String week, double hours, String status) {
        return new ResourceConflictEngine.HourRecord(userId, "用户" + userId, week, hours, status);
    }

    // —— PRJ-016 人员周冲突 ——
    @Test
    void 三人冲突场景全部识别() {
        List<ResourceConflictEngine.HourRecord> hours = List.of(
            hr("U1", "2026-W43", 25, "已审核"),
            hr("U1", "2026-W43", 25, "已提交"),
            hr("U2", "2026-W43", 50, "已审核"),
            hr("U3", "2026-W43", 48, "已审核"));
        ResourceConflictEngine.ConflictReport r = ResourceConflictEngine.detectConflicts(hours, 40, 110);
        assertEquals(3, r.conflicts.size()); // U1(50h=125%) U2(50h=125%) U3(48h=120%)
        assertEquals(3, r.personCount);
    }

    @Test
    void 草稿工时不计入避免假冲突() {
        List<ResourceConflictEngine.HourRecord> hours = List.of(
            hr("U1", "2026-W43", 30, "草稿"),
            hr("U1", "2026-W43", 20, "已审核"));
        ResourceConflictEngine.ConflictReport r = ResourceConflictEngine.detectConflicts(hours, 40, 110);
        // 仅 20h = 50%，无冲突
        assertTrue(r.conflicts.isEmpty());
    }

    // —— RES-005 超分配三级升级 ——
    @Test
    void 三级阈值生效() {
        assertEquals(ResourceConflictEngine.OverallocLevel.L1, ResourceConflictEngine.overallocLevel(110));
        assertEquals(ResourceConflictEngine.OverallocLevel.L2, ResourceConflictEngine.overallocLevel(120));
        assertEquals(ResourceConflictEngine.OverallocLevel.L3, ResourceConflictEngine.overallocLevel(150));
        assertEquals(null, ResourceConflictEngine.overallocLevel(90));
    }

    @Test
    void 超分配识别与闸门阻断() {
        List<ResourceConflictEngine.HourRecord> hours = List.of(
            hr("U1", "2026-W43", 60, "已审核"),  // 150% L3
            hr("U2", "2026-W43", 48, "已审核")); // 120% L2
        List<ResourceConflictEngine.Overallocation> out = ResourceConflictEngine.detectOverallocations(hours, 40, Set.of());
        assertEquals(2, out.size());
        assertEquals(ResourceConflictEngine.OverallocLevel.L3, out.get(0).level);
        assertEquals(ResourceConflictEngine.OverallocLevel.L2, out.get(1).level);

        ResourceConflictEngine.GateBlock block = ResourceConflictEngine.gateBlocked(out);
        assertTrue(block.blocked);
        assertEquals(2, block.reasons.size());
    }

    // —— RES-001 资源池层级 ——
    @Test
    void 三层资源池校验() {
        List<ResourcePoolEngine.PoolNode> full = List.of(
            new ResourcePoolEngine.PoolNode("e", "企业"),
            new ResourcePoolEngine.PoolNode("d", "部门"),
            new ResourcePoolEngine.PoolNode("p", "项目"));
        assertTrue(ResourcePoolEngine.validatePoolHierarchy(full).ok);

        List<ResourcePoolEngine.PoolNode> partial = List.of(
            new ResourcePoolEngine.PoolNode("e", "企业"));
        ResourcePoolEngine.HierarchyResult r = ResourcePoolEngine.validatePoolHierarchy(partial);
        assertFalse(r.ok);
        assertEquals(2, r.missingLevels.size());
    }

    @Test
    void 兼任投入比例校验() {
        List<ResourcePoolEngine.Engagement> ok = List.of(
            new ResourcePoolEngine.Engagement("R1", 0.5),
            new ResourcePoolEngine.Engagement("R1", 0.4));
        assertTrue(ResourcePoolEngine.validateEngagementRatio(ok).ok);

        List<ResourcePoolEngine.Engagement> over = List.of(
            new ResourcePoolEngine.Engagement("R1", 0.6),
            new ResourcePoolEngine.Engagement("R1", 0.6));
        ResourcePoolEngine.RatioResult r = ResourcePoolEngine.validateEngagementRatio(over);
        assertFalse(r.ok);
        assertEquals("R1", r.over.get(0).resourceId);
    }

    @Test
    void 跨项目冲突识别() {
        List<ResourcePoolEngine.Assignment> assignments = List.of(
            new ResourcePoolEngine.Assignment("R1", "P1", "W43", 30),
            new ResourcePoolEngine.Assignment("R1", "P2", "W43", 30));
        ResourcePoolEngine.CrossConflict r = ResourcePoolEngine.crossProjectConflict(assignments, 40);
        assertTrue(r.conflictResourceIds.contains("R1"));
    }

    @Test
    void 候选人检索按匹配排序() {
        List<ResourcePoolEngine.Candidate> pool = List.of(
            new ResourcePoolEngine.Candidate("1", "甲", "系统工程师", List.of("C", "AutoSAR"), 0),
            new ResourcePoolEngine.Candidate("2", "乙", "系统工程师", List.of("C"), 0));
        List<ResourcePoolEngine.Candidate> r = ResourcePoolEngine.searchCandidates(pool, "系统工程师", List.of("C", "AutoSAR"));
        assertEquals(2, r.size());
        assertEquals("甲", r.get(0).name); // 匹配 2 项靠前
        assertEquals(2, r.get(0).matchCount);
    }

    @Test
    void 外部产能偏差() {
        ResourcePoolEngine.CapacityDeviation d = ResourcePoolEngine.externalCapacityDeviation(100, 80);
        assertFalse(d.ok);
        assertEquals(0.8, d.rate, 0.001);

        assertTrue(ResourcePoolEngine.externalCapacityDeviation(100, 100).ok);
    }

    @Test
    void 投入偏差与效率系数() {
        assertEquals(0.2, ResourcePoolEngine.effortDeviationRate(100, 80), 0.001);
        assertEquals(0.8, ResourcePoolEngine.efficiencyFactor(100, 80), 0.001);
        assertEquals(80, ResourcePoolEngine.applyEfficiencyFactor(100, 0.8), 0.001);
    }

    @Test
    void 偏差持续判定() {
        assertTrue(ResourcePoolEngine.isEstimateStale(List.of(0.15, 0.16), 0.15, 2));
        assertFalse(ResourcePoolEngine.isEstimateStale(List.of(0.15, 0.10, 0.16), 0.15, 2));
    }
}
