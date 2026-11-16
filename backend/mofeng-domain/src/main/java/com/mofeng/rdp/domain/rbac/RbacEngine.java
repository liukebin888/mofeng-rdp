package com.mofeng.rdp.domain.rbac;

import java.util.ArrayList;
import java.util.List;

/**
 * 权限引擎（SRS 7.3 / SEC-001~006、附录 D 18 角色矩阵、SOD-01~07）。
 * 三层权限取交集：角色动作 × 数据作用域 × 字段策略。
 *
 * 迁移自 app/src/domain/rbac.ts，同一套测试用例验收。
 */
public final class RbacEngine {

    private RbacEngine() {
    }

    // ------------------------------------------------------------------
    // 18 角色矩阵
    // ------------------------------------------------------------------

    /** 动作值：● 允许 / ○ 受限允许 / — 禁止。 */
    public static final class Role {
        public final String code;
        public final String name;
        public final String scope;
        public final String view;
        public final String create;
        public final String update;
        public final String delete;
        public final String approve;
        public final String export;
        public final String limits;
        /** SEC-006：组织角色 / 项目角色分离标记 */
        public final String roleType;
        /** SEC-002：角色默认数据作用域（SELF/DEPT/PROJECT/TENANT） */
        public final String dataScope;

        Role(String code, String name, String scope, String view, String create, String update,
             String delete, String approve, String export, String limits, String roleType, String dataScope) {
            this.code = code;
            this.name = name;
            this.scope = scope;
            this.view = view;
            this.create = create;
            this.update = update;
            this.delete = delete;
            this.approve = approve;
            this.export = export;
            this.limits = limits;
            this.roleType = roleType;
            this.dataScope = dataScope;
        }

        public String action(String key) {
            switch (key) {
                case "view": return view;
                case "create": return create;
                case "update": return update;
                case "delete": return delete;
                case "approve": return approve;
                case "export": return export;
                default: return "—";
            }
        }
    }

    public static final List<Role> ROLES = List.of(
        new Role("SYS_ADMIN", "系统管理员", "平台级", "●", "●", "●", "○", "—", "—", "仅配置类对象；业务数据一律脱敏，操作全审计", "org", "TENANT"),
        new Role("TENANT_ADMIN", "租户管理员", "租户级", "●", "●", "●", "○", "—", "○", "不可跨租户；不可变更审计配置与已冻结基线", "org", "TENANT"),
        new Role("PM", "研发项目经理", "项目级", "●", "●", "●", "○", "—", "●", "不可自审自批；删除仅限本人草稿", "project", "PROJECT"),
        new Role("SE", "系统工程师", "项目级", "●", "●", "●", "—", "—", "●", "不可放行 Gate；不可修改已冻结需求", "project", "PROJECT"),
        new Role("FSM", "功能安全经理", "项目级", "●", "●", "●", "—", "●", "●", "不可关闭本人提出的安全风险；含安全项 Gate 须二次签署", "project", "PROJECT"),
        new Role("CSM", "信息安全经理", "项目级", "●", "●", "●", "—", "●", "●", "不可自行批准 TARA 例外", "project", "PROJECT"),
        new Role("QDIR", "质量总监", "租户级", "●", "○", "—", "—", "●", "●", "「增」仅限风险接受单、豁免单、评审结论；不可代行技术评审", "org", "TENANT"),
        new Role("SQE", "SQE", "租户级", "●", "●", "●", "—", "●", "●", "代录须标记来源；不可自批本人代录的 PPAP", "org", "TENANT"),
        new Role("BUYER", "采购", "租户级", "●", "●", "●", "—", "—", "●", "不可见设计与软件明细；价格字段按字段策略脱敏", "org", "TENANT"),
        new Role("CM", "配置管理员", "项目级", "●", "●", "●", "○", "—", "●", "基线冻结后不可改；删除仅限未被引用对象", "project", "PROJECT"),
        new Role("TEST_LEAD", "测试负责人", "项目级", "●", "●", "●", "—", "—", "●", "不可修改需求与设计；用例执行记录不可回改", "project", "PROJECT"),
        new Role("SUPPLIER", "供应商用户", "外部（本企业）", "○", "●", "●", "—", "—", "○", "仅门户路由；仅本企业数据；导出留水印与留痕", "org", "SELF"),
        new Role("AUDITOR", "只读审计员", "租户级", "●", "—", "—", "—", "—", "●", "任何角色均不可修改审计；导出须记录用途", "org", "TENANT"),
        new Role("TRIAL", "试制负责人", "项目级", "●", "●", "●", "—", "●", "●", "不可自审试制放行；齐套阻塞时无放行权限", "project", "PROJECT"),
        new Role("PE", "工艺工程师", "项目级", "●", "●", "●", "—", "—", "●", "仅工艺与工装类对象；不可修改 EBOM 结构", "project", "PROJECT"),
        new Role("QE", "质量工程师", "项目级", "●", "●", "●", "—", "○", "●", "「审」仅限检验记录与不合格品处置；不可批准本人编制的检验规范", "project", "PROJECT"),
        new Role("RD_VP", "研发副总", "租户级", "●", "—", "—", "—", "●", "●", "仅跨项目决策与重大风险接受；不参与日常评审", "org", "TENANT"),
        new Role("OPS", "运维负责人", "平台级", "●", "●", "●", "—", "●", "○", "不可读业务明细；导出仅限审计与性能数据；变更须走发布流程", "org", "TENANT")
    );

