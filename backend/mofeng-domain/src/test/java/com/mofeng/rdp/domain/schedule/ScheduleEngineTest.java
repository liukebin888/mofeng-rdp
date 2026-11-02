package com.mofeng.rdp.domain.schedule;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 计划与调度引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 {@code app/tests/domain.spec.ts}「CPM 与计划质量」用例同构。
 * 同一套输入、同一套期望，一致率 100%。</p>
 */
class ScheduleEngineTest {

    /** 构造一个简单 WBS：1.1 依赖 1.0，无成环。 */
    private static List<ScheduleEngine.Node> simpleWbs() {
        List<ScheduleEngine.Dep> deps1 = List.of(new ScheduleEngine.Dep("n0", "FS", 0));
        List<ScheduleEngine.Node> nodes = new ArrayList<>();
        // n0 是父节点（parentId=null，被 n1 依赖），n1 是叶子
        nodes.add(new ScheduleEngine.Node("n0", "1.0", "启动", null, 5, 0, 5, null, null, 100, 0,
            List.of(), "", "项目默认日历", "R1", "项目经理"));
        nodes.add(new ScheduleEngine.Node("n1", "1.1", "设计", "n0", 10, 5, 15, null, null, 50, 50,
            deps1, "", "项目默认日历", "R2", "工程师"));
        return nodes;
    }

    @Test
    void cpm计算正确无成环() {
        ScheduleEngine.CpmResult r = ScheduleEngine.computeCpm(simpleWbs());
        assertEquals(15, r.duration);
        assertEquals(2, r.nodes.size());
        assertTrue(!r.hasNegativeFloat);
    }

    @Test
    void 成环依赖被拒绝() {
        // 构造 1.0 依赖 1.1，1.1 依赖 1.0 的成环
        List<ScheduleEngine.Node> nodes = new ArrayList<>();
        nodes.add(new ScheduleEngine.Node("n0", "1.0", "A", null, 5, 0, 5, null, null, 100, 50,
            List.of(new ScheduleEngine.Dep("n1", "FS", 0)), "", "项目默认日历", "R1", "PM"));
        nodes.add(new ScheduleEngine.Node("n1", "1.1", "B", "n0", 10, 5, 15, null, null, 50, 50,
            List.of(new ScheduleEngine.Dep("n0", "FS", 0)), "", "项目默认日历", "R2", "工程师"));
        assertThrows(ScheduleEngine.CyclicDependencyError.class, () -> ScheduleEngine.computeCpm(nodes));
    }

    @Test
    void 加权完成率双路径一致() {
        ScheduleEngine.WeightedCompletion w = ScheduleEngine.weightedCompletion(simpleWbs(), 1000);
        // 仅 n1 为叶子（weight=50, percent=50）→ weightedPercent = 50
        assertEquals(50, w.weightedPercent, 0.001);
        assertTrue(w.consistent);
        assertEquals(500, w.evByWeight, 0.001);
    }

    @Test
    void 质量检查输出十三项() {
        ScheduleEngine.QualityResult q = ScheduleEngine.planQualityChecks(simpleWbs());
        assertEquals(13, q.checks.size());
        assertTrue(q.health >= 0);
        assertTrue(q.health <= 100);
    }
}
