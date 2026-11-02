package com.mofeng.rdp.infrastructure.messaging;

import com.mofeng.rdp.domain.task.AsyncTaskEngine;
import com.mofeng.rdp.domain.task.AsyncTaskEngine.Task;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.support.MessageBuilder;

/**
 * Kafka 异步任务队列实现（基础设施层，B4）。
 *
 * <p>基于 Spring Kafka。三类异步任务（报表/导入/AI）至少一次投递 + 消费端幂等。
 * 租户上下文显式随任务消息头传递，并复用 {@link TenantContextHolder} 兜底断言
 * （TEN-004：异步跨线程/进程必须显式传租户，缺失即拒，防串租户）。</p>
 */
public final class KafkaAsyncTaskQueue implements AsyncTaskQueue {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final String taskTopic;

    public KafkaAsyncTaskQueue(KafkaTemplate<String, String> kafkaTemplate, String taskTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.taskTopic = taskTopic;
    }

    @Override
    public void submit(Task task) {
        // 提交判定：白名单 + 租户兜底断言（复用领域层 AsyncTaskEngine.checkSubmit）
        AsyncTaskEngine.SubmitVerdict verdict = AsyncTaskEngine.checkSubmit(task);
        if (!verdict.acceptable()) {
            throw new IllegalArgumentException("异步任务提交被拒: " + verdict.reason());
        }
        // 显式传递租户上下文，写入消息头（不依赖线程局部）
        kafkaTemplate.send(MessageBuilder.withPayload(task.taskId())
            .setHeader(KafkaHeaders.TOPIC, taskTopic)
            .setHeader("taskId", task.taskId())
            .setHeader("taskClass", task.taskClass().name())
            .setHeader("tenantId", task.tenantId())
            .setHeader("idempotencyKey", task.idempotencyKey())
            .build());
    }

    @Override
    public void consume(TaskHandler handler) {
        // 消费由 Spring Kafka @KafkaListener 承载；消费端须先经 AsyncTaskEngine.isDuplicate 幂等去重，
        // 再重建 TenantContextHolder 后调用 handler（应用层编排）。
        throw new UnsupportedOperationException(
            "消费请经 @KafkaListener + TenantContextHolder 重建 + AsyncTaskEngine 幂等去重（应用层编排）");
    }
}
