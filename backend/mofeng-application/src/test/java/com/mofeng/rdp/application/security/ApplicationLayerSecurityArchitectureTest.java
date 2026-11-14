package com.mofeng.rdp.application.security;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

/**
 * 应用层安全边界架构守护（E2「绕过前端直调 API 写入」）。
 *
 * <p>定位：把「服务端写路径必须鉴权」这一不可违反的安全边界固化为静态扫描，
 * 杜绝 fail-open 隐患——任何新增的写路径端点若漏标 {@link RequiresPermission}，
 * 构建即失败，不依赖人工评审。</p>
 *
 * <p>E2 背景（决策文档 SERVER-SIDE-REJECTION-DECISION.md）：恶意/脚本绕过 UI 直接 POST
 * 服务端写路径。业务规则三档拦截（🔴/🟡/🟢）由各 ApplicationService 承载，本守护锁定的是
 * 「鉴权层」这一更上游的边界——未认证/无权限者根本到不了业务规则层。</p>
 *
 * <p>守护规则（fail-closed）：</p>
 * <ol>
 *   <li>每个 {@code @RestController} 的写方法（POST/PUT/DELETE/PATCH）必须标注
 *       {@code @RequiresPermission}；</li>
 *   <li>写方法标注的动作必须是合法动作（view/create/update/delete/approve/export）。</li>
 * </ol>
 *
 * <p>与 {@code DomainLayerArchitectureTest} 同源：架构约束以静态扫描固化进 {@code mvn test}
 * 流水线，任何违反即阻断交付。</p>
 */
class ApplicationLayerSecurityArchitectureTest {

    private static final Set<String> VALID_ACTIONS =
            Set.of("view", "create", "update", "delete", "approve", "export");

    /**
     * 认证前端点白名单（SEC-001 / B2 整改）。
     *
     * <p>身份建立入口（令牌签发）本质必须匿名可达——若标 {@code @RequiresPermission}，
     * 匿名调用方将永远无法换取令牌（无有效身份 → 401），认证闭环无法建立。</p>
     *
     * <p>故对「签发令牌」这一端点做<b>精确到方法</b>的显式豁免（类全名 + 方法名），
     * 而非笼统豁免整个类/包，守住 E2 fail-closed 守护的初衷。任何新增的认证前端点
     * 都必须在此显式登记并注明理由，否则仍被 fail-closed 扫描拦截。</p>
     *
     * <p>生产形态：本端点前置口令/凭据认证（对接 PasswordEngine 加盐哈希校验），
     * 凭任意 userId 签发即等于伪造身份，见 {@code AuthController} 类注释。</p>
     */
    private static final Set<String> AUTH_PRE_ENDPOINTS = Set.of(
            "com.mofeng.rdp.application.security.AuthController#token");

    private static com.tngtech.archunit.core.domain.JavaClasses applicationClasses;

    @BeforeAll
    static void importClasses() {
        applicationClasses = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.mofeng.rdp.application");
    }

    /** 判定某方法是否为「认证前端点」（身份建立入口，匿名可达，豁免鉴权标注）。 */
    private static boolean isAuthPreEndpoint(JavaClass cls, JavaMethod m) {
        return AUTH_PRE_ENDPOINTS.contains(cls.getName() + "#" + m.getName());
    }

    /**
     * E2-1（fail-closed）：每个 REST Controller 的写映射方法必须标注 {@code @RequiresPermission}。
     * 逐方法精确断言，避免「类级有任一标注即放行」的漏网。
     * 例外：认证前端点（身份建立入口，见 {@link #AUTH_PRE_ENDPOINTS}）显式豁免。
     */
    @Test
    void eachWriteMappedMethodMustRequirePermission() {
        ArchCondition<JavaClass> guard = new ArchCondition<>("each write-mapped method be annotated with @RequiresPermission") {
            @Override
            public void check(JavaClass cls, ConditionEvents events) {
                for (JavaMethod m : cls.getMethods()) {
                    if (!isWriteMapped(m) || isAuthPreEndpoint(cls, m)) {
                        continue;
                    }
                    boolean guarded = m.isAnnotatedWith(RequiresPermission.class);
                    events.add(new SimpleConditionEvent(
                            m, guarded,
                            "写方法 " + cls.getName() + "#" + m.getName()
                                    + " 缺失 @RequiresPermission 鉴权标注（E2 fail-closed 违规）"));
                }
            }
        };
        classes().that().areAnnotatedWith(RestController.class).should(guard).check(applicationClasses);
    }

    /**
     * E2-2：写方法标注的 {@code @RequiresPermission} 动作必须是合法动作，非法动作视为配置错误。
     * 认证前端点同样豁免（不标注动作）。
     */
    @Test
    void writeMethodsMustUseValidPermissionActions() {
        ArchCondition<JavaClass> guard = new ArchCondition<>("write-mapped methods use a valid permission action") {
            @Override
            public void check(JavaClass cls, ConditionEvents events) {
                for (JavaMethod m : cls.getMethods()) {
                    if (!isWriteMapped(m) || isAuthPreEndpoint(cls, m)) {
                        continue;
                    }
                    RequiresPermission ann = m.getAnnotationOfType(RequiresPermission.class);
                    if (ann == null) {
                        continue; // 缺失标注由 E2-1 判定，此处不重复
                    }
                    boolean valid = VALID_ACTIONS.contains(ann.action());
                    events.add(new SimpleConditionEvent(
                            m, valid,
                            "写方法 " + cls.getName() + "#" + m.getName()
                                    + " 的 @RequiresPermission(action=\"" + ann.action()
                                    + "\") 非法，须在 " + VALID_ACTIONS + " 内"));
                }
            }
        };
        classes().that().areAnnotatedWith(RestController.class).should(guard).check(applicationClasses);
    }

    private static boolean isWriteMapped(JavaMethod m) {
        return m.isAnnotatedWith(PostMapping.class)
                || m.isAnnotatedWith(PutMapping.class)
                || m.isAnnotatedWith(DeleteMapping.class)
                || m.isAnnotatedWith(PatchMapping.class);
    }
}
