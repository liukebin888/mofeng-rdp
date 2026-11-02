package com.mofeng.rdp.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 领域层哈希工具（确定性、可逐位复算）。
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/hash.ts} 的 {@code hashOf} 语义对齐：
 * <b>稳定序列化（键排序）+ SHA-256</b>。用于基线 row_hash / manifest_hash、
 * 审计 prev_hash 链、判定留痕快照（ARC-008、SEC-007）。</p>
 *
 * <p>领域层纯工具，禁止依赖框架（ARC-001）。</p>
 */
public final class HashUtil {

    private HashUtil() {
    }

    /** SHA-256 十六进制摘要（64 位小写）。 */
    public static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    /** 零哈希（64 个 0），审计链首条记录的 prevHash 锚点。 */
    public static final String ZERO_HASH = "0".repeat(64);

    /**
     * 稳定序列化：Map 按键排序，List 逐项，其余按字符串值。
     * 保证「同一对象任何字段书写顺序」哈希一致（基线校验前提）。
     */
    public static String stableStringify(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof Map<?, ?> m) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) {
                sorted.put(String.valueOf(e.getKey()), e.getValue());
            }
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : sorted.entrySet()) {
                if (!first) sb.append(',');
                sb.append(jsonString(e.getKey())).append(':').append(stableStringify(e.getValue()));
                first = false;
            }
            return sb.append('}').toString();
        }
        if (value instanceof List<?> list) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append(stableStringify(list.get(i)));
            }
            return sb.append(']').toString();
        }
        if (value instanceof String s) {
            return jsonString(s);
        }
        if (value instanceof Boolean || value instanceof Number) {
            return String.valueOf(value);
        }
        return jsonString(String.valueOf(value));
    }

    /** 与 TS {@code hashOf} 同构：sha256(stableStringify(value))。 */
    public static String hashOf(Object value) {
        return sha256(stableStringify(value));
    }

    /** 便捷：对多个部件稳定哈希（内部组合为有序列表）。 */
    public static String hashOf(Object... parts) {
        return hashOf((Object) List.of(parts));
    }

    /** JSON 字符串字面量转义（与 JSON.stringify 对齐的最小实现）。 */
    private static String jsonString(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.append('"').toString();
    }
}
