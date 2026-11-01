package com.mofeng.rdp.application;

/**
 * 应用层健康探针（用于验证模块化单体可启动）。
 *
 * <p>应用层只做用例编排与入口，不承载领域规则（ARC-001）。领域规则在
 * mofeng-domain 模块，由纯函数式受控对象与引擎承载。</p>
 */
public final class ApplicationLayerMarker {

    private ApplicationLayerMarker() {
        // 标记类，非实例化
    }
}
