/**
 * 项目主计划集成视图领域引擎（深度参照 RMP「研发管理平台」项目主计划 pgplan）
 *
 * 结构（忠实复刻 RMP pgplan，格式/字段不调整，数据通用化占位）：
 *   1. 项目上下文条：项目选择 + 项目信息 + RAG 红黄绿健康度
 *   2. 5 个 KPI：计划总数（1 主 + 5 分）/ 关键里程碑（CG1–CG7）/ 已完成里程碑 / 关联风险 / 已同步分计划
 *   3. 项目产品等级与工时估算：主计划计算等级（L1–L5）+ 产品清单 + 各分计划工时估算
 *   4. 项目主计划集成整体视图：
 *      - 统一时间轴（主计划 + 各分计划，同一时间基准，红线为今天，跨所有泳道）
 *      - 里程碑 × 分计划支撑矩阵（7 个 CG 里程碑展开 + 分计划支撑活动窗口归集）
 *      - 分计划只读投影（5 个分计划卡片：功能安全/信息安全/ASPICE 标签 + 关键输出文档 + 闸门摘要）
 *
 * 红线（ARC-001）：纯函数、零 DOM、零 vue/pinia；判定逻辑单一权威，禁止调用方自造。
 */

/** 分计划 key（前端逻辑顺序不可错：结构 / 硬件 / 软件 / 测试验证 / 过程） */
export type SubPlanKey = 'st' | 'hw' | 'sw' | 'tv' | 'pr'

/** 分计划展示次序（与 RMP SUB_ORDER 一致） */
export const SUB_ORDER: SubPlanKey[] = ['st', 'hw', 'sw', 'tv', 'pr']

/** 时间轴节点状态 */
export type TimelineStatus = 'done' | 'doing' | 'todo' | 'overdue'

/** 时间轴状态展示元（与 RMP TL_ST 一致） */
export const TL_ST: Record<TimelineStatus, { t: string; cls: string }> = {
  done: { t: '已完成', cls: 'done' },
  doing: { t: '进行中', cls: 'doing' },
  todo: { t: '未开始', cls: 'todo' },
  overdue: { t: '已逾期', cls: 'overdue' }
}

/** 产品等级系数（与 RMP LEVEL_COEF 一致：L1=0.6 L2=0.8 L3=1.0 L4=1.2 L5=1.5） */
export const LEVEL_COEF: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.2, 5: 1.5 }
export const LEVEL_OPTS = [1, 2, 3, 4, 5]

/** 标准输出文档（类型） */
export interface StdDoc {
  name: string
  type: string
  base: number
  doc?: string | null
}

/** 时间轴节点 */
export interface PlanTimelineNode {
  name: string
  date: string
  owner: string
  status: TimelineStatus
  doc?: string | null
  desc?: string
  outs?: Array<{ name: string; type: string; doc?: string | null; state?: string }>
}

/** 分计划 */
export interface DevPlan {
  key: SubPlanKey | 'mp'
  name: string
  hue: string
  owner: string
  scope: string
  fusa: string
  is: string
  aspice: string
  standards: Array<{ n: string; s: string }>
  outputs: Array<{ name: string; doc?: string | null; type: string }>
  timeline: PlanTimelineNode[]
  confirmed?: boolean
  syncedAt?: string | null
  syncedBy?: string | null
}

/** 产品清单项 */
export interface PlanProduct {
  cat: string
  name: string
  model: string
  grade: number
}

/** 主计划 */
export interface MasterPlan extends DevPlan {
  calcGrade: number
  products: PlanProduct[]
}

/** 分计划工时（各分计划按等级的基础工时） */
const PLAN_WORKS: Record<SubPlanKey, Array<{ base: number }>> = {
  st: [{ base: 120 }, { base: 80 }, { base: 60 }],
  hw: [{ base: 150 }, { base: 100 }, { base: 70 }],
  sw: [{ base: 200 }, { base: 140 }, { base: 90 }],
  tv: [{ base: 110 }, { base: 70 }, { base: 50 }],
  pr: [{ base: 100 }, { base: 65 }, { base: 45 }]
}

