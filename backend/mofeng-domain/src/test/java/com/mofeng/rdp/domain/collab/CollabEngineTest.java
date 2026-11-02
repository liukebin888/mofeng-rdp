package com.mofeng.rdp.domain.collab;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 协同沟通引擎独立 QA 用例（SRS 第 12 章 / COM-001~009 / FUN-024）。
 *
 * <p>与前端 {@code app/tests/collab.spec.ts} 同构，以「同一套测试用例」为迁移判据。</p>
 */
class CollabEngineTest {

    private static final String TODAY = "2026-11-01";

    private static CollabEngine.ResolutionItem mkResolution(String id, String due, String status) {
        return new CollabEngine.ResolutionItem(id, "P-001", "M1", "RES-TST-001", "完成软件配置字回归",
                "林静", due, status, null, null, "2026-10-29");
    }

    private static CollabEngine.SendAuditItem mkSendAudit(String dueAt) {
        return new CollabEngine.SendAuditItem("SA-T1", "P-001", "SA-TST-001", "DV 大纲", "V1.0",
                "客户", "客户 SQE", "2026-10-24", dueAt, "待答复", new ArrayList<>(), false);
    }

    private static CollabEngine.SuperviseItem mkSupervise(String status, String due) {
        List<CollabEngine.SuperviseAction> actions = new ArrayList<>();
        if ("交办".equals(status)) {
            actions.add(new CollabEngine.SuperviseAction("t0", "许", "交办", ""));
        }
        return new CollabEngine.SuperviseItem("SV-T1", "P-001", "SUP-0001", "锁定台架", "冯磊", due,
                status, actions, false);
    }

    @Test
    void 决议内容为空即拒() {
        assertTrue(CollabEngine.validateResolution("", "林静", "2026-11-06").contains("决议内容不能为空"));
    }

    @Test
    void 决议缺责任人即拒() {
        assertTrue(CollabEngine.validateResolution("x", "", "2026-11-06").contains("责任人不能为空"));
    }

    @Test
    void 决议缺期限即拒() {
        assertTrue(CollabEngine.validateResolution("x", "林静", "").contains("期限不能为空"));
    }

    @Test
    void 决议三要素齐备则通过() {
        assertTrue(CollabEngine.validateResolution("x", "林静", "2026-11-06").isEmpty());
    }

    @Test
    void 决议首次转任务挂taskId并进入执行中() {
        CollabEngine.ResolutionItem r = CollabEngine.resolutionToTask(mkResolution("RS-T1", "2026-11-06", "待执行"), "TASK-001");
        assertEquals("TASK-001", r.taskId);
        assertEquals("执行中", r.status);
    }

    @Test
    void 同一决议不重复建任务() {
        CollabEngine.ResolutionItem once = CollabEngine.resolutionToTask(mkResolution("RS-T1", "2026-11-06", "待执行"), "TASK-001");
        CollabEngine.ResolutionItem twice = CollabEngine.resolutionToTask(once, "TASK-002");
        assertEquals("TASK-001", twice.taskId);
    }

    @Test
    void 决议无证据关闭被拒() {
        CollabEngine.CloseResult r = CollabEngine.closeResolution(mkResolution("RS-T1", "2026-11-06", "待执行"), "", TODAY);
        assertFalse(r.closed);
        assertTrue(r.errors.contains("无证据关闭被拒（COM-008）"));
    }

    @Test
    void 决议有证据关闭成功并留痕() {
        CollabEngine.CloseResult r = CollabEngine.closeResolution(mkResolution("RS-T1", "2026-11-06", "待执行"), "回归用例全部通过", TODAY);
        assertTrue(r.closed);
        assertEquals("已闭环", r.resolution.status);
        assertEquals("回归用例全部通过", r.resolution.evidence);
    }

    @Test
    void 逾期未闭环决议被列出() {
        CollabEngine.ResolutionItem overdue = mkResolution("a", "2026-10-20", "执行中");
        CollabEngine.ResolutionItem ok = mkResolution("b", "2026-11-10", "执行中");
        CollabEngine.ResolutionItem closed = mkResolution("c", "2026-10-01", "已闭环");
        List<CollabEngine.ResolutionItem> list = CollabEngine.overdueResolutions(List.of(overdue, ok, closed), TODAY);
        assertEquals(List.of("a"), list.stream().map(r -> r.id).toList());
    }

