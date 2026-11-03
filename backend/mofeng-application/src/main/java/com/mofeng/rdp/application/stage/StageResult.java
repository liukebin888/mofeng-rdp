package com.mofeng.rdp.application.stage;

import java.util.List;

/**
 * 研发阶段管控结果（产品核心「审批驱动阶段门禁」服务端写路径出参）。
 *
 * <p>聚合四类写路径动作（advance / createWorkItem / configure / release）的判定结果：
 * allowed（是否放行）+ note（判定说明）+ blockers（阻断项）。</p>
 *
 * <p>fail-closed 语义：🔴 档违规直接抛异常（422），不到达本结果；本结果承载
 * 🟡 档（依配置放行/拒绝）与 🟢 档（只读披露）的判定输出，供前端提示。</p>
 */
public class StageResult {

    private final String op;
    private final String stageCode;
    private final boolean allowed;
    private final String note;
    private final List<String> blockers;

    public StageResult(String op, String stageCode, boolean allowed, String note, List<String> blockers) {
        this.op = op;
        this.stageCode = stageCode;
        this.allowed = allowed;
        this.note = note;
        this.blockers = blockers == null ? List.of() : List.copyOf(blockers);
    }

    public String getOp() { return op; }
    public String getStageCode() { return stageCode; }
    public boolean isAllowed() { return allowed; }
    public String getNote() { return note; }
    public List<String> getBlockers() { return blockers; }
}
