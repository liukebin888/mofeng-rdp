package com.mofeng.rdp.application.sample;

import java.util.List;

/**
 * 样件试制请求（C-8 端到端闭环：样件 → 齐套 → 检验）。
 *
 * <p>承载样件需求单 + EBOM 齐套 + 试制下达 + 检验结论。字段对齐领域引擎
 * {@link com.mofeng.rdp.domain.sample.SampleEngine} 的值对象。</p>
 */
public class SampleRequest {

    /** 租户标识（TEN-004 权限入口）。 */
    private String tenantId;
    /** 组织标识。 */
    private String orgId;
    /** 项目标识。 */
    private String projectId;
    /** 操作人。 */
    private String userName;
    /** 操作人角色。 */
    private String roleName;

    /** 样件需求编号。 */
    private String orderId;
    /** 样件编码。 */
    private String code;
    /** 样件类型（A/B/C/OTS）。 */
    private String type;
    /** 样件数量。 */
    private double qty;
    /** 需求日期。 */
    private String needDate;
    /** EBOM 版本（先 BOM 后样件 P-03 依据）。 */
    private String ebomVersion;

    /** EBOM 是否已冻结发布。 */
    private boolean ebomFrozen;
    /** 齐套是否阻断。 */
    private boolean kitBlocked;
    /** 工装夹具是否就绪。 */
    private boolean toolingReady;

    /** EBOM 节点（齐套校验用）。 */
    private List<BomNodeDto> bom;

    /** 当前状态（状态机流转）。 */
    private String status;
    /** 状态机事件（submit/start/finish/inspectPass/rework/reject/close）。 */
    private String event;

    /** 检验结论（合格/不合格，HW-013）。 */
    private String conclusion;
    /** 未闭环问题单列表（HW-014 检验放行用）。 */
    private List<String> nonconformityIds;

    public static class BomNodeDto {
        private String materialCode;
        private String name;
        private String parentMaterialCode;
        private double qty;
        private double stock;
        private double incoming;

        public String getMaterialCode() { return materialCode; }
        public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getParentMaterialCode() { return parentMaterialCode; }
        public void setParentMaterialCode(String parentMaterialCode) { this.parentMaterialCode = parentMaterialCode; }
        public double getQty() { return qty; }
        public void setQty(double qty) { this.qty = qty; }
        public double getStock() { return stock; }
        public void setStock(double stock) { this.stock = stock; }
        public double getIncoming() { return incoming; }
        public void setIncoming(double incoming) { this.incoming = incoming; }
    }

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
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public double getQty() { return qty; }
    public void setQty(double qty) { this.qty = qty; }
    public String getNeedDate() { return needDate; }
    public void setNeedDate(String needDate) { this.needDate = needDate; }
    public String getEbomVersion() { return ebomVersion; }
    public void setEbomVersion(String ebomVersion) { this.ebomVersion = ebomVersion; }
    public boolean isEbomFrozen() { return ebomFrozen; }
    public void setEbomFrozen(boolean ebomFrozen) { this.ebomFrozen = ebomFrozen; }
    public boolean isKitBlocked() { return kitBlocked; }
    public void setKitBlocked(boolean kitBlocked) { this.kitBlocked = kitBlocked; }
    public boolean isToolingReady() { return toolingReady; }
    public void setToolingReady(boolean toolingReady) { this.toolingReady = toolingReady; }
    public List<BomNodeDto> getBom() { return bom; }
    public void setBom(List<BomNodeDto> bom) { this.bom = bom; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }
    public String getConclusion() { return conclusion; }
    public void setConclusion(String conclusion) { this.conclusion = conclusion; }
    public List<String> getNonconformityIds() { return nonconformityIds; }
    public void setNonconformityIds(List<String> nonconformityIds) { this.nonconformityIds = nonconformityIds; }
}