/** 标准输出文档基础工时（按等级折算） */
const STD_DOCS: StdDoc[] = [
  { name: '设计输出文档', type: '设计类', base: 40 },
  { name: '验证与测试文档', type: '测试类', base: 35 },
  { name: '质量与合规文档', type: '合归类', base: 30 },
  { name: '管理类文档', type: '管理类', base: 25 }
]

/**
 * 主计划（7 个关键里程碑 CG1–CG7，通用化占位）。
 * 里程碑顺序 CG1<…<CG7 不可错。
 */
export const MASTER_PLAN: MasterPlan = {
  key: 'mp',
  name: '项目主计划',
  hue: '#dc2626',
  owner: '项目经理',
  scope: '项目整体 · 关键里程碑 CG1–CG7',
  fusa: '项目级功能安全策划与安全目标分解（参考 ISO 26262-2 整体安全管理与 OEM 项目安全门）。',
  is: '项目级网络安全与合规策划（参考 ISO/SAE 21434 + UN R155，贯穿 CG1→CG7）。',
  aspice: '项目主计划统领各分计划（硬件/软件/结构/过程），里程碑门禁与 ASPICE 过程就绪度对齐。',
  standards: [
    { n: 'IATF 16949', s: '汽车质量管理体系（8.3 设计与开发策划）' },
    { n: 'APQP（AIAG）', s: '先期产品质量策划 5 阶段：计划→产品设计→过程设计→验证→量产' },
    { n: 'PPAP', s: '生产件批准程序（德系对应 VDA 2 / PPF）' },
    { n: '里程碑门禁', s: 'CG1 启动→CG2 工程发布→CG3 首样→CG4 OTS→CG5 过程认可→CG6 PPAP→CG7 SOP' }
  ],
  outputs: [
    { name: '项目主计划书', doc: null, type: '项目类 / 计划类' },
    { name: 'WBS 工作分解结构', doc: null, type: '项目类' },
    { name: '里程碑节点定义', doc: null, type: '项目类' },
    { name: '资源与预算基线', doc: null, type: '管理类' }
  ],
  timeline: [
    { name: 'CG1-项目启动', date: '2026-01-10', owner: '项目经理', status: 'done', doc: null, desc: '立项批准、项目章程签发、跨职能团队（结构/硬件/软件/测试/过程）组建、WBS 与预算基线发布，APQP 启动。' },
    { name: 'CG2-工程发布（设计冻结）', date: '2026-06-15', owner: '项目经理', status: 'doing', doc: null, desc: '系统/软件/硬件/结构设计冻结，EBOM 发布，设计评审通过，可制造性(DFM)与可测试性确认，功能安全/信息安全计划锁定。' },
    { name: 'CG3-首次样件（首件）', date: '2026-08-15', owner: '结构工程师', status: 'todo', doc: null, desc: '结构/硬件/软件首样齐套，首件检验(FAI)合格，基础功能贯通，DV 设计验证启动。' },
    { name: 'CG4-OTS 认可（工装样件）', date: '2026-09-15', owner: '硬件工程师', status: 'todo', doc: null, desc: '工装样件(OTS)提交并获客户认可，DV 设计验证完成，功能安全/信息安全测试通过。' },
    { name: 'CG5-过程认可', date: '2026-10-30', owner: '项目经理', status: 'todo', doc: null, desc: '试产与过程能力(CPK)达标，过程审核(VDA 6.3)通过，PFMEA/控制计划锁定，产线信息安全就绪。' },
    { name: 'CG6-生产件批准（PPAP）', date: '2026-11-30', owner: '项目经理', status: 'todo', doc: null, desc: 'PPAP 文件提交并获批准（等级 3），产能与节拍验证通过，量产前物料与供应商放行。' },
    { name: 'CG7-SOP（量产及项目验收）', date: '2026-12-30', owner: '项目经理', status: 'todo', doc: null, desc: '量产启动(SOP)，项目验收交付，经验教训(LL)归档，ASPICE/功能安全/质量目标达成评审。' }
  ],
  calcGrade: 3,
  products: [{ cat: '智能交互', name: '组合开关', model: 'SW-2026-A', grade: 3 }]
}

