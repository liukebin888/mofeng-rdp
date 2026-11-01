package com.mofeng.rdp.domain.grading;

import java.util.Objects;

/**
 * 项目分级管控等级（L1~L4，数字越小管控越严）。
 *
 * <p>与前端 TS 引擎 {@code Level} 同构。</p>
 */
public enum Level {
    L1(1, "最高管控：完整安全链路、独立安全评估、禁止裁剪"),
    L2(2, "较高管控：核心 SWE 强制、裁剪需风险补偿"),
    L3(3, "标准管控：按 ASPICE 裁剪、保留追溯"),
    L4(4, "基础管控：样件交付台账记录");

    /** 管控严格度秩（越小越严）。 */
    private final int rank;

    /** 管控描述。 */
    private final String description;

    Level(int rank, String description) {
        this.rank = rank;
        this.description = description;
    }

    /** 严格度秩，用于「分解不降级」判定（数字越小越严）。 */
    public int rank() {
        return rank;
    }

    public String description() {
        return description;
    }

    /** 从 TS 侧的等级字符串解析（"L1"~"L4"）。 */
    public static Level parse(String s) {
        Objects.requireNonNull(s, "等级字符串不可为空");
        return switch (s.trim().toUpperCase()) {
            case "L1" -> L1;
            case "L2" -> L2;
            case "L3" -> L3;
            case "L4" -> L4;
            default -> throw new IllegalArgumentException("未知等级：" + s);
        };
    }
}
