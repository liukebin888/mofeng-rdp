package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import com.mofeng.rdp.infrastructure.persistence.plan.NotifyChannelService;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertLogRepository;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertPolicyRepository;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertPrrIssueRepository;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanNodeRepository;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 四级计划告警巡检编排（PLN-ALERT 巡检，方向 3）。
 *
 * <p>编排链路：取项目已落表四级节点 → 逐节点用 {@link PlanAlertEngine#alertResult} 判定
 * 告警阶段（fail-closed，未命中返回 null）→ 结合已发阶段做阶段跃迁去重（
 * {@link PlanAlertEngine#pendingStages} + {@link PlanAlertLogRepository#listFiredStages}）
 * → 命中且未发过的阶段经 {@link PlanAlertLogRepository#addLog} 幂等登记留痕
 * （表 uk_stage 兜底，重复 insert 由唯一约束拒绝）。</p>
 *
 * <p>投递纪律：真实消息发送由 {@link NotifyChannelService} 适配器负责，本层只登记
 * {@code channelMask} / {@code receiverIds} 留痕，不伪造发送成功（不虚假投递）。</p>
 *
 * <p>阈值口径：项目级覆盖（prj_plan_alert_policy）经 {@link PlanAlertPolicyRepository}
 * 查询后，由领域层 {@link PlanAlertEngine.Threshold#merge} 与全局基线合并（单一权威），
 * 无覆盖时回落 {@link PlanAlertEngine.Threshold#baseline()}。</p>
 *
 * <p>PRR 抱怨单：S4 抱怨阶段命中时，经 {@link PlanAlertEngine#buildPrrIssue} 生成 PRR 单
 * 并经 {@link PlanAlertPrrIssueRepository} 幂等登记（同一对象同一逾期日只建一张），
 * 编号回填至告警流水的 {@code prr_issue_id}。</p>
 */
@Service
public class PlanAlertApplicationService {

    private final PlanNodeRepository planNodeRepository;
    private final PlanAlertLogRepository planAlertLogRepository;
    private final PlanAlertPolicyRepository planAlertPolicyRepository;
    private final PlanAlertPrrIssueRepository planAlertPrrIssueRepository;
    private final NotifyChannelService notifyChannelService;

    public PlanAlertApplicationService(PlanNodeRepository planNodeRepository,
                                       PlanAlertLogRepository planAlertLogRepository,
                                       PlanAlertPolicyRepository planAlertPolicyRepository,
                                       PlanAlertPrrIssueRepository planAlertPrrIssueRepository,
                                       NotifyChannelService notifyChannelService) {
        this.planNodeRepository = planNodeRepository;
        this.planAlertLogRepository = planAlertLogRepository;
        this.planAlertPolicyRepository = planAlertPolicyRepository;
        this.planAlertPrrIssueRepository = planAlertPrrIssueRepository;
        this.notifyChannelService = notifyChannelService;
    }

    /**
     * 执行一次告警巡检（幂等：同阶段同日多跑不重复登记）。
     *
     * @param today 巡检基准日；为 null 时取服务器当前日期
     */
    @Transactional
    public PlanAlertResult scan(String tenantId, String projectId, String today) {
        TenantContextHolder.setTenantId(tenantId);
        try {
            return doScan(tenantId, projectId, today);
        } finally {
            TenantContextHolder.clear();
        }
    }

    private PlanAlertResult doScan(String tenantId, String projectId, String today) {
        String todayStr = (today == null || today.isBlank())
                ? LocalDate.now().toString()
                : today;

        List<FourLevelPlanEngine.PlanNode> nodes = planNodeRepository.listNodes(tenantId, projectId);
        // 项目级覆盖合并全局基线（单一权威），无覆盖回落 baseline
        PlanAlertEngine.Threshold override = planAlertPolicyRepository.findOverride(tenantId, projectId);
        PlanAlertEngine.Threshold threshold = PlanAlertEngine.Threshold.merge(override);

        List<PlanAlertResult.AlertItem> items = new ArrayList<>();
        int fired = 0;
        int skipped = 0;
        int hitNodes = 0;

        for (FourLevelPlanEngine.PlanNode node : nodes) {
            String dueDate = FourLevelPlanEngine.effectiveDueDate(node);
            PlanAlertEngine.AlertResult alert = PlanAlertEngine.alertResult(
                    objTypeOf(node.level), node.id, dueDate, todayStr, threshold);
            if (alert == null) continue; // 未到告警窗口（fail-closed：不虚报）
            hitNodes++;

            // 阶段跃迁去重：本对象已发过的阶段不再重发
            List<String> alreadyFired = planAlertLogRepository.listFiredStages(tenantId, alert.objType, alert.objId);
            List<String> pending = PlanAlertEngine.pendingStages(dueDate, todayStr, threshold, alreadyFired);
            for (String stage : pending) {
                // 幂等：仅登记「应发未发」阶段；重复由 uk_stage 兜底
                // S4 抱怨阶段 → 生成/复用 PRR 抱怨单并回填编号；其余阶段 prrIssueId=null
                String prrIssueId = null;
                if (PlanAlertEngine.S4_PRR.equals(stage)) {
                    PlanAlertEngine.PrrIssue prr = PlanAlertEngine.buildPrrIssue(
                            alert.objType, alert.objId, dueDate, node.name,
                            notifyChannelService.receiverIds(node, stage));
                    prrIssueId = planAlertPrrIssueRepository.ensurePrrIssue(tenantId, projectId, prr);
                }
                planAlertLogRepository.addLog(
                        tenantId, projectId, alert.objType, alert.objId, stage, node.level,
                        PlanAlertEngine.levelOf(stage),
                        notifyChannelService.channelMask(stage),
                        notifyChannelService.receiverIds(node, stage),
                        prrIssueId,
                        LocalDate.parse(dueDate), threshold.snapshot());
                fired++;
            }
            skipped += Math.max(0, 1 - pending.size()); // 当前阶段已发过 → 记一次跳过

            PlanAlertResult.AlertItem item = new PlanAlertResult.AlertItem(
                    alert.stage, alert.level, alert.objType, alert.objId, node.level,
                    notifyChannelService.receiverIds(node, alert.stage),
                    notifyChannelService.channelMask(alert.stage),
                    alert.remainDays, alert.prrTriggered);
            items.add(item);
        }

        return new PlanAlertResult(projectId, todayStr, nodes.size(), hitNodes, fired, skipped, items);
    }

    /** 节点层级 → 告警对象类型（方案第 4 章对象口径）。 */
    private String objTypeOf(String level) {
        if ("L1".equals(level)) return "CUSTOMER_NODE";
        if ("L2".equals(level)) return "COMPANY_NODE";
        return "PLAN"; // L3/L4 均归 PLAN（TASK 需任务级数据，本步以计划级覆盖）
    }
}
