package com.mofeng.rdp.domain.gate;

/**
 * 门禁引擎（SRS 14 / GAT-001~013、附录 A）。
 *
 * <p>五要素：输入物清单、可机器校验判据、放行人与评审人分离、时限、驳回与豁免。
 * 与前端 TS 引擎 {@code app/src/domain/gate.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>铁律（GAT-001 / D-15 裁决）：<b>Gate 模板由 PMO 统一维护、唯一权威，项目不得自建判据</b>。
 * 未知/自建 gate code 一律拒绝，而非静默放行。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class GateEngine {

    private GateEngine() {
    }

    /** 控制点裁决结果。 */
    public enum Verdict { PASS, FAIL, CONDITIONAL }

    /** 控制点评估结果。 */
    public static final class ControlPointResult {
        private final String code;
        private final String measured;
        private final Verdict verdict;

        public ControlPointResult(String code, String measured, Verdict verdict) {
            this.code = code;
            this.measured = measured;
            this.verdict = verdict;
        }

        public String code() { return code; }
        public String measured() { return measured; }
        public Verdict verdict() { return verdict; }
    }

    /** 门禁条目。 */
    public static final class GateItem {
        private final String code;
        private final String name;
        private final boolean required;
        private final boolean safety;
        private final String cp;

        public GateItem(String code, String name, boolean required, boolean safety, String cp) {
            this.code = code;
            this.name = name;
            this.required = required;
            this.safety = safety;
            this.cp = cp;
        }

        public String code() { return code; }
        public String name() { return name; }
        public boolean required() { return required; }
        public boolean safety() { return safety; }
        public String cp() { return cp; }
    }

    /** 门禁模板。 */
    public static final class GateTemplate {
        private final String code;
        private final String name;
        private final String stage;
        private final int slaHours;
        private final java.util.List<GateItem> items;

        public GateTemplate(String code, String name, String stage, int slaHours, java.util.List<GateItem> items) {
            this.code = code;
            this.name = name;
            this.stage = stage;
            this.slaHours = slaHours;
            this.items = java.util.List.copyOf(items);
        }

        public String code() { return code; }
        public String name() { return name; }
        public String stage() { return stage; }
        public int slaHours() { return slaHours; }
        public java.util.List<GateItem> items() { return items; }
    }

    /** 门禁单条结果。 */
    public static final class ItemResult {
        private final String code;
        private final String name;
        private final boolean ok;
        private final String cp;
        private final String note;

        ItemResult(String code, String name, boolean ok, String cp, String note) {
            this.code = code;
            this.name = name;
            this.ok = ok;
            this.cp = cp;
            this.note = note;
        }

        public String code() { return code; }
        public String name() { return name; }
        public boolean ok() { return ok; }
        public String cp() { return cp; }
        public String note() { return note; }
    }

    /** 门禁运行结果。 */
    public static final class Run {
        private final String gate;
        private final String projectId;
        private final boolean passed;
        private final boolean conditional;
        private final java.util.List<String> missing;
        private final boolean safetyBlocked;
        private final java.util.List<ItemResult> results;
        private final String submittedBy;

        Run(String gate, String projectId, boolean passed, boolean conditional,
            java.util.List<String> missing, boolean safetyBlocked,
            java.util.List<ItemResult> results, String submittedBy) {
            this.gate = gate;
            this.projectId = projectId;
            this.passed = passed;
            this.conditional = conditional;
            this.missing = java.util.List.copyOf(missing);
            this.safetyBlocked = safetyBlocked;
            this.results = java.util.List.copyOf(results);
            this.submittedBy = submittedBy;
        }

        public String gate() { return gate; }
        public String projectId() { return projectId; }
        public boolean passed() { return passed; }
        public boolean conditional() { return conditional; }
        public java.util.List<String> missing() { return missing; }
        public boolean safetyBlocked() { return safetyBlocked; }
        public java.util.List<ItemResult> results() { return results; }
        public String submittedBy() { return submittedBy; }
    }

    /** 门禁提交输入。 */
    public static final class Submit {
        private final String gate;
        private final String projectId;
        private final java.util.List<ControlPointResult> cpResults;
        private final String submitter;
        private final boolean baselineFrozen;
        private final boolean safetySigned;
        private final java.util.List<String> exemptItems;

        public Submit(String gate, String projectId, java.util.List<ControlPointResult> cpResults,
                      String submitter, boolean baselineFrozen, boolean safetySigned,
                      java.util.List<String> exemptItems) {
            this.gate = gate;
            this.projectId = projectId;
            this.cpResults = cpResults == null ? java.util.List.of() : java.util.List.copyOf(cpResults);
            this.submitter = submitter;
            this.baselineFrozen = baselineFrozen;
            this.safetySigned = safetySigned;
            this.exemptItems = exemptItems == null ? java.util.List.of() : java.util.List.copyOf(exemptItems);
        }

        public String gate() { return gate; }
        public String projectId() { return projectId; }
        public java.util.List<ControlPointResult> cpResults() { return cpResults; }
        public String submitter() { return submitter; }
        public boolean baselineFrozen() { return baselineFrozen; }
        public boolean safetySigned() { return safetySigned; }
        public java.util.List<String> exemptItems() { return exemptItems; }
    }

    private static GateItem item(String code, String name, boolean required, String cp) {
        return new GateItem(code, name, required, false, cp);
    }

    private static GateItem safetyItem(String code, String name, boolean required, String cp) {
        return new GateItem(code, name, required, true, cp);
    }

    /** 权威模板集（PMO 唯一维护），G1~G5。 */
    private static final java.util.List<GateTemplate> GATE_TEMPLATES = java.util.List.of(
        new GateTemplate("G1", "立项闸门", "P1–P2 立项与策划", 24, java.util.List.of(
            item("G1-01", "项目等级已判定（L1~L4）且依据可回看", true, "C-01"),
            item("G1-02", "技术方案与报价已关联", true, "C-02"),
            item("G1-03", "预算已批准并挂 WBS 成本科目", true, "C-10"),
            item("G1-04", "需求基线已形成、无孤儿需求", true, "C-03"),
            item("G1-05", "关键角色到位（PM/质量/安全/SQE）", true, "C-23"),
            item("G1-06", "立项评审结论明确（三态之一）", true, "C-07")
        )),
        new GateTemplate("G2", "方案闸门", "P3 方案与计划", 24, java.util.List.of(
            item("G2-01", "WBS 分解至可估算层级、依赖完整", true, "C-04"),
            item("G2-02", "计划已通过 13 项质量检查并冻结", true, "C-37"),
            item("G2-03", "风险四要素齐全且完成 RPN 量化", true, "C-14"),
            item("G2-04", "高风险已完成策略登记与储备测算", true, "C-44"),
            item("G2-05", "成本口径与挣值计量规则已登记", true, "C-41"),
            safetyItem("G2-06", "安全评审独立通过", true, "C-31")
        )),
        new GateTemplate("G3", "设计闸门", "P4 研发过程", 24, java.util.List.of(
            safetyItem("G3-01", "安全链路追溯覆盖率 ≥98%、断链为空", true, "C-32"),
            item("G3-02", "图纸与关键文档多专业会签齐备", true, "C-45"),
            item("G3-03", "交付物清单齐套（缺件率 0）", true, "C-19"),
            item("G3-04", "对应基线已冻结、哈希校验通过", true, "C-20"),
            item("G3-05", "ECR 影响闭包已逐项确认", true, "C-17"),
            item("G3-06", "控制点/阈值变更已回归测试", false, "C-48")
        )),
        new GateTemplate("G4", "样件闸门", "P5 样件试制与 OTS", 48, java.util.List.of(
            item("G4-01", "供应商已准入且在有效期内", true, "C-25"),
            item("G4-02", "PPAP 要素齐全并批准", true, "C-26"),
            item("G4-03", "关键物料齐套率 100%", true, "C-19"),
            item("G4-04", "样件与文件成套、基线已冻结", true, "C-20"),
            safetyItem("G4-05", "高风险项已完成量化与策略登记", true, "C-44"),
            item("G4-06", "资源超分配已裁决", false, "C-40")
        )),
        new GateTemplate("G5", "交付闸门", "P6–P7 交付与结项", 48, java.util.List.of(
            item("G5-01", "交付基线已冻结、哈希校验通过", true, "C-20"),
            item("G5-02", "交付物齐套、缺件率 0", true, "C-19"),
            item("G5-03", "客户签收或拒收结论明确并留痕", true, "C-21"),
            safetyItem("G5-04", "高危漏洞为 0，中危已评估", true, "C-33"),
            item("G5-05", "审计哈希链连续、11 类动作覆盖", true, "C-29"),
            item("G5-06", "阶段复盘完成（目标/偏差/改进项）", false, "C-34")
        ))
    );

    /** 权威模板解析：仅接受登记内的 gate code；未知/自建返回 null。 */
    public static GateTemplate resolveGateTemplate(String gate) {
        return GATE_TEMPLATES.stream().filter(g -> g.code().equals(gate)).findFirst().orElse(null);
    }

    /** 权威模板集（只读）。 */
    public static java.util.List<GateTemplate> templates() {
        return GATE_TEMPLATES;
    }

    /** 非权威 gate 拒绝（D-15：项目自建判据一律拒绝）。 */
    public static Run rejectUnknownGate(String gate, String projectId, String submitter) {
        var note = gate + " 非权威闸门模板";
        var item = new ItemResult(gate, "非权威闸门模板", false, null,
            "该闸门不在 PMO 统一维护的权威模板集内（GAT-001 / D-15），项目不得自建判据，拒绝执行");
        return new Run(gate, projectId, false, false,
            java.util.List.of(note), false, java.util.List.of(item), submitter);
    }

    /** Gate 准入校验：L4 阻断、L3 条件放行、安全项不可豁免；非权威 gate 直接拒绝。 */
    public static Run runGate(Submit input) {
        GateTemplate tpl = resolveGateTemplate(input.gate());
        if (tpl == null) {
            return rejectUnknownGate(input.gate(), input.projectId(), input.submitter());
        }
        java.util.Map<String, ControlPointResult> cpMap = new java.util.HashMap<>();
        for (ControlPointResult r : input.cpResults()) {
            cpMap.put(r.code(), r);
        }

        java.util.List<ItemResult> results = new java.util.ArrayList<>();
        for (GateItem it : tpl.items()) {
            // 非 G1 且绑定基线控制点 C-20 时，基线必须已冻结（GAT-004）
            if (!input.gate().equals("G1") && "C-20".equals(it.cp()) && !input.baselineFrozen()) {
                results.add(new ItemResult(it.code(), it.name(), false, it.cp(),
                    "基线未冻结，前置条件不满足（GAT-004）"));
                continue;
            }
            // 安全项需独立签署（SOD-02）
            if (it.safety() && !input.safetySigned()) {
                results.add(new ItemResult(it.code(), it.name(), false, it.cp(),
                    "安全评审未独立签署（SOD-02）"));
                continue;
            }
            ControlPointResult cp = it.cp() == null ? null : cpMap.get(it.cp());
            // CLS-007 缺项按最严：控制点未被评估 = 无证据 = 不可放行（严禁 fail-open）
            if (cp == null) {
                results.add(new ItemResult(it.code(), it.name(), false, it.cp(),
                    "控制点 " + (it.cp() == null ? "（未绑定）" : it.cp()) + " 无评估结果，按缺项判不合格（CLS-007），须补评估后重新提交"));
                continue;
            }
            boolean exempt = input.exemptItems().contains(it.code());
            if (exempt && it.safety()) {
                results.add(new ItemResult(it.code(), it.name(), false, it.cp(), "安全项不可豁免（GAT-009）"));
                continue;
            }
            boolean ok = cp.verdict() != Verdict.FAIL;
            String note = cp.verdict() == Verdict.FAIL
                ? "控制点 " + cp.code() + " 不合格：" + cp.measured()
                : cp.verdict() == Verdict.CONDITIONAL
                    ? "有条件：" + cp.measured()
                    : "通过：" + cp.measured();
            results.add(new ItemResult(it.code(), it.name(), ok, it.cp(), note));
        }

        java.util.List<String> missing = new java.util.ArrayList<>();
        for (ItemResult r : results) {
            if (!r.ok()) missing.add(r.code() + " " + r.name());
        }
        boolean safetyBlocked = false;
        for (ItemResult r : results) {
            if (!r.ok()) {
                GateItem gi = tpl.items().stream().filter(i -> i.code().equals(r.code())).findFirst().orElse(null);
                if (gi != null && gi.safety()) safetyBlocked = true;
            }
        }
        boolean requiredMissing = results.stream().anyMatch(r -> {
            if (r.ok()) return false;
            return tpl.items().stream().anyMatch(i -> i.code().equals(r.code()) && i.required());
        });
        boolean passed = !requiredMissing && !safetyBlocked;
        boolean conditional = !requiredMissing && results.stream().anyMatch(r -> r.note().startsWith("有条件"));
        return new Run(input.gate(), input.projectId(), passed, conditional,
            missing, safetyBlocked, results, input.submitter());
    }

    /** SOD-01：提交人与放行人不得为同一人。 */
    public static SodResult sodRelease(String submitter, String releaser) {
        if (!submitter.equals(releaser)) {
            return new SodResult(true, "提交人 " + submitter + " / 放行人 " + releaser + "，职责分离满足");
        }
        return new SodResult(false, "提交人与放行人为同一人（" + submitter + "），违反 SOD-01，放行被拒");
    }

    /** SOD 判定结果。 */
    public static final class SodResult {
        private final boolean ok;
        private final String message;

        SodResult(boolean ok, String message) {
            this.ok = ok;
            this.message = message;
        }

        public boolean ok() { return ok; }
        public String message() { return message; }
    }

    /** SLA 超时状态（GAT-008）；非权威 gate 返回 null。 */
    public static SlaState slaState(String gate, java.time.Instant submittedAt, java.time.Instant now) {
        GateTemplate tpl = resolveGateTemplate(gate);
        if (tpl == null) return null;
        double hours = (double) (now.toEpochMilli() - submittedAt.toEpochMilli()) / 3_600_000.0;
        double rounded = Math.round(hours * 10) / 10.0;
        return new SlaState(rounded, rounded > tpl.slaHours(), tpl.slaHours());
    }

    /** SLA 状态。 */
    public static final class SlaState {
        private final double hours;
        private final boolean overdue;
        private final int limit;

        SlaState(double hours, boolean overdue, int limit) {
            this.hours = hours;
            this.overdue = overdue;
            this.limit = limit;
        }

        public double hours() { return hours; }
        public boolean overdue() { return overdue; }
        public int limit() { return limit; }
    }
}