/** 5 个分计划（结构/硬件/软件/测试验证/过程），通用化占位，格式复刻 RMP。 */
export const DEV_PLANS: DevPlan[] = [
  {
    key: 'st',
    name: '结构开发计划',
    hue: '#d97706',
    owner: '结构工程师',
    scope: '智能座舱 / 智能驾驶 等结构件',
    fusa: '机械安全与公差链分析、结构件对功能安全的支撑（参考 ISO 26262 系统层面与 VDA 结构件安全规范）。',
    is: '结构防拆与物理篡改防护、产线信息安全接口（参考 ISO/SAE 21434 物理层要求）。',
    aspice: '系统层面(SYS.x)与供应商过程(SUP.1/SUP.8)，支撑软件/硬件落地（参考 ASPICE + VDA 6.3 过程审核）。',
    standards: [
      { n: 'IATF 16949 / APQP', s: '结构与尺寸先期策划' },
      { n: 'AIAG-VDA DFMEA', s: '设计 FMEA（结构风险分析）' },
      { n: 'VDA 6.3', s: '德系过程审核与成熟度评估' },
      { n: 'GD&T（ASME Y14.5）', s: '几何尺寸与公差（ISO 8015 GPS）' }
    ],
    outputs: [
      { name: '结构开发计划书', doc: 'DOC-STR-001', type: '项目类 / 计划类' },
      { name: '结构需求规格（StRS）/ 结构追溯矩阵（StTM）', doc: null, type: '硬件类 / 结构' },
      { name: '结构方案设计报告 / 结构 CAE 分析报告', doc: null, type: '硬件类 / 结构' },
      { name: '结构数模（3D）/ 2D 工程图纸 / DFM 报告', doc: null, type: '硬件类 / 结构' },
      { name: '模具方案/模具DFM / 样件（T1）', doc: null, type: '硬件类' },
      { name: '尺寸检验报告（T1/T2）', doc: null, type: '测试类' },
      { name: '结构 DFMEA / FTA 分析报告', doc: null, type: '硬件类' },
      { name: '结构发布与基线', doc: null, type: '硬件类 / 结构' }
    ],
    timeline: [
      { name: '结构开发启动与计划', date: '2026-03-01', owner: '结构工程师', status: 'done', doc: 'DOC-STR-001' },
      { name: '结构需求分析', date: '2026-03-20', owner: '结构工程师', status: 'done', doc: null },
      { name: '结构方案设计', date: '2026-04-25', owner: '结构工程师', status: 'done', doc: null },
      { name: '详细设计 / DFM', date: '2026-06-15', owner: '结构工程师', status: 'done', doc: null },
      { name: '结构 DFMEA 与可靠性分析', date: '2026-05-10', owner: '结构工程师', status: 'done', doc: null },
      { name: '结构配置管理与变更控制', date: '2026-03-10', owner: '结构工程师', status: 'done', doc: null },
      { name: '模具开发与样件试制（T1）', date: '2026-08-15', owner: '结构工程师', status: 'doing', doc: null },
      { name: '尺寸验证（T1/T2）', date: '2026-09-30', owner: '结构工程师', status: 'todo', doc: null },
      { name: '材料 / 性能验证', date: '2026-10-30', owner: '结构工程师', status: 'todo', doc: null },
      { name: '模具验收（T2/T3）', date: '2026-11-30', owner: '结构工程师', status: 'todo', doc: null },
      { name: '结构件发布', date: '2026-12-15', owner: '结构工程师', status: 'todo', doc: null },
      { name: '结构发布与基线', date: '2026-12-30', owner: '结构工程师', status: 'todo', doc: null }
    ]
  },
  {
    key: 'hw',
    name: '硬件开发计划',
    hue: '#0891b2',
    owner: '硬件工程师',
    scope: '智能控制 / 智能座舱 / 智能驾驶',
    fusa: '硬件安全需求(HSR)、硬件架构度量(SPFM/LFM)满足 ASIL-D（参考 ISO 26262-5/8/9）；硬件 FMEDA 纳入计划与验证，单元/集成/硬件-软件接口(HSI)测试覆盖。',
    is: '硬件防篡改与密钥安全存储、调试/测试接口访问控制与防提取（参考 ISO/SAE 21434 + UN R155）。',
    aspice: '硬件工程过程 HWE.1~HWE.4（需求→架构→详细设计→集成测试），目标达成 ASPICE Level 3。',
    standards: [
      { n: 'IATF 16949', s: '汽车质量管理体系（8.3 设计与开发控制）' },
      { n: 'ISO 26262', s: '道路车辆功能安全（硬件 HWE.x，SPFM/LFM 度量）' },
      { n: 'ISO/SAE 21434', s: '道路车辆信息安全工程（UN R155 依据）' },
      { n: 'ISO 16750', s: '道路车辆电气/电子设备环境条件和试验' }
    ],
    outputs: [
      { name: '硬件开发计划书', doc: 'DOC-HW-001', type: '项目类 / 计划类' },
      { name: '硬件需求规格（HRS）/ 硬件追溯矩阵（HTM）', doc: null, type: '硬件类' },
      { name: '硬件架构设计规范 / 软硬件接口规范（HSI）', doc: null, type: '硬件类' },
      { name: '原理图设计文件（SCH）/ PCB 设计文件（Layout）/ BOM', doc: null, type: '硬件类' },
      { name: 'FMEDA 报告 / 硬件架构度量（SPFM/LFM）', doc: null, type: '合归类 / 功能安全' },
      { name: '硬件集成测试报告 / EMC 环境试验报告', doc: null, type: '测试类' },
      { name: 'DFMEA 报告 / 硬件发布说明', doc: null, type: '项目类' }
    ],
    timeline: [
      { name: '硬件项目启动与计划', date: '2026-02-20', owner: '硬件工程师', status: 'done', doc: 'DOC-HW-001' },
      { name: '硬件需求分析', date: '2026-03-15', owner: '硬件工程师', status: 'done', doc: null },
      { name: '硬件架构设计', date: '2026-04-30', owner: '硬件工程师', status: 'done', doc: null },
      { name: '硬件详细设计 / PCB 设计', date: '2026-06-10', owner: '硬件工程师', status: 'done', doc: null },
      { name: '硬件安全分析（FMEDA）', date: '2026-06-30', owner: '硬件工程师', status: 'done', doc: null },
      { name: '硬件配置管理与变更控制', date: '2026-07-10', owner: '硬件工程师', status: 'done', doc: null },
      { name: '样件制作 / 板级 Bring-up', date: '2026-08-10', owner: '硬件工程师', status: 'doing', doc: null },
      { name: '硬件单元测试（模块/电路）', date: '2026-09-10', owner: '硬件工程师', status: 'todo', doc: null },
      { name: '硬件信息安全验证（防篡改 / 接口安全）', date: '2026-09-30', owner: '硬件工程师', status: 'todo', doc: null },
      { name: '硬件集成与接口测试（HSI）', date: '2026-10-15', owner: '硬件工程师', status: 'todo', doc: null },
      { name: '硬件合格性测试（EMC/环境/电气）', date: '2026-11-20', owner: '硬件工程师', status: 'todo', doc: null },
      { name: '系统集成验证与发布', date: '2026-12-20', owner: '硬件工程师', status: 'todo', doc: null },
      { name: '硬件发布与基线', date: '2026-12-30', owner: '硬件工程师', status: 'todo', doc: null }
    ]
  },
  {
    key: 'sw',
    name: '软件开发计划',
    hue: '#7c3aed',
    owner: '软件工程师',
    scope: '全部软件（座舱 / 智驾 / 交互 / 平台）',
    fusa: '软件安全需求(SSR)、ASIL 分解与软硬件接口(HSI)、安全机制与故障处理（参考 ISO 26262-6）。',
    is: '威胁分析与风险评估(TARA)、安全需求与密码学措施（参考 ISO/SAE 21434、UN R155 / R156）。',
    aspice: '符合双 V 模型：左降支 SWE.1~SWE.4，右升支 SWE.5~SWE.7；达成 ASPICE Level 3。',
    standards: [
      { n: 'Automotive SPICE', s: '汽车软件过程评估（ASPICE L2/L3，INTACS 模型）' },
      { n: 'ISO 26262', s: '功能安全软件部分 SWE.1~SWE.7' },
      { n: 'ISO 21448（SOTIF）', s: '预期功能安全' },
      { n: 'MISRA C / C++', s: '汽车 C/C++ 编码规范' }
    ],
    outputs: [
      { name: '软件项目计划（软件开发计划 ASPICE）', doc: 'DOC-SW-001', type: '项目类 / 计划类' },
      { name: '软件需求规格（SRS-SW）/ 需求追溯矩阵（RTM）', doc: null, type: '软件类' },
      { name: '软件架构设计说明 / 软硬件接口（HSI）规范', doc: null, type: '软件类' },
      { name: '软件详细设计说明书 / 单元设计说明', doc: null, type: '软件类' },
      { name: '源代码与构建物 / CI 构建与回归报告', doc: null, type: '软件类' },
      { name: '单元测试报告 / 代码覆盖率报告', doc: null, type: '测试类' },
      { name: '软件验证报告（SWE.7）/ 软件发布说明', doc: null, type: '测试类' }
    ],
    timeline: [
      { name: '软件项目启动与计划', date: '2026-02-25', owner: '软件工程师', status: 'done', doc: 'DOC-SW-001' },
      { name: '软件需求分析（SWE.1）', date: '2026-03-10', owner: '软件工程师', status: 'done', doc: null },
      { name: '软件架构设计（SWE.2）', date: '2026-04-20', owner: '软件工程师', status: 'done', doc: null },
      { name: '软件详细设计（SWE.3）', date: '2026-05-30', owner: '软件工程师', status: 'done', doc: null },
      { name: '软件单元实现（SWE.4）', date: '2026-07-10', owner: '软件工程师', status: 'done', doc: null },
      { name: '软件配置管理与变更控制', date: '2026-07-20', owner: '软件工程师', status: 'done', doc: null },
      { name: '代码评审（Peer Review）', date: '2026-08-05', owner: '软件工程师', status: 'todo', doc: null },
      { name: '软件单元测试（SWE.5）', date: '2026-08-20', owner: '软件工程师', status: 'todo', doc: null },
      { name: '迭代开发 / 持续集成（CI 门禁）', date: '2026-09-05', owner: '软件工程师', status: 'todo', doc: null },
      { name: '软件合格性测试（SWE.7）', date: '2026-10-25', owner: '软件工程师', status: 'todo', doc: null },
      { name: '系统集成与系统测试（SYS.4/5）', date: '2026-11-10', owner: '软件工程师', status: 'todo', doc: null },
      { name: '软件发布与基线', date: '2026-12-20', owner: '软件工程师', status: 'todo', doc: null }
    ]
  },
  {
    key: 'tv',
    name: '测试与验证计划',
    hue: '#2563eb',
    owner: '测试工程师',
    scope: '验证中心 / 全部项目',
    fusa: '测试覆盖率与故障注入验证、安全机制有效性确认（参考 ISO 26262-4/6/8 V&V）。',
    is: '渗透测试与漏洞扫描、信息安全验收准则（参考 ISO/SAE 21434、UN R155）。',
    aspice: '软件测试过程 SUP.1（测试计划/用例/执行/报告），达成 ASPICE L2/L3 测试覆盖与可追溯性要求。',
    standards: [
      { n: 'ISO 26262', s: '功能安全 V&V' },
      { n: 'ISO/SAE 21434', s: '网络安全测试' },
      { n: 'IATF 16949 8.3.4', s: '设计与开发验证/确认要求' },
      { n: 'APQP / PPAP', s: '验证与批准准则（DV / PV）' }
    ],
    outputs: [
      { name: '测试与验证计划', doc: 'DOC-TV-001', type: '项目类 / 计划类' },
      { name: '测试主计划 / 测试策略', doc: null, type: '项目类 / 计划类' },
      { name: '测试需求规格（TRS）/ 测试追溯矩阵（TTM）', doc: null, type: '测试类' },
      { name: '测试方案 / 测试用例库', doc: null, type: '测试类' },
      { name: '单元/集成测试报告', doc: null, type: '测试类' },
      { name: '软件/系统合格性测试报告', doc: null, type: '测试类' },
      { name: '整车/DV/PV 型式试验与发布', doc: 'DOC-TV-002', type: '测试类' },
      { name: '测试总结与发布基线', doc: null, type: '测试类' }
    ],
    timeline: [
      { name: '测试策略与计划', date: '2026-03-15', owner: '测试工程师', status: 'done', doc: 'DOC-TV-001' },
      { name: '测试配置管理与变更控制', date: '2026-03-20', owner: '测试工程师', status: 'done', doc: null },
      { name: '测试需求分析', date: '2026-04-10', owner: '测试工程师', status: 'done', doc: null },
      { name: '测试方案设计', date: '2026-04-30', owner: '测试工程师', status: 'done', doc: null },
      { name: '测试环境设计', date: '2026-05-15', owner: '测试工程师', status: 'done', doc: null },
      { name: '测试台架 / 环境集成', date: '2026-05-30', owner: '测试工程师', status: 'doing', doc: null },
      { name: '功能安全测试（故障注入 / 安全机制验证）', date: '2026-07-10', owner: '测试工程师', status: 'done', doc: null },
      { name: '信息安全测试（渗透 / 漏洞扫描）', date: '2026-07-15', owner: '测试工程师', status: 'done', doc: null },
      { name: '单元/集成测试执行', date: '2026-07-20', owner: '测试工程师', status: 'todo', doc: null },
      { name: '软件/系统合格性测试', date: '2026-08-25', owner: '测试工程师', status: 'todo', doc: null },
      { name: '硬件合格性测试（EMC/环境/电气）', date: '2026-09-30', owner: '测试工程师', status: 'todo', doc: null },
      { name: '整车/DV/PV 型式试验与发布', date: '2026-10-30', owner: '测试工程师', status: 'todo', doc: 'DOC-TV-002' },
      { name: '测试总结与发布基线', date: '2026-12-30', owner: '测试工程师', status: 'todo', doc: null }
    ]
  },
  {
    key: 'pr',
    name: '过程开发计划',
    hue: '#059669',
    owner: '过程工程师',
    scope: '量产导入 / 供应商管理',
    fusa: '过程保证与来料安全、制造环节功能安全落地（参考 IATF 16949 / VDA 6.3 / PPAP）。',
    is: '产线信息安全与数据封堵、供应商信息安全要求传递（参考 ISO/SAE 21434 供应链要求）。',
    aspice: '量产过程(ACM/SUP.9)与供应商管理(SUP.8)，达成过程认可(PPAP)。',
    standards: [
      { n: 'IATF 16949', s: '汽车质量管理体系核心（量产过程）' },
      { n: 'APQP（5 阶段）', s: '先期产品质量策划' },
      { n: 'PPAP', s: '生产件批准' },
      { n: 'PFMEA / MSA / SPC', s: 'AIAG 五大手册' }
    ],
    outputs: [
      { name: '过程开发计划书', doc: 'DOC-PR-001', type: '项目类 / 计划类' },
      { name: '过程流程图 / 工厂平面布置图', doc: null, type: '项目类' },
      { name: 'PFMEA 报告', doc: 'DOC-PR-002', type: '项目类 / 风险评估类' },
      { name: '试生产控制计划 / 特殊特性清单', doc: null, type: '项目类' },
      { name: '设备/工装清单 / 产线布局图', doc: null, type: '管理类' },
      { name: 'SOP 作业指导书 / 检验指导书', doc: null, type: '管理类 / 管理流程' },
      { name: '过程能力研究报告（CPK/PPK）/ MSA', doc: null, type: '测试类' },
      { name: '过程发布与量产放行基线（PPAP/PSW）', doc: null, type: '项目类' }
    ],
    timeline: [
      { name: '过程开发启动与计划', date: '2026-03-10', owner: '过程工程师', status: 'done', doc: 'DOC-PR-001' },
      { name: '过程配置管理与变更控制', date: '2026-03-15', owner: '过程工程师', status: 'done', doc: null },
      { name: '过程策划 / 过程流程图', date: '2026-04-20', owner: '过程工程师', status: 'done', doc: null },
      { name: 'PFMEA', date: '2026-05-30', owner: '过程工程师', status: 'done', doc: 'DOC-PR-002' },
      { name: '过程功能安全（来料安全 / 制造环节功能安全落地）', date: '2026-06-10', owner: '过程工程师', status: 'done', doc: null },
      { name: '控制计划设计（试生产）', date: '2026-06-30', owner: '过程工程师', status: 'done', doc: null },
      { name: '作业指导书（SOP）', date: '2026-07-20', owner: '过程工程师', status: 'done', doc: null },
      { name: '工装 / 设备 / 产线准备', date: '2026-08-20', owner: '过程工程师', status: 'doing', doc: null },
      { name: '过程信息安全（产线数据封堵 / 防篡改）', date: '2026-08-25', owner: '过程工程师', status: 'doing', doc: null },
      { name: '试生产 / Run@Rate', date: '2026-09-30', owner: '过程工程师', status: 'todo', doc: null },
      { name: '过程能力研究（CPK/PPK · MSA）', date: '2026-10-30', owner: '过程工程师', status: 'todo', doc: null },
      { name: '过程批准 / 量产控制计划', date: '2026-12-10', owner: '过程工程师', status: 'todo', doc: null },
      { name: '过程发布与量产放行基线', date: '2026-12-30', owner: '过程工程师', status: 'todo', doc: null }
    ]
  }
]

