package com.mofeng.rdp.application.stage;

import com.mofeng.rdp.domain.flow.FlowEngine;
import com.mofeng.rdp.domain.gate.GateEngine;
import com.mofeng.rdp.domain.stage.ApprovalBindingEngine;
import com.mofeng.rdp.domain.stage.DeliverableApprovalEngine;
import com.mofeng.rdp.domain.stage.GateEnforceEngine;
import com.mofeng.rdp.domain.stage.StageTemplateEngine;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 研发阶段管控应用服务（产品核心「审批驱动阶段门禁」的服务端权威写路径）。
 *
 * <p>定位：把 4 个领域引擎（StageTemplateEngine / GateEnforceEngine / ApprovalBindingEngine /
 * DeliverableApprovalEngine）编排为「服务端拒绝」的写路径，兑现决策文档
 * {@code docs/SERVER-SIDE-REJECTION-DECISION.md} 的三档拦截：</p>
 *
 * <ul>
 *   <li>🔴 硬拒绝（A3 阶段不存在 / B3 审批驳回仍放行 / D1 依赖环 / D2 删被依赖阶段 / D3 code 冲突）：
 *       抛 {@link IllegalArgumentException}，由全局异常处理器收敛为 HTTP 422 BLOCKED，fail-closed 不可配置关闭；</li>
 *   <li>🟡 可配置拒绝（A1 前序未批 / A2 闸门未过 / B1 未绑定审批 / B2 审批进行中 / B4 会签未齐 /
 *       C1 必交未批 / C2 交付物未齐 / C3 未绑定却标记）：读配置字段（strictMode / allowConditional /
 *       approvalRequired / allowPartialApprove / signMode / required / allowDeferredDeliverable）决定力度；</li>
 *   <li>🟢 只读披露（E1 跨层不一致 / E3 存量违规）：只返回状态供前端提示，不拦截。</li>
 * </ul>
 *
 * <p>应用层只做编排与「拒绝动作」，判定一律调领域引擎（ARC-001），不承载任何规则。
 * 引擎保持纯函数（只判定不拒绝），本服务是「拒绝」动作的唯一落点。</p>
 *
 * <p>本服务是无状态纯编排（无持久化依赖，与 SampleApplicationService 一致），
 * 便于独立单测。持久化留待基础设施层接入（后续把 stage 受控对象入库）。</p>
 */
@Service
public class StageApplicationService {

    // -------------------------------------------------------------------------
    // 动作一：阶段推进（A1/A2/A3/B1/B2/B4/C2 落点）
    // -------------------------------------------------------------------------

