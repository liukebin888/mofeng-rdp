package com.mofeng.rdp.domain.grading;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;

/**
 * 项目分级引擎（L1~L4），SRS 附录 C「分级判定真值表」14 行 + 6 条裁定规则（CLS-001~007）。
 *
 * <p>铁律（CLS-002 验收）：<b>判定只允许查表，命中即返回；不得在代码中另写等价的布尔表达式。</b>
 * 因此 {@link #GRADING_ROWS} 是唯一权威，逐行按序号顺序匹配，命中即停。</p>
 *
 * <p>本类是前端 TS 引擎 {@code app/src/domain/grading.ts} 的 Java 等价迁移。
 * 迁移完成判据：<b>同一套测试用例（14 行真值表 + 缺项阻断 + 6 条裁定）结果一致率 100%</b>。</p>
 *
 * <p>领域层纯对象：禁止依赖 Spring/MyBatis/HTTP（ARC-001），由
 * {@code DomainLayerArchitectureTest} 构建期守护。</p>
 */
public final class GradingEngine {

    /** 真值表版本（与 TS 侧 {@code GRADING_TABLE_VERSION} 保持一致）。 */
    public static final String GRADING_TABLE_VERSION = "APX-C-2026.11";

    private GradingEngine() {
        // 工具类，禁止实例化
    }

    /** 分级结果。 */
    public static final class Result {
        private final Level level;              // null 表示未定级（缺项）
        private final int hitRowNo;             // 命中行号；-1 表示未命中（缺项）
        private final String basis;             // 判定依据（命中行 text 或缺项说明）
        private final String controlPoints;     // 管控要点（命中行 control 或补全提示）
        private final Trace trace;              // 留痕
        private final List<Check> checks;       // 六条裁定规则结果
        private final List<String> missing;     // 缺失输入项清单

        Result(Level level, int hitRowNo, String basis, String controlPoints,
               Trace trace, List<Check> checks, List<String> missing) {
            this.level = level;
            this.hitRowNo = hitRowNo;
            this.basis = basis;
            this.controlPoints = controlPoints;
            this.trace = trace;
            this.checks = checks;
            this.missing = missing;
        }

        public Level level() { return level; }
        public int hitRowNo() { return hitRowNo; }
        public String basis() { return basis; }
        public String controlPoints() { return controlPoints; }
        public Trace trace() { return trace; }
        public List<Check> checks() { return checks; }
        public List<String> missing() { return missing; }
    }

    /** 留痕信息（决定人 / 时间 / 版本 / 快照哈希 / 命中行文本）。 */
    public static final class Trace {
        private final int hitRowNo;
        private final String hitRowText;
        private final String tableVersion;
        private final String decidedBy;
        private final String decidedAt;
        private final String snapshotHash;

        Trace(int hitRowNo, String hitRowText, String tableVersion,
              String decidedBy, String decidedAt, String snapshotHash) {
            this.hitRowNo = hitRowNo;
            this.hitRowText = hitRowText;
            this.tableVersion = tableVersion;
            this.decidedBy = decidedBy;
            this.decidedAt = decidedAt;
            this.snapshotHash = snapshotHash;
        }

        public int hitRowNo() { return hitRowNo; }
        public String hitRowText() { return hitRowText; }
        public String tableVersion() { return tableVersion; }
        public String decidedBy() { return decidedBy; }
        public String decidedAt() { return decidedAt; }
        public String snapshotHash() { return snapshotHash; }
    }

    /** 单条裁定规则结果（CLS-002~007）。 */
    public static final class Check {
        private final String code;
        private final String name;
        private final boolean ok;
        private final String note;

        Check(String code, String name, boolean ok, String note) {
            this.code = code;
            this.name = name;
            this.ok = ok;
            this.note = note;
        }

        public String code() { return code; }
        public String name() { return name; }
        public boolean ok() { return ok; }
        public String note() { return note; }
    }

    /** 真值表行。 */
    private static final class Row {
        final int no;
        final String text;
        final Level level;
        final String control;
        final Predicate<NormalizedInput> match;

        Row(int no, String text, Level level, String control, Predicate<NormalizedInput> match) {
            this.no = no;
            this.text = text;
            this.level = level;
            this.control = control;
            this.match = match;
        }
    }

