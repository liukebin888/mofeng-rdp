package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import com.mofeng.rdp.infrastructure.persistence.plan.NotifyChannelService;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertLogRepository;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertPolicyRepository;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertPrrIssueRepository;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanNodeRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 四级计划告警巡检编排测试（PLN-ALERT 巡检）。
 *
 * <p>用内存 stub 替代 PlanNodeRepository / PlanAlertLogRepository / NotifyChannelService，
 * 验证「逐节点判定四段式阶段 → 阶段跃迁去重 → 幂等登记」编排正确性，不依赖真实数据库。</p>
 */
class PlanAlertApplicationServiceTest {

    /** 内存节点仓库：返回预设节点。 */
    private static final class StubPlanNodeRepository implements PlanNodeRepository {
        final List<FourLevelPlanEngine.PlanNode> nodes = new ArrayList<>();

        @Override
        public List<FourLevelPlanEngine.PlanNode> listNodes(String tenantId, String projectId) {
            return new ArrayList<>(nodes);
        }

        @Override public void addNode(String t, String p, FourLevelPlanEngine.PlanNode n) { nodes.add(n); }
        @Override public void addLink(String t, String p, String u, String l) { }
        @Override public void removeAll(String t, String p) { nodes.clear(); }
        @Override public List<String[]> listProjects() { return List.of(); }
    }

    /** 内存告警流水仓库：记录 addLog 调用 + 可预设已发阶段。 */
    private static final class StubAlertLogRepository implements PlanAlertLogRepository {
        final List<String[]> logs = new ArrayList<>();
        final java.util.Map<String, List<String>> firedByObj = new java.util.HashMap<>();

        void presetFired(String objType, String objId, String stage) {
            firedByObj.computeIfAbsent(objType + "|" + objId, k -> new ArrayList<>()).add(stage);
        }

        @Override
        public void addLog(String tenantId, String projectId, String objType, String objId,
                           String stage, String planLevel, String notifyLevel, String channelMask,
                           String receiverIds, String prrIssueId, LocalDate dueDateSnapshot,
                           String thresholdSnapshot) {
            logs.add(new String[]{objType, objId, stage, notifyLevel, prrIssueId});
        }

        @Override
        public List<String> listFiredStages(String tenantId, String objType, String objId) {
            return firedByObj.getOrDefault(objType + "|" + objId, List.of());
        }
    }

    /** 固定返回简单渠道/接收人，避免测试依赖 NoopNotifyChannelService 细节。 */
    private static final class StubNotifyChannelService implements NotifyChannelService {
        @Override public String channelMask(String stage) { return "站内信"; }
        @Override public String receiverIds(FourLevelPlanEngine.PlanNode node, String stage) { return "责任人"; }
    }

    /** 内存阈值覆盖仓库：默认无覆盖，可预设覆盖。 */
    private static final class StubPlanAlertPolicyRepository implements PlanAlertPolicyRepository {
        PlanAlertEngine.Threshold override;

        @Override public PlanAlertEngine.Threshold findOverride(String tenantId, String projectId) {
            return override;
        }

        @Override public void saveOverride(String tenantId, String projectId, Integer remindDays,
                                           Integer warnDays, Integer alarmDays) {
            this.override = new PlanAlertEngine.Threshold(
                    remindDays == null ? PlanAlertEngine.DEFAULT_REMIND_DAYS : remindDays,
                    warnDays == null ? PlanAlertEngine.DEFAULT_WARN_DAYS : warnDays,
                    alarmDays == null ? PlanAlertEngine.DEFAULT_ALARM_DAYS : alarmDays,
                    PlanAlertEngine.DEFAULT_PRR_DAYS);
        }
    }

    /** 内存 PRR 单仓库：记录 ensurePrrIssue 调用，返回确定性编号。 */
    private static final class StubPlanAlertPrrIssueRepository implements PlanAlertPrrIssueRepository {
        final List<String> codes = new ArrayList<>();

