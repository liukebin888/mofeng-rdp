package com.mofeng.rdp.domain.grading;

/**
 * 自研软件属性（决定「是否有软件」的判定口径）。
 *
 * <p>与前端 TS 引擎 {@code NormalizedInput.selfDev} 取值同构：</p>
 * <ul>
 *   <li>{@link #FULL} —— 自研软件（完整开发）；</li>
 *   <li>{@link #PARAM_ONLY} —— 仅参数配置（有软件，但仅标定/参数）；</li>
 *   <li>{@link #NONE_HW} —— 无自研软件（纯硬件）；</li>
 *   <li>{@link #NONE_DOC} —— 无自研软件（纯文档/参数变更）。</li>
 * </ul>
 *
 * <p>「是否有软件」的判定：{@code FULL} 或 {@code PARAM_ONLY} 视为有软件，
 * {@code NONE_HW}/{@code NONE_DOC} 视为无软件。</p>
 */
public enum SelfDev {
    FULL, PARAM_ONLY, NONE_HW, NONE_DOC;

    /** 是否有自研软件（FULL 或 PARAM_ONLY 视为有）。 */
    public boolean hasSoftware() {
        return this == FULL || this == PARAM_ONLY;
    }

    /** 是否无自研软件（NONE_HW 或 NONE_DOC）。 */
    public boolean hasNone() {
        return this == NONE_HW || this == NONE_DOC;
    }
}