    /**
     * 阶段推进判定：目标阶段能否进入，取决于其前置阶段「已批准」（审批完成 + 闸门通过）。
     *
     * <p>三档映射：</p>
     * <ul>
     *   <li>A3 阶段不存在 → 🔴 硬拒绝（fail-closed，抛 IllegalArgumentException）；</li>
     *   <li>A1 前序未批准 → 🟡 依 strictMode（true 拒绝 / false 警告放行）；</li>
     *   <li>B1 未绑定审批链 → 🟡 依 approvalRequired（true 拒绝 / false 放行）；</li>
     *   <li>B2 审批进行中 → 🟡 依 allowPartialApprove（true 放行 / false 拒绝）；</li>
     *   <li>B3 审批驳回却放行 → 🔴 硬拒绝；</li>
     *   <li>通过 → 放行。</li>
     * </ul>
     */
    public StageResult advanceStage(StageRequest request) {
        StageTemplateEngine.StageTemplate tpl = resolveTemplate(request);
        String targetCode = request.getTargetStageCode();
        if (targetCode == null || targetCode.isBlank()) {
            throw new IllegalArgumentException("目标阶段 code 必填");
        }

        StageTemplateEngine.StageDef target = StageTemplateEngine.findStage(tpl, targetCode);
        // A3：阶段不存在 → 硬拒绝（fail-closed）
        if (target == null) {
            throw new IllegalArgumentException("阶段 " + targetCode + " 不在模板 " + tpl.id() + " 内（A3 硬拒绝）");
        }

        List<ApprovalBindingEngine.ApprovalBinding> bindings = toBindings(request);
        List<FlowEngine.FlowInstance> instances = toInstances(request);
        Map<String, Boolean> gatePassedMap = toGatePassedMap(request);

        List<String> blockers = new ArrayList<>();
        StringBuilder note = new StringBuilder();

        for (String preCode : target.prerequisites()) {
            StageTemplateEngine.StageDef preStage = StageTemplateEngine.findStage(tpl, preCode);
            if (preStage == null) {
                blockers.add(preCode + "（前置阶段不存在）");
                continue;
            }

            // B1：前置阶段未绑定审批链
            ApprovalBindingEngine.ApprovalBinding binding =
                ApprovalBindingEngine.bindingOf(bindings, preCode);
            boolean approvalRequired = request.isApprovalRequired(); // 🟡 配置字段（默认 true）
            if (binding == null && approvalRequired) {
                blockers.add(preStage.name() + "（未绑定审批链，B1）");
                continue;
            }

            // B3：审批已驳回却仍要放行 → 硬拒绝（fail-closed）
            if (isRejected(instances, binding)) {
                throw new IllegalArgumentException(
                    "前置阶段 " + preStage.name() + " 的审批链已被驳回，禁止进入下一阶段（B3 硬拒绝）");
            }

            // 前置阶段闸门判定
            boolean gatePassed = gatePassedMap.getOrDefault(preStage.gateCode(), false);

            // 免审批（binding==null 且 approvalRequired=false）：仅看闸门
            if (binding == null) {
                if (!gatePassed && request.isStrictMode()) {
                    blockers.add(preStage.name() + "（闸门未通过）");
                }
                continue;
            }

            // 前置阶段审批证据
            ApprovalBindingEngine.GateReleaseEvidence ev =
                ApprovalBindingEngine.gateReleaseEvidence(tpl, preCode, bindings, instances);

            if (!ev.released()) {
                // B2：审批进行中 → 依 allowPartialApprove
                boolean allowPartial = request.isAllowPartialApprove(); // 🟡 默认 false
                if ("PENDING".equals(ev.code()) && allowPartial) {
                    note.append("（前置 ").append(preStage.name()).append(" 审批进行中，允许先行，B2）");
                    continue;
                }
                if (!gatePassed) {
                    // A1/A2：前序未批准 / 闸门未过 → 依 strictMode / allowConditional
                    boolean strict = request.isStrictMode(); // 🟡 默认汽车零部件 true
                    if (strict) {
                        blockers.add(preStage.name() + "（" + ev.note() + "）");
                    } else {
                        note.append("（前置 ").append(preStage.name()).append(" 未批准，宽松放行，A1）");
                    }
                    continue;
                }
                blockers.add(preStage.name() + "（" + ev.note() + "）");
            }
        }

        boolean allowed = blockers.isEmpty();
        return new StageResult(
            "advance", targetCode, allowed,
            allowed ? "阶段 " + target.name() + " 前置已满足，可进入" + note
                    : "阶段 " + target.name() + " 前置未满足：" + String.join("；", blockers),
            blockers);
    }

    // -------------------------------------------------------------------------
    // 动作二：工作对象创建（A1 落点）
    // -------------------------------------------------------------------------

    /**
     * 工作对象创建资格：目标阶段的前置须「已批准」，否则阻断（GAT-ENF-001「未批准不得实施」）。
     *
     * <p>🔴 A3 阶段不存在 → 硬拒绝；🟡 A1 前序未批 → 依 strictMode。</p>
     */
    public StageResult createWorkItem(StageRequest request) {
        StageTemplateEngine.StageTemplate tpl = resolveTemplate(request);
        String targetCode = request.getTargetStageCode();
        if (targetCode == null || targetCode.isBlank()) {
            throw new IllegalArgumentException("目标阶段 code 必填");
        }

        GateEnforceEngine.Verdict v = GateEnforceEngine.enforceStageGate(
            tpl, targetCode, toGateRuns(request));
        if ("STAGE_UNKNOWN".equals(v.code())) {
            throw new IllegalArgumentException(v.note() + "（A3 硬拒绝）");
        }
        if ("BLOCKED_PREREQ".equals(v.code())) {
            if (request.isStrictMode()) {
                throw new IllegalArgumentException(v.note() + "（A1 硬拒绝：strictMode=true）");
            }
            return new StageResult("createWorkItem", targetCode, false, v.note() + "（A1 宽松放行，仅披露）", v.blockedBy());
        }
        return new StageResult("createWorkItem", targetCode, true, v.note(), List.of());
    }

