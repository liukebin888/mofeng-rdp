package com.mofeng.rdp.infrastructure.persistence.plan;

import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import com.mofeng.rdp.domain.plan.PlanAlertEngine;

/**
 * 四级计划告警投递通道服务接口（基础设施层，PLN-ALERT 投递）。
 *
 * <p>职责边界（ARC-001 / 不虚假投递纪律）：</p>
 * <ul>
 *   <li>本接口只负责「决定应投递哪些渠道 + 哪些接收人」，产出投递指令元数据
 *       （{@code channelMask} / {@code receiverIds}），由应用层登记进告警流水留痕；</li>
 *   <li>真实消息发送（站内信/邮件/企微/短信）由具体适配器实现，本步默认实现
 *       {@code NoopNotifyChannelService} 仅登记「本应投递的渠道」而不伪造发送成功——</li>
 * </ul>
 * <p>领域判定（时点/级别/接收人层级）一律复用 {@link PlanAlertEngine} 与
 * {@link FourLevelPlanEngine}，本接口不做任何业务判定。</p>
 */
public interface NotifyChannelService {

    /**
     * 计算某告警阶段应投递的渠道位掩码（逗号分隔渠道标识，如 "站内信,企微"）。
     * 只描述「应投递」，不触发真实发送。
     *
     * @param stage 告警阶段 S1~S4（见 {@link PlanAlertEngine}）
     */
    String channelMask(String stage);

    /**
     * 计算某告警阶段应送达的接收人 id（逗号分隔），依据节点层级与阶段升级规则
     * （S1 责任人；S2 +直属上级；S3 +部门总监；S4 +项目经理/总监/经理）。
     *
     * @param node 命中告警的计划节点
     * @param stage 告警阶段
     */
    String receiverIds(FourLevelPlanEngine.PlanNode node, String stage);
}