/** 分计划名称查找 */
export function planName(key: SubPlanKey | 'mp'): string {
  if (key === 'mp') return MASTER_PLAN.name
  const p = DEV_PLANS.find((x) => x.key === key)
  return p ? p.name : key
}

/** 分计划 hue 查找 */
export function planHue(key: SubPlanKey | 'mp'): string {
  if (key === 'mp') return MASTER_PLAN.hue
  const p = DEV_PLANS.find((x) => x.key === key)
  return p ? p.hue : '#94a3b8'
}

/** 单个工时按等级折算（与 RMP whH 一致：base × LEVEL_COEF[level]，保留 1 位小数） */
export function whH(base: number, level: number): number {
  return +((base || 0) * (LEVEL_COEF[level] || LEVEL_COEF[3])).toFixed(1)
}

/** 某分计划按等级的总工时 */
export function planWorkTotalAt(key: SubPlanKey, grade: number): number {
  return (PLAN_WORKS[key] || []).reduce((s, w) => s + whH(w.base, grade), 0)
}

/** 标准输出文档按等级的总工时 */
export function docTotalAt(grade: number): number {
  return STD_DOCS.reduce((s, d) => s + whH(d.base, grade), 0)
}

/** 主计划 KPI 汇总（单一权威：供视图层引用，禁止调用方自造） */
export function masterPlanKpis() {
  const total = DEV_PLANS.length + 1
  const tl = MASTER_PLAN.timeline
  const doneN = tl.filter((t) => t.status === 'done').length
  const syncedN = DEV_PLANS.filter((p) => p.confirmed).length
  return {
    total,
    milestone: tl.length,
    done: doneN,
    synced: syncedN,
    risk: 0
  }
}

