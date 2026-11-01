package com.mofeng.rdp.domain;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * 领域层架构守护（SRS ARC-001）。
 *
 * <p>领域层禁止依赖 Spring、MyBatis、HTTP 等框架与传输实现。依赖规则以静态扫描固化进
 * 构建流水线，出现反向依赖即构建失败，不依赖人工评审发现。领域层的纯净性是本平台可长期
 * 演进的前提：管控规则会随客户流程变化，若规则与框架耦合，每次变化都将引发全量回归。</p>
 *
 * <p>本测试在 {@code mvn test} 阶段运行，任何一条规则命中即失败，阻断交付。</p>
 */
class DomainLayerArchitectureTest {

    private static JavaClasses domainClasses;

    @BeforeAll
    static void importClasses() {
        // 只导入主代码（生产代码）做架构守护；测试类自身的 JUnit/ArchUnit 依赖不属于
        // 「领域层纯净性」的守护对象，故通过 ImportOption 排除测试代码。
        domainClasses = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.mofeng.rdp.domain");
    }

    /**
     * 领域层禁止依赖 Spring Framework（含 spring-core/spring-context/spring-boot 等）。
     */
    @Test
    void domainLayerMustNotDependOnSpring() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("com.mofeng.rdp.domain..")
                .should().dependOnClassesThat().resideInAPackage("org.springframework..");
        rule.check(domainClasses);
    }

    /**
     * 领域层禁止依赖 MyBatis / MyBatis-Plus。
     */
    @Test
    void domainLayerMustNotDependOnMyBatis() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("com.mofeng.rdp.domain..")
                .should().dependOnClassesThat().resideInAPackage("com.baomidou..")
                .orShould().dependOnClassesThat().resideInAPackage("org.apache.ibatis..");
        rule.check(domainClasses);
    }

    /**
     * 领域层禁止依赖 HTTP 传输层（javax.servlet / jakarta.servlet / HTTP 客户端）。
     */
    @Test
    void domainLayerMustNotDependOnHttpTransport() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("com.mofeng.rdp.domain..")
                .should().dependOnClassesThat().resideInAPackage("jakarta.servlet..")
                .orShould().dependOnClassesThat().resideInAPackage("javax.servlet..")
                .orShould().dependOnClassesThat().resideInAPackage("org.apache.http..");
        rule.check(domainClasses);
    }

    /**
     * 领域层禁止依赖持久化框架（JPA / Hibernate）。
     */
    @Test
    void domainLayerMustNotDependOnJpaOrHibernate() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("com.mofeng.rdp.domain..")
                .should().dependOnClassesThat().resideInAPackage("jakarta.persistence..")
                .orShould().dependOnClassesThat().resideInAPackage("org.hibernate..");
        rule.check(domainClasses);
    }

    /**
     * 领域层只允许依赖 JDK 与领域自身（白名单式收口，杜绝任何未登记框架）。
     */
    @Test
    void domainLayerMayOnlyDependOnJdkAndItself() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("com.mofeng.rdp.domain..")
                .should().dependOnClassesThat()
                .resideOutsideOfPackages(
                        "java..",
                        "javax..",
                        "com.mofeng.rdp.domain.."
                );
        rule.check(domainClasses);
    }
}