    /**
     * 14 行真值表（含第 13 行 CAL≥3 无自研软件 → L2、第 14 行兜底）。
     * 与 TS 侧 {@code GRADING_ROWS} 逐行一一对应，顺序即判定优先级。
     */
    private static final List<Row> GRADING_ROWS = List.of(
        new Row(1, "ASIL D/C/B，其余任意 → L1（完整安全链路 + 独立安全评估 + 禁止裁剪）",
            Level.L1, "完整安全链路 + 独立安全评估 + 禁止裁剪",
            i -> i.asil == Asil.D || i.asil == Asil.C || i.asil == Asil.B),
        new Row(2, "ASIL A，CAL 3/4，自研软件 → L1（信息安全驱动）",
            Level.L1, "CAL≥3 即触发最高管控，软件特征不影响升级",
            i -> i.asil == Asil.A && (i.cal == 3 || i.cal == 4) && i.selfDev.hasSoftware()),
        new Row(3, "ASIL QM，CAL 3/4，自研软件 → L1（信息安全驱动，ASIL 为空不影响）",
            Level.L1, "CAL≥3 即触发最高管控",
            i -> i.asil == Asil.QM && (i.cal == 3 || i.cal == 4) && i.selfDev.hasSoftware()),
        new Row(4, "ASIL A，CAL 1/2，自研软件 → L2（核心 SWE 强制 + 裁剪需风险补偿）",
            Level.L2, "核心 SWE 强制，安全要求追溯评审",
            i -> i.asil == Asil.A && (i.cal == 1 || i.cal == 2) && i.selfDev.hasSoftware()),
        new Row(5, "ASIL QM，CAL 1/2，自研软件 → L2（信息安全中等级别）",
            Level.L2, "核心 SWE 强制",
            i -> i.asil == Asil.QM && (i.cal == 1 || i.cal == 2) && i.selfDev.hasSoftware()),
        new Row(6, "ASIL A，CAL 0，自研软件 → L2（有 ASIL A 即不低于 L2）",
            Level.L2, "有 ASIL A 即不低于 L2",
            i -> i.asil == Asil.A && i.cal == 0 && i.selfDev.hasSoftware()),
        new Row(7, "ASIL QM，CAL 0，自研软件，新架构/算法 → L2（新架构引入不确定性，抬升一级）",
            Level.L2, "核心 SWE 强制",
            i -> i.asil == Asil.QM && i.cal == 0 && i.selfDev.hasSoftware() && i.newArch),
        new Row(8, "ASIL QM，CAL 0，仅参数配置，非新架构，无客户强制 → L3（版本仅台账，ASPICE 大部分裁剪）",
            Level.L3, "不允许新增安全要求",
            i -> i.asil == Asil.QM && i.cal == 0 && i.selfDev == SelfDev.PARAM_ONLY && !i.newArch && !i.customerSafety),
        new Row(9, "ASIL QM，CAL 0，仅参数配置，非新架构，客户强制要求 → L2（客户要求优先于内部判定）",
            Level.L2, "按 L2 管控",
            i -> i.asil == Asil.QM && i.cal == 0 && i.selfDev == SelfDev.PARAM_ONLY && !i.newArch && i.customerSafety),
        new Row(10, "ASIL QM，CAL 0，无自研软件（纯硬件），非新架构 → L4（样件交付台账记录）",
            Level.L4, "无软件 ASPICE 管控",
            i -> i.asil == Asil.QM && i.cal == 0 && i.selfDev == SelfDev.NONE_HW && !i.newArch && !i.customerSafety),
        new Row(11, "ASIL QM，CAL 0，无自研软件（纯文档/参数变更），非新架构 → L4",
            Level.L4, "样件交付台账记录",
            i -> i.asil == Asil.QM && i.cal == 0 && i.selfDev == SelfDev.NONE_DOC && !i.newArch && !i.customerSafety),
        new Row(12, "客户强制要求（安全相关），其余任意 → L1（客户安全要求自动升级，需评审确认）",
            Level.L1, "按 L1 管控",
            i -> i.customerSafety),
        new Row(13, "ASIL QM，CAL 3/4，无自研软件（纯硬件/纯文档），任意架构 → L2（否定性裁定：CAL≥3 一律不低于 L2）",
            Level.L2, "核心 SWE 强制；CAL=4 且涉及对外通信接口时升 L1",
            i -> i.asil == Asil.QM && (i.cal == 3 || i.cal == 4) && (i.selfDev == SelfDev.NONE_HW || i.selfDev == SelfDev.NONE_DOC)),
        new Row(14, "其余组合 → L3（兜底：须经分级评审确认，不得默认 L4 或报错阻断）",
            Level.L3, "按 ASPICE 裁剪，保留追溯",
            i -> true)
    );