/**
 * 里程碑 × 分计划支撑矩阵（复刻 RMP renderMilestoneMatrix）：
 * 把 7 个 CG 里程碑按时间窗口归集各分计划活动，合成「一个整体」。
 * 窗口 = 上一里程碑日期 → 本里程碑日期（首个窗口从 2026-01-01 起；末窗口含 CG7 之后收尾活动）。
 */
export interface MilestoneWindow {
  milestone: PlanTimelineNode
  lo: string
  up: string
  isLast: boolean
  subs: Array<{
    plan: DevPlan
    acts: Array<{ node: PlanTimelineNode }>
  }>
}

export function milestoneMatrix(): MilestoneWindow[] {
  const cg = MASTER_PLAN.timeline.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const n = cg.length
  return cg.map((m, i) => {
    const isLast = i === n - 1
    const lo = i > 0 ? cg[i - 1].date : '2026-01-01'
    const up = isLast ? '2099-12-31' : m.date
    const subs = SUB_ORDER.map((k) => {
      const p = DEV_PLANS.find((x) => x.key === k)
      if (!p) return null
      const acts = (p.timeline || [])
        .filter((nn) => nn.date > lo && nn.date <= up)
        .map((nn) => ({ node: nn }))
      if (!acts.length) return null
      return { plan: p, acts }
    }).filter((x): x is NonNullable<typeof x> => !!x)
    return { milestone: m, lo, up, isLast, subs }
  })
}

