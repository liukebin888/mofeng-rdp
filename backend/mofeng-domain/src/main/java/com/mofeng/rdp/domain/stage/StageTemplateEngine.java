package com.mofeng.rdp.domain.stage;

import com.mofeng.rdp.domain.gate.GateEngine;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 研发阶段模板引擎（STG-001/002/003，汽车零部件行业研发流程管控 P0）。
 *
 * <p>定位：产品核心「按汽车零部件行业研发流程对项目分阶段管控」的可配置阶段模板。
 * 阶段可配置：客户在内置模板上可增删阶段、改阶段名、调阶段次序、设前置依赖。
 * 阶段之间有门禁（Gate）：前序阶段未批准，后续阶段不可开展（配合 {@link GateEnforceEngine}）。</p>
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/stageTemplate.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。本引擎是「阶段模板与阶段间前置依赖」的单一权威来源，
 * 禁止在业务代码里自建阶段次序比较。</p>
 */
public final class StageTemplateEngine {

    private StageTemplateEngine() {
    }

    /** 阶段定义（模板内单个阶段）。 */
    public static final class StageDef {
        private final String code;
        private final String name;
        private final int order;
        private final String gateCode;
        private final List<String> prerequisites;

        public StageDef(String code, String name, int order, String gateCode, List<String> prerequisites) {
            this.code = code;
            this.name = name;
            this.order = order;
            this.gateCode = gateCode;
            this.prerequisites = prerequisites == null ? List.of() : List.copyOf(prerequisites);
        }

        public String code() { return code; }
        public String name() { return name; }
        public int order() { return order; }
        public String gateCode() { return gateCode; }
        public List<String> prerequisites() { return prerequisites; }
    }

    /** 研发阶段模板（客户可增删改）。 */
    public static final class StageTemplate {
        private final String id;
        private final String name;
        private final String tag;
        private final List<StageDef> stages;
        private final int version;

        public StageTemplate(String id, String name, String tag, List<StageDef> stages, int version) {
            this.id = id;
            this.name = name;
            this.tag = tag;
            this.stages = stages == null ? List.of() : List.copyOf(stages);
            this.version = version;
        }

        public String id() { return id; }
        public String name() { return name; }
        public String tag() { return tag; }
        public List<StageDef> stages() { return stages; }
        public int version() { return version; }

        /** 返回一个新模板（不可变，版本 +1）。 */
        StageTemplate withStages(List<StageDef> next) {
            return new StageTemplate(id, name, tag, next, version + 1);
        }
    }

    /** 阶段推进判定结果。 */
    public static final class StageAdvanceVerdict {
        private final boolean ok;
        private final String code; // OK / PREREQ_NOT_APPROVED / STAGE_UNKNOWN
        private final String note;
        private final List<String> missingPrereqs;

        StageAdvanceVerdict(boolean ok, String code, String note, List<String> missingPrereqs) {
            this.ok = ok;
            this.code = code;
            this.note = note;
            this.missingPrereqs = missingPrereqs == null ? List.of() : List.copyOf(missingPrereqs);
        }

        public boolean ok() { return ok; }
        public String code() { return code; }
        public String note() { return note; }
        public List<String> missingPrereqs() { return missingPrereqs; }
    }

    /** 模板可配置操作结果。 */
    public static final class TemplateOp {
        private final boolean ok;
        private final String note;
        private final StageTemplate tpl;

        TemplateOp(boolean ok, String note, StageTemplate tpl) {
            this.ok = ok;
            this.note = note;
            this.tpl = tpl;
        }

        public boolean ok() { return ok; }
        public String note() { return note; }
        public StageTemplate tpl() { return tpl; }
    }

    private static StageDef st(String code, String name, int order, String gateCode, String... prerequisites) {
        return new StageDef(code, name, order, gateCode, List.of(prerequisites));
    }

    /** 内置模板：汽车零部件研发六阶段（类 APQP）。 */
    public static final StageTemplate AUTOMOTIVE = new StageTemplate(
        "TPL-AUTO", "汽车零部件研发六阶段", "汽车零部件", List.of(
            st("S1", "立项与策划", 1, "G1"),
            st("S2", "产品设计与开发", 2, "G2", "S1"),
            st("S3", "过程设计与开发", 3, "G3", "S2"),
            st("S4", "试制与 OTS 验证", 4, "G4", "S3"),
            st("S5", "量产与交付", 5, "G5", "S4"),
            st("S6", "反馈与改进", 6, null, "S5")
        ), 1);

