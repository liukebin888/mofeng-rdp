package com.mofeng.rdp.application.project;

import com.mofeng.rdp.domain.ControlledObject;
import com.mofeng.rdp.infrastructure.persistence.controlled.ControlledObjectEntity;
import com.mofeng.rdp.infrastructure.persistence.controlled.ControlledObjectRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 项目立项应用服务编排测试（C-2 首个端到端闭环）。
 *
 * <p>用内存 stub 替代 ControlledObjectRepository，验证「分级 → 门禁 G1 → 受控对象入库 → 审计链」
 * 的编排正确性，不依赖真实数据库。</p>
 */
class ProjectApplicationServiceTest {

    /** 内存受控对象仓库 stub。 */
    private static final class InMemoryControlledObjectRepository implements ControlledObjectRepository {
        final List<ControlledObject<?>> inserted = new ArrayList<>();

        @Override
        public void insert(ControlledObject<?> obj, String objectType) {
            inserted.add(obj);
        }

        @Override
        public void freeze(String tenantId, String objectType, String objectId, String baselineId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ControlledObjectEntity load(String tenantId, String objectType, String objectId) {
            return null;
        }

        @Override
        public List<ControlledObjectEntity> listByProject(String tenantId, String projectId) {
            return List.of();
        }
    }

    private ProjectInitiateRequest req(String asil, Integer cal, String selfDev,
                                       Boolean newArch, Boolean customerSafety) {
        ProjectInitiateRequest r = new ProjectInitiateRequest();
        r.setProjectId("PRJ-001");
        r.setProjectName("测试项目");
        r.setTenantId("t1");
        r.setOrgId("org1");
        r.setAsil(asil);
        r.setCal(cal);
        r.setSelfDev(selfDev);
        r.setNewArch(newArch);
        r.setCustomerSafety(customerSafety);
        r.setUserName("张三");
        r.setRoleName("PM");
        return r;
    }

    @Test
    void 完整输入立项闭环成功() {
        InMemoryControlledObjectRepository repo = new InMemoryControlledObjectRepository();
        ProjectApplicationService svc = new ProjectApplicationService(repo);

        ProjectInitiateResult result = svc.initiate(
            req("A", 1, "HAS_SOFTWARE", false, false));

        assertEquals("L2", result.getLevel());           // ASIL A + CAL1 + 自研软件 → L2（真值表第4行）
        assertEquals(4, result.getHitRowNo());
        assertTrue(result.isGatePassed());
        assertEquals(1, repo.inserted.size());           // 受控对象已入库
        assertNotNull(result.getAuditChainHash());        // 审计链已留痕
    }

    @Test
    void 缺项分级未定级门禁阻断() {
        InMemoryControlledObjectRepository repo = new InMemoryControlledObjectRepository();
        ProjectApplicationService svc = new ProjectApplicationService(repo);

        // 缺 CAL 与 selfDev → 分级未定级 → C-01 FAIL → 门禁阻断
        ProjectInitiateResult result = svc.initiate(
            req("A", null, null, false, false));

        assertNull(result.getLevel());
        assertFalse(result.isGatePassed());
        assertEquals(0, repo.inserted.size());           // 未入库
        assertFalse(result.getGradingMissing().isEmpty());
    }

    @Test
    void 门禁未通过不写库() {
        InMemoryControlledObjectRepository repo = new InMemoryControlledObjectRepository();
        ProjectApplicationService svc = new ProjectApplicationService(repo);

        // 完整输入但无分级结果会阻断——这里用空输入验证「门禁阻断则零写入」
        ProjectInitiateResult result = svc.initiate(
            req(null, null, null, null, null));

        assertFalse(result.isGatePassed());
        assertEquals(0, repo.inserted.size());
    }
}