    // -------------------------------------------------------------------------
    // 动作三：模板配置（D1/D2/D3 落点）
    // -------------------------------------------------------------------------

    /**
     * 阶段模板配置（增删改）。D1 依赖环 / D2 删被依赖 / D3 code/order 冲突 → 🔴 硬拒绝。
     */
    public StageResult configureStage(StageRequest request) {
        StageTemplateEngine.StageTemplate tpl = resolveTemplate(request);
        String op = request.getOp();
        if (op == null || op.isBlank()) {
            throw new IllegalArgumentException("配置操作 op 必填（add/remove/update）");
        }
        StageTemplateEngine.TemplateOp result;
        switch (op) {
            case "add" -> {
                StageTemplateEngine.StageDef stage = toStageDef(request);
                result = StageTemplateEngine.addStage(tpl, stage);
            }
            case "remove" -> result = StageTemplateEngine.removeStage(tpl, request.getStageCode());
            case "update" -> result = StageTemplateEngine.updateStage(
                tpl, request.getStageCode(), request.getStageName(), request.getStageOrder(),
                request.getGateCode(), toPrereqList(request));
            default -> throw new IllegalArgumentException("未知配置操作：" + op);
        }

        if (!result.ok()) {
            // D1/D2/D3：配置合法性违规 → 硬拒绝
            throw new IllegalArgumentException(result.note());
        }
        StageTemplateEngine.ValidateResult vr = StageTemplateEngine.validateTemplate(result.tpl());
        if (!vr.ok()) {
            throw new IllegalArgumentException("模板配置形成非法状态：" + String.join("；", vr.errors()));
        }
        return new StageResult("configure", request.getStageCode(), true, result.note(), List.of());
    }

    // -------------------------------------------------------------------------
    // 动作四：审批放行（B3/B4 落点）
    // -------------------------------------------------------------------------

    /**
     * 阶段审批放行判定：审批完成 + 闸门通过才放行（P2 只有批准才能实施下一阶段）。
     * B3 驳回放行 → 🔴 硬拒绝；B4 会签未齐 → 🟡 依 signMode。
     */
    public StageResult releaseStage(StageRequest request) {
        StageTemplateEngine.StageTemplate tpl = resolveTemplate(request);
        String stageCode = request.getStageCode();
        if (stageCode == null || stageCode.isBlank()) {
            throw new IllegalArgumentException("阶段 code 必填");
        }
        List<ApprovalBindingEngine.ApprovalBinding> bindings = toBindings(request);
        List<FlowEngine.FlowInstance> instances = toInstances(request);

        // B3：审批已驳回却请求放行 → 硬拒绝（fail-closed）
        ApprovalBindingEngine.ApprovalBinding binding =
            ApprovalBindingEngine.bindingOf(bindings, stageCode);
        if (isRejected(instances, binding)) {
            throw new IllegalArgumentException("阶段 " + stageCode + " 的审批链已驳回，禁止放行（B3 硬拒绝）");
        }

        boolean gatePassed = toGatePassedMap(request).getOrDefault(
            StageTemplateEngine.findStage(tpl, stageCode) == null
                ? null : StageTemplateEngine.findStage(tpl, stageCode).gateCode(), false);

        ApprovalBindingEngine.StageReleaseVerdict v =
            ApprovalBindingEngine.stageFullyReleased(tpl, stageCode, bindings, instances, gatePassed);

        if (!v.released() && "APPROVAL_NOT_DONE".equals(v.code()) && "any".equals(request.getSignMode())) {
            // B4 会签未齐但 signMode=any → 放行
            return new StageResult("release", stageCode, true, v.note() + "（B4 signMode=any 放行）", List.of());
        }
        if (!v.released() && "GATE_NOT_PASSED".equals(v.code()) && request.isAllowConditional()) {
            // A2 闸门 conditional 放行
            return new StageResult("release", stageCode, true, v.note() + "（A2 allowConditional 放行）", List.of());
        }
        return new StageResult("release", stageCode, v.released(), v.note(), List.of());
    }