    public static Role roleOf(String code) {
        for (Role r : ROLES) {
            if (r.code.equals(code)) return r;
        }
        return null;
    }

    public static final class CanResult {
        public final boolean allowed;
        public final boolean conditional;
        public final String reason;

        CanResult(boolean allowed, boolean conditional, String reason) {
            this.allowed = allowed;
            this.conditional = conditional;
            this.reason = reason;
        }
    }

    public static CanResult can(String roleCode, String action) {
        Role role = roleOf(roleCode);
        if (role == null) {
            return new CanResult(false, false, "角色未登记于附录 D，不得创建（SEC-006）");
        }
        String v = role.action(action);
        if ("●".equals(v)) {
            return new CanResult(true, false, role.name + " 允许该动作（作用域 " + role.scope + "）");
        }
        if ("○".equals(v)) {
            return new CanResult(true, true, role.name + " 受限允许：" + role.limits);
        }
        return new CanResult(false, false, role.name + " 禁止该动作");
    }

    // ------------------------------------------------------------------
    // 对象级权限矩阵（SEC-001：角色 × 动作 × 对象类型）
    // ------------------------------------------------------------------

    /** 受控对象类型清单（未登记对象 fail-closed） */
    public static final List<String> OBJECT_TYPES = List.of(
        "项目", "需求", "评审", "基线", "样件", "供应商", "PPAP", "风险", "EBOM", "工艺", "工装",
        "审计", "配置", "文档", "测试用例", "检验记录", "不合格品", "资源", "计划", "经验"
    );

    /** 对象作用域：白名单 allow / 黑名单 deny / 受限 conditional */
    public static final class ObjectScope {
        public final List<String> allow;
        public final List<String> conditional;
        public final List<String> deny;

        ObjectScope(List<String> allow, List<String> conditional, List<String> deny) {
            this.allow = allow;
            this.conditional = conditional;
            this.deny = deny;
        }
    }

    /** 角色 × 动作 的对象类型作用域表（结构化附录 D 限制条件） */
    public static ObjectScope objectScope(String roleCode, String action) {
        switch (roleCode + ":" + action) {
            case "QDIR:create":
                return new ObjectScope(List.of("风险", "评审"), List.of(), List.of("项目", "需求", "基线", "样件", "供应商", "PPAP", "EBOM", "工艺", "工装", "配置", "文档", "测试用例", "检验记录", "不合格品", "资源", "计划", "经验"));
            case "PE:create":
                return new ObjectScope(List.of("工艺", "工装"), List.of(), List.of());
            case "PE:update":
                return new ObjectScope(List.of("工艺", "工装"), List.of(), List.of("EBOM"));
            case "PE:view":
                return new ObjectScope(List.of("工艺", "工装", "EBOM", "项目", "计划", "文档"), List.of(), List.of());
            case "BUYER:view":
                return new ObjectScope(null, List.of(), List.of("EBOM"));
            case "BUYER:create":
            case "BUYER:update":
                return new ObjectScope(List.of("供应商", "计划", "检验记录"), List.of(), List.of());
            case "QE:approve":
                return new ObjectScope(List.of("检验记录", "不合格品"), List.of(), List.of("项目", "需求", "评审", "基线", "样件", "供应商", "PPAP", "风险", "EBOM", "工艺", "工装", "配置", "文档", "测试用例", "资源", "计划", "经验"));
            case "TEST_LEAD:update":
                return new ObjectScope(null, List.of(), List.of("需求", "EBOM"));
            case "CM:delete":
                return new ObjectScope(null, List.of(), List.of("基线", "文档"));
            case "RD_VP:approve":
                return new ObjectScope(List.of("风险"), List.of(), List.of("项目", "需求", "评审", "基线", "样件", "供应商", "PPAP", "EBOM", "工艺", "工装", "配置", "文档", "测试用例", "检验记录", "不合格品", "资源", "计划", "经验"));
            case "SUPPLIER:view":
                return new ObjectScope(List.of("供应商", "PPAP", "样件"), List.of(), List.of());
            case "SUPPLIER:create":
            case "SUPPLIER:update":
                return new ObjectScope(List.of("PPAP", "样件"), List.of(), List.of());
            default:
                return null;
        }
    }

