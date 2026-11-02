package com.mofeng.rdp.infrastructure.gateway;

import com.mofeng.rdp.domain.gmtls.GmTlsEngine;

import java.util.List;

/**
 * 国密 TLS 网关抽象（基础设施层，B5 / SEC-012）。
 *
 * <p>国密传输层「卸载与再加密」属平台边界网关职责（DEPLOYMENT.md 五·一节），
 * 应用代码不自行实现 SM2/SM3/SM4。本接口定义网关的合规自证能力：
 * 报告协议扫描结果与证书链，套件合规判定复用领域层 {@link GmTlsEngine}。</p>
 */
public interface GmTlsGateway {

    /**
     * 报告当前网关启用的国密套件清单（协议扫描产物）。
     * 供领域层 {@link GmTlsEngine#scan} 复核「无弱套件、无 RSA/AES 回落、TLS1.2 以下 0 个」。
     */
    List<GmTlsEngine.CipherSuite> enabledSuites();

    /**
     * 报告证书链算法（每级证书的算法，如 SM2）。
     * 供领域层 {@link GmTlsEngine#verifyCertChain} 复核「证书链与算法符合国密」。
     */
    List<String> certificateChainAlgorithms();

    /** 是否启用 SM2 签名证书。 */
    boolean hasSignCertificate();

    /** 是否启用 SM2 加密证书（双证书）。 */
    boolean hasEncryptCertificate();
}