    @Test
    void 会议缺参会人即拒() {
        List<String> e = CollabEngine.validateMeeting("评审", "议题", "陈志远", "2026-11-02", List.of());
        assertTrue(e.contains("参会人不能为空"));
    }

    @Test
    void 会议四要素齐备通过() {
        List<String> e = CollabEngine.validateMeeting("评审", "议题", "陈志远", "2026-11-02", List.of("林静"));
        assertTrue(e.isEmpty());
    }

    @Test
    void 送审缺版本即拒() {
        assertTrue(CollabEngine.validateSendAudit("DV 大纲", "", "客户", "SQE", "2026-11-02").contains("版本不能为空（COM-001）"));
    }

    @Test
    void 送审答复留痕并记录往返() {
        CollabEngine.AnswerResult r = CollabEngine.answerSendAudit(mkSendAudit("2026-11-02"), "张工", "同意", "2026-11-01T10:00", TODAY);
        assertTrue(r.errors.isEmpty());
        assertEquals(1, r.item.answers.size());
        assertEquals("已答复", r.item.status);
    }

    @Test
    void 送审答复超期自动升级() {
        CollabEngine.AnswerResult r = CollabEngine.answerSendAudit(mkSendAudit("2026-10-20"), "张工", "同意", "2026-11-01T10:00", TODAY);
        assertTrue(r.item.escalated);
    }

    @Test
    void 送审未答复且逾期升级为已超期() {
        CollabEngine.SendAuditItem item = CollabEngine.escalateSendAudit(mkSendAudit("2026-10-20"), TODAY);
        assertEquals("已超期", item.status);
        assertTrue(item.escalated);
    }

    @Test
    void 督办交办态只能反馈非法动作被拒() {
        CollabEngine.AdvanceResult r = CollabEngine.advanceSupervise(mkSupervise("交办", "2026-11-03"), "销项", "许", "", "t1", TODAY);
        assertFalse(r.advanced);
        assertTrue(r.errors.get(0).contains("只能执行「反馈」"));
    }

    @Test
    void 督办四态顺序流转() {
        CollabEngine.SuperviseItem cur = mkSupervise("交办", "2026-11-03");
        CollabEngine.AdvanceResult s1 = CollabEngine.advanceSupervise(cur, "反馈", "冯", "", "t1", TODAY);
        assertEquals("反馈", s1.item.status);
        CollabEngine.AdvanceResult s2 = CollabEngine.advanceSupervise(s1.item, "复核", "许", "", "t2", TODAY);
        assertEquals("复核", s2.item.status);
        CollabEngine.AdvanceResult s3 = CollabEngine.advanceSupervise(s2.item, "销项", "许", "验收通过", "t3", TODAY);
        assertEquals("已销项", s3.item.status);
        assertEquals(4, s3.item.actions.size());
    }

    @Test
    void 督办已销项不可再推进() {
        CollabEngine.AdvanceResult r = CollabEngine.advanceSupervise(mkSupervise("已销项", "2026-11-03"), "销项", "许", "", "t1", TODAY);
        assertFalse(r.advanced);
        assertTrue(r.errors.contains("已销项事项不可再推进"));
    }

    @Test
    void 督办超期自动升级() {
        CollabEngine.SuperviseItem item = CollabEngine.escalateSupervise(mkSupervise("交办", "2026-10-20"), TODAY);
        assertTrue(item.escalated);
    }

    @Test
    void 决议编码按项目内递增() {
        CollabEngine.ResolutionItem a = mkResolution("a", "2026-11-06", "待执行");
        CollabEngine.ResolutionItem b = mkResolution("b", "2026-11-06", "待执行");
        assertEquals("RES-003", CollabEngine.nextResolutionCode(List.of(a, b), "P-001"));
    }

    @Test
    void isOverdue字典序比较() {
        assertTrue(CollabEngine.isOverdue("2026-10-20", "2026-11-01"));
        assertFalse(CollabEngine.isOverdue("2026-11-02", "2026-11-01"));
    }
}
