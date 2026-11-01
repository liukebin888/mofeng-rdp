package com.mofeng.rdp.boot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * MOFENG-RDP 模块化单体启动入口（SRS ARC-003：R1 单一部署单元）。
 *
 * <p>依赖方向：boot → application/infrastructure → domain。领域层保持纯净，
 * 由 ArchUnit 测试守护（见 mofeng-domain 模块）。</p>
 */
@SpringBootApplication(scanBasePackages = "com.mofeng.rdp")
public class MofengRdpApplication {

    public static void main(String[] args) {
        SpringApplication.run(MofengRdpApplication.class, args);
    }
}
