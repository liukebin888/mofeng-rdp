import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import Placeholder from '@/views/Placeholder.vue'

export interface MenuItem {
  path: string
  title: string
  desc?: string
  comp?: () => Promise<unknown>
  batch?: string
}
export interface MenuGroup {
  key: string
  title: string
  icon: string
  stage: string
  role: string
  cp: string
  items: MenuItem[]
}

const viewModules = import.meta.glob('../views/**/*.vue')
const v = (p: string) => viewModules[`../views/${p}.vue`] as () => Promise<unknown>

/** 16 个一级菜单，与 SOLUTION 11.1 一一对应；二级页标注 P0/P1 批次 */
export const MENUS: MenuGroup[] = [
  {
    key: 'workbench', title: '我的工作中心', icon: 'Grid', stage: 'P1–P7', role: '全员', cp: '—',
    items: [
      { path: '/workbench/today', title: '今日必办', desc: '四类事项聚合（POR-011）', comp: v('wb/TodayView') },
      { path: '/workbench/tasks', title: '我的任务', desc: '我的 WBS 任务与回执', comp: v('wb/TodayView') },
      { path: '/workbench/todos', title: '我的待办', desc: '与流程中心同源（RPT-013）', comp: v('flow/ApprovalsView') },
      { path: '/workbench/messages', title: '消息与收件箱', desc: '已读回执 + 三类来件（POR-006/008）', comp: v('wb/InboxView') },
      { path: '/workbench/hours', title: '我的工时单', desc: '工时填报与审核（POR-009/010）', comp: v('wb/HoursView') }
    ]
  },
  {
    key: 'presale', title: '项目前期', icon: 'Document', stage: 'P1–P2', role: '项目经理 / 研发副总', cp: 'K1 K2',
    items: [
      { path: '/presale/presale-apply', title: '前期交流申请', desc: '客户/产品线/预估金额，市场总监审核→三中心会签→总经理批准', comp: v('presale/PresaleApplyView') },
      { path: '/presale/quote-apply', title: '项目/产品报价', desc: '报价唯一权威：四角色并行填报成本→财务汇总→总经理批准，报价单清单与金额汇总', comp: v('presale/QuoteApplyView') },
      { path: '/presale/quote-cost', title: '报价费用明细', desc: '八类报价费用明细行填报（材料/制造/研发/工装/设备/试验/合规/包装），自动汇总引入报价单', comp: v('presale/QuoteCostView') },
      { path: '/presale/scheme', title: '技术方案（TR）', desc: '技术方案版本管理 + TR 技术评审审批流（评审委员会→总经理，C-02 技术输入）', comp: v('presale/SchemeView') },
      { path: '/presale/apply', title: '立项申请', desc: '五项分级输入定级 + 审批链同前期交流申请（市场总监审核→三中心会签→总经理批准）', comp: v('presale/ApplyView') },
      { path: '/presale/review', title: '立项评审', desc: '人工+AI 四维度评估（进度/资源/技术/成本）+ 参考结论与图表', comp: v('presale/ProjectReviewView') },
      { path: '/presale/flow', title: '前期审批流程', desc: '纯监视：按项目/产品聚合五流程（前期交流→TR→报价→立项→立项评审）审批过程与结果', comp: v('presale/PreSaleFlowView') }
    ]
  },
  {
    key: 'project', title: '项目执行', icon: 'Flag', stage: 'P3–P6', role: '项目经理 / 质量', cp: 'K3 K9 K10 K12',
    items: [
      { path: '/project/task', title: '项目任务书', desc: '任务目标/交付物/里程碑，项目经理发起→研发副总审核→总经理批准', comp: v('project/ProjectTaskView') },
      { path: '/project/plan', title: '项目主计划', desc: '计划周期/里程碑/资源，PMO审核→部门会签→总经理批准', comp: v('project/ProjectPlanView') },
      { path: '/project/ots', title: 'OTS 认可', desc: '三大条件附件驱动 + L1-L4 等级自动判定，部门会签→客户认可→总经理批准', comp: v('project/OtsApprovalView') },
      { path: '/project/ots-attachment-a', title: '附件 A 设计文件归档', desc: '设计文件归档汇总表（A-1 电子 / A-2 结构 / A-3 工艺），只读', comp: v('project/OtsAttachmentA') },
      { path: '/project/ots-attachment-b', title: '附件 B 样件评审报告', desc: 'OTS 样件评审报告，只读', comp: v('project/OtsAttachmentB') },
      { path: '/project/ots-attachment-c', title: '附件 C DV 试验报告', desc: 'DV 试验报告，只读', comp: v('project/OtsAttachmentC') },
      { path: '/project/ppap', title: 'PPAP 提交', desc: '等级/文件包/18要素，部门会签→客户批准', comp: v('project/PpapView') },
      { path: '/project/sop', title: 'SOP', desc: 'SOP日期/产能/爬坡计划，部门会签→总经理批准', comp: v('project/SopView') }
    ]
  },
  {
    key: 'portfolio', title: '组合与投资', icon: 'TrendCharts', stage: 'P1–P7', role: 'PMO / 研发副总', cp: 'C-43 C-44',
    items: [
      { path: '/portfolio/score', title: '评分与排序', desc: '40/35/25 三维加权 ×20', comp: v('portfolio/ScoreView') },
      { path: '/portfolio/capacity', title: '优选与容量', desc: '容量缺口三建议（PFM-019）', comp: v('portfolio/ScoreView') },
      { path: '/portfolio/analysis', title: '组合分析', desc: 'ROI/决策留痕/What-if', comp: v('portfolio/AnalysisView') },
      { path: '/portfolio/eps', title: 'EPS 节点树', desc: '四级树逐层汇总', comp: v('portfolio/EpsView') },
      { path: '/portfolio/gate-consistency', title: '闸门一致性', desc: '跨项目判据集统一（PFM-011）', comp: v('portfolio/GateConsistencyView') }
    ]
  },
  {
    key: 'plan', title: '项目计划与进度', icon: 'Calendar', stage: 'P3', role: '项目经理', cp: 'K3 K15 K16',
    items: [
      { path: '/plan/list', title: '项目台账', desc: '项目全景与健康度', comp: v('plan/ProjectListView') },
      { path: '/plan/wbs', title: 'WBS 与任务', desc: '四类依赖 + CPM 关键路径', comp: v('plan/WbsView') },
      { path: '/plan/weight', title: '权重体系', desc: '加权完成率双路径复算', comp: v('plan/WbsView') },
      { path: '/plan/quality', title: '13 项质量检查', desc: 'SCH-026 发布前体检', comp: v('plan/QualityView') },
      { path: '/plan/milestone', title: '里程碑与关键节点', desc: 'OTS 绑定 Gate4（PRJ-010）', comp: v('plan/QualityView') },
      { path: '/plan/deviation', title: '进度偏差', desc: 'S 曲线与 SPI 判读', comp: v('plan/DeviationView') },
      { path: '/plan/resource', title: '资源负荷', desc: '负荷率 >110% 冲突', comp: v('plan/ResourceView') },
      { path: '/plan/change', title: '计划变更', desc: '双轨计划与变更留痕', comp: v('plan/ChangeView') },
      { path: '/plan/alert', title: '计划告警', desc: '四段式时点告警 S1~S4 巡检', comp: v('plan/PlanAlertView') },
      { path: '/plan/interface', title: '界面（接口）计划', desc: '跨项目四要素接口 + 延误下游标红', comp: v('plan/InterfacePlanView') }
    ]
  },
  {
    key: 'dev', title: '研发过程', icon: 'Cpu', stage: 'P4', role: '系统工程师 / 设计', cp: 'K4 K5 K6 K7',
    items: [
      { path: '/dev/product-code', title: '产品型号编制', desc: '12 位六段式编码 + 顾客/车型/产品类型字典 + 零件号申请命名（CJQW0106）', comp: v('dev/ProductCodeView') },
      { path: '/dev/part-number-apply', title: '零件号申请命名', desc: '附表5 零件号申请命名表：表一~四 + 型号自动生成 + 查重 + 审批流转', comp: v('dev/PartNumberApplyView') },
      { path: '/dev/requirements', title: '需求条目库', desc: '六类多态 + 版本化', comp: v('dev/RequirementsView') },
      { path: '/dev/grading', title: '分级判定', desc: '13 行真值表查表留痕', comp: v('dev/GradingView') },
      { path: '/dev/trace', title: '追溯与覆盖率', desc: '闭包 ≤6 跳 + 四类断链', comp: v('dev/TraceView') },
      { path: '/dev/ebom', title: '图纸与 EBOM', desc: '三层用量汇总 + 冻结', comp: v('dev/EbomView') },
      { path: '/dev/ecr', title: 'ECR / ECN', desc: '影响闭包逐项确认', comp: v('dev/EcrView') },
      { path: '/dev/gate', title: '评审与门禁', desc: '5 闸门 + 48 控制点', comp: v('dev/GateView') },
      { path: '/dev/baseline', title: '基线管理', desc: '冻结不可变 + 哈希校验', comp: v('dev/BaselineView') },
      { path: '/dev/version', title: '软件版本', desc: 'SCI 与刷写台账', comp: v('dev/VersionView') }
    ]
  },
  {
    key: 'trial', title: '样件试制与 OTS', icon: 'Box', stage: 'P5', role: '试制负责人 / 质量', cp: 'K8 K9 K10 K11',
    items: [
      { path: '/trial/samples', title: '试制需求', desc: 'A/B/C/OTS 与 Gate 绑定', comp: v('trial/KittingView') },
      { path: '/trial/kitting', title: '齐套校验', desc: '不齐套不开工（K9）', comp: v('trial/KittingView') },
      { path: '/trial/workorder', title: '试制工单与工装', desc: '三处关联可跳转', comp: v('trial/WorkOrderView') },
      { path: '/trial/inspect', title: '检验与 8D', desc: '不合格品处置', comp: v('trial/InspectView') },
      { path: '/trial/ots', title: 'OTS 认可', desc: 'Gate4 未放行不得交付', comp: v('trial/OtsView') }
    ]
  },
  {
    key: 'delivery', title: '交付管理', icon: 'Van', stage: 'P6', role: '项目经理 / 物流', cp: 'K12 K13',
    items: [
      { path: '/delivery/deliverables', title: '交付物清单', desc: '缺件率 0 方可提交（C-19）', comp: v('delivery/DeliverableView') },
      { path: '/delivery/ship', title: '样件发运与签收', desc: '签收后转已交付（HW-016）', comp: v('delivery/DeliverableView') },
      { path: '/delivery/soft', title: '软件交付台账', desc: '版本与刷写记录', comp: v('delivery/SoftDeliverView') }
    ]
  },
  {
    key: 'quality', title: '质量管理', icon: 'CircleCheck', stage: 'P2–P7', role: '质量工程师 / 质量总监', cp: 'K14 C-07',
    items: [
      { path: '/quality/risk', title: '风险台账', desc: 'RPN 与红区强制策略', comp: v('quality/RiskView') },
      { path: '/quality/criteria', title: '评审条件定义', desc: '进入/退出准则（GAT-013）', comp: v('quality/CriteriaView') },
      { path: '/quality/vuln', title: '漏洞台账', desc: '高危 0 方可结项（C-33）', comp: v('quality/RiskView') },
      { path: '/quality/coverage', title: '追溯覆盖率', desc: '安全 100% / ASPICE ≥95%', comp: v('dev/TraceView') },
      { path: '/quality/pdca', title: 'PDCA 闭环', desc: '处置与改进分离', comp: v('quality/PdcaView') },
      { path: '/quality/knowledge', title: '复盘与经验库', desc: '阶段复盘 + 经验打标签（C-34/C-35）', comp: v('quality/KnowledgeView') },
      { path: '/quality/report', title: '质量评估统计报告', desc: 'A-SPICE PQSR：周度质量趋势 R/Y/G/N（CAEA-E-PQSR-A2）', comp: v('quality/QualityReportView') },
      { path: '/quality/nonconformity', title: '不符合项追踪表', desc: 'A-SPICE NTTT：不符合项四态追踪（CAEA-E-NTTT-A0）', comp: v('quality/NonconformityView') }
    ]
  },
  {
    key: 'cost', title: '成本管理', icon: 'Money', stage: 'P1–P7', role: '项目经理 / 财务', cp: 'C-10~C-12',
    items: [
      { path: '/cost/budget', title: '成本归集表', desc: '8 列归集表 + 四类单据', comp: v('cost/CostSheetView') },
      { path: '/cost/deviation', title: '成本偏差', desc: 'CPI 0.95/0.90 判读', comp: v('resource/EvmView') },
      { path: '/cost/hours', title: '工时归集', desc: '工时→成本归集', comp: v('resource/EvmView') }
    ]
  },
  {
    key: 'resource', title: '资源与成本', icon: 'User', stage: 'P3–P7', role: '资源经理 / 财务 BP', cp: 'K17 C-22~C-24 C-40 C-41',
    items: [
      { path: '/resource/evm', title: '四值与挣值报表', desc: 'SPI/CPI/EAC/TCPI/VAC', comp: v('resource/EvmView') },
      { path: '/resource/overload', title: '供需与超分配', desc: '>110% 标红与裁决', comp: v('resource/EvmView') },
      { path: '/resource/pool', title: '资源池与技能', desc: '技能矩阵与派工', comp: v('resource/PoolView') }
    ]
  },
  {
    key: 'collab', title: '门户与协同', icon: 'ChatDotRound', stage: 'P2–P7', role: '全员 / 项目秘书', cp: 'C-19 C-21 C-29',
    items: [
      { path: '/collab/portal', title: '项目门户', desc: '五区数据来自业务对象', comp: v('collab/PortalView') },
      { path: '/collab/review', title: '送审件', desc: '送审与答复留痕', comp: v('collab/PortalView') },
      { path: '/collab/meeting', title: '会议与决议', desc: '决议条目化转任务', comp: v('collab/PortalView') },
      { path: '/collab/supervise', title: '督办', desc: '超期升级', comp: v('collab/SuperviseView') }
    ]
  },
  {
    key: 'doc', title: '文档中心', icon: 'FolderOpened', stage: 'P2–P7', role: '文控 / 各专业', cp: 'C-45',
    items: [
      { path: '/doc/library', title: '文档库与版本', desc: '四态状态机 + 受控发布', comp: v('doc/DocView') },
      { path: '/doc/mdr', title: 'MDR / TDR 齐套', desc: '齐套率作 Gate 判据', comp: v('doc/DocView') },
      { path: '/doc/signoff', title: '会签工作台', desc: '并行会签、否决整体退回', comp: v('doc/DocView') }
    ]
  },
  {
    key: 'flow', title: '流程中心', icon: 'Operation', stage: '全阶段', role: '全员', cp: '全部',
    items: [
      { path: '/flow/start', title: '发起流程', desc: '四类流程对象', comp: v('flow/ApprovalsView') },
      { path: '/flow/approvals', title: '待我审批', desc: 'SOD-01 强制校验', comp: v('flow/ApprovalsView') },
      { path: '/flow/monitor', title: '流程监控与时限', desc: '超时升级（GAT-008）', comp: v('flow/ApprovalsView') },
      { path: '/flow/config', title: '流程与表单配置', desc: '配置化边界', comp: v('flow/ConfigView') }
    ]
  },
  {
    key: 'supply', title: '供应链协同', icon: 'Connection', stage: 'P5', role: 'SQE / 采购', cp: 'K8',
    items: [
      { path: '/supply/suppliers', title: '供应商档案', desc: '准入/定点/PPAP 全景', comp: v('supply/SupplierView') },
      { path: '/supply/qualify', title: '准入与定点', desc: '双重校验（C-25）', comp: v('supply/SupplierView') },
      { path: '/supply/ppap', title: 'PPAP', desc: '18 要素齐全性', comp: v('supply/SupplierView') },
      { path: '/supply/portal', title: '门户与代录', desc: '代录标记来源（SUP-014）', comp: v('supply/PortalView') }
    ]
  },
  {
    key: 'report', title: '报表与看板', icon: 'DataAnalysis', stage: '全阶段', role: '管理层', cp: 'C-47',
    items: [
      { path: '/report/dashboard', title: '项目级驾驶舱', desc: 'Gate/待办/逾期同源', comp: v('report/DashboardView') },
      { path: '/report/portfolio', title: '组合级驾驶舱', desc: '企业级聚合视图（跨项目 SPI/CPI/风险/交接）', comp: v('report/PortfolioDashboardView') },
      { path: '/report/audit', title: '审计与合规报表', desc: '哈希链校验报告', comp: v('report/AuditReportView') },
      { path: '/report/rules', title: '规则体检', desc: '48 控制点分布与口径核对', comp: v('report/RulesView') }
    ]
  },
  {
    key: 'ai', title: 'AI 智能辅助', icon: 'MagicStick', stage: '全阶段', role: '全员', cp: 'C-30',
    items: [
      { path: '/ai/assist', title: '智能辅助工作台', desc: '六类场景 + 检索前置过滤 + 复核留痕（AIA-001~007）', comp: v('ai/AiAssistView') }
    ]
  },
  {
    key: 'basic', title: '基础数据', icon: 'Coin', stage: '全阶段', role: '租户管理员 / 项目秘书', cp: '—',
    items: [
      { path: '/basic/customer', title: '客户管理', desc: '车厂主数据：名称/编号/车型，增删改+导入导出', comp: v('basic/CustomerView') },
      { path: '/basic/product', title: '产品管理', desc: '产品三级分类：类别→产品线→产品，增删改+导入导出', comp: v('basic/ProductView') },
      { path: '/basic/naming', title: '命名与编码规则', desc: '客户/产品/文档/部门/人员 命名规范与编码规范', comp: v('basic/NamingView') },
      { path: '/basic/deliverable-control', title: '输出物管控标准', desc: '产品开发输出物管控一览表（部门×门控阶段×等级）', comp: v('basic/DeliverableControlView') }
    ]
  },
  {
    key: 'system', title: '系统管理', icon: 'Setting', stage: '全阶段', role: '租户管理员', cp: 'C-29 C-36',
    items: [
      { path: '/system/org', title: '组织与用户', desc: '18 角色用户与租户', comp: v('system/OrgView') },
      { path: '/system/roles', title: '角色权限', desc: '18×6 矩阵 + SOD-01~07', comp: v('system/RolesView') },
      { path: '/system/audit', title: '审计日志', desc: '七元组 + 哈希链', comp: v('system/AuditLogView') },
      { path: '/system/dict', title: '分类码与 UDF', desc: '自定义字段扩展点', comp: v('system/DictView') },
      { path: '/system/rejection', title: '拦截策略配置', desc: '服务端拒绝三档可配置（硬拒绝/可配置/只读披露）', comp: v('system/RejectionPolicyView') },
      { path: '/system/calendar', title: '三层日历', desc: '企业/项目/资源 + 例外日（TEN-015）', comp: v('system/CalendarView') },
      { path: '/system/ops', title: '运维监控', desc: 'SLO + 监控告警 + 限流熔断 + 配额预警 + 变更审批', comp: v('system/OpsMonitorView') },
      { path: '/system/probe', title: '服务端一致性探针', desc: '前端引擎结论 vs 后端 REST 复核一致性比对（联调）', comp: v('system/ConsistencyProbeView') },
      { path: '/system/data', title: '数据与版本', desc: '种子重置与 schema 版本', comp: v('system/OrgView') }
    ]
  }
]

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/workbench/today' },
  {
    path: '/',
    component: AppLayout,
    children: MENUS.flatMap((g) =>
      g.items.map((it) => ({
        path: it.path.replace(/^\//, ''),
        name: it.path,
        component: it.comp || Placeholder,
        meta: { title: it.title, desc: it.desc, group: g.key, groupTitle: g.title, batch: it.batch || 'P0' }
      }))
    )
  },
  { path: '/:pathMatch(.*)*', redirect: '/workbench/today' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
