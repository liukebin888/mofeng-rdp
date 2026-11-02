package com.mofeng.rdp.domain.password;

import com.mofeng.rdp.domain.HashUtil;

import java.security.SecureRandom;

/**
 * 口令加盐哈希（SRS SEC-001 / AC-24「口令哈希不可逆且加盐」）。
 *
 * 原则：每口令独立随机盐、多轮迭代（PBKDF2 风格）、恒等时间比较。
 * 复用 HashUtil.sha256（浏览器/node 一致、零依赖、可逐位复算）。
 *
 * 迁移自 app/src/domain/password.ts，同一套测试用例验收。
 */
public final class PasswordEngine {

    private PasswordEngine() {
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 生成随机盐（hex，16 字节熵）。 */
    public static String generateSalt() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(32);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /** PBKDF2 风格迭代哈希：derived = sha256^iterations(salt + password)，输出 64 位 hex。 */
    public static String hashPassword(String password, String salt, int iterations) {
        String h = HashUtil.sha256(salt + password);
        for (int i = 1; i < iterations; i++) {
            h = HashUtil.sha256(h + salt + password);
        }
        return h;
    }

    /** 生成口令哈希存证：pbkdf2$iterations$salt$hash。 */
    public static String encodePassword(String password, int iterations) {
        String salt = generateSalt();
        String h = hashPassword(password, salt, iterations);
        return "pbkdf2$" + iterations + "$" + salt + "$" + h;
    }

    /** 恒等时间比较，防时序侧信道。 */
    public static boolean timingSafeEqual(String a, String b) {
        if (a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) {
            diff |= a.charAt(i) ^ b.charAt(i);
        }
        return diff == 0;
    }

    /** 校验口令：解析存证，重算哈希并恒等时间比较。 */
    public static boolean verifyPassword(String password, String encoded) {
        String[] parts = encoded.split("\\$", -1);
        if (parts.length != 4 || !"pbkdf2".equals(parts[0])) return false;
        int iterations;
        try {
            iterations = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            return false;
        }
        String salt = parts[2];
        String expected = parts[3];
        if (iterations == 0 || salt.isEmpty() || expected.isEmpty()) return false;
        String actual = hashPassword(password, salt, iterations);
        return timingSafeEqual(actual, expected);
    }

    public static final class StrengthResult {
        public final boolean ok;
        public final int score;
        public final String reason;

        StrengthResult(boolean ok, int score, String reason) {
            this.ok = ok;
            this.score = score;
            this.reason = reason;
        }
    }

    /** 口令强度校验：长度 ≥8 且至少 3 类字符（大小写/数字/符号）。 */
    public static StrengthResult passwordStrength(String pwd) {
        if (pwd == null || pwd.length() < 8) {
            return new StrengthResult(false, 0, "长度不足 8 位");
        }
        int score = 0;
        boolean hasLower = false, hasUpper = false, hasDigit = false, hasSymbol = false;
        for (char c : pwd.toCharArray()) {
            if (c >= 'a' && c <= 'z') hasLower = true;
            else if (c >= 'A' && c <= 'Z') hasUpper = true;
            else if (c >= '0' && c <= '9') hasDigit = true;
            else hasSymbol = true;
        }
        if (hasLower) score++;
        if (hasUpper) score++;
        if (hasDigit) score++;
        if (hasSymbol) score++;
        if (score < 3) {
            return new StrengthResult(false, score, "字符类型仅 " + score + " 类，须至少 3 类（大小写/数字/符号）");
        }
        return new StrengthResult(true, score, "强度达标（" + score + " 类字符）");
    }
}
