package com.mofeng.rdp.application.change;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ECR 变更单处理应用服务编排测试（C-6 端到端闭环）。
 *
 * <p>验证「四维影响评估 → 审批角色 → 闭包 → 关闭资格」的编排正确性
 * （DTO 映射 / 调用顺序 / fail-closed 分支），不重复验证领域引擎数值。</p>
 */
class ChangeApplicationServiceTest {

    private ChangeRequest baseRequest(String stage, boolean highRisk, Boolean ecnVerified) {
        ChangeRequest r = new ChangeRequest();
        r.setTenantId("t1");
        r.setOrgId("org1");
        r.setProjectId("PRJ-001");
        r.setUserName("张三");
        r.setRoleName("系统工程师");
        r.setEcrId("ECR-001");
        r.setCode("ECR-001");
        r.setTitle("变更测试");
        r.setStage(stage);
        r.setHighRisk(highRisk);
        r.setEcnVerified(ecnVerified);
        return r;
    }

    /** 四维影响全部已评估。 */
    private List<ChangeRequest.ImpactDto> fullImpacts() {
        List<ChangeRequest.ImpactDto> impacts = new ArrayList<>();
        for (String dim : List.of("软件", "硬件", "安全", "供应链")) {
            ChangeRequest.ImpactDto d = new ChangeRequest.ImpactDto();
            d.setDim(dim);
            d.setAssessed(true);
            d.setNote(dim + "已评估");
            impacts.add(d);
        }
        return impacts;
    }

    /** 闭包全部确认（无未确认项）。 */
    private List<ChangeRequest.ClosureDto> fullClosure() {
        List<ChangeRequest.ClosureDto> closure = new ArrayList<>();
        closure.add(cl("FSR", "FSR-001", "修改"));
        closure.add(cl("TSR", "TSR-001", "确认无影响"));
        closure.add(cl("TC", "TC-001", "废弃"));
        return closure;
    }

    private ChangeRequest.ClosureDto cl(String objType, String objId, String decision) {
        ChangeRequest.ClosureDto d = new ChangeRequest.ClosureDto();
        d.setObjType(objType);
        d.setObjId(objId);
        d.setObjCode(objId);
        d.setDecision(decision);
        d.setNote("");
        return d;
    }

    @Test
    void 四维评估齐全且闭包确认且ECN验证通过允许关闭() {
        ChangeRequest r = baseRequest("ECN验证", false, true);
        r.setImpacts(fullImpacts());
        r.setClosure(fullClosure());

        ChangeResult result = new ChangeApplicationService().process(r);

        assertTrue(result.isImpactComplete());
        assertEquals(3, result.getClosureTotal());
        assertTrue(result.isCanClose());
        assertNull(result.getCloseCode());
    }

    @Test
    void 高风险变更自动增补三个审批角色() {
        ChangeRequest r = baseRequest("影响评估", true, null);
        r.setImpacts(fullImpacts());
        r.setClosure(fullClosure());

        ChangeResult result = new ChangeApplicationService().process(r);

        // 基础角色（研发项目经理 + 系统工程师）+ 高风险增补（功能安全经理 + 信息安全经理 + 架构师）
        assertEquals(5, result.getRequiredApprovers().size());
        assertTrue(result.getRequiredApprovers().contains("功能安全经理"));
        assertTrue(result.getRequiredApprovers().contains("架构师"));
    }

    @Test
    void 四维评估缺一维拒绝关闭() {
        ChangeRequest r = baseRequest("ECN验证", false, true);
        // 提供四维，但「供应链」未评估（assessed=false，领域引擎语义：缺评估用 assessed 表达）
        List<ChangeRequest.ImpactDto> impacts = fullImpacts();
        for (ChangeRequest.ImpactDto d : impacts) {
            if ("供应链".equals(d.getDim())) d.setAssessed(false);
        }
        r.setImpacts(impacts);
        r.setClosure(fullClosure());

        ChangeResult result = new ChangeApplicationService().process(r);

        assertFalse(result.isImpactComplete());
        assertTrue(result.getImpactMissing().contains("供应链"));
    }

    @Test
    void 闭包存在未确认项拒绝关闭() {
        ChangeRequest r = baseRequest("ECN验证", false, true);
        r.setImpacts(fullImpacts());
        // 一项闭包 decision 为空（未确认）
        List<ChangeRequest.ClosureDto> closure = fullClosure();
        closure.add(cl("VER", "VER-001", ""));
        r.setClosure(closure);

        ChangeResult result = new ChangeApplicationService().process(r);

        assertFalse(result.isCanClose());
        assertEquals("CHG_UNCONFIRMED", result.getCloseCode());
        assertFalse(result.getClosureUnconfirmed().isEmpty());
    }

    @Test
    void ECN已执行未验证拒绝关闭() {
        ChangeRequest r = baseRequest("ECN验证", false, false); // ecnVerified=false
        r.setImpacts(fullImpacts());
        r.setClosure(fullClosure());

        ChangeResult result = new ChangeApplicationService().process(r);

        assertFalse(result.isCanClose());
        assertEquals("CHG_UNVERIFIED", result.getCloseCode());
    }

    @Test
    void 非ECN验证阶段拒绝关闭() {
        ChangeRequest r = baseRequest("审批中", false, true); // 阶段不是 ECN验证
        r.setImpacts(fullImpacts());
        r.setClosure(fullClosure());

        ChangeResult result = new ChangeApplicationService().process(r);

        assertFalse(result.isCanClose());
        assertEquals("CHG_STAGE", result.getCloseCode());
    }
}
