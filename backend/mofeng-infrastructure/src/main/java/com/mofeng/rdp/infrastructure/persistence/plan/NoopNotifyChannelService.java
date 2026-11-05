package com.mofeng.rdp.infrastructure.persistence.plan;

import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import org.springframework.stereotype.Service;

/**
 * 告警投递通道默认实现（PLN-ALERT 投递，不虚假投递）。
 *
 * <p>本实现只产出投递指令元数据（渠道位掩码 + 接收人），不触发真实消息发送。
 * 真实发送由后续接入站内信/邮件/企微/短信适配器后替换本 Bean 完成；在此之前，
 * 流水表 {@code channel_mask} 如实记录「本应投递的渠道」，接收人列记录「本应送达的人」，
 * 不伪造发送成功（fail-closed 投递口径）。</p>
 *
 * <p>接收人升级规则（与方案第 4 章一致，按阶段递进）：</p>
 * <ul>
 *   <li>S1 提醒 → 责任人（节点 ownerRole）；</li>
 *   <li>S2 预警 → 责任人 + 直属上级；</li>
 *   <li>S3 报警 → 责任人 + 上级 + 部门总监；</li>
 *   <li>S4 抱怨 → 责任人 + 项目经理 + 总监 + 经理。</li>
 * </ul>
 *
 * <p>注：接收人为角色描述占位（责任人/上级/总监/经理），真实用户 id 解析依赖组织主数据，
 * 本步以角色名登记留痕，不臆造用户 id（不虚假投递）。</p>
 */
@Service
public class NoopNotifyChannelService implements NotifyChannelService {

    @Override
    public String channelMask(String stage) {
        // 渠道位：S1 站内信；S2 站内信+邮件；S3 站内信+邮件+企微；S4 站内信+邮件+企微+短信
        if (PlanAlertEngine.S4_PRR.equals(stage)) return "站内信,邮件,企微,短信";
        if (PlanAlertEngine.S3_ALARM.equals(stage)) return "站内信,邮件,企微";
        if (PlanAlertEngine.S2_WARN.equals(stage)) return "站内信,邮件";
        return "站内信";
    }

    @Override
    public String receiverIds(FourLevelPlanEngine.PlanNode node, String stage) {
        String owner = node.ownerRole != null && !node.ownerRole.isBlank() ? node.ownerRole : "责任人";
        if (PlanAlertEngine.S4_PRR.equals(stage)) {
            return owner + ",项目经理,部门总监,部门经理";
        }
        if (PlanAlertEngine.S3_ALARM.equals(stage)) {
            return owner + ",直属上级,部门总监";
        }
        if (PlanAlertEngine.S2_WARN.equals(stage)) {
            return owner + ",直属上级";
        }
        return owner;
    }
}
