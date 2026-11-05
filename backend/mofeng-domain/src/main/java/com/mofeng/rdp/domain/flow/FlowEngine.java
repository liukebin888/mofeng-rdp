package com.mofeng.rdp.domain.flow;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 可配置流程引擎（SRS 4.4 审批能力 / FUN-017 / GAT-008 / DOC-004 / DOC-014）。
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/flowEngine.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>节点、条件分支、会签或签、加签转签、超时升级。流程「定义」是数据（可配置、可持久化、
 * 不发版生效），业务规则（SOD / 安全不可豁免等）仍在领域层写死，不可通过配置绕过（GAT-013）。</p>
 *
 * <p>判定位置（卡点在哪一步执行）固定在代码里，不随配置挪动（SOLUTION 10.5）。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class FlowEngine {

    private FlowEngine() {
    }

    /** 节点类型。 */
    public static final class NodeType {
        public static final String START = "start";
        public static final String APPROVE = "approve";
        public static final String BRANCH = "branch";
        public static final String SIGN = "sign";
        public static final String END = "end";

        private NodeType() {
        }
    }

    /** 会签/或签模式。 */
    public static final class SignMode {
        public static final String ALL = "all";
        public static final String ANY = "any";

        private SignMode() {
        }
    }

    /** 实例状态。 */
    public static final class Status {
        public static final String RUNNING = "运行中";
        public static final String FINISHED = "已完成";
        public static final String REJECTED = "已驳回";
        public static final String TERMINATED = "已终止";

        private Status() {
        }
    }

    /** 审批动作。 */
    public static final class Action {
        public static final String APPROVE = "approve";
        public static final String REJECT = "reject";
        public static final String COUNTER_SIGN = "counterSign";
        public static final String ADD_SIGN = "addSign";
        public static final String TRANSFER = "transfer";
        public static final String ESCALATE = "escalate";

        private Action() {
        }
    }

    /** 条件分支：对表单字段做比较，命中则走指定下一节点。 */
    public static final class FlowBranch {
        public final String field;
        public final String op; // gt/gte/lt/lte/eq/neq
        public final String value; // 统一按字符串比较，数值型由 compareValue 解析
        public final String toNodeId;

        public FlowBranch(String field, String op, String value, String toNodeId) {
            this.field = field;
            this.op = op;
            this.value = value;
            this.toNodeId = toNodeId;
        }
    }

    /** 审批节点：可配置审批角色、时限、会签/或签、超时升级目标。 */
    public static final class FlowNode {
        public final String id;
        public final String name;
        public final String type;
        public final String approverRole; // 审批角色（approve/sign 节点必填，可为 null）
        public final String signMode;     // all/any（sign 节点），null 视为 any
        public final List<String> signRoles; // 会签参与角色列表（可为空列表）
        public final Integer slaHours;    // 超时工作小时数（null = 无超时）
        public final String escalateToRole; // 超时升级目标角色（null = 不升级仅提醒）
        public final boolean safety;      // 是否安全相关项
        public final List<FlowBranch> branches; // 条件分支（branch 节点）
        public final String defaultNext;  // 未命中任何分支时的默认下一节点

        public FlowNode(String id, String name, String type, String approverRole, String signMode,
                        List<String> signRoles, Integer slaHours, String escalateToRole, boolean safety,
                        List<FlowBranch> branches, String defaultNext) {
            this.id = id;
            this.name = name;
            this.type = type;
            this.approverRole = approverRole;
            this.signMode = signMode;
            this.signRoles = signRoles == null ? List.of() : signRoles;
            this.slaHours = slaHours;
            this.escalateToRole = escalateToRole;
            this.safety = safety;
            this.branches = branches == null ? List.of() : branches;
            this.defaultNext = defaultNext;
        }
    }

    /** 表单字段说明（分支条件引用的字段）。 */
    public static final class FormField {
        public final String key;
        public final String label;

        public FormField(String key, String label) {
            this.key = key;
            this.label = label;
        }
    }

    /** 流程定义（可配置、可持久化，修改后新实例即生效，无需发版）。 */
    public static final class FlowDefinition {
        public final String id;
        public final String code;
        public final String name;
        public final List<FormField> formFields;
        public final List<FlowNode> nodes;
        public final String startNodeId;
        public final boolean enabled;
        public final int version;

        public FlowDefinition(String id, String code, String name, List<FormField> formFields,
                              List<FlowNode> nodes, String startNodeId, boolean enabled, int version) {
            this.id = id;
            this.code = code;
            this.name = name;
            this.formFields = formFields == null ? List.of() : formFields;
            this.nodes = nodes == null ? List.of() : nodes;
            this.startNodeId = startNodeId;
            this.enabled = enabled;
            this.version = version;
        }
    }

    /** 发起人自定义追加的一个审批节点（审核/会签）。 */
    public static final class CustomApproverAddition {
        public final String name;          // 节点名（如「法务审核」「财务会签」）
        public final String kind;          // approve（单人审核）/ sign（并行会签，全部通过才过）
        public final String approverRole;  // approve 必填
        public final List<String> signRoles; // sign 必填（并行、全部通过才过）
        public final Integer slaHours;     // 缺省 48h

        public CustomApproverAddition(String name, String kind, String approverRole,
                                      List<String> signRoles, Integer slaHours) {
            this.name = name;
            this.kind = kind;
            this.approverRole = approverRole;
            this.signRoles = signRoles == null ? List.of() : signRoles;
            this.slaHours = slaHours;
        }
    }

    /** 会签单个签署人结论。 */
    public static final class Signature {
        public final String role;
        public final String name; // 可为 null
        public final boolean pass;
        public final String at;

        public Signature(String role, String name, boolean pass, String at) {
            this.role = role;
            this.name = name;
            this.pass = pass;
            this.at = at;
        }
    }

    /** 单个审批记录。 */
    public static final class ApprovalRecord {
        public final String nodeId;
        public final String nodeName;
        public final String approverRole;
        public final String approverName; // 可为 null
        public final String action;
        public final String at;
        public final String note; // 可为 null
        public final List<Signature> signatures; // 会签时各签署人结论（可为空）

        public ApprovalRecord(String nodeId, String nodeName, String approverRole, String approverName,
                              String action, String at, String note, List<Signature> signatures) {
            this.nodeId = nodeId;
            this.nodeName = nodeName;
            this.approverRole = approverRole;
            this.approverName = approverName;
            this.action = action;
            this.at = at;
            this.note = note;
            this.signatures = signatures == null ? List.of() : signatures;
        }
    }

    /** 流程实例运行时状态（不可变，流转返回新实例）。 */
    public static final class FlowInstance {
        public final String id;
        public final String defId;
        public final String defCode;
        public final String title;
        public final String submitter;
        public final Map<String, Object> form; // String/Number/Boolean
        public final String currentNodeId;
        public final String status;
        public final List<String> passedNodeIds;
        public final List<ApprovalRecord> history;
        public final String nodeEnteredAt; // ISO
        public final boolean escalated;
        public final String escalatedToRole; // 可为 null
        public final List<String> addedSigners;
        public final List<CustomApproverAddition> customNodes; // 发起人自定义追加的审批节点（留痕，可为空）
        public final String createdAt;
        public final String finishedAt; // 可为 null

        public FlowInstance(String id, String defId, String defCode, String title, String submitter,
                            Map<String, Object> form, String currentNodeId, String status,
                            List<String> passedNodeIds, List<ApprovalRecord> history,
                            String nodeEnteredAt, boolean escalated, String escalatedToRole,
                            List<String> addedSigners, List<CustomApproverAddition> customNodes,
                            String createdAt, String finishedAt) {
            this.id = id;
            this.defId = defId;
            this.defCode = defCode;
            this.title = title;
            this.submitter = submitter;
            this.form = form == null ? new LinkedHashMap<>() : form;
            this.currentNodeId = currentNodeId;
            this.status = status;
            this.passedNodeIds = passedNodeIds == null ? new ArrayList<>() : passedNodeIds;
            this.history = history == null ? new ArrayList<>() : history;
            this.nodeEnteredAt = nodeEnteredAt;
            this.escalated = escalated;
            this.escalatedToRole = escalatedToRole;
            this.addedSigners = addedSigners == null ? new ArrayList<>() : addedSigners;
            this.customNodes = customNodes == null ? new ArrayList<>() : customNodes;
            this.createdAt = createdAt;
            this.finishedAt = finishedAt;
        }

        /** 拷贝构造的便捷方法：以旧实例为底，覆盖指定字段。 */
        FlowInstance copy(String currentNodeId, String status, List<String> passedNodeIds,
                          List<ApprovalRecord> history, String nodeEnteredAt, boolean escalated,
                          String escalatedToRole, List<String> addedSigners, String finishedAt) {
            return new FlowInstance(id, defId, defCode, title, submitter, form,
                    currentNodeId == null ? this.currentNodeId : currentNodeId,
                    status == null ? this.status : status,
                    passedNodeIds == null ? this.passedNodeIds : passedNodeIds,
                    history == null ? this.history : history,
                    nodeEnteredAt == null ? this.nodeEnteredAt : nodeEnteredAt,
                    escalated,
                    escalatedToRole == null ? this.escalatedToRole : escalatedToRole,
                    addedSigners == null ? this.addedSigners : addedSigners,
                    this.customNodes,
                    createdAt,
                    finishedAt == null ? this.finishedAt : finishedAt);
        }
    }

    // ---------------------------------------------------------------------------
    // 节点查找 / 下一步解析 / 超时判定
    // ---------------------------------------------------------------------------

    public static FlowNode getNode(FlowDefinition def, String nodeId) {
        for (FlowNode n : def.nodes) {
            if (n.id.equals(nodeId)) {
                return n;
            }
        }
        return null;
    }

    /** 解析某节点 → 候选下一步（不含条件分支求值，仅静态后继）。 */
    public static List<String> staticNext(FlowDefinition def, String nodeId) {
        FlowNode node = getNode(def, nodeId);
        if (node == null) {
            return List.of();
        }
        if (NodeType.END.equals(node.type)) {
            return List.of();
        }
        List<String> next = new ArrayList<>();
        if (NodeType.BRANCH.equals(node.type)) {
            for (FlowBranch b : node.branches) {
                next.add(b.toNodeId);
            }
            if (node.defaultNext != null) {
                next.add(node.defaultNext);
            }
            return next;
        }
        // 非分支节点：按定义中的顺序找下一个节点（线性流程）
        int idx = indexOf(def, nodeId);
        if (idx >= 0 && idx + 1 < def.nodes.size()) {
            next.add(def.nodes.get(idx + 1).id);
        }
        return next;
    }

    /** 条件分支求值：命中第一个满足条件的分支；无命中走 defaultNext。 */
    public static String evalBranch(FlowDefinition def, FlowNode node, Map<String, Object> form) {
        if (!NodeType.BRANCH.equals(node.type)) {
            return null;
        }
        for (FlowBranch b : node.branches) {
            Object v = form.get(b.field);
            if (v == null) {
                continue;
            }
            if (compareValue(v, b.op, b.value)) {
                return b.toNodeId;
            }
        }
        return node.defaultNext;
    }

    /** 超时判定：超过 slaHours 工作小时则需升级（安全项即时、无延展）。 */
    public static boolean isOverdue(FlowInstance inst, FlowDefinition def, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || NodeType.END.equals(node.type) || !Status.RUNNING.equals(inst.status)) {
            return false;
        }
        if (node.slaHours == null) {
            return false;
        }
        long entered;
        try {
            entered = Instant.parse(inst.nodeEnteredAt).toEpochMilli();
        } catch (RuntimeException e) {
            return false;
        }
        double elapsedHours = (now.toEpochMilli() - entered) / 3_600_000.0;
        return elapsedHours > node.slaHours;
    }

    // ---------------------------------------------------------------------------
    // 实例创建与流转
    // ---------------------------------------------------------------------------

    /** 从定义启动一个流程实例。 */
    public static FlowInstance startFlow(FlowDefinition def, String title, String submitter,
                                         Map<String, Object> form, String id, Instant now) {
        return startFlow(def, title, submitter, form, id, now, null);
    }

    /** 从定义启动一个流程实例（可携带发起人自定义追加的审批节点留痕）。 */
    public static FlowInstance startFlow(FlowDefinition def, String title, String submitter,
                                         Map<String, Object> form, String id, Instant now,
                                         List<CustomApproverAddition> customNodes) {
        String at = now.toString();
        String instId = id != null ? id : "F" + System.currentTimeMillis();
        return new FlowInstance(
                instId, def.id, def.code, title, submitter,
                form == null ? new LinkedHashMap<>() : form,
                def.startNodeId, Status.RUNNING,
                new ArrayList<>(), new ArrayList<>(),
                at, false, null, new ArrayList<>(), customNodes, at, null);
    }

    /**
     * 发起人自定义审批节点合并（FUN-017 扩展）：在固定审批链之外，发起人可自行增加
     * 「审核（单人）」与「会签（并行、全部通过才过）」节点。
     *
     * <p>插入规则（fail-closed，非法输入不改变定义）：</p>
     * <ul>
     *   <li>自定义节点统一插入到固定链中「最后一个 approve 批准节点」之前（即会签之后、批准之前）。</li>
     *   <li>会签节点 signMode 固定为 'all'（并行、全部通过才过）。</li>
     *   <li>会签至少 1 个角色、审核至少 1 个审批角色，否则该条被忽略。</li>
     *   <li>节点 id 用前缀 'cxN-' 生成，避免与固定节点 id 冲突。</li>
     * </ul>
     *
     * <p>返回新的 FlowDefinition（原 def 不可变）；additions 为空或全非法则原样返回。</p>
     */
    public static FlowDefinition applyCustomApprovers(FlowDefinition def,
                                                      List<CustomApproverAddition> additions) {
        if (additions == null || additions.isEmpty()) {
            return def;
        }
        List<CustomApproverAddition> valid = new ArrayList<>();
        for (CustomApproverAddition a : additions) {
            boolean nameOk = a.name != null && !a.name.trim().isEmpty();
            if (!nameOk) {
                continue;
            }
            if ("sign".equals(a.kind)) {
                if (a.signRoles != null && !a.signRoles.isEmpty()) {
                    valid.add(a);
                }
            } else if (a.approverRole != null && !a.approverRole.trim().isEmpty()) {
                valid.add(a);
            }
        }
        if (valid.isEmpty()) {
            return def;
        }

        List<FlowNode> nodes = new ArrayList<>(def.nodes);
        // 定位固定链最后一个 approve 批准节点（插入锚点）；无则退化为 end 节点之前
        int anchorIdx = -1;
        for (int i = 0; i < nodes.size(); i++) {
            if (NodeType.APPROVE.equals(nodes.get(i).type)) {
                anchorIdx = i;
            }
        }
        int insertIdx = anchorIdx >= 0 ? anchorIdx : indexOfType(nodes, NodeType.END);

        List<FlowNode> customNodes = new ArrayList<>();
        for (int i = 0; i < valid.size(); i++) {
            CustomApproverAddition a = valid.get(i);
            String name = a.name.trim();
            Integer sla = a.slaHours != null ? a.slaHours : 48;
            if ("sign".equals(a.kind)) {
                List<String> roles = new ArrayList<>();
                for (String r : a.signRoles) {
                    if (r != null && !r.trim().isEmpty()) {
                        roles.add(r.trim());
                    }
                }
                customNodes.add(new FlowNode("cxN-" + i, name, NodeType.SIGN, null, SignMode.ALL,
                        roles, sla, null, false, List.of(), null));
            } else {
                customNodes.add(new FlowNode("cxN-" + i, name, NodeType.APPROVE, a.approverRole.trim(),
                        null, List.of(), sla, null, false, List.of(), null));
            }
        }

        List<FlowNode> nextNodes = new ArrayList<>();
        if (insertIdx >= 0) {
            nextNodes.addAll(nodes.subList(0, insertIdx));
            nextNodes.addAll(customNodes);
            nextNodes.addAll(nodes.subList(insertIdx, nodes.size()));
        } else {
            nextNodes.addAll(nodes);
            nextNodes.addAll(customNodes);
        }
        return new FlowDefinition(def.id, def.code, def.name, def.formFields, nextNodes,
                def.startNodeId, def.enabled, def.version);
    }

    /** 分支跳转：branch 节点进入后立即解析并推进到目标节点。 */
    public static FlowInstance advanceThroughBranch(FlowInstance inst, FlowDefinition def, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || !NodeType.BRANCH.equals(node.type) || !Status.RUNNING.equals(inst.status)) {
            return inst;
        }
        String to = evalBranch(def, node, inst.form);
        String at = now.toString();
        if (to == null) {
            // 无命中且无 defaultNext：终止（异常出口，防静默挂起）
            List<ApprovalRecord> history = append(inst.history,
                    new ApprovalRecord(node.id, node.name, "系统", null, Action.ESCALATE, at,
                            "条件分支无命中且无默认路径，流程终止", List.of()));
            return inst.copy(null, Status.TERMINATED, null, history, null, inst.escalated, null, null, at);
        }
        List<String> passed = appendStr(inst.passedNodeIds, node.id);
        List<ApprovalRecord> history = append(inst.history,
                new ApprovalRecord(node.id, node.name, "系统", null, Action.ESCALATE, at,
                        "条件分支命中 → " + to, List.of()));
        return inst.copy(to, null, passed, history, at, inst.escalated, null, null, null);
    }

    /** 会签/或签节点：登记一个签署人结论，返回是否整节点通过。 */
    public static SignResult signNode(FlowInstance inst, FlowDefinition def,
                                      String approverRole, String approverName, String signRole, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || (!NodeType.SIGN.equals(node.type) && !NodeType.APPROVE.equals(node.type))
                || !Status.RUNNING.equals(inst.status)) {
            return new SignResult(inst, false, false);
        }
        String at = now.toString();
        // 会签范围 = 定义中的 signRoles + 审批中加签(addedSigners)的角色（并行，全部通过才过）
        List<String> roles = new ArrayList<>(
                !node.signRoles.isEmpty() ? node.signRoles
                        : (node.approverRole != null ? List.of(node.approverRole) : List.of()));
        for (String r : inst.addedSigners) {
            if (!roles.contains(r)) {
                roles.add(r);
            }
        }
        // 找到本节点已有的签署记录（同一角色不可重复签）
        ApprovalRecord existing = findCounterSign(inst.history, node.id);
        List<Signature> sigs = existing != null ? new ArrayList<>(existing.signatures) : new ArrayList<>();
        String targetRole = signRole != null ? signRole : approverRole;
        boolean targetPass = approverRole != null && approverRole.equals(targetRole);
        if (!containsRole(sigs, targetRole)) {
            sigs.add(new Signature(targetRole, approverName, targetPass, at));
        }

        String signMode = node.signMode != null ? node.signMode : SignMode.ANY;
        boolean allPassed = roles.stream().allMatch(r -> containsPass(sigs, r));
        boolean anyPassed = sigs.stream().anyMatch(s -> s.pass);
        boolean nodePassed = SignMode.ALL.equals(signMode) ? allPassed : anyPassed;

        List<ApprovalRecord> history = new ArrayList<>(inst.history);
        history.removeIf(h -> h.nodeId.equals(node.id) && Action.COUNTER_SIGN.equals(h.action));
        history.add(new ApprovalRecord(node.id, node.name, approverRole, approverName,
                Action.COUNTER_SIGN, at, null, sigs));

        FlowInstance newInst = inst.copy(null, null, null, history, null, inst.escalated, null, null, null);
        return new SignResult(newInst, nodePassed, allPassed);
    }

    /** 普通审批节点通过；通过后推进到下一节点（含分支求值）。 */
    public static FlowInstance approveNode(FlowInstance inst, FlowDefinition def,
                                           String approverRole, String approverName, String note, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || !Status.RUNNING.equals(inst.status)) {
            return inst;
        }
        String at = now.toString();
        List<String> passed = appendStr(inst.passedNodeIds, node.id);
        List<ApprovalRecord> history = append(inst.history,
                new ApprovalRecord(node.id, node.name, approverRole, approverName, Action.APPROVE, at, note, List.of()));
        FlowInstance next = inst.copy(null, null, passed, history, null, inst.escalated, null, null, null);

        List<String> candidates = staticNext(def, node.id);
        if (candidates.isEmpty()) {
            // 已是最后一个审批节点（其后无节点）：结束
            next = next.copy(null, Status.FINISHED, null, null, null, inst.escalated, null, null, at);
        } else {
            String targetId = candidates.get(0);
            FlowNode targetNode = getNode(def, targetId);
            if (targetNode != null && NodeType.END.equals(targetNode.type)) {
                next = next.copy(targetId, Status.FINISHED, null, null, null, inst.escalated, null, null, at);
            } else {
                next = next.copy(targetId, null, null, null, at, inst.escalated, null, null, null);
                next = advanceThroughBranch(next, def, Instant.parse(at));
            }
        }
        return next;
    }

    /** 驳回节点。 */
    public static FlowInstance rejectNode(FlowInstance inst, FlowDefinition def,
                                          String approverRole, String approverName, String note, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || !Status.RUNNING.equals(inst.status)) {
            return inst;
        }
        String at = now.toString();
        List<ApprovalRecord> history = append(inst.history,
                new ApprovalRecord(node.id, node.name, approverRole, approverName, Action.REJECT, at, note, List.of()));
        return inst.copy(null, Status.REJECTED, null, history, null, inst.escalated, null, null, at);
    }

    /** 加签：在审批节点追加一个签署角色（扩大会签范围）。 */
    public static FlowInstance addSigner(FlowInstance inst, FlowDefinition def, String role, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || !Status.RUNNING.equals(inst.status)) {
            return inst;
        }
        String at = now.toString();
        List<String> added = appendStr(inst.addedSigners, role);
        List<ApprovalRecord> history = append(inst.history,
                new ApprovalRecord(node.id, node.name, role, null, Action.ADD_SIGN, at, "加签 " + role, List.of()));
        return inst.copy(null, null, null, history, null, inst.escalated, null, added, null);
    }

    /** 转办：把当前审批转给另一角色。 */
    public static FlowInstance transferNode(FlowInstance inst, FlowDefinition def, String toRole, String note, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || !Status.RUNNING.equals(inst.status)) {
            return inst;
        }
        String at = now.toString();
        List<ApprovalRecord> history = append(inst.history,
                new ApprovalRecord(node.id, node.name, toRole, null, Action.TRANSFER, at,
                        note != null ? note : "转办至 " + toRole, List.of()));
        return inst.copy(null, null, null, history, at, inst.escalated, null, null, null);
    }

    /** 超时升级：把当前审批升级到上级角色并留痕（触达记录）。 */
    public static FlowInstance escalate(FlowInstance inst, FlowDefinition def, Instant now) {
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null || !Status.RUNNING.equals(inst.status) || inst.escalated) {
            return inst;
        }
        String toRole = node.escalateToRole;
        if (toRole == null) {
            return inst.copy(null, null, null, null, null, true, null, null, null);
        }
        String at = now.toString();
        List<ApprovalRecord> history = append(inst.history,
                new ApprovalRecord(node.id, node.name, toRole, null, Action.ESCALATE, at,
                        "超时升级 → " + toRole, List.of()));
        return inst.copy(null, null, null, history, at, true, toRole, null, null);
    }

    /** 可执行动作：给定实例与定义，返回当前节点允许的动作集合。 */
    public static List<String> availableActions(FlowInstance inst, FlowDefinition def, Instant now) {
        if (!Status.RUNNING.equals(inst.status)) {
            return List.of();
        }
        FlowNode node = getNode(def, inst.currentNodeId);
        if (node == null) {
            return List.of();
        }
        List<String> acts = new ArrayList<>();
        if (NodeType.APPROVE.equals(node.type) || NodeType.SIGN.equals(node.type)) {
            acts.add("通过");
            acts.add("驳回");
            if (NodeType.SIGN.equals(node.type) || (node.signRoles != null && node.signRoles.size() > 1)) {
                acts.add("会签");
            }
            acts.add("加签");
            acts.add("转办");
        }
        if (isOverdue(inst, def, now) && !inst.escalated && node.escalateToRole != null) {
            acts.add("超时升级");
        }
        return acts;
    }

    // ---------------------------------------------------------------------------
    // 内部工具
    // ---------------------------------------------------------------------------

    /** 会签节点签署结果。 */
    public static final class SignResult {
        public final FlowInstance inst;
        public final boolean nodePassed;
        public final boolean allPassed;

        SignResult(FlowInstance inst, boolean nodePassed, boolean allPassed) {
            this.inst = inst;
            this.nodePassed = nodePassed;
            this.allPassed = allPassed;
        }
    }

    private static int indexOf(FlowDefinition def, String nodeId) {
        for (int i = 0; i < def.nodes.size(); i++) {
            if (def.nodes.get(i).id.equals(nodeId)) {
                return i;
            }
        }
        return -1;
    }

    private static int indexOfType(List<FlowNode> nodes, String type) {
        for (int i = 0; i < nodes.size(); i++) {
            if (type.equals(nodes.get(i).type)) {
                return i;
            }
        }
        return -1;
    }

    private static boolean compareValue(Object v, String op, String target) {
        if ("eq".equals(op)) {
            return String.valueOf(v).equals(target);
        }
        if ("neq".equals(op)) {
            return !String.valueOf(v).equals(target);
        }
        double nv;
        double nt;
        try {
            nv = v instanceof Number ? ((Number) v).doubleValue() : Double.parseDouble(String.valueOf(v));
            nt = Double.parseDouble(target);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Double.isNaN(nv) || Double.isNaN(nt)) {
            return false;
        }
        switch (op) {
            case "gt":
                return nv > nt;
            case "gte":
                return nv >= nt;
            case "lt":
                return nv < nt;
            case "lte":
                return nv <= nt;
            default:
                return false;
        }
    }

    private static ApprovalRecord findCounterSign(List<ApprovalRecord> history, String nodeId) {
        for (ApprovalRecord h : history) {
            if (h.nodeId.equals(nodeId) && Action.COUNTER_SIGN.equals(h.action)) {
                return h;
            }
        }
        return null;
    }

    private static boolean containsRole(List<Signature> sigs, String role) {
        for (Signature s : sigs) {
            if (s.role.equals(role)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsPass(List<Signature> sigs, String role) {
        for (Signature s : sigs) {
            if (s.role.equals(role) && s.pass) {
                return true;
            }
        }
        return false;
    }

    private static List<ApprovalRecord> append(List<ApprovalRecord> list, ApprovalRecord item) {
        List<ApprovalRecord> out = new ArrayList<>(list);
        out.add(item);
        return out;
    }

    private static List<String> appendStr(List<String> list, String item) {
        List<String> out = new ArrayList<>(list);
        out.add(item);
        return out;
    }
}
