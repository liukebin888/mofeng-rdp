package com.mofeng.rdp.domain.gmtls;

import com.mofeng.rdp.domain.gmtls.GmTlsEngine.CipherSuite;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GmTlsEngineTest {

    @Test
    void 国密三要素齐备判定通过() {
        CipherSuite s = new CipherSuite("ECC-SM2-SM4-CBC-SM3", "SM2", "SM3", "SM4", "TLS1.3");
        assertTrue(GmTlsEngine.isGmSuite(s).compliant);
    }

    @Test
    void 缺国密要素判定不通过() {
        CipherSuite s = new CipherSuite("RSA-AES256-GCM-SHA384", "RSA", "SHA384", "AES", "TLS1.2");
        assertFalse(GmTlsEngine.isGmSuite(s).compliant);
    }

    @Test
    void TLS12以下判弱套件() {
        assertTrue(GmTlsEngine.isPreTls12("TLS1.0"));
        assertTrue(GmTlsEngine.isPreTls12("TLS1.1"));
        assertTrue(GmTlsEngine.isPreTls12("SSLv3"));
        assertFalse(GmTlsEngine.isPreTls12("TLS1.2"));
        assertFalse(GmTlsEngine.isPreTls12("TLS1.3"));
    }

    @Test
    void RSA或AES回落判弱套件() {
        CipherSuite rsa = new CipherSuite("RSA-...", "RSA", "SHA256", "AES", "TLS1.2");
        CipherSuite aes = new CipherSuite("ECDHE-...", "ECDHE", "SHA256", "AES", "TLS1.2");
        assertTrue(GmTlsEngine.isWeakSuite(rsa));
        assertTrue(GmTlsEngine.isWeakSuite(aes));
    }

    @Test
    void 协议扫描无弱套件() {
        List<CipherSuite> gm = List.of(
            new CipherSuite("ECC-SM2-SM4-CBC-SM3", "SM2", "SM3", "SM4", "TLS1.3"),
            new CipherSuite("ECC-SM2-SM4-GCM-SM3", "SM2", "SM3", "SM4", "TLS1.3")
        );
        GmTlsEngine.ScanResult r = GmTlsEngine.scan(gm);
        assertFalse(r.weakSuitePresent);
        assertFalse(r.preTls12Present);
        assertFalse(r.rsaOrAesFallback);
        assertTrue(r.offendingSuites.isEmpty());
    }

    @Test
    void 协议扫描检出弱套件与回落() {
        List<CipherSuite> mixed = List.of(
            new CipherSuite("ECC-SM2-SM4-CBC-SM3", "SM2", "SM3", "SM4", "TLS1.3"),
            new CipherSuite("RSA-AES256-GCM-SHA384", "RSA", "SHA384", "AES", "TLS1.2"),
            new CipherSuite("TLS-RSA-WITH-AES-128", "RSA", "SHA1", "AES", "TLS1.0")
        );
        GmTlsEngine.ScanResult r = GmTlsEngine.scan(mixed);
        assertTrue(r.weakSuitePresent);
        assertTrue(r.preTls12Present);   // TLS1.0
        assertTrue(r.rsaOrAesFallback);  // RSA/AES
        assertFalse(r.offendingSuites.isEmpty());
    }

    @Test
    void 证书链国密双证书校验通过() {
        GmTlsEngine.CertChainVerdict v = GmTlsEngine.verifyCertChain(
            List.of("SM2", "SM2", "SM2"), true, true);
        assertTrue(v.gmCompliant);
    }

    @Test
    void 证书链缺双证书判定失败() {
        GmTlsEngine.CertChainVerdict v = GmTlsEngine.verifyCertChain(
            List.of("SM2"), true, false);
        assertFalse(v.gmCompliant);
    }

    @Test
    void 证书链含非国密算法判定失败() {
        GmTlsEngine.CertChainVerdict v = GmTlsEngine.verifyCertChain(
            List.of("SM2", "RSA"), true, true);
        assertFalse(v.gmCompliant);
    }

    @Test
    void 密钥分级轮换分离校验通过() {
        GmTlsEngine.KeyManagementVerdict v = GmTlsEngine.checkKeyManagement(3, 90, false);
        assertTrue(v.compliant);
    }

    @Test
    void 密钥与数据同库判定失败() {
        GmTlsEngine.KeyManagementVerdict v = GmTlsEngine.checkKeyManagement(3, 90, true);
        assertFalse(v.compliant);
    }

    @Test
    void 密钥未分级或轮换周期非法判定失败() {
        assertFalse(GmTlsEngine.checkKeyManagement(1, 90, false).compliant);
        assertFalse(GmTlsEngine.checkKeyManagement(3, 0, false).compliant);
        assertFalse(GmTlsEngine.checkKeyManagement(3, 400, false).compliant);
    }
}
