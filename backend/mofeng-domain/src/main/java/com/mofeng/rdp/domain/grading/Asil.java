package com.mofeng.rdp.domain.grading;

/**
 * ASIL 等级（汽车安全完整性等级）。
 *
 * <p>与前端 TS 引擎 {@code NormalizedInput.asil} 的取值同构：D / C / B / A / QM。
 * 其中 QM 表示「质量管理」，非安全相关。</p>
 */
public enum Asil {
    D, C, B, A, QM
}
