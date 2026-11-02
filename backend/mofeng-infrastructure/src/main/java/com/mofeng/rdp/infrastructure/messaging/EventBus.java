package com.mofeng.rdp.infrastructure.messaging;

import com.mofeng.rdp.domain.event.DomainEvent;

/**
 * 事件总线抽象（基础设施层，B4 Kafka 领域事件 / 跨域最终一致）。
 *
 * <p>只做投递编排，事件判定（白名单/幂等/溯源链）复用领域层 {@code EventBusEngine}。
 * 至少一次投递语义 + 消费端幂等（ARC-003）。</p>
 */
public interface EventBus {

    /**
     * 发布领域事件（至少一次投递）。
     *
     * <p>投递前由调用方经领域层白名单校验；本接口负责把事件序列化并写入消息队列。
     * 租户上下文随事件头传递（tenantId 在事件头中，不依赖线程局部）。</p>
     */
    void publish(DomainEvent event);

    /**
     * 订阅并消费领域事件。消费端按 eventId 幂等去重后调用 handler。
     *
     * @param topic   事件主题
     * @param handler 事件处理器（由应用层注入，内含领域判定 + 补偿）
     */
    void subscribe(String topic, EventHandler handler);

    /** 事件处理器（消费端回调）。 */
    @FunctionalInterface
    interface EventHandler {
        void onEvent(DomainEvent event);
    }
}