        @Override
        public String ensurePrrIssue(String tenantId, String projectId, PlanAlertEngine.PrrIssue issue) {
            codes.add(issue.code);
            return issue.code;
        }
    }

    private FourLevelPlanEngine.PlanNode node(String id, String level, String date) {
        return new FourLevelPlanEngine.PlanNode(id, level, id, "节点" + id, date,
                null, null, false, "负责人", "PM", null);
    }

    private PlanAlertApplicationService svc(StubPlanNodeRepository nodeRepo,
                                            StubAlertLogRepository logRepo) {
        return svc(nodeRepo, logRepo, new StubPlanAlertPolicyRepository(), new StubPlanAlertPrrIssueRepository());
    }

    private PlanAlertApplicationService svc(StubPlanNodeRepository nodeRepo,
                                            StubAlertLogRepository logRepo,
                                            StubPlanAlertPolicyRepository policyRepo) {
        return svc(nodeRepo, logRepo, policyRepo, new StubPlanAlertPrrIssueRepository());
    }

    private PlanAlertApplicationService svc(StubPlanNodeRepository nodeRepo,
                                            StubAlertLogRepository logRepo,
                                            StubPlanAlertPolicyRepository policyRepo,
                                            StubPlanAlertPrrIssueRepository prrRepo) {
        return new PlanAlertApplicationService(nodeRepo, logRepo, policyRepo, prrRepo, new StubNotifyChannelService());
    }

    @Test
    void 逾期节点命中S3报警并按阶段跃迁补齐登记() {
        StubPlanNodeRepository nodeRepo = new StubPlanNodeRepository();
        // today=2026-11-04，due=2026-11-02 → 逾期 2 天（1 ≤ 逾期 < 7）→ S3 报警
        nodeRepo.nodes.add(node("n1", "L3", "2026-11-02"));
        StubAlertLogRepository logRepo = new StubAlertLogRepository();

        PlanAlertResult r = svc(nodeRepo, logRepo).scan("t1", "PRJ-001", "2026-11-04");

        assertEquals(1, r.getScannedNodes());
        assertEquals(1, r.getHitNodes());
        // 阶段跃迁：S3 命中时补齐 S1/S2/S3 三个「应发未发」阶段，故 fired = 3
        assertEquals(3, r.getFired());
        assertEquals(3, logRepo.logs.size());
        assertEquals("S3", logRepo.logs.get(2)[2]); // 最后一条为最高阶段 S3
    }

    @Test
    void 未到告警窗口节点不虚报() {
        StubPlanNodeRepository nodeRepo = new StubPlanNodeRepository();
        nodeRepo.nodes.add(node("n1", "L3", "2030-01-01")); // 远未到期 → 不命中
        StubAlertLogRepository logRepo = new StubAlertLogRepository();

        PlanAlertResult r = svc(nodeRepo, logRepo).scan("t1", "PRJ-001", "2026-11-04");

        assertEquals(1, r.getScannedNodes());
        assertEquals(0, r.getHitNodes());       // 未到窗口，不虚报
        assertEquals(0, r.getFired());
        assertEquals(0, logRepo.logs.size());
    }

    @Test
    void 已发阶段不重复登记() {
        StubPlanNodeRepository nodeRepo = new StubPlanNodeRepository();
        // today=2026-11-04，due=2026-11-02 → 逾期 2 天 → 命中 S3
        nodeRepo.nodes.add(node("n1", "L3", "2026-11-02"));
        StubAlertLogRepository logRepo = new StubAlertLogRepository();
        // 预设 S1/S2/S3 已发 → pendingStages 为空，跳过
        logRepo.presetFired("PLAN", "n1", "S1");
        logRepo.presetFired("PLAN", "n1", "S2");
        logRepo.presetFired("PLAN", "n1", "S3");

        PlanAlertResult r = svc(nodeRepo, logRepo).scan("t1", "PRJ-001", "2026-11-04");

        assertEquals(0, r.getFired());          // 阶段已发过，不重复登记
        assertEquals(0, logRepo.logs.size());
        assertEquals(1, r.getSkipped());        // 当前阶段已发 → 记一次跳过
    }