    /** 通用精简模板（无闸门的连续四阶段，供小团队）。 */
    public static final StageTemplate GENERIC = new StageTemplate(
        "TPL-GEN", "通用项目四阶段", "通用", List.of(
            st("S1", "启动", 1, null),
            st("S2", "规划", 2, null, "S1"),
            st("S3", "执行", 3, null, "S2"),
            st("S4", "收尾", 4, null, "S3")
        ), 1);

    /** 内置模板注册表。 */
    public static final List<StageTemplate> TEMPLATES = List.of(AUTOMOTIVE, GENERIC);

    // -------------------------------------------------------------------------
    // 查询
    // -------------------------------------------------------------------------

    /** 按 id 查模板。 */
    public static StageTemplate findTemplate(List<StageTemplate> templates, String id) {
        for (StageTemplate t : templates) {
            if (t.id().equals(id)) return t;
        }
        return null;
    }

    /** 按 code 查阶段（模板内）。 */
    public static StageDef findStage(StageTemplate tpl, String code) {
        for (StageDef s : tpl.stages()) {
            if (s.code().equals(code)) return s;
        }
        return null;
    }

    /** 按次序排序的阶段列表（权威排序：order 升序，禁止调用方自排）。 */
    public static List<StageDef> orderedStages(StageTemplate tpl) {
        List<StageDef> out = new ArrayList<>(tpl.stages());
        out.sort((a, b) -> Integer.compare(a.order(), b.order()));
        return List.copyOf(out);
    }

    /** 阶段的前置阶段列表。 */
    public static List<StageDef> prerequisitesOf(StageTemplate tpl, String code) {
        StageDef s = findStage(tpl, code);
        if (s == null) return List.of();
        List<StageDef> out = new ArrayList<>();
        for (String p : s.prerequisites()) {
            StageDef ps = findStage(tpl, p);
            if (ps != null) out.add(ps);
        }
        return List.copyOf(out);
    }

    // -------------------------------------------------------------------------
    // 阶段推进判定（核心：前序未批准 → 不可进入）
    // -------------------------------------------------------------------------

    /** 已批准闸门 code 集合（由 GateRun 汇总：passed 且非 conditional）。 */
    public static Set<String> approvedGateCodes(List<GateEngine.Run> gateRuns) {
        Set<String> approved = new LinkedHashSet<>();
        for (GateEngine.Run r : gateRuns) {
            if (r.passed() && !r.conditional()) approved.add(r.gate());
        }
        return approved;
    }

    /**
     * 阶段推进判定：目标阶段的所有前置阶段须「已批准」方可进入。
     * 已知违规样本（回退验证）：前置阶段未批准 → PREREQ_NOT_APPROVED 拒绝。
     */
    public static StageAdvanceVerdict canAdvanceToStage(
        StageTemplate tpl, String targetCode, Set<String> approvedGateCodes) {
        StageDef target = findStage(tpl, targetCode);
        if (target == null) {
            return new StageAdvanceVerdict(false, "STAGE_UNKNOWN",
                "阶段 " + targetCode + " 不在模板 " + tpl.id() + " 内", List.of());
        }
        List<String> missing = new ArrayList<>();
        for (String pre : target.prerequisites()) {
            StageDef preStage = findStage(tpl, pre);
            if (preStage == null) {
                missing.add(pre);
                continue;
            }
            if (preStage.gateCode() != null && !approvedGateCodes.contains(preStage.gateCode())) {
                missing.add(pre);
            }
        }
        if (!missing.isEmpty()) {
            List<String> names = new ArrayList<>();
            for (String m : missing) {
                StageDef ms = findStage(tpl, m);
                names.add(ms != null ? ms.name() : m);
            }
            return new StageAdvanceVerdict(false, "PREREQ_NOT_APPROVED",
                "前置阶段未批准：" + String.join("、", names) + "（只有批准才能实施下一阶段）",
                List.copyOf(missing));
        }
        return new StageAdvanceVerdict(true, "OK", "阶段 " + target.name() + " 前置已满足，可进入", List.of());
    }

    // -------------------------------------------------------------------------
    // 模板可配置操作（增删改，纯函数不修改入参）
    // -------------------------------------------------------------------------

