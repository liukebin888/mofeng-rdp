import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import Placeholder from '@/views/Placeholder.vue'

export interface MenuItem {
  path: string
  title: string
  desc?: string
  icon?: string
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
    key: 'workbench', title: '工作中心', icon: 'Grid', stage: 'P1–P7', role: '全员', cp: '—',
    items: [
      { path: '/workbench/today', title: '今日必办', desc: '四类事项聚合（POR-011）', icon: 'AlarmClock', comp: v('wb/TodayView') },
      { path: '/workbench/tasks', title: '我的任务', desc: '我的 WBS 任务与回执', icon: 'List', comp: v('wb/TodayView') },
      { path: '/workbench/todos', title: '我的待办', desc: '与流程中心同源（RPT-013）', icon: 'Tickets', comp: v('flow/ApprovalsView') },
      { path: '/workbench/messages', title: '消息与收件箱', desc: '已读回执 + 三类来件（POR-006/008）', icon: 'Message', comp: v('wb/InboxView') },
      { path: '/workbench/hours', title: '我的工时单', desc: '工时填报与审核（POR-009/010）', icon: 'Timer', comp: v('wb/HoursView') },
      { path: '/workbench/light-task-board', title: '通用任务看板', desc: '轻量任务列表/看板/甘特三态 + 自定义字段（GEN-001/002/003 通用 PM）', icon: 'Grid', comp: v('wb/LightTaskBoardView') },
      { path: '/workbench/dashboard', title: '项目级驾驶舱', desc: 'Gate/待办/逾期同源', icon: 'Odometer', comp: v('report/DashboardView') },
      { path: '/workbench/portfolio', title: '组合级驾驶舱', desc: '企业级聚合视图（跨项目 SPI/CPI/风险/交接）', icon: 'PieChart', comp: v('report/PortfolioDashboardView') },
      { path: '/workbench/audit', title: '审计与合规报表', desc: '哈希链校验报告', icon: 'DocumentChecked', comp: v('report/AuditReportView') },
      { path: '/workbench/rules', title: '规则体检', desc: '48 控制点分布与口径核对', icon: 'List', comp: v('report/RulesView') }
    ]
  },
  {
    key: 'presale', title: '项目前期', icon: 'Document', stage: 'P1–P2', role: '项目经理 / 研发副总', cp: 'K1 K2',
    items: [
      { path: '/presale/presale-apply', title: '前期交流申请', desc: '客户/产品线/预估金额，市场总监审核→三中心会签→总经理批准', icon: 'ChatLineRound', comp: v('presale/PresaleApplyView') },
      { path: '/presale/quote-apply', title: '项目成本', desc: '报价唯一权威：四角色并行填报成本→财务汇总→总经理批准；含八类费用明细填报与报价测算', icon: 'Money', comp: v('presale/QuoteApplyView') },
      { path: '/presale/scheme', title: '技术方案（TR）', desc: '技术方案版本管理 + TR 技术评审审批流（评审委员会→总经理，C-02 技术输入）', icon: 'Document', comp: v('presale/SchemeView') },
      { path: '/presale/apply', title: '立项申请', desc: '五项分级输入定级 + 审批链同前期交流申请（市场总监审核→三中心会签→总经理批准）', icon: 'Files', comp: v('presale/ApplyView') },
      { path: '/presale/review', title: '立项评审', desc: '人工+AI 四维度评估（进度/资源/技术/成本）+ 参考结论与图表', icon: 'View', comp: v('presale/ProjectReviewView') },
      { path: '/presale/flow', title: '前期审批流程', desc: '纯监视：按项目/产品聚合五流程（前期交流→TR→报价→立项→立项评审）审批过程与结果', icon: 'Share', comp: v('presale/PreSaleFlowView') },
      { path: '/presale/analysis', title: '前期看板', desc: '前期业务 5 年趋势：前期交流/报价/TR/正式立项四类数量与金额按年份聚合，只读', icon: 'DataAnalysis', comp: v('presale/PresaleAnalysisView') }
    ]
  },
  {
    key: 'project', title: '项目管理', icon: 'Flag', stage: 'P3–P6', role: '项目经理 / 质量', cp: 'K3 K9 K10 K12',
    items: [
      { path: '/project/task', title: '项目任务书', desc: '任务目标/交付物/里程碑，项目经理发起→研发副总审核→总经理批准', icon: 'Notebook', comp: v('project/ProjectTaskView') },
      { path: '/project/plan', title: '项目主计划', desc: 'RMP 式主计划表达：项目上下文 + RAG + 5 KPI + 等级工时 + 集成整体视图（统一时间轴/里程碑矩阵/分计划投影），数据实时映射四级计划', icon: 'Histogram', comp: v('project/ProjectMasterPlanView') },
      { path: '/project/ots', title: 'OTS 认可', desc: '三大条件附件驱动 + L1-L4 等级自动判定，部门会签→客户认可→总经理批准', icon: 'Stamp', comp: v('project/OtsApprovalView') },
      { path: '/project/ots-attachment-a', title: '附件 A 设计文件归档', desc: '设计文件归档汇总表（A-1 电子 / A-2 结构 / A-3 工艺），只读', icon: 'Folder', comp: v('project/OtsAttachmentA') },
      { path: '/project/ots-attachment-b', title: '附件 B 样件评审报告', desc: 'OTS 样件评审报告，只读', icon: 'DocumentChecked', comp: v('project/OtsAttachmentB') },
      { path: '/project/ots-attachment-c', title: '附件 C DV 试验报告', desc: 'DV 试验报告，只读', icon: 'DataLine', comp: v('project/OtsAttachmentC') },
      { path: '/project/ppap', title: 'PPAP 提交', desc: '等级/文件包/18要素，部门会签→客户批准', icon: 'Checked', comp: v('project/PpapView') },
      { path: '/project/sop', title: 'SOP', desc: 'SOP日期/产能/爬坡计划，部门会签→总经理批准', icon: 'Cpu', comp: v('project/SopView') }
    ]
  },
  {
    key: 'issue-risk', title: '问题和风险', icon: 'Warning', stage: 'P3–P7', role: '项目经理 / 质量', cp: 'K14 C-07',
    items: [
      { path: '/issue-risk/issue', title: '问题管理', desc: '临界值自动触发问题 + 不符合项追踪（NTTT 四态）', icon: 'QuestionFilled', comp: v('project/IssueView') },
      { path: '/issue-risk/risk', title: '风险管理', desc: 'RPN 风险登记 + 漏洞台账 + 机会型风险 + 风险量化与储备', icon: 'WarningFilled', comp: v('quality/RiskView') }
    ]
  },
  {
    key: 'plan', title: '计划与进度', icon: 'Calendar', stage: 'P3', role: '项目经理', cp: 'K3 K15 K16',
    items: [
      { path: '/plan/list', title: '项目台账', desc: '项目全景与健康度', icon: 'Grid', comp: v('plan/ProjectListView') },
      { path: '/plan/wbs', title: 'WBS 与任务', desc: '四类依赖 + CPM 关键路径', icon: 'Operation', comp: v('plan/WbsView') },
      { path: '/plan/weight', title: '权重体系', desc: '加权完成率双路径复算', icon: 'ScaleToOriginal', comp: v('plan/WbsView') },
      { path: '/plan/quality', title: '13 项质量检查', desc: 'SCH-026 发布前体检', icon: 'CircleCheck', comp: v('plan/QualityView') },
      { path: '/plan/milestone', title: '里程碑与关键节点', desc: 'OTS 绑定 Gate4（PRJ-010）', icon: 'Flag', comp: v('plan/QualityView') },
      { path: '/plan/deviation', title: '进度偏差', desc: 'S 曲线与 SPI 判读', icon: 'TrendCharts', comp: v('plan/DeviationView') },
      { path: '/plan/resource', title: '资源负荷', desc: '负荷率 >110% 冲突', icon: 'UserFilled', comp: v('plan/ResourceView') },
      { path: '/plan/change', title: '计划变更', desc: '双轨计划与变更留痕', icon: 'Refresh', comp: v('plan/ChangeView') },
      { path: '/plan/alert', title: '计划告警', desc: '四段式时点告警 S1~S4 巡检', icon: 'Bell', comp: v('plan/PlanAlertView') },
      { path: '/plan/interface', title: '界面（接口）计划', desc: '跨项目四要素接口 + 延误下游标红', icon: 'Connection', comp: v('plan/InterfacePlanView') }
    ]
  },
  {
    key: 'dev', title: '研发过程', icon: 'Cpu', stage: 'P4', role: '系统工程师 / 设计', cp: 'K4 K5 K6 K7',
    items: [
      { path: '/dev/part-number-apply', title: '零件号申请命名', desc: '附表5 零件号申请命名表：表一~四 + 型号自动生成 + 查重 + 审批流转', icon: 'EditPen', comp: v('dev/PartNumberApplyView') },
      { path: '/dev/requirements', title: '需求条目库', desc: '六类多态 + 版本化', icon: 'Collection', comp: v('dev/RequirementsView') },
      { path: '/dev/grading', title: '分级判定', desc: '13 行真值表查表留痕', icon: 'Histogram', comp: v('dev/GradingView') },
      { path: '/dev/trace', title: '追溯与覆盖率', desc: '闭包 ≤6 跳 + 四类断链', icon: 'Link', comp: v('dev/TraceView') },
      { path: '/dev/ebom', title: '图纸与 EBOM', desc: '三层用量汇总 + 冻结', icon: 'Files', comp: v('dev/EbomView') },
      { path: '/dev/ecr', title: 'ECR / ECN', desc: '影响闭包逐项确认', icon: 'RefreshRight', comp: v('dev/EcrView') },
      { path: '/dev/gate', title: '评审与门禁', desc: '5 闸门 + 48 控制点', icon: 'Lock', comp: v('dev/GateView') },
      { path: '/dev/baseline', title: '基线管理', desc: '冻结不可变 + 哈希校验', icon: 'Cpu', comp: v('dev/BaselineView') },
      { path: '/dev/version', title: '软件版本', desc: 'SCI 与刷写台账', icon: 'Monitor', comp: v('dev/VersionView') },
      { path: '/dev/software-release', title: '软件发布', desc: '基于软件测试报告判定发布结论（准予/偏差/不予）', icon: 'Upload', comp: v('dev/SoftwareReleaseView') },
      { path: '/dev/external-part-approval', title: '外购外协件认可', desc: '样品认可三档结论（尺寸/材质/性能），CG4 前完成', icon: 'Stamp', comp: v('dev/ExternalPartApprovalView') }
    ]
  },
  {
    key: 'trial', title: '样件试制', icon: 'Box', stage: 'P5', role: '试制负责人 / 质量', cp: 'K8 K9 K10 K11',
    items: [
      { path: '/trial/samples', title: '试制需求', desc: 'A/B/C/OTS 与 Gate 绑定', icon: 'Box', comp: v('trial/KittingView') },
      { path: '/trial/kitting', title: '齐套校验', desc: '不齐套不开工（K9）', icon: 'CircleCheck', comp: v('trial/KittingView') },
      { path: '/trial/workorder', title: '试制工单与工装', desc: '三处关联可跳转', icon: 'Tickets', comp: v('trial/WorkOrderView') },
      { path: '/trial/inspect', title: '检验与 8D', desc: '不合格品处置', icon: 'Search', comp: v('trial/InspectView') }
    ]
  },
  {
    key: 'quality', title: '质量管理', icon: 'CircleCheck', stage: 'P2–P7', role: '质量工程师 / 质量总监', cp: 'K14 C-07',
    items: [
      { path: '/quality/risk', title: '风险台账', desc: 'RPN 与红区强制策略', icon: 'Warning', comp: v('quality/RiskView') },
      { path: '/quality/criteria', title: '评审条件定义', desc: '进入/退出准则（GAT-013）', icon: 'Notebook', comp: v('quality/CriteriaView') },
      { path: '/quality/vuln', title: '漏洞台账', desc: '高危 0 方可结项（C-33）', icon: 'Lock', comp: v('quality/RiskView') },
      { path: '/quality/coverage', title: '追溯覆盖率', desc: '安全 100% / ASPICE ≥95%', icon: 'Link', comp: v('dev/TraceView') },
      { path: '/quality/pdca', title: 'PDCA 闭环', desc: '处置与改进分离', icon: 'Refresh', comp: v('quality/PdcaView') },
      { path: '/quality/knowledge', title: '复盘与经验库', desc: '阶段复盘 + 经验打标签（C-34/C-35）', icon: 'Reading', comp: v('quality/KnowledgeView') },
      { path: '/quality/report', title: '质量评估统计报告', desc: 'A-SPICE PQSR：周度质量趋势 R/Y/G/N（CAEA-E-PQSR-A2）', icon: 'DataAnalysis', comp: v('quality/QualityReportView') },
      { path: '/quality/nonconformity', title: '不符合项追踪表', desc: 'A-SPICE NTTT：不符合项四态追踪（CAEA-E-NTTT-A0）', icon: 'DocumentRemove', comp: v('quality/NonconformityView') }
    ]
  },
  {
    key: 'cost', title: '成本管理', icon: 'Money', stage: 'P1–P7', role: '项目经理 / 财务', cp: 'C-10~C-12',
    items: [
      { path: '/cost/budget', title: '成本归集表', desc: '8 列归集表 + 四类单据', icon: 'Money', comp: v('cost/CostSheetView') },
      { path: '/cost/deviation', title: '成本偏差', desc: 'CPI 0.95/0.90 判读', icon: 'TrendCharts', comp: v('resource/EvmView') },
      { path: '/cost/hours', title: '工时归集', desc: '工时→成本归集', icon: 'Timer', comp: v('resource/EvmView') },
      { path: '/cost/evm', title: '四值与挣值报表', desc: 'SPI/CPI/EAC/TCPI/VAC', icon: 'DataAnalysis', comp: v('resource/EvmView') },
      { path: '/cost/score', title: '评分与排序', desc: '40/35/25 三维加权 ×20', icon: 'Rank', comp: v('portfolio/ScoreView') },
      { path: '/cost/capacity', title: '优选与容量', desc: '容量缺口三建议（PFM-019）', icon: 'Odometer', comp: v('portfolio/ScoreView') },
      { path: '/cost/analysis', title: '组合分析', desc: 'ROI/决策留痕/What-if', icon: 'TrendCharts', comp: v('portfolio/AnalysisView') },
      { path: '/cost/eps', title: 'EPS 节点树', desc: '四级树逐层汇总', icon: 'Share', comp: v('portfolio/EpsView') },
      { path: '/cost/gate-consistency', title: '闸门一致性', desc: '跨项目判据集统一（PFM-011）', icon: 'Switch', comp: v('portfolio/GateConsistencyView') }
    ]
  },
  {
    key: 'doc', title: '文档中心', icon: 'FolderOpened', stage: 'P2–P7', role: '文控 / 各专业', cp: 'C-45',
    items: [
      { path: '/doc/library', title: '文档库与版本', desc: '四态状态机 + 受控发布', icon: 'FolderOpened', comp: v('doc/DocView') },
      { path: '/doc/master-plan-templates', title: '主计划模板库', desc: 'A/B/C/D 四套主计划模板（APQP 裁剪）', icon: 'Collection', comp: v('doc/MasterPlanTemplateLibraryView') },
      { path: '/doc/mdr', title: 'MDR / TDR 齐套', desc: '齐套率作 Gate 判据', icon: 'CircleCheck', comp: v('doc/DocView') },
      { path: '/doc/signoff', title: '会签工作台', desc: '并行会签、否决整体退回', icon: 'EditPen', comp: v('doc/DocView') }
    ]
  },
  {
    key: 'flow', title: '流程中心', icon: 'Operation', stage: '全阶段', role: '全员', cp: '全部',
    items: [
      { path: '/flow/start', title: '发起流程', desc: '四类流程对象', icon: 'Promotion', comp: v('flow/ApprovalsView') },
      { path: '/flow/approvals', title: '待我审批', desc: 'SOD-01 强制校验', icon: 'Stamp', comp: v('flow/ApprovalsView') },
      { path: '/flow/monitor', title: '流程监控与时限', desc: '超时升级（GAT-008）', icon: 'VideoCamera', comp: v('flow/ApprovalsView') },
      { path: '/flow/apqp', title: '流程管理（APQP）', desc: 'APQP 五阶段流程节点 + 主计划模板 A/B/C/D 裁剪（APQ-001~005）', icon: 'Share', comp: v('flow/ApqpFlowView') },
      { path: '/flow/config', title: '流程与表单配置', desc: '配置化边界', icon: 'Setting', comp: v('flow/ConfigView') }
    ]
  },
  {
    key: 'supply', title: '采购管理', icon: 'Connection', stage: 'P5', role: 'SQE / 采购', cp: 'K8',
    items: [
      { path: '/supply/supplier', title: '供应商管理', desc: '准入/定点/PPAP/状态机/绩效评估（SUP-001~006）', icon: 'User', comp: v('supply/SupplierView') },
      { path: '/supply/portal', title: '门户与代录', desc: '代录标记来源（SUP-014）', icon: 'Monitor', comp: v('supply/PortalView') },
      { path: '/supply/purchase-plan', title: '采购计划', desc: '采购计划编制与跟踪（长周期零件）', icon: 'Tickets', comp: v('supply/PurchasePlanView') },
      { path: '/supply/tender', title: '招投标', desc: '招标立项/投标评审/开标定标留痕', icon: 'Document', comp: v('supply/TenderView') },
      { path: '/supply/sample-purchase', title: '样件采购管理', desc: '试制样件采购需求/下单/到货/验收', icon: 'Box', comp: v('supply/SamplePurchaseView') },
      { path: '/supply/deliverables', title: '交付物清单', desc: '缺件率 0 方可提交（C-19）', icon: 'List', comp: v('delivery/DeliverableView') },
      { path: '/supply/ship', title: '样件发运与签收', desc: '签收后转已交付（HW-016）', icon: 'Van', comp: v('delivery/DeliverableView') },
      { path: '/supply/soft', title: '软件交付台账', desc: '版本与刷写记录', icon: 'Monitor', comp: v('delivery/SoftDeliverView') }
    ]
  },
  {
    key: 'ai', title: 'AI 智能辅助', icon: 'MagicStick', stage: '全阶段', role: '全员', cp: 'C-30',
    items: [
      { path: '/ai/assist', title: '智能辅助工作台', desc: '六类场景 + 检索前置过滤 + 复核留痕（AIA-001~007）', icon: 'MagicStick', comp: v('ai/AiAssistView') }
    ]
  },
  {
    key: 'basic', title: '基础数据', icon: 'Coin', stage: '全阶段', role: '租户管理员 / 项目秘书', cp: '—',
    items: [
      { path: '/basic/customer', title: '客户管理', desc: '车厂主数据：名称/编号/车型，增删改+导入导出', icon: 'User', comp: v('basic/CustomerView') },
      { path: '/basic/product', title: '产品管理', desc: '产品三级分类：类别→产品线→产品，增删改+导入导出', icon: 'Goods', comp: v('basic/ProductView') },
      { path: '/basic/product-code', title: '产品型号编制', desc: '12 位六段式编码 + 顾客/车型/产品类型字典 + 零件号申请命名（CJQW0106）', icon: 'Memo', comp: v('dev/ProductCodeView') },
      { path: '/basic/naming', title: '命名与编码规则', desc: '客户/产品/文档/部门/人员 命名规范与编码规范', icon: 'Memo', comp: v('basic/NamingView') },
      { path: '/basic/deliverable-control', title: '输出物管控标准', desc: '产品开发输出物管控一览表（部门×门控阶段×等级）', icon: 'Grid', comp: v('basic/DeliverableControlView') }
    ]
  },
  {
    key: 'admin', title: '行政管理', icon: 'OfficeBuilding', stage: '全阶段', role: '租户管理员 / 人事', cp: 'C-29 C-36',
    items: [
      { path: '/admin/org', title: '组织与用户', desc: '18 角色用户与租户', icon: 'User', comp: v('system/OrgView') },
      { path: '/admin/roles', title: '角色权限', desc: '18×6 矩阵 + SOD-01~07', icon: 'Key', comp: v('system/RolesView') },
      { path: '/admin/overload', title: '供需与超分配', desc: '>110% 标红与裁决', icon: 'Histogram', comp: v('resource/EvmView') },
      { path: '/admin/pool', title: '资源池与技能', desc: '技能矩阵与派工', icon: 'User', comp: v('resource/PoolView') }
    ]
  },
  {
    key: 'system', title: '系统管理', icon: 'Setting', stage: '全阶段', role: '租户管理员', cp: 'C-29 C-36',
    items: [
      { path: '/system/audit', title: '审计日志', desc: '七元组 + 哈希链', icon: 'Document', comp: v('system/AuditLogView') },
      { path: '/system/dict', title: '分类码与 UDF', desc: '自定义字段扩展点', icon: 'Collection', comp: v('system/DictView') },
      { path: '/system/rejection', title: '拦截策略配置', desc: '服务端拒绝三档可配置（硬拒绝/可配置/只读披露）', icon: 'Switch', comp: v('system/RejectionPolicyView') },
      { path: '/system/calendar', title: '三层日历', desc: '企业/项目/资源 + 例外日（TEN-015）', icon: 'Calendar', comp: v('system/CalendarView') },
      { path: '/system/ops', title: '运维监控', desc: 'SLO + 监控告警 + 限流熔断 + 配额预警 + 变更审批', icon: 'Monitor', comp: v('system/OpsMonitorView') },
      { path: '/system/probe', title: '服务端一致性探针', desc: '前端引擎结论 vs 后端 REST 复核一致性比对（联调）', icon: 'Connection', comp: v('system/ConsistencyProbeView') },
      { path: '/system/data', title: '数据与版本', desc: '种子重置与 schema 版本', icon: 'Coin', comp: v('system/OrgView') }
    ]
  }
]

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/workbench/today' },
  {
    path: '/',
    component: AppLayout,
    children: [
      ...MENUS.flatMap((g) =>
        g.items.map((it) => ({
          path: it.path.replace(/^\//, ''),
          name: it.path,
          component: it.comp || Placeholder,
          meta: { title: it.title, desc: it.desc, group: g.key, groupTitle: g.title, batch: it.batch || 'P0' }
        }))
      ),
      // 非菜单页面路由（不出现在侧边栏，仅由「项目主计划」页「新建」按钮跳转进入）
      {
        path: 'project/master-plan-editor',
        name: '/project/master-plan-editor',
        component: v('project/ProjectMasterPlanEditorView'),
        meta: { title: '新建项目主计划', desc: '从空白板开始创建新的项目主计划', group: 'project', groupTitle: '项目管理', batch: 'P0' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/workbench/today' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
