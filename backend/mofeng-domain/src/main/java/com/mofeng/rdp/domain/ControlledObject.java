package com.mofeng.rdp.domain;

import java.time.Instant;
import java.util.Objects;

/**
 * 受控对象统一抽象（SRS ARC-004）。
 *
 * <p>平台上真正的复杂度不在页面多少，而在「受控对象」的一致性：需求、变更单、样件、
 * 评审、基线、风险，本质都是「有状态、有版本、进基线、要留痕、受权限约束」的对象。
 * 若每类对象各自实现一遍，管控规则必然口径漂移。因此所有受控对象继承本基类，强制具备
 * 五要素，缺一不得入库。</p>
 *
 * <p>本类属于领域层，<b>禁止</b>依赖 Spring、MyBatis、HTTP 等任何框架（ARC-001）。
 * 该约束由 ArchUnit 测试 {@code DomainLayerArchitectureTest} 在构建期强制。</p>
 *
 * <p>与前端 TS 纯函数引擎（app/src/domain/types.ts 的受控对象五要素）语义同构，
 * 迁移以「通过同一套测试用例」为完成判据。</p>
 *
 * @param <I> 对象标识类型
 */
public abstract class ControlledObject<I> {

    /** 对象唯一标识 */
    private final I id;

    /** 状态机：当前状态（五元组流转由状态机引擎驱动，本基类仅承载当前状态） */
    private String state;

    /** 版本：对象版本号 */
    private int version;

    /** 版本修订原因 */
    private String revisionReason;

    /** 版本修订人 */
    private String revisionBy;

    /** 版本修订时间 */
    private Instant revisionAt;

    /** 基线绑定：所属基线标识（null 表示尚未入基线） */
    private String baselineId;

    /** 基线绑定：冻结标记（冻结后只读） */
    private boolean frozen;

    /** 审计：变更前后值哈希链锚点（append-only） */
    private String auditChainHash;

    /** 权限范围：租户标识 */
    private String tenantId;

    /** 权限范围：组织标识 */
    private String orgId;

    /** 权限范围：项目标识 */
    private String projectId;

    protected ControlledObject(I id) {
        this.id = Objects.requireNonNull(id, "受控对象 id 不可为空");
        this.state = "初始";
        this.version = 1;
        this.frozen = false;
    }

    /**
     * 五要素齐全性校验（ARC-004 判据：缺一不得入库）。
     *
     * @return 校验结果，含是否齐全与缺失要素清单
     */
    public final CompletenessCheck checkCompleteness() {
        CompletenessCheck check = new CompletenessCheck();
        if (isBlank(state)) check.missing("状态机.state");
        if (version < 1) check.missing("版本.version");
        if (isBlank(revisionBy)) check.missing("版本.revisionBy");
        if (revisionAt == null) check.missing("版本.revisionAt");
        // 基线绑定：冻结对象必须有基线
        if (frozen && isBlank(baselineId)) check.missing("基线绑定.baselineId（冻结对象必须入基线）");
        if (isBlank(auditChainHash)) check.missing("审计.auditChainHash");
        if (isBlank(tenantId)) check.missing("权限范围.tenantId");
        if (isBlank(orgId)) check.missing("权限范围.orgId");
        if (isBlank(projectId)) check.missing("权限范围.projectId");
        return check;
    }

    /** 冻结：设置基线并置只读。冻结后任何修改须走受控流程。 */
    public final void freeze(String baselineId) {
        if (isBlank(baselineId)) {
            throw new IllegalArgumentException("冻结必须指定所属基线");
        }
        this.baselineId = baselineId;
        this.frozen = true;
    }

    /** 冻结后修改守卫：冻结对象修改任一成员立即被拒（ARC-008 语义）。 */
    protected final void assertNotFrozen() {
        if (frozen) {
            throw new IllegalStateException("对象已冻结（基线 " + baselineId + "），禁止修改；须走 ECR/ECN 受控变更");
        }
    }

    /** 修订：版本 +1 并记录修订元数据（未冻结才允许）。 */
    protected final void revise(String reason, String by) {
        assertNotFrozen();
        this.version = this.version + 1;
        this.revisionReason = reason;
        this.revisionBy = by;
        this.revisionAt = Instant.now();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    // —— 访问器（领域对象通过方法暴露状态，不暴露可变字段） ——

    public I id() { return id; }
    public String state() { return state; }
    public int version() { return version; }
    public String revisionReason() { return revisionReason; }
    public String revisionBy() { return revisionBy; }
    public Instant revisionAt() { return revisionAt; }
    public String baselineId() { return baselineId; }
    public boolean frozen() { return frozen; }
    public String auditChainHash() { return auditChainHash; }
    public String tenantId() { return tenantId; }
    public String orgId() { return orgId; }
    public String projectId() { return projectId; }

    protected void state(String state) { assertNotFrozen(); this.state = state; }
    protected void auditChainHash(String hash) { this.auditChainHash = hash; }
    protected void tenantId(String tenantId) { this.tenantId = tenantId; }
    protected void orgId(String orgId) { this.orgId = orgId; }
    protected void projectId(String projectId) { this.projectId = projectId; }

    /** 五要素齐全性校验结果。 */
    public static final class CompletenessCheck {
        private final java.util.List<String> missing = new java.util.ArrayList<>();

        private void missing(String element) { missing.add(element); }

        /** 是否齐全（五要素全部齐备）。 */
        public boolean complete() { return missing.isEmpty(); }

        /** 缺失要素清单（只读）。 */
        public java.util.List<String> missingElements() {
            return java.util.Collections.unmodifiableList(missing);
        }
    }
}
