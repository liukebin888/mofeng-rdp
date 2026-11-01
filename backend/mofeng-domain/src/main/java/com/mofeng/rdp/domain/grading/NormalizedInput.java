package com.mofeng.rdp.domain.grading;

/**
 * 归一化后的内部输入（五项全部非空，供真值表匹配使用）。
 *
 * <p>与前端 TS 引擎 {@code NormalizedInput} 同构，是「纯数据」的内部表示，
 * 由 {@link GradingInput#normalizeOrNull} 在通过缺项校验后生成。</p>
 */
final class NormalizedInput {
    final Asil asil;
    final int cal;
    final SelfDev selfDev;
    final boolean newArch;
    final boolean customerSafety;

    NormalizedInput(Asil asil, int cal, SelfDev selfDev, boolean newArch, boolean customerSafety) {
        this.asil = asil;
        this.cal = cal;
        this.selfDev = selfDev;
        this.newArch = newArch;
        this.customerSafety = customerSafety;
    }
}
