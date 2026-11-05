package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.infrastructure.persistence.plan.PlanNodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 四级计划告警定时巡检调度（PLN-ALERT 定时巡检，方向 4 第 1 项）。
 *
 * <p>职责：按 cron 周期遍历「有四级计划落表」的 (tenantId, projectId) 组合，
 * 逐项目调用 {@link PlanAlertApplicationService#scan} 触发四段式告警巡检，
 * 汇总各项目巡检中间指标并留审计日志。判定权威仍在 {@code PlanAlertEngine}，
 * 本类只做调度编排（ARC-001）。</p>
 *
 * <p>开关与周期（application.yml 可覆盖）：</p>
 * <ul>
 *   <li>{@code mofeng.plan-alert.schedule-enabled}（默认 true）——是否启用定时巡检；</li>
 *   <li>{@code mofeng.plan-alert.cron}（默认 {@code 0 0 2 * * ?}）——每天 02:00 巡检。</li>
 * </ul>
 *
 * <p>单次巡检抛异常不中断整体：逐项目 try/catch 隔离，保证一个项目失败不阻塞其余项目。</p>
 */
@Component
public class PlanAlertScheduleService {

    private static final Logger log = LoggerFactory.getLogger(PlanAlertScheduleService.class);

    private final PlanNodeRepository planNodeRepository;
    private final PlanAlertApplicationService planAlertApplicationService;

    @Value("${mofeng.plan-alert.schedule-enabled:true}")
    boolean scheduleEnabled;

    @Value("${mofeng.plan-alert.cron:0 0 2 * * ?}")
    String cronExpression;

    public PlanAlertScheduleService(PlanNodeRepository planNodeRepository,
                                    PlanAlertApplicationService planAlertApplicationService) {
        this.planNodeRepository = planNodeRepository;
        this.planAlertApplicationService = planAlertApplicationService;
    }

    /**
     * 定时巡检：遍历所有有落表计划的项目，逐项目扫描四段式告警。
     * 每天凌晨 02:00 触发（cron 可覆盖），开关关闭时跳过。
     */
    @Scheduled(cron = "${mofeng.plan-alert.cron:0 0 2 * * ?}")
    public void scanAllProjects() {
        if (!scheduleEnabled) {
            return;
        }
        String today = LocalDate.now().toString();
        List<String[]> projects = planNodeRepository.listProjects();
        int totalFired = 0;
        int totalScanned = 0;
        int failures = 0;

        for (String[] tp : projects) {
            String tenantId = tp[0];
            String projectId = tp[1];
            try {
                PlanAlertResult r = planAlertApplicationService.scan(tenantId, projectId, today);
                totalFired += r.getFired();
                totalScanned += r.getScannedNodes();
                if (r.getFired() > 0) {
                    log.info("[plan-alert] 项目 {} 巡检：扫描 {} 节点，新发告警 {} 条（命中 {}）",
                            projectId, r.getScannedNodes(), r.getFired(), r.getHitNodes());
                }
            } catch (RuntimeException ex) {
                failures++;
                log.error("[plan-alert] 项目 {} 巡检失败：{}", projectId, ex.getMessage(), ex);
            }
        }

        log.info("[plan-alert] 定时巡检完成：覆盖 {} 个项目，扫描 {} 节点，新发告警 {} 条，失败 {} 项",
                projects.size(), totalScanned, totalFired, failures);
    }
}
