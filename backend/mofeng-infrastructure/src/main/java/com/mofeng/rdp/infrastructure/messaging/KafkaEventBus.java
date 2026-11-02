package com.mofeng.rdp.infrastructure.messaging;

import com.mofeng.rdp.domain.event.DomainEvent;
import com.mofeng.rdp.domain.event.EventBusEngine;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.support.MessageBuilder;

/**
 * Kafka 事件总线实现（基础设施层，B4）。
 *
 * <p>基于 Spring Kafka。事件头序列化为消息头，租户上下文随事件头传递（不依赖线程局部）。
 * 只做投递编排，白名单/幂等/溯源判定复用领域层 {@code EventBusEngine}。
 * 至少一次投递（Kafka acks=all）。</p>
 */
public final class KafkaEventBus implements EventBus {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final String defaultTopic;

    public KafkaEventBus(KafkaTemplate<String, String> kafkaTemplate, String defaultTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.defaultTopic = defaultTopic;
    }

    @Override
    public void publish(DomainEvent event) {
        // 白名单校验：未登记事件类型拒绝投递（ARC-003）
        if (!EventBusEngine.isRegistered(event.header().eventType())) {
            throw new IllegalArgumentException("未登记事件类型拒绝投递（ARC-003）: "
                + event.header().eventType());
        }
        kafkaTemplate.send(MessageBuilder.withPayload(event.header().eventId())
            .setHeader(KafkaHeaders.TOPIC, defaultTopic)
            .setHeader("eventType", event.header().eventType())
            .setHeader("tenantId", event.header().tenantId())
            .setHeader("aggregateType", event.header().aggregateType())
            .setHeader("aggregateId", event.header().aggregateId())
            .setHeader("idempotencyKey", event.header().idempotencyKey())
            .setHeader("causationId", event.header().causationId())
            .setHeader("correlationId", event.header().correlationId())
            .setHeader("occurredAt", event.header().occurredAt())
            .setHeader("payload", event.payloadHash(event.payload()))
            .build());
    }

    @Override
    public void subscribe(String topic, EventHandler handler) {
        // 订阅由 Spring Kafka @KafkaListener 承载，此处保留接口契约供应用层显式注册。
        // 消费端幂等去重由应用层以 processedEventIds 集合 + EventBusEngine.checkIdempotency 完成。
        throw new UnsupportedOperationException(
            "订阅请经 @KafkaListener + EventBusEngine 幂等去重（应用层编排）");
    }
}
