package com.mofeng.rdp.application.change;

import java.util.List;

/**
 * ECR 变更单处理结果（C-6 端到端闭环）。
 *
 * <p>聚合四维影响评估完整性、审批角色、闭包统计、关闭资格四段判定结果。</p>
 */
public class ChangeResult {

    private final String ecrId;
    private final String code;

    // 阶段一：影响评估完整性（C-16）
    private final boolean impactComplete;
    private final List<String> impactMissing;

    // 阶段二：审批角色（CHG-003 高风险自动增补）
    private final List<String> requiredApprovers;

    // 阶段三：闭包统计
    private final int closureTotal;
    private final List<String> closureUnconfirmed;
    private final int closureModified;
    private final int closureNoImpact;
    private final int closureDropped;

    // 阶段四：关闭资格（C-17/C-18）
    private final boolean canClose;
    private final String closeCode;
    private final String closeMessage;

    public ChangeResult(String ecrId, String code,
                        boolean impactComplete, List<String> impactMissing,
                        List<String> requiredApprovers,
                        int closureTotal, List<String> closureUnconfirmed,
                        int closureModified, int closureNoImpact, int closureDropped,
                        boolean canClose, String closeCode, String closeMessage) {
        this.ecrId = ecrId;
        this.code = code;
        this.impactComplete = impactComplete;
        this.impactMissing = impactMissing;
        this.requiredApprovers = requiredApprovers;
        this.closureTotal = closureTotal;
        this.closureUnconfirmed = closureUnconfirmed;
        this.closureModified = closureModified;
        this.closureNoImpact = closureNoImpact;
        this.closureDropped = closureDropped;
        this.canClose = canClose;
        this.closeCode = closeCode;
        this.closeMessage = closeMessage;
    }

    public String getEcrId() { return ecrId; }
    public String getCode() { return code; }
    public boolean isImpactComplete() { return impactComplete; }
    public List<String> getImpactMissing() { return impactMissing; }
    public List<String> getRequiredApprovers() { return requiredApprovers; }
    public int getClosureTotal() { return closureTotal; }
    public List<String> getClosureUnconfirmed() { return closureUnconfirmed; }
    public int getClosureModified() { return closureModified; }
    public int getClosureNoImpact() { return closureNoImpact; }
    public int getClosureDropped() { return closureDropped; }
    public boolean isCanClose() { return canClose; }
    public String getCloseCode() { return closeCode; }
    public String getCloseMessage() { return closeMessage; }
}
