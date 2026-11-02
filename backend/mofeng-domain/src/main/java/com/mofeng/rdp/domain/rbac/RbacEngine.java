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

        Role(String code, String name, String scope, String view, String create, String update,
             String delete, String approve, String export, String limits) {
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
        new Role("SYS_ADMIN", "系统管理员", "平台级", "●", "●", "●", "○", "—", "—", "仅配置类对象；业务数据一律脱敏，操作全审计"),
        new Role("TENANT_ADMIN", "租户管理员", "租户级", "●", "●", "●", "○", "—", "○", "不可跨租户；不可变更审计配置与已冻结基线"),
        new Role("PM", "研发项目经理", "项目级", "●", "●", "●", "○", "—", "●", "不可自审自批；删除仅限本人草稿"),
        new Role("SE", "系统工程师", "项目级", "●", "●", "●", "—", "—", "●", "不可放行 Gate；不可修改已冻结需求"),
        new Role("FSM", "功能安全经理", "项目级", "●", "●", "●", "—", "●", "●", "不可关闭本人提出的安全风险；含安全项 Gate 须二次签署"),
        new Role("CSM", "信息安全经理", "项目级", "●", "●", "●", "—", "●", "●", "不可自行批准 TARA 例外"),
        new Role("QDIR", "质量总监", "租户级", "●", "○", "—", "—", "●", "●", "「增」仅限风险接受单、豁免单、评审结论；不可代行技术评审"),
        new Role("SQE", "SQE", "租户级", "●", "●", "●", "—", "●", "●", "代录须标记来源；不可自批本人代录的 PPAP"),
        new Role("BUYER", "采购", "租户级", "●", "●", "●", "—", "—", "●", "不可见设计与软件明细；价格字段按字段策略脱敏"),
        new Role("CM", "配置管理员", "项目级", "●", "●", "●", "○", "—", "●", "基线冻结后不可改；删除仅限未被引用对象"),
        new Role("TEST_LEAD", "测试负责人", "项目级", "●", "●", "●", "—", "—", "●", "不可修改需求与设计；用例执行记录不可回改"),
        new Role("SUPPLIER", "供应商用户", "外部（本企业）", "○", "●", "●", "—", "—", "○", "仅门户路由；仅本企业数据；导出留水印与留痕"),
        new Role("AUDITOR", "只读审计员", "租户级", "●", "—", "—", "—", "—", "●", "任何角色均不可修改审计；导出须记录用途"),
        new Role("TRIAL", "试制负责人", "项目级", "●", "●", "●", "—", "●", "●", "不可自审试制放行；齐套阻塞时无放行权限"),
        new Role("PE", "工艺工程师", "项目级", "●", "●", "●", "—", "—", "●", "仅工艺与工装类对象；不可修改 EBOM 结构"),
        new Role("QE", "质量工程师", "项目级", "●", "●", "●", "—", "○", "●", "「审」仅限检验记录与不合格品处置；不可批准本人编制的检验规范"),
        new Role("RD_VP", "研发副总", "租户级", "●", "—", "—", "—", "●", "●", "仅跨项目决策与重大风险接受；不参与日常评审"),
        new Role("OPS", "运维负责人", "平台级", "●", "●", "●", "—", "●", "○", "不可读业务明细；导出仅限审计与性能数据；变更须走发布流程")
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
        // 按表逐项匹配（role 精确 + objType 精确或通配 + field 精确或通配）
        String[][] table = {
            {"采购", "供应商", "价格", "MASK"},
            {"采购", "需求", "设计明细", "HIDDEN"},
            {"系统管理员", "项目", "客户联系人", "MASK"},
            {"只读审计员", "*", "*", "READONLY"},
            {"供应商用户", "PPAP", "判定意见", "READONLY"}
        };
        for (String[] p : table) {
            boolean roleHit = p[0].equals(roleName);
            boolean objHit = p[1].equals(objType) || "*".equals(p[1]);
            boolean fieldHit = p[2].equals(field) || "*".equals(p[2]);
            if (roleHit && objHit && fieldHit) return p[3];
        }
        return "EDIT";
    }
}