    /** 对象级权限判定（fail-closed） */
    public static CanResult canOperate(String roleCode, String action, String objType) {
        if (!OBJECT_TYPES.contains(objType)) {
            return new CanResult(false, false, "对象类型「" + objType + "」未登记，禁止操作（SEC-001 fail-closed）");
        }
        CanResult base = can(roleCode, action);
        if (!base.allowed) return base;
        ObjectScope scope = objectScope(roleCode, action);
        if (scope == null) return base;
        Role role = roleOf(roleCode);
        String roleName = role != null ? role.name : roleCode;
        if (scope.deny != null && scope.deny.contains(objType)) {
            return new CanResult(false, false, roleName + " 禁止对「" + objType + "」执行该动作（对象级限制）");
        }
        if (scope.allow != null) {
            if (scope.allow.contains(objType)) {
                boolean cond = scope.conditional != null && scope.conditional.contains(objType);
                return new CanResult(true, cond, cond ? roleName + " 对「" + objType + "」受限允许" : roleName + " 对「" + objType + "」允许");
            }
            return new CanResult(false, false, roleName + " 对该动作仅限 " + String.join("、", scope.allow) + " 类对象，不含「" + objType + "」");
        }
        return base;
    }

    // ------------------------------------------------------------------
    // 一人多角色并集（PRJ-013）
    // ------------------------------------------------------------------

    /** 多角色并集判定：任一角色允许即允许 */
    public static CanResult canAny(java.util.List<String> roleCodes, String action) {
        if (roleCodes == null || roleCodes.isEmpty()) {
            return new CanResult(false, false, "无角色分配，禁止操作");
        }
        boolean conditional = false;
        for (String code : roleCodes) {
            CanResult r = can(code, action);
            if (r.allowed && !r.conditional) {
                return new CanResult(true, false, "多角色并集允许（PRJ-013）");
            }
            if (r.allowed) conditional = true;
        }
        if (conditional) return new CanResult(true, true, "多角色并集受限允许（PRJ-013）");
        return new CanResult(false, false, "所有角色均禁止该动作（PRJ-013 并集为空）");
    }

    /** 多角色 × 对象并集判定 */
    public static CanResult canOperateAny(java.util.List<String> roleCodes, String action, String objType) {
        if (roleCodes == null || roleCodes.isEmpty()) {
            return new CanResult(false, false, "无角色分配，禁止操作");
        }
        boolean conditional = false;
        for (String code : roleCodes) {
            CanResult r = canOperate(code, action, objType);
            if (r.allowed && !r.conditional) return r;
            if (r.allowed) conditional = true;
        }
        if (conditional) return new CanResult(true, true, "多角色并集受限允许（PRJ-013）");
        return new CanResult(false, false, "所有角色均禁止对「" + objType + "」执行该动作");
    }

    // ------------------------------------------------------------------
    // 数据范围四级（SEC-002）
    // ------------------------------------------------------------------

    private static final java.util.List<String> SCOPE_ORDER = List.of("SELF", "DEPT", "PROJECT", "TENANT");

    public static String dataScopeOfRole(String roleCode) {
        Role role = roleOf(roleCode);
        return role == null ? "SELF" : role.dataScope;
    }

    public static String dataScopeOfRoles(java.util.List<String> roleCodes) {
        if (roleCodes == null || roleCodes.isEmpty()) return "SELF";
        String acc = "SELF";
        for (String code : roleCodes) {
            String s = dataScopeOfRole(code);
            if (SCOPE_ORDER.indexOf(s) > SCOPE_ORDER.indexOf(acc)) acc = s;
        }
        return acc;
    }

    public static boolean coversScope(String roleScope, String required) {
        return SCOPE_ORDER.indexOf(roleScope) >= SCOPE_ORDER.indexOf(required);
    }

    // ------------------------------------------------------------------
    // SOD-01~07
    // ------------------------------------------------------------------

    public static final class SodResult {
        public final boolean ok;
        public final String note;
        public final String code;
        public final String name;

        SodResult(boolean ok, String note, String code, String name) {
            this.ok = ok;
            this.note = note;
            this.code = code;
            this.name = name;
        }
    }

    private static boolean ne(String a, String b) {
        return a != null && !a.isEmpty() && b != null && !b.isEmpty() && !a.equals(b);
    }

