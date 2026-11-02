package com.mofeng.rdp.domain.project;

import com.mofeng.rdp.domain.ControlledObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProjectTest {

    @Test
    void 立项后五要素齐全() {
        Project p = Project.initiate("PRJ-001", "L2", 4, "ASIL A，CAL 1/2，自研软件 → L2",
            "t1", "org1", "PRJ-001", "张三");
        ControlledObject.CompletenessCheck check = p.checkCompleteness();
        assertTrue(check.complete(), "五要素应齐全：" + check.missingElements());
        assertEquals("已立项", p.state());
        assertEquals("PRJ-001", p.id());
        assertEquals("L2", p.level());
        assertEquals(4, p.hitRowNo());
    }

    @Test
    void 缺权限范围判不齐全() {
        Project p = Project.initiate("PRJ-002", "L2", 4, "basis", null, null, null, "张三");
        ControlledObject.CompletenessCheck check = p.checkCompleteness();
        assertFalse(check.complete());
        assertTrue(check.missingElements().contains("权限范围.tenantId"));
    }

    @Test
    void 冻结后基线绑定且只读() {
        Project p = Project.initiate("PRJ-003", "L2", 4, "basis", "t1", "org1", "PRJ-003", "张三");
        p.freeze("BL-001");
        assertTrue(p.frozen());
        assertEquals("BL-001", p.baselineId());
        // 冻结后五要素校验需基线（已具备），仍齐全
        assertTrue(p.checkCompleteness().complete());
    }
}