    // -------------------------------------------------------------------------
    // DTO → 领域值对象映射
    // -------------------------------------------------------------------------

    private StageTemplateEngine.StageTemplate resolveTemplate(StageRequest request) {
        String tplId = request.getTemplateId();
        if (tplId == null || tplId.isBlank()) {
            // 默认汽车零部件六阶段模板
            return StageTemplateEngine.AUTOMOTIVE;
        }
        StageTemplateEngine.StageTemplate tpl = StageTemplateEngine.findTemplate(
            StageTemplateEngine.TEMPLATES, tplId);
        if (tpl == null) {
            throw new IllegalArgumentException("阶段模板 " + tplId + " 不存在（A3 硬拒绝）");
        }
        return tpl;
    }

    private List<ApprovalBindingEngine.ApprovalBinding> toBindings(StageRequest request) {
        List<ApprovalBindingEngine.ApprovalBinding> out = new ArrayList<>();
        if (request.getBindings() == null) return out;
        for (StageRequest.BindingDto d : request.getBindings()) {
            out.add(new ApprovalBindingEngine.ApprovalBinding(d.getStageCode(), d.getDefId(), d.getLabel()));
        }
        return out;
    }

    private List<FlowEngine.FlowInstance> toInstances(StageRequest request) {
        List<FlowEngine.FlowInstance> out = new ArrayList<>();
        if (request.getInstances() == null) return out;
        for (StageRequest.InstanceDto d : request.getInstances()) {
            out.add(new FlowEngine.FlowInstance(
                d.getId(), d.getDefId(), d.getDefCode(), d.getTitle(), d.getSubmitter(),
                d.getForm(), d.getCurrentNodeId(), d.getStatus(), d.getPassedNodeIds(),
                null, d.getNodeEnteredAt(), d.isEscalated(), d.getEscalatedToRole(),
                d.getAddedSigners(), d.getCreatedAt(), d.getFinishedAt()));
        }
        return out;
    }

    private Map<String, Boolean> toGatePassedMap(StageRequest request) {
        Map<String, Boolean> out = new HashMap<>();
        if (request.getGatePassed() == null) return out;
        for (StageRequest.GatePassedDto d : request.getGatePassed()) {
            out.put(d.getGate(), d.isPassed());
        }
        return out;
    }

    private List<GateEngine.Run> toGateRuns(StageRequest request) {
        List<GateEngine.Run> out = new ArrayList<>();
        if (request.getGatePassed() == null) return out;
        for (StageRequest.GatePassedDto d : request.getGatePassed()) {
            // 用 runGate 公共 API 构造（Run 构造器包私有）
            List<GateEngine.ControlPointResult> cps = new ArrayList<>();
            GateEngine.Submit submit = new GateEngine.Submit(
                d.getGate(), request.getProjectId(), cps, request.getUserName(),
                true, true, List.of());
            out.add(GateEngine.runGate(submit));
        }
        return out;
    }

    private StageTemplateEngine.StageDef toStageDef(StageRequest request) {
        return new StageTemplateEngine.StageDef(
            request.getStageCode(), request.getStageName(),
            request.getStageOrder() == null ? 0 : request.getStageOrder(),
            request.getGateCode(), toPrereqList(request));
    }

    private List<String> toPrereqList(StageRequest request) {
        return request.getPrerequisites() == null ? List.of() : request.getPrerequisites();
    }

    /** 是否该绑定的审批链已被驳回（B3 判定）。 */
    private boolean isRejected(List<FlowEngine.FlowInstance> instances,
                               ApprovalBindingEngine.ApprovalBinding binding) {
        if (binding == null) return false;
        for (FlowEngine.FlowInstance i : instances) {
            if (i.defId.equals(binding.defId()) && FlowEngine.Status.REJECTED.equals(i.status)) {
                return true;
            }
        }
        return false;
    }
}