    @Test
    void 空项目巡检返回空结果且披露零扫描() {
        StubPlanNodeRepository nodeRepo = new StubPlanNodeRepository();
        StubAlertLogRepository logRepo = new StubAlertLogRepository();

        PlanAlertResult r = svc(nodeRepo, logRepo).scan("t1", "PRJ-001", "2026-11-04");

        assertEquals(0, r.getScannedNodes());   // 零扫描 → 「零告警」需披露而非宣称无告警
        assertEquals(0, r.getFired());
        assertEquals(0, r.getItems().size());
    }

    @Test
    void 巡检基准日缺省取今日() {
        StubPlanNodeRepository nodeRepo = new StubPlanNodeRepository();
        nodeRepo.nodes.add(node("n1", "L3", "2030-01-01"));
        StubAlertLogRepository logRepo = new StubAlertLogRepository();

        PlanAlertResult r = svc(nodeRepo, logRepo).scan("t1", "PRJ-001", null);

        assertNotNull(r.getToday());            // 缺省时取服务器当前日期
        assertEquals(LocalDate.now().toString(), r.getToday());
    }

    @Test
    void 项目级阈值覆盖生效并收紧提醒窗口() {
        StubPlanNodeRepository nodeRepo = new StubPlanNodeRepository();
        // today=2026-11-04，due=2026-11-10 → 距到期 6 天。
        // 基线 remind=7 会命中 S1；覆盖 remind=5 后 6 天 > 5 天 → 不命中（fail-closed 不虚报）
        nodeRepo.nodes.add(node("n1", "L3", "2026-11-10"));
        StubAlertLogRepository logRepo = new StubAlertLogRepository();
        StubPlanAlertPolicyRepository policyRepo = new StubPlanAlertPolicyRepository();
        policyRepo.override = new PlanAlertEngine.Threshold(5, 3, 1, 7); // remind 收紧到 5

        PlanAlertResult r = svc(nodeRepo, logRepo, policyRepo).scan("t1", "PRJ-001", "2026-11-04");

        assertEquals(1, r.getScannedNodes());
        assertEquals(0, r.getHitNodes());       // 覆盖 remind=5 生效，6 天 > 5 天 → 不虚报
        assertEquals(0, r.getFired());
    }

    @Test
    void S4命中生成PRR单并回填编号() {
        StubPlanNodeRepository nodeRepo = new StubPlanNodeRepository();
        // today=2026-11-04，due=2026-10-20 → 逾期 15 天（≥7）→ S4 抱怨
        nodeRepo.nodes.add(node("n1", "L3", "2026-10-20"));
        StubAlertLogRepository logRepo = new StubAlertLogRepository();
        StubPlanAlertPrrIssueRepository prrRepo = new StubPlanAlertPrrIssueRepository();

        PlanAlertResult r = svc(nodeRepo, logRepo, new StubPlanAlertPolicyRepository(), prrRepo)
                .scan("t1", "PRJ-001", "2026-11-04");

        // 阶段跃迁 S1~S4 共 4 条，其中 S4 一条生成了 PRR 单
        assertEquals(4, r.getFired());
        assertEquals(1, prrRepo.codes.size());
        assertEquals("PRR-n1-20261020", prrRepo.codes.get(0));

        // S4 那条告警流水的 prrIssueId 被回填为 PRR 编号（logs: [objType, objId, stage, notifyLevel, prrIssueId]）
        boolean s4Backfilled = logRepo.logs.stream()
                .anyMatch(l -> "S4".equals(l[2]) && "PRR-n1-20261020".equals(l[4]));
        assertTrue(s4Backfilled, "S4 告警流水应回填 PRR 编号");
    }
}
