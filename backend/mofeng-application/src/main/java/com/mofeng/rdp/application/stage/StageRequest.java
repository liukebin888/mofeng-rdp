package com.mofeng.rdp.application.stage;

import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.Map;

/**
 * 研发阶段管控请求（产品核心「审批驱动阶段门禁」服务端写路径入参）。
 *
 * <p>承载阶段推进 / 工作对象创建 / 模板配置 / 审批放行四类写路径动作的入参，
 * 字段对齐领域引擎 {@code com.mofeng.rdp.domain.stage} 四个引擎的值对象。</p>
 *
 * <p>🟡 档配置字段（strictMode / allowConditional / approvalRequired /
 * allowPartialApprove / signMode / required / allowDeferredDeliverable）
 * 由请求携带，用于决定可配置档的拦截力度（决策文档 M2「阶段模板+审批链配置」）。</p>
 */
public class StageRequest {

    /** 租户标识。 */
    @NotBlank(message = "tenantId 必填")
    private String tenantId;
    /** 组织标识。 */
    private String orgId;
    /** 项目标识。 */
    @NotBlank(message = "projectId 必填")
    private String projectId;
    /** 操作人。 */
    private String userName;
    /** 操作人角色。 */
    private String roleName;

    /** 动作类型：advance / createWorkItem / configure / release。由 controller 端点决定，非客户端输入。 */
    private String op;

    /** 阶段模板 id（空则默认汽车零部件六阶段模板 TPL-AUTO）。 */
    private String templateId;
    /** 目标阶段 code（advance / createWorkItem 用）。 */
    private String targetStageCode;
    /** 阶段 code（configure remove/update / release 用）。 */
    private String stageCode;
    /** 阶段名（configure add/update 用）。 */
    private String stageName;
    /** 阶段次序（configure add/update 用）。 */
    private Integer stageOrder;
    /** 闸门 code（configure add/update 用）。 */
    private String gateCode;
    /** 前置阶段 code 列表（configure add/update 用）。 */
    private List<String> prerequisites;

    /** 审批链—阶段绑定。 */
    private List<BindingDto> bindings;
    /** 审批链实例（审批完成证据）。 */
    private List<InstanceDto> instances;
    /** 闸门通过状态（gate → passed）。 */
    private List<GatePassedDto> gatePassed;
    /** 交付物清单（C1/C2/C3 交付物齐套判定用）。 */
    private List<DeliverableDto> deliverables;
    /** 交付物—审批链绑定（C1/C3 有效提供证据用）。 */
    private List<DeliverableBindingDto> deliverableBindings;

    // —— 🟡 档配置字段（可配置拒绝力度，缺省走行业惯例默认值）——

    /** A1 前序未批准：true=严格（拒绝）/ false=宽松（警告放行）。默认 false。 */
    private boolean strictMode;
    /** A2 闸门 conditional：true=允许 conditional 放行 / false=严格。默认 true。 */
    private boolean allowConditional = true;
    /** B1 未绑定审批链：true=必审批（拒绝）/ false=免审批放行。默认 true。 */
    private boolean approvalRequired = true;
    /** B2 审批进行中：true=允许先行 / false=拒绝。默认 false。 */
    private boolean allowPartialApprove;
    /** B4 会签：all=全签（缺签拒绝）/ any=任一签放行。默认 all。 */
    private String signMode = "all";
    /** C1/C3 交付物必交：true=必交未批视为缺件（拒绝）/ false=可选不参与齐套。默认 true。 */
    private boolean required = true;
    /** C2 交付物后补：true=允许后补放行 / false=缺件拒绝。默认 false。 */
    private boolean allowDeferredDeliverable;

    /** 审批链—阶段绑定 DTO。 */
    public static class BindingDto {
        private String stageCode;
        private String defId;
        private String label;

        public String getStageCode() { return stageCode; }
        public void setStageCode(String stageCode) { this.stageCode = stageCode; }
        public String getDefId() { return defId; }
        public void setDefId(String defId) { this.defId = defId; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
    }

