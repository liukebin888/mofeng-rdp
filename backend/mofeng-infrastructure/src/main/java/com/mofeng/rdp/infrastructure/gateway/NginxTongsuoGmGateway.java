package com.mofeng.rdp.infrastructure.gateway;

import com.mofeng.rdp.domain.gmtls.GmTlsEngine;

import java.util.ArrayList;
import java.util.List;

/**
 * Nginx + tongsuo（铜锁）国密网关实现（基础设施层，B5 / SEC-012）。
 *
 * <p>对应 DEPLOYMENT.md 五·一节落地选项 1（推荐，零应用改造）：
 * 在 Nginx 前端以国密模块终止 TLS（SM2 双证书 / SM3 签名 / SM4 加密），
 * 后端应用层完全不动。本实现只做网关配置的自证报告，套件合规判定复用领域层
 * {@link GmTlsEngine}，不做算法实现。</p>
 */
public final class NginxTongsuoGmGateway implements GmTlsGateway {

    /** 国密标准套件（tongsuo 启用的 SM2-SM3-SM4 套件名）。 */
    private static final List<GmTlsEngine.CipherSuite> GM_SUITES = List.of(
        new GmTlsEngine.CipherSuite("ECC-SM2-SM4-CBC-SM3", "SM2", "SM3", "SM4", "TLS1.3"),
        new GmTlsEngine.CipherSuite("ECC-SM2-SM4-GCM-SM3", "SM2", "SM3", "SM4", "TLS1.3"),
        new GmTlsEngine.CipherSuite("ECDHE-SM2-SM4-CBC-SM3", "SM2", "SM3", "SM4", "TLS1.3")
    );

    private final List<String> certChainAlgorithms;
    private final boolean hasSignCert;
    private final boolean hasEncryptCert;

    public NginxTongsuoGmGateway(List<String> certChainAlgorithms,
                                 boolean hasSignCert, boolean hasEncryptCert) {
        this.certChainAlgorithms = new ArrayList<>(certChainAlgorithms);
        this.hasSignCert = hasSignCert;
        this.hasEncryptCert = hasEncryptCert;
    }

    @Override
    public List<GmTlsEngine.CipherSuite> enabledSuites() {
        return GM_SUITES;
    }

    @Override
    public List<String> certificateChainAlgorithms() {
        return certChainAlgorithms;
    }

    @Override
    public boolean hasSignCertificate() {
        return hasSignCert;
    }

    @Override
    public boolean hasEncryptCertificate() {
        return hasEncryptCert;
    }
}
