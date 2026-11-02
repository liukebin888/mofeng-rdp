package com.mofeng.rdp.domain.gmtls;

import java.util.ArrayList;
import java.util.List;

/**
 * 国密 TLS 套件判定引擎（SRS SEC-012 / NFR-010 / AC-24）。
 *
 * <p>国密传输层合规的判定权威：SM2 密钥协商 / SM3 摘要签名 / SM4 传输加密，
 * 无 RSA/AES 回落、无弱套件（TLS1.2 以下 0 个）、证书链与算法符合国密。
 * 对应 {@code docs/DEPLOYMENT.md} 五·一节「国密套件要求」。</p>
 *
 * <p>边界说明（ARC-001）：国密 TLS 的<b>卸载与再加密</b>属部署/网关层职责（平台边界），
 * 应用代码不自行实现 SM2/SM3/SM4 算法；本引擎只做「套件是否合规 / 是否存在弱套件 /
 * 证书链是否国密 / 密钥是否分级轮换」的纯函数判定，供网关配置与协议扫描结果复核。</p>
 */
public final class GmTlsEngine {

    private GmTlsEngine() {
    }

    /** 国密套件三要素。 */
    public enum Suite {
        KEY_EXCHANGE, // SM2（签名 + 加密双证书）
        HASH,         // SM3
        BULK          // SM4
    }

    /** 套件判定结果。 */
    public static final class SuiteVerdict {
        public final boolean compliant;
        public final String reason;

        SuiteVerdict(boolean compliant, String reason) {
            this.compliant = compliant;
            this.reason = reason;
        }
    }

    /** 单个 TLS 套件（协议扫描产物）。 */
    public static final class CipherSuite {
        public final String name;       // 如 "ECDHE-SM4-SM3" / "RSA-AES256-GCM-SHA384"
        public final String keyExchange; // SM2 / RSA / ECDHE ...
        public final String hash;        // SM3 / SHA256 ...
        public final String bulk;        // SM4 / AES ...
        public final String protocol;    // TLS1.3 / TLS1.2 / TLS1.0 ...

        public CipherSuite(String name, String keyExchange, String hash, String bulk, String protocol) {
            this.name = name;
            this.keyExchange = keyExchange;
            this.hash = hash;
            this.bulk = bulk;
            this.protocol = protocol;
        }
    }

    /** 协议扫描结果。 */
    public static final class ScanResult {
        public final boolean weakSuitePresent;
        public final boolean preTls12Present;
        public final boolean rsaOrAesFallback;
        public final List<String> offendingSuites;

        ScanResult(boolean weakSuitePresent, boolean preTls12Present, boolean rsaOrAesFallback,
                   List<String> offendingSuites) {
            this.weakSuitePresent = weakSuitePresent;
            this.preTls12Present = preTls12Present;
            this.rsaOrAesFallback = rsaOrAesFallback;
            this.offendingSuites = offendingSuites;
        }
    }

    /** 证书链校验结果。 */
    public static final class CertChainVerdict {
        public final boolean gmCompliant;
        public final String reason;

        CertChainVerdict(boolean gmCompliant, String reason) {
            this.gmCompliant = gmCompliant;
            this.reason = reason;
        }
    }

    // ------------------------------------------------------------------
    // 套件判定
    // ------------------------------------------------------------------

    /** 单套件是否为国密套件（SM2 + SM3 + SM4 三要素齐备）。 */
    public static SuiteVerdict isGmSuite(CipherSuite suite) {
        boolean sm2 = "SM2".equalsIgnoreCase(suite.keyExchange);
        boolean sm3 = "SM3".equalsIgnoreCase(suite.hash);
        boolean sm4 = "SM4".equalsIgnoreCase(suite.bulk);
        if (sm2 && sm3 && sm4) {
            return new SuiteVerdict(true, null);
        }
        return new SuiteVerdict(false, "非国密套件（keyExchange=" + suite.keyExchange
            + ", hash=" + suite.hash + ", bulk=" + suite.bulk + "）");
    }

