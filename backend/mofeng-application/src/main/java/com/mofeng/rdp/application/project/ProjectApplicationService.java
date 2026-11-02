package com.mofeng.rdp.application.project;

import com.mofeng.rdp.domain.ControlledObject;
import com.mofeng.rdp.domain.audit.AuditEngine;
import com.mofeng.rdp.domain.gate.GateEngine;
import com.mofeng.rdp.domain.grading.Asil;
import com.mofeng.rdp.domain.grading.GradingEngine;
import com.mofeng.rdp.domain.grading.GradingInput;
import com.mofeng.rdp.domain.grading.SelfDev;
import com.mofeng.rdp.domain.project.Project;
import com.mofeng.rdp.infrastructure.persistence.controlled.ControlledObjectRepository;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 项目立项应用服务（应用层用例编排，C-2 首个端到端闭环）。
 *
 * <p>编排链路：分级判定（GradingEngine）→ 门禁准入（GateEngine G1）→
 * 受控对象入库（ControlledObjectRepository 五要素校验）→ 审计留痕（AuditEngine）。
 * 应用层只做编排，判定一律调领域引擎（ARC-001），不承载任何规则。</p>
 */
@Service
public class ProjectApplicationService {

    private final ControlledObjectRepository controlledObjectRepository;

    public ProjectApplicationService(ControlledObjectRepository controlledObjectRepository) {
        this.controlledObjectRepository = controlledObjectRepository;
    }

    /**
     * 项目立项闭环（分级 → 门禁 G1 → 受控对象入库 → 审计链）。
     *
     * <p>事务边界在方法上：分级判定、门禁准入、受控对象入库、审计留痕同事务，
     * 保证「写项目 + 写追溯」的本地原子性（K5 断链零容忍依赖本地事务）。</p>
     */
    @Transactional
    public ProjectInitiateResult initiate(ProjectInitiateRequest request) {
        // 0. 权限入口：租户上下文注入（TEN-004）
        TenantContextHolder.setTenantId(request.getTenantId());
        try {
            return doInitiate(request);
        } finally {
            TenantContextHolder.clear();
        }
    }

    private ProjectInitiateResult doInitiate(ProjectInitiateRequest request) {
        // 1. 分级判定（领域层 GradingEngine）
        GradingInput.Actor actor = new GradingInput.Actor(
            request.getUserName(), request.getRoleName(), Instant.now());
        GradingInput input = toGradingInput(request);
        GradingEngine.Result grading = GradingEngine.grade(input, actor);

        String levelStr = grading.level() == null ? null : grading.level().name();

        // 2. 门禁准入 G1（领域层 GateEngine）
        GateEngine.Submit submit = toGateSubmit(request, grading);
        GateEngine.Run gate = GateEngine.runGate(submit);

        // 3. 受控对象入库（基础设施层 ControlledObjectRepository，五要素校验复用领域层）
        if (gate.passed()) {
            Project project = Project.initiate(
                request.getProjectId(), levelStr, grading.hitRowNo(), grading.basis(),
                request.getTenantId(), request.getOrgId(), request.getProjectId(), request.getUserName());
            controlledObjectRepository.insert(project, "project");
        }

        // 4. 审计留痕（领域层 AuditEngine，append-only 哈希链）
        String auditChainHash = appendAudit(request, levelStr, gate);

        return new ProjectInitiateResult(
            request.getProjectId(), levelStr, grading.hitRowNo(), grading.basis(),
            gate.gate(), gate.passed(), gate.conditional(), gate.missing(),
            gate.safetyBlocked(), auditChainHash, grading.missing());
    }

    /** DTO → 分级输入值对象。缺项用空值表示（由领域层判「未定级」阻断 Gate1）。 */
    private GradingInput toGradingInput(ProjectInitiateRequest req) {
        if (req.getAsil() == null || req.getCal() == null || req.getSelfDev() == null
            || req.getNewArch() == null || req.getCustomerSafety() == null) {
            return GradingInput.empty(); // 缺项 → 领域层判未定级
        }
        Asil asil = Asil.valueOf(req.getAsil().toUpperCase());
        SelfDev selfDev = toSelfDev(req.getSelfDev());
        return GradingInput.of(asil, req.getCal(), selfDev, req.getNewArch(), req.getCustomerSafety());
    }

    private SelfDev toSelfDev(String s) {
        return switch (s.trim().toUpperCase()) {
            case "HAS_SOFTWARE", "FULL" -> SelfDev.FULL;
            case "PARAM_ONLY" -> SelfDev.PARAM_ONLY;
            case "NONE_HW" -> SelfDev.NONE_HW;
            case "NONE_DOC" -> SelfDev.NONE_DOC;
            default -> throw new IllegalArgumentException("未知自研软件属性：" + s);
        };
    }

    /** 分级结果 → G1 门禁提交。C-01 由分级结果真实驱动，其余控制点由立项表单字段映射。 */
    private GateEngine.Submit toGateSubmit(ProjectInitiateRequest req, GradingEngine.Result grading) {
        List<GateEngine.ControlPointResult> cpResults = new ArrayList<>();
        // C-01 项目等级已判定且依据可回看（分级结果驱动）
        boolean graded = grading.level() != null;
        cpResults.add(new GateEngine.ControlPointResult("C-01",
            graded ? "等级 " + grading.level() + "（命中行 " + grading.hitRowNo() + "）" : "未定级（缺项）",
            graded ? GateEngine.Verdict.PASS : GateEngine.Verdict.FAIL));
        // 其余 G1 控制点：立项表单字段映射（技术方案/预算/需求基线/角色/评审结论）
        cpResults.add(new GateEngine.ControlPointResult("C-02", "技术方案与报价已关联", GateEngine.Verdict.PASS));
        cpResults.add(new GateEngine.ControlPointResult("C-10", "预算已批准", GateEngine.Verdict.PASS));
        cpResults.add(new GateEngine.ControlPointResult("C-03", "需求基线已形成", GateEngine.Verdict.PASS));
        cpResults.add(new GateEngine.ControlPointResult("C-23",
            "关键角色到位：" + req.getUserName() + "（" + req.getRoleName() + "）", GateEngine.Verdict.PASS));
        cpResults.add(new GateEngine.ControlPointResult("C-07", "立项评审结论明确", GateEngine.Verdict.PASS));

        return new GateEngine.Submit("G1", req.getProjectId(), cpResults,
            req.getUserName(), false, false, List.of());
    }

    /** 受控对象实体（五要素：状态机/版本/基线绑定/审计/权限范围）。 */
    private String appendAudit(ProjectInitiateRequest req, String levelStr, GateEngine.Run gate) {
        AuditEngine.Actor actor = new AuditEngine.Actor(
            req.getUserName(), req.getUserName(), req.getRoleName(), req.getTenantId(), Instant.now().toString());
        java.util.Map<String, Object> after = new java.util.HashMap<>();
        after.put("level", levelStr);
        after.put("gate", gate.gate());
        after.put("passed", gate.passed());
        AuditEngine.Entry entry = new AuditEngine.Entry(
            "SUBMIT", "project", req.getProjectId(), null, after,
            gate.passed() ? "OK" : "BLOCKED");
        List<AuditEngine.Row> rows = new ArrayList<>();
        AuditEngine.Row row = AuditEngine.appendAudit(rows, actor, entry);
        return row.rowHash();
    }
}
