package com.mofeng.rdp.domain.task;

import com.mofeng.rdp.domain.HashUtil;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/**
 * 异步任务引擎（SRS 12.4 / ARC-003：跨模块事务仅经领域事件或补偿）。
 *
 * <p>三类异步任务（报表生成 / 批量导入 / AI 调用）的领域判定权威：
 * 至少一次投递、消费端幂等、租户上下文传递兜底断言、状态机推进。</p>
 *
 * <p>纯函数、零框架依赖。实际队列投递/消费是基础设施层 Kafka 适配器的事，
 * 本引擎只做「任务是否可提交 / 是否重复 / 状态如何推进 / 租户是否缺失」的判定。</p>
 */
public final class AsyncTaskEngine {

    private AsyncTaskEngine() {
    }

    /** 三类异步任务。 */
    public enum TaskClass { REPORT, IMPORT, AI }

    /** 任务状态机。 */
    public enum TaskState { PENDING, RUNNING, SUCCEEDED, FAILED }

    /** 任务描述（不可变，承载幂等键 + 租户上下文 + 载荷）。 */
    public static final class Task {
        private final String taskId;
        private final TaskClass taskClass;
        private final String idempotencyKey;
        private final String tenantId;
        private final Map<String, Object> payload;

        public Task(String taskId, TaskClass taskClass, String idempotencyKey,
                    String tenantId, Map<String, Object> payload) {
            this.taskId = taskId;
            this.taskClass = taskClass;
            this.idempotencyKey = idempotencyKey;
            this.tenantId = tenantId;
            this.payload = payload == null ? new LinkedHashMap<>() : new LinkedHashMap<>(payload);
        }

        public String taskId() { return taskId; }
        public TaskClass taskClass() { return taskClass; }
        public String idempotencyKey() { return idempotencyKey; }
        public String tenantId() { return tenantId; }
        public Map<String, Object> payload() { return payload; }
    }

    /** 提交判定结果。 */
    public static final class SubmitVerdict {
        private final boolean acceptable;
        private final String reason;

        SubmitVerdict(boolean acceptable, String reason) {
            this.acceptable = acceptable;
            this.reason = reason;
        }

        public boolean acceptable() { return acceptable; }
        public String reason() { return reason; }
    }

    /** 状态推进结果。 */
    public static final class ProgressResult {
        private final TaskState from;
        private final TaskState to;
        private final boolean legal;

        ProgressResult(TaskState from, TaskState to, boolean legal) {
            this.from = from;
            this.to = to;
            this.legal = legal;
        }

        public TaskState from() { return from; }
        public TaskState to() { return to; }
        public boolean legal() { return legal; }
    }

    /**
     * 确定性任务 id（幂等键 + 任务类别 + 载荷派生），同请求同 id。
     * 支撑「重复提交去重」与「消费端幂等」。
     */
    public static String taskId(TaskClass taskClass, String idempotencyKey, Map<String, Object> payload) {
        Map<String, Object> seed = new TreeMap<>();
        seed.put("class", taskClass.name());
        seed.put("idempotency", idempotencyKey);
        seed.put("payload", new TreeMap<>(payload));
        return HashUtil.hashOf(seed);
    }

    /**
     * 提交判定：三类任务白名单 + 租户上下文兜底断言（TEN-004）。
     *
     * <p>异步任务跨线程/跨进程执行，租户上下文必须显式随任务传递；
     * 缺失即拒（tenant 为 null/blank），防止串租户——这是 B4 的兜底断言，
     * 与 TenantContextHolder 注入形成双重保障。</p>
     */
    public static SubmitVerdict checkSubmit(Task task) {
        if (task == null) {
            return new SubmitVerdict(false, "missing task");
        }
        if (task.taskClass() == null) {
            return new SubmitVerdict(false, "unregistered task class");
        }
        if (task.tenantId() == null || task.tenantId().isBlank()) {
            return new SubmitVerdict(false, "TENANT_FORGED: async task missing tenant context");
        }
        return new SubmitVerdict(true, null);
    }

    /** 状态机推进合法性（PENDING → RUNNING → SUCCEEDED/FAILED，禁止倒退与跳步）。 */
    public static ProgressResult progress(TaskState from, TaskState to) {
        if (from == null || to == null) {
            return new ProgressResult(from, to, false);
        }
        boolean legal;
        switch (from) {
            case PENDING:
                legal = (to == TaskState.RUNNING || to == TaskState.FAILED);
                break;
            case RUNNING:
                legal = (to == TaskState.SUCCEEDED || to == TaskState.FAILED);
                break;
            case SUCCEEDED:
            case FAILED:
                legal = false; // 终态不可再推进
                break;
            default:
                legal = false;
        }
        return new ProgressResult(from, to, legal);
    }

    /**
     * 消费端幂等判定：同一 taskId 只执行一次（至少一次投递下的去重）。
     * 与事件总线幂等语义一致，供异步任务队列复用。
     */
    public static boolean isDuplicate(java.util.Set<String> processedTaskIds, String taskId) {
        return processedTaskIds.contains(taskId);
    }
}