    /** 弱套件检测：TLS1.2 以下（TLS1.0/1.1/SSL）或 RSA/AES 回落均为弱套件。 */
    public static boolean isWeakSuite(CipherSuite suite) {
        if (isPreTls12(suite.protocol)) return true;
        if (isRsaOrAes(suite)) return true;
        return false;
    }

    /** 协议是否低于 TLS1.2。 */
    public static boolean isPreTls12(String protocol) {
        if (protocol == null) return true;
        String p = protocol.trim().toUpperCase();
        if (p.startsWith("SSL")) return true;
        if (p.equals("TLS1.0") || p.equals("TLS1.1") || p.equals("TLS1")) return true;
        return false;
    }

    /** 是否为 RSA/AES 回落（国密链路禁止）。 */
    public static boolean isRsaOrAes(CipherSuite suite) {
        return "RSA".equalsIgnoreCase(suite.keyExchange) || "AES".equalsIgnoreCase(suite.bulk);
    }

    /** 协议扫描结果汇总（SEC-012：协议扫描无弱套件，TLS1.2 以下 0 个）。 */
    public static ScanResult scan(List<CipherSuite> suites) {
        boolean weak = false;
        boolean pre12 = false;
        boolean fallback = false;
        List<String> offending = new ArrayList<>();
        for (CipherSuite s : suites) {
            if (isPreTls12(s.protocol)) {
                pre12 = true;
                weak = true;
                offending.add(s.name + " (" + s.protocol + ")");
            }
            if (isRsaOrAes(s)) {
                fallback = true;
                weak = true;
                offending.add(s.name + " (RSA/AES 回落)");
            }
        }
        return new ScanResult(weak, pre12, fallback, offending);
    }

    // ------------------------------------------------------------------
    // 证书链判定
    // ------------------------------------------------------------------

    /**
     * 证书链国密校验：证书链与算法符合国密。
     * 算法须为 SM2（签名证书 + 加密证书双证书），证书链每级算法均须 SM2。
     */
    public static CertChainVerdict verifyCertChain(List<String> certAlgorithms, boolean hasSignCert,
                                                    boolean hasEncryptCert) {
        if (!hasSignCert || !hasEncryptCert) {
            return new CertChainVerdict(false, "缺 SM2 双证书（签名 + 加密证书）");
        }
        if (certAlgorithms == null || certAlgorithms.isEmpty()) {
            return new CertChainVerdict(false, "证书链为空");
        }
        for (String alg : certAlgorithms) {
            if (!"SM2".equalsIgnoreCase(alg)) {
                return new CertChainVerdict(false, "证书链含非国密算法：" + alg);
            }
        }
        return new CertChainVerdict(true, null);
    }

    // ------------------------------------------------------------------
    // 密钥管理判定
    // ------------------------------------------------------------------

    /** 密钥分级 + 轮换 + 不入库（NFR-010：密钥与数据物理分离）。 */
    public static final class KeyManagementVerdict {
        public final boolean compliant;
        public final String reason;

        KeyManagementVerdict(boolean compliant, String reason) {
            this.compliant = compliant;
            this.reason = reason;
        }
    }

    public static KeyManagementVerdict checkKeyManagement(int keyLevels, int rotationDays, boolean storedWithData) {
        if (storedWithData) {
            return new KeyManagementVerdict(false, "密钥与数据同库（违反 NFR-010 物理分离）");
        }
        if (keyLevels < 2) {
            return new KeyManagementVerdict(false, "密钥未分级（须至少 2 级）");
        }
        if (rotationDays <= 0 || rotationDays > 365) {
            return new KeyManagementVerdict(false, "密钥轮换周期非法：" + rotationDays + " 天（须 1~365 天）");
        }
        return new KeyManagementVerdict(true, null);
    }
}