    /** ctx 为字段名→值映射（submitter/releasedBy/safetyFlag/signCount 等）。 */
    public static List<SodResult> checkSod(java.util.Map<String, String> ctx) {
        String submitter = ctx.get("submitter");
        String releasedBy = ctx.get("releasedBy");
        String safetyFlag = ctx.get("safetyFlag");
        String signCount = ctx.get("signCount");
        String author = ctx.get("author");
        String reviewer = ctx.get("reviewer");
        String proxyRecorder = ctx.get("proxyRecorder");
        String ppapJudge = ctx.get("ppapJudge");
        String frozenUpdates = ctx.get("frozenUpdates");
        String auditMutate = ctx.get("auditMutate");
        String grantDays = ctx.get("grantDays");

        List<SodResult> out = new ArrayList<>();
        out.add(new SodResult(ne(submitter, releasedBy), "提交人 " + nvl(submitter) + " / 放行人 " + nvl(releasedBy), "SOD-01", "提交人与放行人不得为同一人"));
        out.add(new SodResult(!"1".equals(safetyFlag) || (parseInt(signCount) >= 2), "安全标记 " + ("1".equals(safetyFlag) ? "是" : "否") + "，签署 " + nvl(signCount) + " 人", "SOD-02", "安全相关交付物须安全经理二次签署"));
        out.add(new SodResult(ne(author, reviewer), "作者 " + nvl(author) + " / 评审人 " + nvl(reviewer), "SOD-03", "评审人不得评审自己提交的需求"));
        out.add(new SodResult(ne(proxyRecorder, ppapJudge) || proxyRecorder == null || proxyRecorder.isEmpty(), "代录人 " + nvl(proxyRecorder) + " / PPAP 判定人 " + nvl(ppapJudge), "SOD-04", "代录人不得担任该供应商 PPAP 判定人"));
        out.add(new SodResult(!"1".equals(frozenUpdates), "已冻结基线 UPDATE 次数 " + nvl(frozenUpdates) + "（应为 0）", "SOD-05", "基线冻结后任何人不得修改，只能新建基线替代"));
        out.add(new SodResult(!"1".equals(auditMutate), "审计改删请求 " + ("1".equals(auditMutate) ? "被拒绝" : "无"), "SOD-06", "审计日志任何角色均无改删权限"));
        out.add(new SodResult(parseInt(grantDays) <= 30, "授权时长 " + nvl(grantDays) + " 天", "SOD-07", "临时授权最长 30 天，到期自动回收"));
        return out;
    }

    private static String nvl(String s) {
        return s == null || s.isEmpty() ? "—" : s;
    }

    private static int parseInt(String s) {
        if (s == null || s.isEmpty()) return 0;
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ------------------------------------------------------------------
    // 字段级策略（SEC-003）
    // ------------------------------------------------------------------

    public static final String[] FIELD_POLICIES_VALUES = {"HIDDEN", "MASK", "READONLY", "EDIT"};

    public static String resolveField(String roleName, String objType, String field) {
        // 按表逐项匹配（role 精确 + objType 精确或通配 + field 精确或通配）；多条命中取最强（HIDDEN > MASK > READONLY > EDIT）
        String[][] table = {
            {"采购", "供应商", "价格", "MASK"},
            {"采购", "需求", "设计明细", "HIDDEN"},
            {"采购", "EBOM", "软件明细", "HIDDEN"},
            {"采购", "文档", "设计附件", "HIDDEN"},
            {"系统管理员", "项目", "客户联系人", "MASK"},
            {"系统管理员", "项目", "财务数据", "MASK"},
            {"只读审计员", "*", "*", "READONLY"},
            {"供应商用户", "PPAP", "判定意见", "READONLY"},
            {"供应商用户", "供应商", "内部评分", "HIDDEN"},
            {"研发副总", "项目", "日常评审记录", "HIDDEN"}
        };
        int strength = 0; // EDIT
        String best = "EDIT";
        for (String[] p : table) {
            boolean roleHit = p[0].equals(roleName);
            boolean objHit = p[1].equals(objType) || "*".equals(p[1]);
            boolean fieldHit = p[2].equals(field) || "*".equals(p[2]);
            if (roleHit && objHit && fieldHit) {
                int s = policyStrength(p[3]);
                if (s > strength) {
                    strength = s;
                    best = p[3];
                }
            }
        }
        return best;
    }

    private static int policyStrength(String policy) {
        switch (policy) {
            case "HIDDEN": return 3;
            case "MASK": return 2;
            case "READONLY": return 1;
            default: return 0;
        }
    }
}