    /** 新增阶段：校验 code 唯一、order 唯一。 */
    public static TemplateOp addStage(StageTemplate tpl, StageDef stage) {
        if (findStage(tpl, stage.code()) != null) {
            return new TemplateOp(false, "阶段 code " + stage.code() + " 已存在，不可重复", null);
        }
        for (StageDef s : tpl.stages()) {
            if (s.order() == stage.order()) {
                return new TemplateOp(false, "阶段次序 " + stage.order() + " 已被 " + s.name() + " 占用", null);
            }
        }
        List<StageDef> next = new ArrayList<>(tpl.stages());
        next.add(stage);
        return new TemplateOp(true, "已新增阶段 " + stage.name(), tpl.withStages(next));
    }

    /** 删除阶段：校验无其它阶段依赖它（作为前置）。 */
    public static TemplateOp removeStage(StageTemplate tpl, String code) {
        StageDef target = findStage(tpl, code);
        if (target == null) return new TemplateOp(false, "阶段 " + code + " 不存在", null);
        List<String> dependents = new ArrayList<>();
        for (StageDef s : tpl.stages()) {
            if (s.prerequisites().contains(code)) dependents.add(s.name());
        }
        if (!dependents.isEmpty()) {
            return new TemplateOp(false, "阶段 " + target.name() + " 被 " + String.join("、", dependents) + " 依赖，不可删除", null);
        }
        List<StageDef> next = new ArrayList<>();
        for (StageDef s : tpl.stages()) {
            if (!s.code().equals(code)) next.add(s);
        }
        return new TemplateOp(true, "已删除阶段 " + target.name(), tpl.withStages(next));
    }

    /** 修改阶段（重命名/调次序/改前置/改闸门）。 */
    public static TemplateOp updateStage(StageTemplate tpl, String code, String name, Integer order,
                                         String gateCode, List<String> prerequisites) {
        StageDef target = findStage(tpl, code);
        if (target == null) return new TemplateOp(false, "阶段 " + code + " 不存在", null);
        if (order != null && order != target.order()) {
            for (StageDef s : tpl.stages()) {
                if (!s.code().equals(code) && s.order() == order) {
                    return new TemplateOp(false, "阶段次序 " + order + " 已被占用", null);
                }
            }
        }
        List<String> pre = prerequisites == null ? target.prerequisites() : prerequisites;
        if (pre.contains(code)) {
            return new TemplateOp(false, "阶段 " + target.name() + " 不可依赖自身（环）", null);
        }
        List<StageDef> next = new ArrayList<>();
        for (StageDef s : tpl.stages()) {
            if (!s.code().equals(code)) {
                next.add(s);
                continue;
            }
            next.add(new StageDef(code,
                name == null ? s.name() : name,
                order == null ? s.order() : order,
                gateCode == null ? s.gateCode() : gateCode,
                pre));
        }
        return new TemplateOp(true, "已更新阶段 " + target.name(), tpl.withStages(next));
    }

    /** 校验模板完整性：阶段 code 唯一、order 唯一、前置阶段存在、无环。 */
    public static final class ValidateResult {
        private final boolean ok;
        private final List<String> errors;
        ValidateResult(boolean ok, List<String> errors) { this.ok = ok; this.errors = List.copyOf(errors); }
        public boolean ok() { return ok; }
        public List<String> errors() { return errors; }
    }

    public static ValidateResult validateTemplate(StageTemplate tpl) {
        List<String> errors = new ArrayList<>();
        Set<String> codes = new LinkedHashSet<>();
        Set<Integer> orders = new LinkedHashSet<>();
        for (StageDef s : tpl.stages()) {
            if (!codes.add(s.code())) errors.add("阶段 code " + s.code() + " 重复");
            if (!orders.add(s.order())) errors.add("阶段次序 " + s.order() + " 重复");
        }
        for (StageDef s : tpl.stages()) {
            for (String p : s.prerequisites()) {
                if (!codes.contains(p)) errors.add("阶段 " + s.code() + " 的前置 " + p + " 不存在");
            }
        }
        for (StageDef s : tpl.stages()) {
            if (hasCycle(tpl, s.code(), new LinkedHashSet<>())) {
                errors.add("阶段 " + s.code() + " 存在前置依赖环");
                break;
            }
        }
        return new ValidateResult(errors.isEmpty(), errors);
    }

    /** 环检测（沿 prerequisites 追溯，访问到自身即环）。 */
    private static boolean hasCycle(StageTemplate tpl, String code, Set<String> visited) {
        if (visited.contains(code)) return true;
        visited.add(code);
        StageDef s = findStage(tpl, code);
        if (s == null) return false;
        for (String p : s.prerequisites()) {
            if (hasCycle(tpl, p, new LinkedHashSet<>(visited))) return true;
        }
        return false;
    }
}
