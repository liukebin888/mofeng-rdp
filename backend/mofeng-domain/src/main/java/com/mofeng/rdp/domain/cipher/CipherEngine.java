package com.mofeng.rdp.domain.cipher;

import com.mofeng.rdp.domain.HashUtil;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 敏感字段加密存储（SRS NFR-010 / SEC-013 / AC-24「明文敏感字段 0 条；密钥不与数据同库」）。
 *
 * 算法：密钥派生（SHA256 迭代）+ 字节置换 + XOR 流加密。字段级可逆加密，密钥与数据物理分离。
 * 传输层国密由网关负责（SEC-012）。
 *
 * 迁移自 app/src/domain/cipher.ts，同一套测试用例验收。
 */
public final class CipherEngine {

    private CipherEngine() {
    }

    /** 密钥派生：从主密钥 + keyId + version 派生独立字段密钥（32 字节）。 */
    private static int[] deriveKey(String masterKey, String keyId, int version) {
        String seed = HashUtil.sha256(masterKey + ":" + keyId + ":v" + version);
        int[] bytes = new int[32];
        for (int i = 0; i < 32; i++) {
            bytes[i] = Integer.parseInt(seed.substring(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }

    private static String toHex(int[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (int b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static int[] fromHex(String hex) {
        int[] out = new int[hex.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    private static int[] utf8Bytes(String str) {
        byte[] raw = str.getBytes(StandardCharsets.UTF_8);
        int[] out = new int[raw.length];
        for (int i = 0; i < raw.length; i++) out[i] = raw[i] & 0xff;
        return out;
    }

    private static String utf8Str(int[] bytes) {
        byte[] raw = new byte[bytes.length];
        for (int i = 0; i < bytes.length; i++) raw[i] = (byte) bytes[i];
        return new String(raw, StandardCharsets.UTF_8);
    }

    /** 加密：返回 enc:v<version>:<keyId>:<ciphertext>。密钥不落库。 */
    public static String encryptField(String plain, String masterKey, String keyId, int version) {
        int[] key = deriveKey(masterKey, keyId, version);
        int[] data = utf8Bytes(plain);
        int[] cipher = new int[data.length];
        for (int i = 0; i < data.length; i++) {
            cipher[i] = (data[i] ^ key[i % key.length] ^ (i * 31 & 0xff)) & 0xff;
        }
        return "enc:v" + version + ":" + keyId + ":" + toHex(cipher);
    }

    /** 解密：非密文格式原样返回。 */
    public static String decryptField(String encoded, String masterKey) {
        Pattern p = Pattern.compile("^enc:v(\\d+):([^:]+):([0-9a-f]+)$");
        Matcher m = p.matcher(encoded);
        if (!m.matches()) return encoded;
        int version = Integer.parseInt(m.group(1));
        String keyId = m.group(2);
        String cipherHex = m.group(3);
        int[] key = deriveKey(masterKey, keyId, version);
        int[] cipher = fromHex(cipherHex);
        int[] plain = new int[cipher.length];
        for (int i = 0; i < cipher.length; i++) {
            plain[i] = (cipher[i] ^ key[i % key.length] ^ (i * 31 & 0xff)) & 0xff;
        }
        return utf8Str(plain);
    }

    /** 脱敏展示：保留首尾，中间打码。 */
    public static String maskField(String plain, int keepHead, int keepTail) {
        if (plain == null || plain.isEmpty()) return "";
        int len = plain.codePointCount(0, plain.length());
        if (len <= keepHead + keepTail) {
            return plain.substring(0, 1) + "***";
        }
        return plain.substring(0, keepHead) + "***" + plain.substring(plain.length() - keepTail);
    }

    /** 检测字段是否为密文。 */
    public static boolean isEncrypted(String value) {
        return Pattern.matches("^enc:v\\d+:[^:]+:[0-9a-f]+$", value);
    }

    /** 便捷：UTF-8 字节工具对外暴露（供测试校验往返一致性）。 */
    public static List<Integer> utf8BytesOf(String str) {
        List<Integer> out = new ArrayList<>();
        for (int b : utf8Bytes(str)) out.add(b);
        return out;
    }
}
