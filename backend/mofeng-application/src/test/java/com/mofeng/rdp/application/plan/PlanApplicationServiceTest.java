package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanNodeRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 四级计划落表应用服务编排测试（PLN-4LV 落表）。
 *
 * <p>用内存 stub 替代 PlanNodeRepository，验证「三硬约束校验 → 重建式双写」编排正确性：
 * 校验通过才落表（节点 + 承接关系），违规则 fail-closed 零写入。不依赖真实数据库。</p>
 */
class PlanApplicationServiceTest {

    /** 内存仓库 stub：记录节点与承接关系写入，模拟 removeAll/addNode/addLink。 */
    private static final class InMemoryPlanNodeRepository implements PlanNodeRepository {
        final List<FourLevelPlanEngine.PlanNode> nodes = new ArrayList<>();
        final List<String> links = new ArrayList<>();
        int removeCount = 0;

        @Override
        public List<FourLevelPlanEngine.PlanNode> listNodes(String tenantId, String projectId) {
            return new ArrayList<>(nodes);
        }

        @Override
        public void addNode(String tenantId, String projectId, FourLevelPlanEngine.PlanNode node) {
            nodes.add(node);
        }

        @Override
        public void addLink(String tenantId, String projectId, String upperNodeId, String lowerNodeId) {
            links.add(upperNodeId + "->" + lowerNodeId);
        }

        @Override
        public void removeAll(String tenantId, String projectId) {
            removeCount++;
            nodes.clear();
            links.clear();
        }

        @Override
        public List<String[]> listProjects() {
            return List.of();
        }
    }

    /** 构造一条「合法对齐」的四级链：L1 ← L2 ← L3 ← L4，且下级日期不晚于上级。 */
    private PlanRequest validRequest() {
        PlanRequest r = new PlanRequest();
        r.setTenantId("t1");
        r.setOrgId("org1");
        r.setProjectId("PRJ-001");
        r.setUserName("张三");
        r.setRoleName("PM");

        List<PlanRequest.NodeDto> nodes = new ArrayList<>();
        nodes.add(node("n1", "L1", "L1-01", "客户SOP节点", "2026-12-31", null, null, true, null));
        nodes.add(node("n2", "L2", "L2-01", "量产爬坡", "2026-11-30", null, null, false, "n1"));
        nodes.add(node("n3", "L3", "L3-01", "试产", "2026-10-31", null, null, false, "n2"));
        nodes.add(node("n4", "L4", "L4-01", "模具开发计划", "2026-09-30", null, null, false, "n3"));
        r.setNodes(nodes);
        return r;
    }

    private PlanRequest.NodeDto node(String id, String level, String code, String name,
                                     String date, String baselineDate, String actualDate,
                                     boolean milestone, String upperNodeId) {
        PlanRequest.NodeDto d = new PlanRequest.NodeDto();
        d.setId(id);
        d.setLevel(level);
        d.setCode(code);
        d.setName(name);
        d.setDate(date);
        d.setBaselineDate(baselineDate);
        d.setActualDate(actualDate);
        d.setMilestone(milestone);
        d.setOwnerName("负责人");
        d.setOwnerRole("PM");
        d.setUpperNodeId(upperNodeId);
        return d;
    }

    @Test
    void 校验通过重建式落表且双写节点与承接关系() {
        InMemoryPlanNodeRepository repo = new InMemoryPlanNodeRepository();
        PlanApplicationService svc = new PlanApplicationService(repo);

        PlanResult result = svc.save(validRequest());

        assertTrue(result.isSaved());
        assertTrue(result.isPassable());
        assertEquals(100, result.getAlignRate());
        assertEquals(4, repo.nodes.size());          // 4 个节点已入库
        assertEquals(3, repo.links.size());          // 3 条承接关系（L2→L1, L3→L2, L4→L3）
        assertEquals(1, repo.removeCount);           // 重建式：先清空一次
    }

    @Test
    void 违规孤儿上级阻断零写入() {
        InMemoryPlanNodeRepository repo = new InMemoryPlanNodeRepository();
        PlanApplicationService svc = new PlanApplicationService(repo);

        // 构造：n2 承接 n1 的链断裂——n3 是 L3 但无下级承接且本身是孤儿上级场景
        // 更直接：让 L1(n1) 没有任何下级承接（R-COVER 违规）
        PlanRequest r = new PlanRequest();
        r.setTenantId("t1");
        r.setOrgId("org1");
        r.setProjectId("PRJ-001");
        List<PlanRequest.NodeDto> nodes = new ArrayList<>();
        nodes.add(node("n1", "L1", "L1-01", "客户SOP节点", "2026-12-31", null, null, true, null));
        nodes.add(node("n2", "L2", "L2-01", "量产爬坡", "2026-11-30", null, null, false, null)); // n2 未承接 n1
        r.setNodes(nodes);

        PlanResult result = svc.save(r);

        assertFalse(result.isSaved());
        assertFalse(result.isPassable());
        assertFalse(result.getViolations().isEmpty());
        assertTrue(result.getViolations().stream().anyMatch(v -> v.startsWith("R-COVER")));
        assertEquals(0, repo.nodes.size());          // 违规零写入
        assertEquals(0, repo.links.size());
        assertEquals(0, repo.removeCount);           // 未清空即阻断，零副作用
    }

    @Test
    void 下级滞后上级阻断且回传R_NOLAG() {
        InMemoryPlanNodeRepository repo = new InMemoryPlanNodeRepository();
        PlanApplicationService svc = new PlanApplicationService(repo);

        // L2(n2) 日期晚于 L1(n1)，触发 R-NOLAG
        PlanRequest r = new PlanRequest();
        r.setTenantId("t1");
        r.setProjectId("PRJ-001");
        List<PlanRequest.NodeDto> nodes = new ArrayList<>();
        nodes.add(node("n1", "L1", "L1-01", "客户SOP节点", "2026-10-01", null, null, true, null));
        nodes.add(node("n2", "L2", "L2-01", "量产爬坡", "2026-11-30", null, null, false, "n1")); // 11-30 > 10-01 滞后
        r.setNodes(nodes);

        PlanResult result = svc.save(r);

        assertFalse(result.isSaved());
        assertTrue(result.getViolations().stream().anyMatch(v -> v.startsWith("R-NOLAG")));
        assertEquals(0, repo.nodes.size());
    }
}