    /** 审批链实例 DTO（对齐 FlowEngine.FlowInstance）。 */
    public static class InstanceDto {
        private String id;
        private String defId;
        private String defCode;
        private String title;
        private String submitter;
        private Map<String, Object> form;
        private String currentNodeId;
        private String status;
        private List<String> passedNodeIds;
        private String nodeEnteredAt;
        private boolean escalated;
        private String escalatedToRole;
        private List<String> addedSigners;
        private String createdAt;
        private String finishedAt;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getDefId() { return defId; }
        public void setDefId(String defId) { this.defId = defId; }
        public String getDefCode() { return defCode; }
        public void setDefCode(String defCode) { this.defCode = defCode; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getSubmitter() { return submitter; }
        public void setSubmitter(String submitter) { this.submitter = submitter; }
        public Map<String, Object> getForm() { return form; }
        public void setForm(Map<String, Object> form) { this.form = form; }
        public String getCurrentNodeId() { return currentNodeId; }
        public void setCurrentNodeId(String currentNodeId) { this.currentNodeId = currentNodeId; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public List<String> getPassedNodeIds() { return passedNodeIds; }
        public void setPassedNodeIds(List<String> passedNodeIds) { this.passedNodeIds = passedNodeIds; }
        public String getNodeEnteredAt() { return nodeEnteredAt; }
        public void setNodeEnteredAt(String nodeEnteredAt) { this.nodeEnteredAt = nodeEnteredAt; }
        public boolean isEscalated() { return escalated; }
        public void setEscalated(boolean escalated) { this.escalated = escalated; }
        public String getEscalatedToRole() { return escalatedToRole; }
        public void setEscalatedToRole(String escalatedToRole) { this.escalatedToRole = escalatedToRole; }
        public List<String> getAddedSigners() { return addedSigners; }
        public void setAddedSigners(List<String> addedSigners) { this.addedSigners = addedSigners; }
        public String getCreatedAt() { return createdAt; }
        public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
        public String getFinishedAt() { return finishedAt; }
        public void setFinishedAt(String finishedAt) { this.finishedAt = finishedAt; }
    }

    /** 闸门通过状态 DTO。 */
    public static class GatePassedDto {
        private String gate;
        private boolean passed;

        public String getGate() { return gate; }
        public void setGate(String gate) { this.gate = gate; }
        public boolean isPassed() { return passed; }
        public void setPassed(boolean passed) { this.passed = passed; }
    }

    /** 交付物 DTO（对齐 DeliverableApprovalEngine.Deliverable 最小视图）。 */
    public static class DeliverableDto {
        private String id;
        private String projectId;
        private String code;
        private String name;
        private String category;
        private boolean required;
        private boolean provided;
        private String gate;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getProjectId() { return projectId; }
        public void setProjectId(String projectId) { this.projectId = projectId; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public boolean isRequired() { return required; }
        public void setRequired(boolean required) { this.required = required; }
        public boolean isProvided() { return provided; }
        public void setProvided(boolean provided) { this.provided = provided; }
        public String getGate() { return gate; }
        public void setGate(String gate) { this.gate = gate; }
    }

    /** 交付物—审批链绑定 DTO（对齐 DeliverableApprovalEngine.Binding）。 */
    public static class DeliverableBindingDto {
        private String deliverableId;
        private String defId;
        private String label;

        public String getDeliverableId() { return deliverableId; }
        public void setDeliverableId(String deliverableId) { this.deliverableId = deliverableId; }
        public String getDefId() { return defId; }
        public void setDefId(String defId) { this.defId = defId; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
    }

    // —— getters / setters ——

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
    public String getOp() { return op; }
    public void setOp(String op) { this.op = op; }
    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }
    public String getTargetStageCode() { return targetStageCode; }
    public void setTargetStageCode(String targetStageCode) { this.targetStageCode = targetStageCode; }
    public String getStageCode() { return stageCode; }
    public void setStageCode(String stageCode) { this.stageCode = stageCode; }
    public String getStageName() { return stageName; }
    public void setStageName(String stageName) { this.stageName = stageName; }
    public Integer getStageOrder() { return stageOrder; }
    public void setStageOrder(Integer stageOrder) { this.stageOrder = stageOrder; }
    public String getGateCode() { return gateCode; }
    public void setGateCode(String gateCode) { this.gateCode = gateCode; }
    public List<String> getPrerequisites() { return prerequisites; }
    public void setPrerequisites(List<String> prerequisites) { this.prerequisites = prerequisites; }
    public List<BindingDto> getBindings() { return bindings; }
    public void setBindings(List<BindingDto> bindings) { this.bindings = bindings; }
    public List<InstanceDto> getInstances() { return instances; }
    public void setInstances(List<InstanceDto> instances) { this.instances = instances; }
    public List<GatePassedDto> getGatePassed() { return gatePassed; }
    public void setGatePassed(List<GatePassedDto> gatePassed) { this.gatePassed = gatePassed; }
    public List<DeliverableDto> getDeliverables() { return deliverables; }
    public void setDeliverables(List<DeliverableDto> deliverables) { this.deliverables = deliverables; }
    public List<DeliverableBindingDto> getDeliverableBindings() { return deliverableBindings; }
    public void setDeliverableBindings(List<DeliverableBindingDto> deliverableBindings) { this.deliverableBindings = deliverableBindings; }
    public boolean isStrictMode() { return strictMode; }
    public void setStrictMode(boolean strictMode) { this.strictMode = strictMode; }
    public boolean isAllowConditional() { return allowConditional; }
    public void setAllowConditional(boolean allowConditional) { this.allowConditional = allowConditional; }
    public boolean isApprovalRequired() { return approvalRequired; }
    public void setApprovalRequired(boolean approvalRequired) { this.approvalRequired = approvalRequired; }
    public boolean isAllowPartialApprove() { return allowPartialApprove; }
    public void setAllowPartialApprove(boolean allowPartialApprove) { this.allowPartialApprove = allowPartialApprove; }
    public String getSignMode() { return signMode; }
    public void setSignMode(String signMode) { this.signMode = signMode; }
    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }
    public boolean isAllowDeferredDeliverable() { return allowDeferredDeliverable; }
    public void setAllowDeferredDeliverable(boolean allowDeferredDeliverable) { this.allowDeferredDeliverable = allowDeferredDeliverable; }
}