/**
 * 分计划只读投影（复刻 RMP renderSubProj）：
 * 数据引用自「开发计划」，只读投影，含功能安全/信息安全/ASPICE 标签 + 关键输出文档 + 闸门摘要。
 */
export interface SubProjection {
  plan: DevPlan
  confirmed: boolean
  outputStates: Array<{ name: string; type: string; doc: string | null; state: string; cls: string }>
}

/** 输出物状态判定（复刻 RMP：已关联已批准→已批准；已关联未批准→按文档状态；未关联→待编制） */
export function outputStateOf(o: { name: string; doc?: string | null; type: string }): { state: string; cls: string } {
  if (o.doc) return { state: '已批准', cls: 'approved' }
  return { state: '待编制', cls: 'draft' }
}

export function subProjections(): SubProjection[] {
  return DEV_PLANS.map((p) => {
    const outputStates = p.outputs.map((o) => {
      const { state, cls } = outputStateOf(o)
      return { name: o.name, type: o.type, doc: o.doc ?? null, state, cls }
    })
    return { plan: p, confirmed: !!p.confirmed, outputStates }
  })
}

/** 确认同步状态（复刻 RMP：confirmed + syncedAt/syncedBy；未确认则提示投影待确认） */
export interface SyncState {
  confirmed: boolean
  syncedAt: string | null
  syncedBy: string | null
}

