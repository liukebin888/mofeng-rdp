package com.mofeng.rdp.domain.task;

import com.mofeng.rdp.domain.task.AsyncTaskEngine.Task;
import com.mofeng.rdp.domain.task.AsyncTaskEngine.TaskClass;
import com.mofeng.rdp.domain.task.AsyncTaskEngine.TaskState;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class AsyncTaskEngineTest {

    private Task task(TaskClass cls, String idemKey, String tenantId, Map<String, Object> payload) {
        return new Task(AsyncTaskEngine.taskId(cls, idemKey, payload), cls, idemKey, tenantId, payload);
    }

    @Test
    void 三类任务提交校验通过() {
        assertTrue(AsyncTaskEngine.checkSubmit(
            task(TaskClass.REPORT, "r1", "t1", Map.of("project", "P1"))).acceptable());
        assertTrue(AsyncTaskEngine.checkSubmit(
            task(TaskClass.IMPORT, "i1", "t1", Map.of("file", "f.xlsx"))).acceptable());
        assertTrue(AsyncTaskEngine.checkSubmit(
            task(TaskClass.AI, "a1", "t1", Map.of("prompt", "x"))).acceptable());
    }

    @Test
    void 租户上下文缺失拒绝提交() {
        AsyncTaskEngine.SubmitVerdict v = AsyncTaskEngine.checkSubmit(
            task(TaskClass.REPORT, "r1", null, Map.of("project", "P1")));
        assertFalse(v.acceptable());
        assertTrue(v.reason().contains("TENANT_FORGED"));
    }

    @Test
    void 空白租户上下文拒绝提交() {
        AsyncTaskEngine.SubmitVerdict v = AsyncTaskEngine.checkSubmit(
            task(TaskClass.REPORT, "r1", "  ", Map.of("project", "P1")));
        assertFalse(v.acceptable());
    }

    @Test
    void 同一幂等键派生出同一任务id() {
        Task a = task(TaskClass.REPORT, "r1", "t1", Map.of("project", "P1"));
        Task b = task(TaskClass.REPORT, "r1", "t1", Map.of("project", "P1"));
        assertEquals(a.taskId(), b.taskId());
    }

    @Test
    void 状态机合法推进() {
        assertTrue(AsyncTaskEngine.progress(TaskState.PENDING, TaskState.RUNNING).legal());
        assertTrue(AsyncTaskEngine.progress(TaskState.RUNNING, TaskState.SUCCEEDED).legal());
        assertTrue(AsyncTaskEngine.progress(TaskState.RUNNING, TaskState.FAILED).legal());
    }

    @Test
    void 状态机禁止倒退与跳步() {
        assertFalse(AsyncTaskEngine.progress(TaskState.RUNNING, TaskState.PENDING).legal());
        assertFalse(AsyncTaskEngine.progress(TaskState.SUCCEEDED, TaskState.RUNNING).legal());
        assertFalse(AsyncTaskEngine.progress(TaskState.FAILED, TaskState.PENDING).legal());
        assertFalse(AsyncTaskEngine.progress(TaskState.SUCCEEDED, TaskState.FAILED).legal());
    }

    @Test
    void 消费端幂等去重() {
        Set<String> processed = new HashSet<>();
        Task t = task(TaskClass.REPORT, "r1", "t1", Map.of("project", "P1"));
        assertFalse(AsyncTaskEngine.isDuplicate(processed, t.taskId()));
        processed.add(t.taskId());
        assertTrue(AsyncTaskEngine.isDuplicate(processed, t.taskId()));
    }
}