    /** 六条裁定规则（校验层，不参与定级；用于发现口径冲突与越级）。 */
    private static List<Check> validate(NormalizedInput i, Level level, Level parentLevel) {
        List<Check> checks = new ArrayList<>();
        checks.add(new Check("CLS-002", "客户要求优先",
            !i.customerSafety || level == Level.L1 || level == Level.L2,
            i.customerSafety ? "客户安全强制要求，判定 " + level + "（不得低于 L2；安全相关取 L1）" : "无客户强制要求"));
        checks.add(new Check("CLS-003", "无自研软件不得高于 L3",
            !(i.selfDev.hasNone() && (level == Level.L1 || level == Level.L2)),
            i.selfDev.hasNone()
                ? (level == Level.L4
                    ? "纯硬件/纯文档，落 L4，符合"
                    : "无自研软件但判定 " + level + "，仅在客户安全强制时可接受，须评审确认")
                : "含自研软件，规则不适用"));
        checks.add(new Check("CLS-004", "CAL≥3 不低于 L2",
            !(i.cal >= 3 && (level == Level.L3 || level == Level.L4)),
            i.cal >= 3 ? "CAL=" + i.cal + "，判定 " + level : "CAL<3"));
        checks.add(new Check("CLS-005", "分解不降级",
            parentLevel == null || level.rank() <= parentLevel.rank(),
            parentLevel != null ? "父项目 " + parentLevel + " → 子项目 " + level + "（数字越小管控越严）" : "顶层项目，不适用"));
        checks.add(new Check("CLS-006", "存量项目不自动降级",
            true, "沿用历史等级，除非客户书面变更或安全等级变化"));
        checks.add(new Check("CLS-007", "缺项按最严",
            true, "五项输入齐备方可判定；缺任一项判「未定级」并阻断 Gate1"));
        return checks;
    }

    /** 执行分级判定（入口，与 TS {@code grade} 同构）。 */
    public static Result grade(GradingInput input, GradingInput.Actor actor) {
        return grade(input, actor, null);
    }

    /** 执行分级判定，可携带父项目等级（用于「分解不降级」CLS-005）。 */
    public static Result grade(GradingInput input, GradingInput.Actor actor, Level parentLevel) {
        Objects.requireNonNull(input, "input 不可为空");
        Objects.requireNonNull(actor, "actor 不可为空");

        String decidedBy = actor.userName() + "（" + actor.roleName() + "）";
        String decidedAt = actor.at().toString();

        List<String> missing = new ArrayList<>();
        NormalizedInput value = input.normalizeOrNull(missing);

        if (value == null) {
            Trace trace = new Trace(-1, "未命中（缺项）", GRADING_TABLE_VERSION,
                decidedBy, decidedAt, hashOf(input));
            return new Result(null, -1,
                "输入项不完整，按最严禁要求判「未定级」，阻断 Gate1（CLS-001/CLS-007）",
                "补齐五项输入后重新判定",
                trace, Collections.emptyList(), Collections.unmodifiableList(missing));
        }

        Row hit = GRADING_ROWS.stream().filter(r -> r.match.test(value)).findFirst().orElseThrow();
        List<Check> checks = validate(value, hit.level, parentLevel);
        Trace trace = new Trace(hit.no, hit.text, GRADING_TABLE_VERSION,
            decidedBy, decidedAt, hashOf(input, hit.no));
        return new Result(hit.level, hit.no, hit.text, hit.control,
            trace, Collections.unmodifiableList(checks), Collections.emptyList());
    }

    /** 真值表行数（用于校验配置表必须为 14 行）。 */
    public static int rowCount() {
        return GRADING_ROWS.size();
    }

    /** 快照哈希（确定性，供判定留痕）。与 TS 侧 hashOf 同源语义。 */
    private static String hashOf(Object... parts) {
        var sb = new StringBuilder();
        for (Object p : parts) {
            sb.append(String.valueOf(p)).append('|');
        }
        // 使用 JDK 内置 SHA-256，保证确定性且与前端 hash 语义对齐（均可复算）。
        try {
            var md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var hex = new StringBuilder();
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
