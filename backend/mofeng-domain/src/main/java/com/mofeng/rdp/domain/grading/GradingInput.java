package com.mofeng.rdp.domain.grading;

import java.util.Objects;

/**
 * 分级判定输入（五要素，缺一不得判定）。
 *
 * <p>与前端 TS 引擎 {@code GradingInput} 同构。五项输入：ASIL、CAL、自研软件属性、
 * 新架构/算法、客户强制安全要求。任一缺失则判「未定级」并阻断 Gate1（CLS-001/CLS-007）。</p>
 *
 * <p>本类为领域层不可变值对象，禁止依赖框架（ARC-001）。</p>
 */
public final class GradingInput {

    /** ASIL 等级（null 表示缺项）。 */
    private final Asil asil;

    /** CAL 信息安全等级（-1 表示缺项，合法值 0~4）。 */
    private final int cal;

    /** 自研软件属性（null 表示缺项）。 */
    private final SelfDev selfDev;

    /** 新架构/算法（null 表示缺项）。 */
    private final Boolean newArch;

    /** 客户强制安全要求（null 表示缺项）。 */
    private final Boolean customerSafety;

    private GradingInput(Asil asil, int cal, SelfDev selfDev, Boolean newArch, Boolean customerSafety) {
        this.asil = asil;
        this.cal = cal;
        this.selfDev = selfDev;
        this.newArch = newArch;
        this.customerSafety = customerSafety;
    }

    public Asil asil() { return asil; }
    public int cal() { return cal; }
    public SelfDev selfDev() { return selfDev; }
    public Boolean newArch() { return newArch; }
    public Boolean customerSafety() { return customerSafety; }

    /** 全五项齐备（用于构造完整输入）。 */
    public static GradingInput of(Asil asil, int cal, SelfDev selfDev, boolean newArch, boolean customerSafety) {
        Objects.requireNonNull(asil, "ASIL 等级不可为空");
        Objects.requireNonNull(selfDev, "自研软件属性不可为空");
        if (cal < 0 || cal > 4) {
            throw new IllegalArgumentException("CAL 等级非法：" + cal + "（合法值 0~4，-1 表示缺项）");
        }
        return new GradingInput(asil, cal, selfDev, newArch, customerSafety);
    }

    /** 全缺项输入（用于测试缺项阻断路径）。 */
    public static GradingInput empty() {
        return new GradingInput(null, -1, null, null, null);
    }

    /** 是否缺项（五项任一缺失即 true）。 */
    public boolean hasMissing() {
        return asil == null || cal < 0 || selfDev == null || newArch == null || customerSafety == null;
    }

    /** 校验并归一化为内部输入；缺项时返回缺项清单。 */
    NormalizedInput normalizeOrNull(java.util.List<String> missingOut) {
        if (asil == null) missingOut.add("ASIL 等级");
        if (cal < 0) missingOut.add("CAL 信息安全等级");
        if (selfDev == null) missingOut.add("自研软件属性");
        if (newArch == null) missingOut.add("新架构/算法");
        if (customerSafety == null) missingOut.add("客户强制要求（安全相关）");
        if (!missingOut.isEmpty()) {
            return null;
        }
        return new NormalizedInput(asil, cal, selfDev, newArch, customerSafety);
    }

    /** 判定留痕信息（决定人 / 角色 / 时间）。 */
    public static final class Actor {
        private final String userName;
        private final String roleName;
        private final java.time.Instant at;

        public Actor(String userName, String roleName, java.time.Instant at) {
            this.userName = Objects.requireNonNull(userName, "userName 不可为空");
            this.roleName = Objects.requireNonNull(roleName, "roleName 不可为空");
            this.at = at == null ? java.time.Instant.now() : at;
        }

        public String userName() { return userName; }
        public String roleName() { return roleName; }
        public java.time.Instant at() { return at; }
    }
}