export function syncStateOf(p: DevPlan): SyncState {
  return { confirmed: !!p.confirmed, syncedAt: p.syncedAt ?? null, syncedBy: p.syncedBy ?? null }
}

/** 统一时间轴所需数据（复刻 RMP renderUnifiedTimeline 的数据准备：主计划 + 各分计划按 SUB_ORDER 排列） */
export function unifiedTimelinePlans(): Array<{ key: SubPlanKey | 'mp'; name: string; hue: string; timeline: PlanTimelineNode[] }> {
  const order: Array<SubPlanKey | 'mp'> = ['mp', ...SUB_ORDER]
  const all: Array<{ key: SubPlanKey | 'mp'; name: string; hue: string; timeline: PlanTimelineNode[] }> = []
  for (const k of order) {
    if (k === 'mp') {
      all.push({ key: 'mp', name: MASTER_PLAN.name, hue: MASTER_PLAN.hue, timeline: MASTER_PLAN.timeline })
    } else {
      const p = DEV_PLANS.find((x) => x.key === k)
      if (p) all.push({ key: k, name: p.name, hue: p.hue, timeline: p.timeline })
    }
  }
  return all
}

/** RAG 健康度（复刻 RMP mpProjectRag：存在延期→红；进行中→黄；否则绿） */
export interface RagResult {
  cls: 'red' | 'amber' | 'green'
  label: string
  red: number
  amber: number
  green: number
}

