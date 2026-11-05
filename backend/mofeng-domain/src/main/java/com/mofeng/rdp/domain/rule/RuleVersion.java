package com.mofeng.rdp.domain.rule;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * 规则版本值对象（ARC-006：规则版本化 + 快照留痕）。
 *
 * <p>领域层纯对象（ARC-001）：不依赖 Spring/MyBatis/数据库。
 * 本类是「规则执行时锁定哪个版本」的单一权威表达，判定引擎据此记录
 * {@code ruleVersion + snapshotHash}，支撑 K1「历史判定可复算」。</p>
 */
public final class RuleVersion {

    private final String ruleType;
    private final String ruleCode;
    private final int version;
    private final String snapshotHash;

    public RuleVersion(String ruleType, String ruleCode, int version, String snapshotHash) {
        this.ruleType = ruleType;
        this.ruleCode = ruleCode;
        this.version = version;
        this.snapshotHash = snapshotHash;
    }

    public String ruleType() { return ruleType; }
    public String ruleCode() { return ruleCode; }
    public int version() { return version; }
    public String snapshotHash() { return snapshotHash; }

    /** 规则唯一标识（rule_type|rule_code），用于留痕与幂等。 */
    public String key() { return ruleType + "|" + ruleCode; }

    /**
     * 规则内容确定性快照哈希（SHA-256）。
     * 同一规则内容任意写法哈希一致，规则一改哈希必变。
     */
    public static String snapshotHashOf(String ruleType, String ruleCode, int version, String content) {
        String raw = ruleType + "|" + ruleCode + "|" + version + "|" + (content == null ? "" : content);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : d) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    /**
     * 判定规则版本是否生效（含当日）。
     * @param today 判定基准日
     * @param effectiveFrom 生效起始日（含）
     * @param effectiveTo 生效截止日（含，null=长期）
     */
    public static boolean isEffective(String today, String effectiveFrom, String effectiveTo) {
        if (effectiveFrom == null) return false;
        // 字符串日期（yyyy-MM-dd）按字典序即时间序，直接比较。
        if (today.compareTo(effectiveFrom) < 0) return false;
        if (effectiveTo != null && today.compareTo(effectiveTo) > 0) return false;
        return true;
    }
}
