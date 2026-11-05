package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanAlertPolicyRepository;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 四级计划告警阈值项目级覆盖编排（PLN-ALERT 阈值覆盖，方向 4 第 2 项）。
 *
 * <p>阈值收紧校验权威在领域层 {@link PlanAlertEngine#validateThreshold}（R-08），
 * 本层只编排「读覆盖 / 校验合并 / 写覆盖」，不做时点判定（ARC-001）。</p>
 *
 * <p>fail-closed：覆盖项合并全局基线后经 {@code validateThreshold} 校验，非法则拒绝写入
 * 并返回阻断结果，不落库（宁可沿用基线也不放宽红线）。</p>
 */
@Service
public class PlanAlertPolicyApplicationService {

    private final PlanAlertPolicyRepository planAlertPolicyRepository;

    public PlanAlertPolicyApplicationService(PlanAlertPolicyRepository planAlertPolicyRepository) {
        this.planAlertPolicyRepository = planAlertPolicyRepository;
    }

    /** 查询某项目生效阈值（覆盖合并基线）。 */
    public PlanAlertPolicyResult get(String tenantId, String projectId) {
        TenantContextHolder.setTenantId(tenantId);
        try {
            PlanAlertEngine.Threshold override = planAlertPolicyRepository.findOverride(tenantId, projectId);
            PlanAlertEngine.Threshold effective = PlanAlertEngine.Threshold.merge(override);
            return new PlanAlertPolicyResult(tenantId, projectId,
                    effective.remindDays, effective.warnDays, effective.alarmDays, effective.prrDays,
                    override != null);
        } finally {
            TenantContextHolder.clear();
        }
    }

    /**
     * 保存某项目阈值覆盖（fail-closed：非法覆盖拒绝写入）。
     *
     * @return 落表结果（valid=false 表示收紧校验失败，未写入）
     */
    @Transactional
    public PolicySaveResult save(PlanAlertPolicyRequest request) {
        TenantContextHolder.setTenantId(request.getTenantId());
        try {
            // 合并基线后校验（null 回落基线，保证校验对象完整）
            PlanAlertEngine.Threshold merged = PlanAlertEngine.Threshold.merge(
                    new PlanAlertEngine.Threshold(
                            nullable(request.getRemindDays(), PlanAlertEngine.DEFAULT_REMIND_DAYS),
                            nullable(request.getWarnDays(), PlanAlertEngine.DEFAULT_WARN_DAYS),
                            nullable(request.getAlarmDays(), PlanAlertEngine.DEFAULT_ALARM_DAYS),
                            PlanAlertEngine.DEFAULT_PRR_DAYS));
            PlanAlertEngine.ThresholdVerdict verdict = PlanAlertEngine.validateThreshold(merged);
            if (!verdict.valid) {
                return PolicySaveResult.rejected(verdict.message);
            }
            planAlertPolicyRepository.saveOverride(
                    request.getTenantId(), request.getProjectId(),
                    request.getRemindDays(), request.getWarnDays(), request.getAlarmDays());
            return PolicySaveResult.saved(merged);
        } finally {
            TenantContextHolder.clear();
        }
    }

    private static Integer nullable(Integer v, int fallback) {
        return v == null ? fallback : v;
    }

    /** 覆盖保存结果（fail-closed：valid=false 表示被拒绝，未落库）。 */
    public static final class PolicySaveResult {
        private final boolean valid;
        private final String message;
        private final int remindDays;
        private final int warnDays;
        private final int alarmDays;
        private final int prrDays;

        private PolicySaveResult(boolean valid, String message, int remindDays, int warnDays,
                                 int alarmDays, int prrDays) {
            this.valid = valid;
            this.message = message;
            this.remindDays = remindDays;
            this.warnDays = warnDays;
            this.alarmDays = alarmDays;
            this.prrDays = prrDays;
        }

        static PolicySaveResult saved(PlanAlertEngine.Threshold t) {
            return new PolicySaveResult(true, null, t.remindDays, t.warnDays, t.alarmDays, t.prrDays);
        }

        static PolicySaveResult rejected(String message) {
            return new PolicySaveResult(false, message, 0, 0, 0, 0);
        }

        public boolean isValid() { return valid; }
        public String getMessage() { return message; }
        public int getRemindDays() { return remindDays; }
        public int getWarnDays() { return warnDays; }
        public int getAlarmDays() { return alarmDays; }
        public int getPrrDays() { return prrDays; }
    }
}