export function computeRag(today: Date = new Date()): RagResult {
  const tl = MASTER_PLAN.timeline
  let red = 0
  let amber = 0
  let green = 0
  for (const m of tl) {
    const done = m.status === 'done'
    const plan = m.date ? new Date(m.date) : null
    const late = plan && plan < today && !done
    if (late) red++
    else if (m.status === 'doing') amber++
    else if (done) green++
    else if (plan && plan < today) red++
    else green++
  }
  if (red > 0) return { cls: 'red', label: `红 · 存在延期节点 ${red}`, red, amber, green }
  if (amber > 0) return { cls: 'amber', label: `黄 · 进行中/待评审 ${amber}`, red, amber, green }
  return { cls: 'green', label: '绿 · 总体受控', red, amber, green }
}

/** 产品等级工时估算汇总（复刻 RMP renderMpGrades 的合计逻辑） */
export interface GradeEstimate {
  grade: number
  planWorks: Array<{ key: SubPlanKey; name: string; hue: string; work: number; hours: number }>
  docWork: number
  totalWork: number
  totalHours: number
}

export function gradeEstimate(calcGrade: number): GradeEstimate {
  const planWorks = SUB_ORDER.map((k) => {
    const work = planWorkTotalAt(k, calcGrade)
    return { key: k, name: planName(k), hue: planHue(k), work, hours: +(work * 8).toFixed(1) }
  })
  const docWork = docTotalAt(calcGrade)
  const totalWork = docWork + SUB_ORDER.reduce((s, k) => s + planWorkTotalAt(k, calcGrade), 0)
  return { grade: calcGrade, planWorks, docWork, totalWork, totalHours: +(totalWork * 8).toFixed(1) }
}
