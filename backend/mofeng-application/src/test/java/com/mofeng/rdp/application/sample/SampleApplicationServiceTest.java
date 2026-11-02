package com.mofeng.rdp.application.sample;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 样件试制处理应用服务编排测试（C-8 端到端闭环）。
 *
 * <p>验证「字段齐全率 → 下达资格 → 齐套 → 状态机 → 检验」的编排正确性
 * （DTO 映射 / 调用顺序 / fail-closed 分支），不重复验证领域引擎数值。</p>
 */
class SampleApplicationServiceTest {

    private SampleRequest baseRequest(String status, String event) {
        SampleRequest r = new SampleRequest();
        r.setTenantId("t1");
        r.setOrgId("org1");
        r.setProjectId("PRJ-001");
        r.setUserName("张三");
        r.setRoleName("样件工程师");
        r.setOrderId("SMP-001");
        r.setCode("SMP-001");
        r.setType("OTS");
        r.setQty(2.0);
        r.setNeedDate("2026-12-01");
        r.setEbomVersion("EBOM-v2");
        r.setEbomFrozen(true);
        r.setKitBlocked(false);
        r.setToolingReady(true);
        r.setStatus(status);
        r.setEvent(event);
        r.setConclusion(null);
        r.setNonconformityIds(List.of());
        return r;
    }

    /** 一个两级 BOM：成品（根）→ 两个子件，库存充足（齐套满足）。 */
    private List<SampleRequest.BomNodeDto> fullBom() {
        List<SampleRequest.BomNodeDto> bom = new ArrayList<>();
        // 根节点也需库存充足（领域引擎 explodeBom 把根节点也计入齐套行）
        bom.add(bomNode("FG-001", "成品", null, 1.0, 10, 0));
        bom.add(bomNode("MAT-A", "子件A", "FG-001", 2.0, 10, 0));
        bom.add(bomNode("MAT-B", "子件B", "FG-001", 3.0, 20, 0));
        return bom;
    }

    private SampleRequest.BomNodeDto bomNode(String code, String name, String parent, double qty, double stock, double incoming) {
        SampleRequest.BomNodeDto d = new SampleRequest.BomNodeDto();
        d.setMaterialCode(code);
        d.setName(name);
        d.setParentMaterialCode(parent);
        d.setQty(qty);
        d.setStock(stock);
        d.setIncoming(incoming);
        return d;
    }

    @Test
    void 字段齐全且下达且齐套满足且状态机流转成功() {
        SampleRequest r = baseRequest("待下达", "start");
        r.setBom(fullBom());

        SampleResult result = new SampleApplicationService().process(r);

        assertTrue(result.isFieldOk());
        assertTrue(result.isReleaseOk());
        assertTrue(result.isKittingOk());
        assertTrue(result.isTransitionOk());
        assertEquals("试制中", result.getNextStatus());
    }

    @Test
    void 字段缺项阻断() {
        SampleRequest r = baseRequest("待下达", "start");
        r.setBom(fullBom());
        r.setEbomVersion(null); // 缺 ebomVersion 字段

        SampleResult result = new SampleApplicationService().process(r);

        assertFalse(result.isFieldOk());
        assertTrue(result.getFieldMissing().contains("ebomVersion"));
    }

    @Test
    void EBOM未冻结阻断下达() {
        SampleRequest r = baseRequest("待下达", "start");
        r.setBom(fullBom());
        r.setEbomFrozen(false); // P-03 先 BOM 后样件

        SampleResult result = new SampleApplicationService().process(r);

        assertFalse(result.isReleaseOk());
        assertTrue(result.getReleaseBlockers().stream().anyMatch(b -> b.contains("EBOM 未冻结")));
    }

    @Test
    void 齐套不足阻断() {
        SampleRequest r = baseRequest("待下达", "start");
        // 子件库存不足：qty=2 需 4 件，但 stock=0 incoming=0
        List<SampleRequest.BomNodeDto> bom = new ArrayList<>();
        bom.add(bomNode("FG-001", "成品", null, 1.0, 0, 0));
        bom.add(bomNode("MAT-A", "子件A", "FG-001", 2.0, 0, 0));
        r.setBom(bom);

        SampleResult result = new SampleApplicationService().process(r);

        assertFalse(result.isKittingOk());
        assertFalse(result.getShortages().isEmpty());
    }

    @Test
    void 非法状态机事件拒绝流转() {
        SampleRequest r = baseRequest("已交付", "reject"); // 已交付不接受 reject
        r.setBom(fullBom());

        SampleResult result = new SampleApplicationService().process(r);

        assertFalse(result.isTransitionOk());
        assertNull(result.getNextStatus());
    }

    @Test
    void 不合格检验生成问题单() {
        SampleRequest r = baseRequest("检验中", "inspectPass");
        r.setBom(fullBom());
        r.setConclusion("不合格");

        SampleResult result = new SampleApplicationService().process(r);

        assertNotNull(result.getProblemTicketId());
        assertTrue(result.getProblemTicketId().startsWith("Q-SMP-001"));
    }

    @Test
    void 未闭环问题单阻断检验放行() {
        SampleRequest r = baseRequest("检验中", "inspectPass");
        r.setBom(fullBom());
        r.setConclusion("合格");
        r.setNonconformityIds(List.of("Q-001", "Q-002")); // 两条未闭环

        SampleResult result = new SampleApplicationService().process(r);

        assertFalse(result.isInspectionReleaseOk());
        assertEquals(2, result.getInspectionBlockers().size());
    }
}
