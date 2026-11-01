package com.mofeng.rdp.infrastructure;

/**
 * 基础设施层标记类。
 *
 * <p>基础设施层以接口方式被上层调用，禁止反向调用领域逻辑、禁止在适配器中做业务判断
 * （ARC-001）。持久化/缓存/检索/消息的适配器实现后续按 B1~B4 任务落地。</p>
 */
public final class InfrastructureLayerMarker {

    private InfrastructureLayerMarker() {
        // 标记类，非实例化
    }
}
