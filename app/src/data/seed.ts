/**
 * 种子数据（首次启动写入 localStorage；可重置）
 * 对齐 SRS 附录 B 字段命名；规模：3 项目（L1/L3/L4）、32 个 WBS 节点、25 条需求、4 类断链样本
 */
import { appendAudit } from '@/domain/audit'
import { buildBaseline } from '@/domain/baseline'
import { grade } from '@/domain/grading'
import { hashOf } from '@/domain/hash'
import type {
  ActorContext,
  AuditRow,
  Baseline,
  BomNode,
  CalendarDef,
  CodeDict,
  DecisionRecord,
  Deliverable,
  DeviationItem,
  DocItem,
  EcrItem,
  HourRecord,
  InboxItem,
  LessonItem,
  MeetingItem,
  MessageItem,
  FormDraft,
  PortalSectionConfig,
  Project,
  ProjectInvestment,
  Requirement,
  ResolutionItem,
  ResourcePoolMember,
  ResourceShareApply,
  RetroItem,
  RiskItem,
  SampleReq,
  SendAuditItem,
  StepRun,
  StepTemplate,
  SuperviseItem,
  Supplier,
  TraceLink,
  UdfDef,
  WbsNode,
  WhatIfScenario
} from '@/domain/types'
import { ROLES } from '@/domain/rbac'
import type { FlowDefinition, FlowInstance } from '@/domain/flowEngine'

export const SEED_VERSION = 'mofeng.rdp.v1.0.5'
const TENANT = 'T-1001'

export interface SeedUser {
  id: string
  name: string
  roleCode: string
  roleName: string
  dept: string
  account: string
}

function buildUsers(): SeedUser[] {
  const names = [
    '陈志远',
    '林静',
    '周立群',
    '吴敏',
    '赵启明',
    '钱伟',
    '孙烨',
    '李文杰',
    '郑昊',
    '王琳',
    '冯磊',
    '何晓东',
    '徐宁',
    '马强',
    '顾晨',
    '沈雅',
    '许国栋',
    '唐峰'
  ]
  return ROLES.map((r, i) => ({
    id: `U${String(i + 1).padStart(3, '0')}`,
    name: names[i] || `用户${i + 1}`,
    roleCode: r.code,
    roleName: r.name,
    dept: ['项目管理部', '研发中心', '质量部', '采购部', '制造部', 'IT'][i % 6],
    account: `mofeng.${r.code.toLowerCase()}`
  }))
}

const actor = (u: SeedUser, projectId?: string): ActorContext => ({
  userId: u.id,
  userName: u.name,
  roleCode: u.roleCode,
  roleName: u.roleName,
  tenantId: TENANT,
  projectId,
  at: '2026-10-30T09:00:00+08:00'
})

function buildProjects(users: SeedUser[]): Project[] {
  const pm = users.find((u) => u.roleCode === 'PM')!
  const base = {
    customer: '上汽通用五菱',
    productLine: '车身电子',
    platform: 'E 平台',
    owner: pm.name,
    start: '2026-03-02',
    status: '进行中' as const
  }
  const p1Input = { asil: 'B' as const, cal: 2 as const, selfDev: 'FULL' as const, newArch: true, customerSafety: false }
  const p2Input = { asil: 'QM' as const, cal: 0 as const, selfDev: 'PARAM_ONLY' as const, newArch: false, customerSafety: false }
  const p3Input = { asil: 'QM' as const, cal: 0 as const, selfDev: 'NONE_DOC' as const, newArch: false, customerSafety: false }
  const g1 = grade(p1Input, actor(pm, 'P-001'))
  const g2 = grade(p2Input, actor(pm, 'P-002'))
  const g3 = grade(p3Input, actor(pm, 'P-003'))
  return [
    {
      ...base,
      id: 'P-001',
      code: 'PRJ-2026-018',
      name: 'E15 车身域控制器开发',
      level: g1.level,
      grading: { input: p1Input, result: g1 },
      end: '2027-06-30',
      budget: 1280,
      spent: 812.6,
      strategic: 5,
      financial: 4,
      technology: 5,
      health: '黄',
      resourceRatio: 1.14,
      planFrozen: true
    },
    {
      ...base,
      id: 'P-002',
      code: 'PRJ-2026-023',
      name: 'B30 智能座舱域控平台',
      customer: '奇瑞汽车',
      platform: 'B 平台',
      level: g2.level,
      grading: { input: p2Input, result: g2 },
      start: '2026-05-11',
      end: '2027-03-31',
      budget: 760,
      spent: 386.2,
      strategic: 4,
      financial: 4,
      technology: 4,
      health: '绿',
      resourceRatio: 0.94,
      planFrozen: true
    },
    {
      ...base,
      id: 'P-003',
      code: 'PRJ-2026-031',
      name: 'C11 电池管理线束改型',
      customer: '宁德时代',
      productLine: '高压电气',
      platform: 'C 平台',
      level: g3.level,
      grading: { input: p3Input, result: g3 },
      start: '2026-07-06',
      end: '2027-01-29',
      budget: 260,
      spent: 158.4,
      strategic: 2,
      financial: 3,
      technology: 2,
      health: '红',
      resourceRatio: 1.02,
      planFrozen: false
    },
    // —— 子租户项目（TEN-002/TEN-004 隔离验证样本，不参与主租户派生统计）——
    {
      ...base,
      id: 'P-004',
      code: 'PRJ-2026-045',
      name: 'D20 智驾域控平台（子租户 T-1002）',
      customer: '理想汽车',
      productLine: '智驾域控',
      platform: 'D 平台',
      owner: '许国栋',
      level: g1.level,
      grading: { input: p1Input, result: g1 },
      start: '2026-04-13',
      end: '2027-08-31',
      budget: 1500,
      spent: 620,
      strategic: 5,
      financial: 4,
      technology: 5,
      health: '黄',
      resourceRatio: 1.08,
      planFrozen: true,
      tenantId: 'T-1002'
    },
    {
      ...base,
      id: 'P-005',
      code: 'PRJ-2026-052',
      name: 'E30 高压集成电驱（子租户 T-1003）',
      customer: '比亚迪',
      productLine: '高压电驱',
      platform: 'E 平台',
      owner: '沈雅',
      level: g2.level,
      grading: { input: p2Input, result: g2 },
      start: '2026-06-01',
      end: '2027-05-31',
      budget: 980,
      spent: 310,
      strategic: 4,
      financial: 3,
      technology: 4,
      health: '绿',
      resourceRatio: 0.9,
      planFrozen: true,
      tenantId: 'T-1003'
    }
  ]
}

/** WBS：32 节点，含 1 条硬件主关键路径 + 1 条软件并行链 */
function buildWbs(): WbsNode[] {
  type Def = [string, string, string, string | undefined, number, string[], number, number, Partial<WbsNode>?]
  const defs: Def[] = [
    ['w01', '1', '项目管理', undefined, 0, [], 0, 0, { level: 1 }],
    ['w02', '1.1', '项目启动与策划', 'w01', 10, [], 3, 100, { resource: '项目管理', cost: 18, actualStart: 0, actualFinish: 10 }],
    ['w03', '1.2', '周报、评审与变更控制', 'w01', 60, ['w02:SS:5'], 2, 62, { resource: '项目管理', cost: 24 }],
    ['w04', '2', '需求与系统方案', undefined, 0, [], 0, 0, { level: 1 }],
    ['w05', '2.1', '需求条目化（SG/FSR/TSR）', 'w04', 15, ['w02:FS:0'], 5, 100, { resource: '系统工程师', cost: 42, actualStart: 10, actualFinish: 26 }],
    ['w06', '2.2', '系统架构与接口设计', 'w04', 12, ['w05:FS:0'], 6, 88, { resource: '系统工程师', cost: 56 }],
    ['w07', '2.3', 'HARA/TARA 安全分析', 'w04', 10, ['w05:FS:0'], 3, 100, { resource: '功能安全经理', cost: 22 }],
    ['w08', '3', '硬件开发', undefined, 0, [], 0, 0, { level: 1 }],
    ['w09', '3.1', '原理图设计', 'w08', 15, ['w06:FS:0'], 7, 100, { resource: '硬件工程师', cost: 74 }],
    ['w10', '3.2', 'PCB Layout 与仿真', 'w08', 12, ['w09:FS:0'], 6, 100, { resource: '硬件工程师', cost: 58, constraint: 'HARD' }],
    ['w11', '3.3', '硬件调试与 EMC 预测试', 'w08', 10, ['w10:FS:0'], 5, 76, { resource: '硬件工程师', cost: 36 }],
    ['w12', '4', '软件开发', undefined, 0, [], 0, 0, { level: 1 }],
    ['w13', '4.1', 'BSW 配置与驱动移植', 'w12', 15, ['w06:FS:0'], 6, 100, { resource: '软件工程师', cost: 48 }],
    ['w14', '4.2', '应用层功能开发', 'w12', 25, ['w13:FS:0'], 7, 82, { resource: '软件工程师', cost: 108 }],
    ['w15', '4.3', '软件集成与 HIL 测试', 'w12', 12, ['w14:FS:0'], 5, 45, { resource: '测试工程师', cost: 40 }],
    ['w16', '4.4', '功能安全机制验证', 'w12', 10, ['w15:FS:0', 'w07:FF:2'], 3, 20, { resource: '功能安全经理', cost: 26 }],
    ['w17', '5', '样件与试验', undefined, 0, [], 0, 0, { level: 1 }],
    ['w18', '5.1', '长周期件采购', 'w17', 25, ['w10:FS:0'], 4, 90, { resource: '采购', cost: 96, constraint: 'SOFT' }],
    ['w19', '5.2', 'A 样件试制', 'w17', 14, ['w11:FS:0', 'w18:FS:0'], 6, 100, { resource: '试制负责人', cost: 62 }],
    ['w20', '5.3', 'A 样件检验与问题闭环', 'w17', 8, ['w19:FS:0'], 3, 100, { resource: '质量工程师', cost: 18 }],
    ['w21', '5.4', 'B 样件试制（含工装）', 'w17', 14, ['w20:FS:0', 'w15:FS:0'], 5, 55, { resource: '试制负责人', cost: 68 }],
    ['w22', '5.5', 'DV/PV 试验与整改', 'w17', 22, ['w21:FS:0'], 6, 12, { resource: '测试工程师', cost: 84 }],
    ['w23', '5.6', 'OTS 样件认可', 'w17', 12, ['w22:FS:0'], 4, 0, { resource: '质量工程师', cost: 32, isMilestone: true, gate: 'G4' }],
    ['w24', '6', '交付与结项', undefined, 0, [], 0, 0, { level: 1 }],
    ['w25', '6.1', '交付物整理与文件会签', 'w24', 8, ['w23:FS:0'], 3, 0, { resource: '配置管理员', cost: 16 }],
    ['w26', '6.2', '客户签收与结项复盘', 'w24', 5, ['w25:FS:0'], 2, 0, { resource: '项目管理', cost: 10, isMilestone: true, gate: 'G5' }],
    ['w27', '3.4', '供应商定点与 PPAP', 'w08', 18, ['w10:SS:3'], 2, 64, { resource: '采购', cost: 20, calendar: '供应商日历' }],
    ['w28', '4.5', '软件刷写与产线标定', 'w12', 6, [], 2, 0, { resource: '工艺工程师', cost: 14 }],
    ['w29', '2.4', '追溯矩阵与覆盖率核查', 'w04', 5, ['w05:FS:0'], 1, 100, { resource: '系统工程师', cost: 8 }],
    ['w30', '5.7', '试验台架排期', 'w17', 6, ['w22:SS:6'], 1, 30, { resource: '测试工程师', cost: 12 }],
    ['w31', '6.3', '量产移交与培训', 'w24', 7, ['w26:FS:0'], 1, 0, { resource: '工艺工程师', cost: 9 }],
    ['w32', '1.3', '项目风险管理', 'w01', 40, ['w02:SS:2'], 2, 70, { resource: '项目管理', cost: 15 }]
  ]
  return defs.map(([id, code, name, parentId, duration, deps, weight, percent, extra]) => ({
    id,
    projectId: 'P-001',
    code,
    name,
    parentId,
    level: (extra?.level as number) || (code.split('.').length === 1 ? 1 : 2),
    deliverable: extra?.isMilestone ? `${name}放行单` : `${name}输出物`,
    ownerRole: (extra?.resource as string) || '项目管理',
    duration,
    planStart: 0,
    planFinish: duration,
    percent,
    weight,
    deps: deps.map((d) => {
      const [predId, type, lag] = d.split(':')
      return { predId, type: type as 'FS' | 'SS' | 'FF' | 'SF', lag: Number(lag || 0) }
    }),
    ...extra
  }))
}

/** 需求：25 条，覆盖 SG→FSR→TSR/HSR/SSSR/SEC→TC→VER */
function buildRequirements(): { reqs: Requirement[]; links: TraceLink[] } {
  const r = (
    id: string,
    code: string,
    type: Requirement['type'],
    title: string,
    asil: Requirement['asil'],
    parentId?: string,
    baselineId?: string,
    version = 1
  ): Requirement => ({
    id,
    code,
    projectId: 'P-001',
    type,
    title,
    asil,
    cal: 2,
    status: baselineId ? '已基线化' : '已批准',
    version,
    parentId,
    baselineId,
    owner: '吴敏',
    verifyMethod: type === 'TC' ? '测试用例' : type === 'VER' ? '版本验证' : '评审+分析',
    createdAt: '2026-03-20'
  })
  const reqs: Requirement[] = [
    r('R01', 'SG-001', 'SG', '避免转向助力在行驶中非预期失效（ASIL B）', 'B', undefined, 'BL-01'),
    r('R02', 'SG-002', 'SG', '避免制动灯误点亮导致后车误判', 'A', undefined, 'BL-01', 2),
    r('R03', 'FSR-001', 'FSR', '系统应在助力扭矩偏差 >15% 时 100ms 内进入降级模式', 'B', 'R01', 'BL-01'),
    r('R04', 'FSR-002', 'FSR', '系统应检测电机位置传感器双路信号一致性', 'B', 'R01', 'BL-01'),
    r('R05', 'FSR-003', 'FSR', '系统应在通信丢失 3 个周期内点亮故障灯', 'A', 'R01', 'BL-01'),
    r('R06', 'FSR-004', 'FSR', '制动灯驱动应具备开路与短路诊断', 'A', 'R02', 'BL-01'),
    r('R07', 'FSR-005', 'FSR', '制动灯输出应支持 PWM 调光与过温保护', 'A', 'R02', 'BL-01'),
    r('R08', 'TSR-001', 'TSR', 'MCU 以 10ms 周期采集双路旋变信号并做交叉校验', 'B', 'R04', 'BL-01'),
    r('R09', 'TSR-002', 'TSR', '扭矩偏差超限时关闭 PWM 输出并置安全状态', 'B', 'R03', 'BL-01'),
    r('R10', 'TSR-003', 'TSR', 'CAN 报文丢失计数器超阈值触发 DTC U0101', 'A', 'R05', 'BL-01'),
    r('R11', 'TSR-004', 'TSR', '看门狗窗口异常时复位并记录复位原因', 'B', 'R03', 'BL-01'),
    r('R12', 'TSR-005', 'TSR', '制动灯驱动开路时 20ms 内关断并报 DTC', 'A', 'R06', 'BL-02'),
    r('R13', 'TSR-006', 'TSR', 'PWM 调光频率配置为 200Hz±5%', 'QM', 'R07', 'BL-02'),
    r('R14', 'HSR-001', 'HSR', '双路传感器供电独立，任一路失效不影响另一路', 'B', 'R04', 'BL-01'),
    r('R15', 'HSR-002', 'HSR', '功率级 MOSFET 结温监测精度 ±5℃', 'A', undefined, 'BL-02'),
    r('R16', 'SSSR-001', 'SSSR', '软件安全机制与硬件诊断共用故障管理器', 'B', 'R03', 'BL-01'),
    r('R17', 'SEC-001', 'SEC', '诊断服务 0x27 安全访问采用 SM4 加密种子', 'QM', undefined, 'BL-02'),
    r('R18', 'SEC-002', 'SEC', '刷写包须签名校验，禁止未签名固件启动', 'QM', undefined, 'BL-02'),
    r('R19', 'SEC-003', 'SEC', '调试口量产后默认关闭', 'QM', undefined, 'BL-02'),
    r('R20', 'TC-001', 'TC', '旋变信号交叉校验用例（含单路失效注入）', 'B', 'R08', 'BL-01'),
    r('R21', 'TC-002', 'TC', '扭矩偏差降级模式用例', 'B', 'R09', 'BL-01'),
    r('R22', 'TC-003', 'TC', 'CAN 丢失 DTC 用例', 'A', 'R10', 'BL-01'),
    r('R23', 'TC-004', 'TC', '看门狗复位用例', 'B', 'R11', 'BL-01'),
    r('R24', 'TC-005', 'TC', '安全访问与刷写签名用例', 'QM', 'R17', 'BL-02'),
    r('R25', 'TC-006', 'TC', '开路诊断用例', 'A', 'R12', 'BL-02'),
    r('R26', 'VER-001', 'VER', 'SW 1.4.2 版本验证记录', 'B', 'R20', 'BL-01'),
    r('R27', 'VER-002', 'VER', 'SW 1.4.2 安全机制验证记录', 'B', 'R21', 'BL-01'),
    r('R28', 'VER-003', 'VER', 'SW 1.5.0 诊断验证记录', 'QM', 'R24', 'BL-02'),
    r('R29', 'VER-004', 'VER', 'SW 1.5.0 开路诊断验证记录', 'A', 'R25', 'BL-02')
  ]
  const L = (src: string, dst: string, baselineId?: string, linkType: TraceLink['linkType'] = 'derive'): TraceLink => ({
    id: `L-${src}-${dst}`,
    srcType: 'REQ',
    srcId: src,
    dstType: 'REQ',
    dstId: dst,
    linkType,
    baselineId,
    status: 1
  })
  const links: TraceLink[] = [
    L('R01', 'R03', 'BL-01'), L('R01', 'R04', 'BL-01'), L('R01', 'R05', 'BL-01'),
    L('R02', 'R06', 'BL-01'), L('R02', 'R07', 'BL-01'),
    L('R04', 'R08', 'BL-01'), L('R03', 'R09', 'BL-01'), L('R05', 'R10', 'BL-01'), L('R03', 'R11', 'BL-01'),
    L('R06', 'R12', 'BL-01'), L('R07', 'R13', 'BL-02'),
    L('R04', 'R14', 'BL-01'), L('R03', 'R16', 'BL-01'),
    L('R08', 'R20', 'BL-01'), L('R09', 'R21', 'BL-01'), L('R10', 'R22', 'BL-01'), L('R11', 'R23', 'BL-01'),
    L('R17', 'R24', 'BL-02'), L('R12', 'R25', 'BL-02'),
    L('R20', 'R26', 'BL-01', 'verify'), L('R21', 'R27', 'BL-01', 'verify'),
    L('R24', 'R28', 'BL-02', 'verify'), L('R25', 'R29', 'BL-02', 'verify'),
    // 断链样本：R12(TSR-005) 属 BL-02，但其关系挂 BL-01 → 跨基线漂移
    L('R06', 'R12', 'BL-01'),
    // 未建立：R13(TSR-006) 无下游 → 缺失下游；R15(HSR-002) 无上游 → 孤儿需求；SEC-001/002/003 无下游
  ]
  return { reqs, links }
}

function buildSuppliers(): Supplier[] {
  return [
    { id: 'S1', code: 'SUP-0081', name: '华阳精工电子', type: '关键件', qualified: true, qualifyExpire: '2027-06-30', nominated: true, ppapStatus: '已批准', ppapElements: 18, riskLevel: '低', sqe: '李文杰' },
    { id: 'S2', code: 'SUP-0142', name: '联创汽车电子', type: '关键件', qualified: true, qualifyExpire: '2026-08-31', nominated: true, ppapStatus: '已批准', ppapElements: 18, riskLevel: '中', sqe: '李文杰' },
    { id: 'S3', code: 'SUP-0233', name: '长鹰合金材料', type: '一般件', qualified: true, qualifyExpire: '2027-01-31', nominated: false, ppapStatus: '审核中', ppapElements: 13, riskLevel: '中', sqe: '沈雅' },
    { id: 'S4', code: 'SUP-0310', name: '金泰线束制造', type: '一般件', qualified: false, qualifyExpire: '—', nominated: false, ppapStatus: '未提交', ppapElements: 0, riskLevel: '高', sqe: '沈雅' }
  ]
}

function buildBom(): BomNode[] {
  const b = (id: string, code: string, name: string, parent: string | undefined, qty: number, stock: number, incoming: number, supplier?: string): BomNode => ({
    id, projectId: 'P-001', materialCode: code, name, parentMaterialCode: parent, qty, version: 'V1.2', frozen: true, supplierCode: supplier, stock, incoming
  })
  return [
    b('b1', 'M-1000', '车身域控制器总成', undefined, 1, 0, 12),
    b('b2', 'M-1100', 'PCBA 主板', 'M-1000', 1, 4, 20, 'SUP-0081'),
    b('b3', 'M-1110', 'MCU 主控芯片', 'M-1100', 1, 30, 60, 'SUP-0142'),
    b('b4', 'M-1120', '双路旋变解码芯片', 'M-1100', 2, 18, 40, 'SUP-0142'),
    b('b5', 'M-1130', '功率 MOSFET', 'M-1100', 6, 120, 200, 'SUP-0081'),
    b('b6', 'M-1200', '铝合金壳体', 'M-1000', 1, 9, 15, 'SUP-0233'),
    b('b7', 'M-1300', '连接器组件', 'M-1000', 2, 12, 8, 'SUP-0310'),
    b('b8', 'M-1400', '导热硅胶垫', 'M-1000', 2, 40, 100)
  ]
}

export function buildSeed() {
  const users = buildUsers()
  const projects = buildProjects(users)
  const wbs = buildWbs()
  const { reqs, links } = buildRequirements()
  const suppliers = buildSuppliers()
  const boms = buildBom()

  const risks: RiskItem[] = [
    { id: 'RK1', projectId: 'P-001', code: 'RSK-018', title: '双路旋变信号共因失效', failureMode: '两路信号同时受同一干扰源影响', cause: '走线并行走同一屏蔽层', consequence: '助力误判，ASIL B 不可接受', trigger: 'EMC 辐射抗扰度试验 200V/m', severity: 7, occurrence: 6, detection: 6, strategy: '改分层走线 + 增加独立滤波，DV 阶段验证', owner: '赵启明', status: '缓解中' },
    { id: 'RK2', projectId: 'P-001', code: 'RSK-021', title: '长周期 MCU 交期延长至 32 周', failureMode: '关键芯片断供', cause: '晶圆产能紧张', consequence: 'B 样件延期 6 周，Gate4 推迟', trigger: '供应商月度交付承诺 <80%', severity: 6, occurrence: 6, detection: 6, strategy: '', owner: '郑昊', status: '开放' },
    { id: 'RK3', projectId: 'P-001', code: 'RSK-024', title: 'OTS 试验台架排期冲突', failureMode: 'DV 试验排队超期', cause: '集团台架资源集中于另一项目', consequence: '试验延期 2 周', trigger: '台架排期表冲突', severity: 5, occurrence: 4, detection: 5, strategy: '提前锁定台架并签内部协议', owner: '冯磊', status: '缓解中' },
    { id: 'RK4', projectId: 'P-001', code: 'RSK-027', title: '刷写签名验签耗时超限', failureMode: '产线刷写节拍不达标', cause: 'SM2 验签算法未优化', consequence: '产线节拍 45s→62s', trigger: '试生产节拍实测', severity: 4, occurrence: 3, detection: 5, strategy: '验签结果缓存 + 并行处理', owner: '顾晨', status: '开放' },
    { id: 'RK5', projectId: 'P-001', code: 'RSK-011', title: '供应商 PPAP 资料延误', failureMode: 'PPAP 未按期提交', cause: '供应商新产线爬坡', consequence: '量产放行推迟', trigger: 'PPAP 里程碑逾期', severity: 3, occurrence: 2, detection: 5, strategy: '驻厂跟催 + 每周例会', owner: '沈雅', status: '已关闭', residual: 30, signatures: ['质量工程师 沈雅'] }
  ]

  const ecrs: EcrItem[] = [
    {
      id: 'E1', projectId: 'P-001', code: 'ECR-2026-0042', title: '旋变解码芯片由 A 型替换为 B 型（降本 8%）', sourceObjType: '需求', sourceObjId: 'R04',
      stage: 'ECN验证', highRisk: true,
      impacts: [
        { dim: '软件', assessed: true, note: '驱动配置字需调整，BSW 改动 3 处' },
        { dim: '硬件', assessed: true, note: '封装兼容，需改钢网开孔' },
        { dim: '安全', assessed: true, note: '安全机制不变，需重新做 FMEDA 局部更新' },
        { dim: '供应链', assessed: true, note: '新供应商需 PPAP 二级提交' }
      ],
      closure: [
        { objType: '需求', objId: 'R04', objCode: 'FSR-002', decision: '修改', note: '更新为 B 型电气特性' },
        { objType: '需求', objId: 'R08', objCode: 'TSR-001', decision: '修改', note: '采样时序调整' },
        { objType: '需求', objId: 'R14', objCode: 'HSR-001', decision: '确认无影响', note: '供电架构不变' },
        { objType: '需求', objId: 'R20', objCode: 'TC-001', decision: '', note: '' },
        { objType: '需求', objId: 'R26', objCode: 'VER-001', decision: '', note: '' }
      ]
    },
    {
      id: 'E2', projectId: 'P-001', code: 'ECR-2026-0035', title: '制动灯 PWM 频率由 100Hz 调整为 200Hz', sourceObjType: '需求', sourceObjId: 'R07',
      stage: '已关闭', highRisk: false,
      impacts: [
        { dim: '软件', assessed: true, note: 'PWM 初始化参数调整' },
        { dim: '硬件', assessed: true, note: '无影响' },
        { dim: '安全', assessed: true, note: '无影响' },
        { dim: '供应链', assessed: true, note: '无影响' }
      ],
      closure: [
        { objType: '需求', objId: 'R07', objCode: 'FSR-005', decision: '修改', note: '频率参数更新' },
        { objType: '需求', objId: 'R13', objCode: 'TSR-006', decision: '修改', note: '配置值更新' }
      ],
      ecnVerification: { verified: true, note: 'DV 试验台架验证通过' }
    }
  ]

  // 文档领域层字段补齐：comments/versionChain/effectiveFlag/hash（DOC-001~007）
  function normalizeDoc(d: Omit<DocItem, 'comments' | 'versionChain' | 'effectiveFlag' | 'hash'>): DocItem {
    const published = d.status === '已发布'
    const hash = published ? hashOf({ code: d.code, version: d.version, name: d.name }) : undefined
    return {
      ...d,
      comments: [],
      versionChain: [
        {
          version: d.version,
          status: published ? '有效' : '草稿',
          hash,
          author: d.discipline + '工程师',
          remark: '初始版本'
        }
      ],
      effectiveFlag: published,
      hash
    }
  }

  const deliverables: Deliverable[] = [
    { id: 'D1', projectId: 'P-001', code: 'DEL-001', name: '系统需求规格书', category: '文档', required: true, provided: true, gate: 'G3' },
    { id: 'D2', projectId: 'P-001', code: 'DEL-002', name: '系统架构设计说明', category: '文档', required: true, provided: true, gate: 'G3' },
    { id: 'D3', projectId: 'P-001', code: 'DEL-003', name: '硬件原理图与 PCB', category: '图纸', required: true, provided: true, gate: 'G3' },
    { id: 'D4', projectId: 'P-001', code: 'DEL-004', name: '安全分析报告（HARA/TARA/FMEDA）', category: '文档', required: true, provided: false, gate: 'G3' },
    { id: 'D5', projectId: 'P-001', code: 'DEL-005', name: '软件发布包与版本说明', category: '软件', required: true, provided: true, gate: 'G3' },
    { id: 'D6', projectId: 'P-001', code: 'DEL-006', name: 'DV/PV 试验报告', category: '报告', required: true, provided: false, gate: 'G4' },
    { id: 'D7', projectId: 'P-001', code: 'DEL-007', name: 'OTS 样件认可报告', category: '报告', required: true, provided: false, gate: 'G4' },
    { id: 'D8', projectId: 'P-001', code: 'DEL-008', name: 'PPAP 文件包', category: '文档', required: true, provided: true, gate: 'G4' },
    { id: 'D9', projectId: 'P-001', code: 'DEL-009', name: '追溯矩阵（SG↔TC）', category: '文档', required: true, provided: true, gate: 'G3' },
    { id: 'D10', projectId: 'P-001', code: 'DEL-010', name: '交付清单与签收单', category: '文档', required: true, provided: false, gate: 'G5' },
    { id: 'D11', projectId: 'P-001', code: 'DEL-011', name: 'DFMEA 经验库条目', category: '知识', required: false, provided: false, gate: 'G5' }
  ]

  const docs: DocItem[] = ([
    { id: 'DC1', projectId: 'P-001', code: 'DOC-SYS-001', name: '系统需求规格书', discipline: '系统', version: 'V1.4', status: '已发布', required: true, signoffs: [{ role: '系统工程师', signed: true }, { role: '功能安全经理', signed: true }, { role: '质量工程师', signed: true }], mdrSet: 'MDR-A' },
    { id: 'DC2', projectId: 'P-001', code: 'DOC-HW-011', name: '硬件原理图', discipline: '硬件', version: 'V2.1', status: '已发布', required: true, signoffs: [{ role: '硬件工程师', signed: true }, { role: '工艺工程师', signed: true }], mdrSet: 'TDR-HW' },
    { id: 'DC3', projectId: 'P-001', code: 'DOC-SW-024', name: '软件架构与详细设计', discipline: '软件', version: 'V1.6', status: '会签中', required: true, signoffs: [{ role: '软件工程师', signed: true }, { role: '测试负责人', signed: false }, { role: '功能安全经理', signed: false }], mdrSet: 'TDR-SW' },
    { id: 'DC4', projectId: 'P-001', code: 'DOC-SAF-004', name: '功能安全计划与安全案例', discipline: '安全', version: 'V1.1', status: '会签中', required: true, signoffs: [{ role: '功能安全经理', signed: true }, { role: '信息安全经理', signed: false }], mdrSet: 'MDR-SAF' },
    { id: 'DC5', projectId: 'P-001', code: 'DOC-QUA-013', name: '控制计划 CP', discipline: '质量', version: 'V1.0', status: '已发布', required: true, signoffs: [{ role: '质量工程师', signed: true }, { role: '工艺工程师', signed: true }], mdrSet: 'TDR-QA' },
    { id: 'DC6', projectId: 'P-001', code: 'DOC-MFG-007', name: '试制工艺卡', discipline: '工艺', version: 'V0.9', status: '草稿', required: true, signoffs: [{ role: '工艺工程师', signed: false }], mdrSet: 'TDR-MFG' },
    { id: 'DC7', projectId: 'P-001', code: 'DOC-SW-031', name: '刷写与标定指导书', discipline: '软件', version: 'V1.2', status: '会签中', required: false, signoffs: [{ role: '软件工程师', signed: true }, { role: '工艺工程师', signed: false }], mdrSet: 'TDR-SW' },
    { id: 'DC8', projectId: 'P-001', code: 'DOC-SUP-002', name: '供应商 PPAP 提交包', discipline: '供应链', version: 'V1.0', status: '已发布', required: true, signoffs: [{ role: 'SQE', signed: true }], mdrSet: 'MDR-SUP' }
  ] as Omit<DocItem, 'comments' | 'versionChain' | 'effectiveFlag' | 'hash'>[]).map((d) => normalizeDoc(d))

  const samples: SampleReq[] = [
    { id: 'SM1', projectId: 'P-001', code: 'SMP-A-01', type: 'A', qty: 12, needDate: '2026-08-14', gate: 'G3', status: '已交付', ebomVersion: 'V1.2' },
    { id: 'SM2', projectId: 'P-001', code: 'SMP-B-01', type: 'B', qty: 24, needDate: '2026-11-27', gate: 'G4', status: '试制中', ebomVersion: 'V1.2' },
    { id: 'SM3', projectId: 'P-001', code: 'SMP-OTS-01', type: 'OTS', qty: 30, needDate: '2027-02-26', gate: 'G4', status: '计划中', ebomVersion: 'V1.3' }
  ]

  const hours: HourRecord[] = [
    { id: 'H1', projectId: 'P-001', userId: 'U003', userName: '周立群', week: '2026-W43', taskId: 'w09', hours: 38, status: '已审核' },
    { id: 'H2', projectId: 'P-001', userId: 'U003', userName: '周立群', week: '2026-W43', taskId: 'w10', hours: 12, status: '已提交' },
    { id: 'H3', projectId: 'P-001', userId: 'U004', userName: '吴敏', week: '2026-W43', taskId: 'w05', hours: 40, status: '已审核' },
    { id: 'H4', projectId: 'P-001', userId: 'U005', userName: '赵启明', week: '2026-W43', taskId: 'w07', hours: 32, status: '已审核' },
    { id: 'H5', projectId: 'P-001', userId: 'U011', userName: '冯磊', week: '2026-W43', taskId: 'w22', hours: 45, status: '草稿' },
    { id: 'H6', projectId: 'P-001', userId: 'U014', userName: '马强', week: '2026-W43', taskId: 'w19', hours: 36, status: '已审核' },
    { id: 'H7', projectId: 'P-001', userId: 'U012', userName: '何晓东', week: '2026-W42', taskId: 'w14', hours: 44, status: '已审核' },
    { id: 'H8', projectId: 'P-001', userId: 'U012', userName: '何晓东', week: '2026-W43', taskId: 'w15', hours: 13, status: '已提交' }
  ]

  const baselines: Baseline[] = [
    buildBaseline({
      id: 'BL-01',
      projectId: 'P-001',
      no: 'BL-REQ-2026-003',
      type: '需求基线',
      frozenBy: '王琳（配置管理员）',
      frozenAt: '2026-09-18T16:20:00+08:00',
      items: reqs
        .filter((x) => x.baselineId === 'BL-01')
        .map((x) => ({ objType: '需求', objId: x.id, objVersion: x.version, snapshot: { code: x.code, title: x.title, asil: x.asil, status: x.status } }))
    }),
    buildBaseline({
      id: 'BL-02',
      projectId: 'P-001',
      no: 'BL-DES-2026-004',
      type: '设计基线',
      items: reqs
        .filter((x) => x.baselineId === 'BL-02')
        .map((x) => ({ objType: '需求', objId: x.id, objVersion: x.version, snapshot: { code: x.code, title: x.title, asil: x.asil, status: x.status } }))
    })
  ]

  const audit: AuditRow[] = []
  const sys = users[0]
  const pm = users.find((u) => u.roleCode === 'PM')!
  const cm = users.find((u) => u.roleCode === 'CM')!
  const fsm = users.find((u) => u.roleCode === 'FSM')!
  const acts: { u: SeedUser; a: string; t: string; id: string; note: string }[] = [
    { u: pm, a: 'CREATE', t: '项目', id: 'P-001', note: '立项申请提交' },
    { u: pm, a: 'SUBMIT', t: '项目', id: 'P-001', note: '分级判定提交（L1，命中第 1 行）' },
    { u: sys, a: 'APPROVE', t: '项目', id: 'P-001', note: '立项审批通过' },
    { u: cm, a: 'FREEZE', t: '基线', id: 'BL-01', note: '需求基线冻结，manifest=3f9a…' },
    { u: fsm, a: 'APPROVE', t: '安全评审', id: 'SR-001', note: '安全评审独立签署' },
    { u: pm, a: 'UPDATE', t: 'WBS', id: 'w14', note: '应用层开发完成率 82%' },
    { u: cm, a: 'EXPORT', t: '证据包', id: 'EV-0031', note: '导出 Gate3 证据包（水印）' },
    { u: sys, a: 'UPDATE', t: '规则', id: 'RULE-2026Q4', note: '控制点阈值灰度发布' },
    { u: pm, a: 'SUBMIT', t: 'ECR', id: 'ECR-2026-0042', note: '变更影响评估提交' },
    { u: fsm, a: 'APPROVE', t: 'ECR', id: 'ECR-2026-0042', note: '安全影响评估通过（高风险增补审批）' },
    { u: sys, a: 'DENY', t: '审计', id: 'AUDIT', note: '尝试删除审计日志被拒（SOD-06）', },
    { u: pm, a: 'RELEASE', t: 'Gate', id: 'G3', note: 'Gate3 有条件放行，附整改期限' }
  ]
  for (let i = 0; i < 40; i++) {
    const a = acts[i % acts.length]
    appendAudit(audit, { ...actor(a.u, 'P-001'), at: `2026-10-${String(1 + Math.floor(i / 2)).padStart(2, '0')}T${String(9 + (i % 8)).padStart(2, '0')}:15:00+08:00` }, {
      action: a.a,
      objType: a.t,
      objId: a.id,
      after: { note: a.note, seq: i + 1 },
      result: a.a === 'DENY' ? 'DENY' : 'OK'
    })
  }

  // —— C-34 阶段复盘 / C-35 经验库 / C-46 纠偏（业务实体，控制点同源判定）——
  const retros: RetroItem[] = [
    { id: 'RT1', projectId: 'P-001', stage: 'P3 方案与计划', goalMet: '方案冻结按期达成', deviationReason: '硬件选型评审延期 1 周', improvement: '提前 1 周锁定关键器件供应商' },
    { id: 'RT2', projectId: 'P-001', stage: 'P4 研发过程', goalMet: 'DV 试验完成', deviationReason: '', improvement: '' }
  ]

  const lessons: LessonItem[] = [
    { id: 'LS1', projectId: 'P-001', code: 'LESS-001', title: '旋变信号共因失效规避', content: '双路信号避免同屏蔽层并行走线，改分层走线+独立滤波', tags: ['硬件', 'EMC', 'ASIL-B'], stage: 'P4 研发过程', category: '硬件', pushedTo: [], pushLog: [], reusedBy: [], createdAt: '2026-06-12' },
    { id: 'LS2', projectId: 'P-001', code: 'LESS-002', title: 'SM2 刷写验签耗时优化', content: '验签结果缓存+并行处理，产线节拍 45s→40s', tags: ['软件', '性能'], stage: 'P5 试制验证', category: '软件', pushedTo: [], pushLog: [], reusedBy: ['P-004'], createdAt: '2026-07-08' }
  ]

  const deviations: DeviationItem[] = [
    { id: 'DV1', projectId: 'P-001', code: 'DEV-2026-01', measure: '增加 2 名工程师并行开发应用层', planUpdated: false, deviationRecomputed: false, status: '开放' }
  ]

  // —— COM 协同沟通域（会议决议 / 送审件 / 督办，替换视图内硬编码假数据）——
  const resolutions: ResolutionItem[] = [
    { id: 'RS1', projectId: 'P-001', meetingId: 'M1', code: 'RES-001', content: '旋变芯片替换 ECN 执行前须完成软件配置字回归', owner: '林静', due: '2026-11-06', status: '执行中', createdAt: '2026-10-29' },
    { id: 'RS2', projectId: 'P-001', meetingId: 'M1', code: 'RES-002', content: 'DV 试验大纲送客户确认并锁定台架排期', owner: '冯磊', due: '2026-11-02', status: '待执行', createdAt: '2026-10-29' },
    { id: 'RS3', projectId: 'P-001', meetingId: 'M3', code: 'RES-003', content: '月度例会议题：Q3 供应商绩效评分补齐', owner: '沈雅', due: '2026-10-20', status: '已闭环', evidence: '已完成 4/4 家评分', createdAt: '2026-10-15' }
  ]

  const meetings: MeetingItem[] = [
    { id: 'M1', projectId: 'P-001', code: 'MTG-001', title: 'Gate3 设计评审会', date: '2026-10-29', stage: 'P4 研发过程', gateId: 'G3', host: '陈志远', attendees: ['林静', '冯磊', '沈雅'], agenda: '旋变芯片替换影响评估与整改', minutes: '确认 ECN 执行前须完成软件配置字回归', resolutions: ['RS1', 'RS2'], status: '已召开' },
    { id: 'M2', projectId: 'P-001', code: 'MTG-002', title: '变更控制委员会（CCB）', date: '2026-10-25', stage: 'P4 研发过程', gateId: 'G3', host: '陈志远', attendees: ['林静', '许国栋'], agenda: 'ECR-2026-0042 变更评审', minutes: '批准变更，进入 ECN 执行', resolutions: [], status: '已召开' },
    { id: 'M3', projectId: 'P-001', code: 'MTG-003', title: '月度项目群例会', date: '2026-10-15', stage: 'P5 试制验证', host: '许国栋', attendees: ['林静', '沈雅', '顾晨'], agenda: 'Q3 供应商绩效与进度复盘', minutes: '补齐供应商评分', resolutions: ['RS3'], status: '已归档' }
  ]

  const sendAudits: SendAuditItem[] = [
    { id: 'SA1', projectId: 'P-001', code: 'SA-001', title: 'DV 试验大纲', version: 'V1.0', reviewerType: '客户', reviewer: '客户 SQE', sentAt: '2026-10-24', dueAt: '2026-11-02', status: '待答复', answers: [], escalated: false },
    { id: 'SA2', projectId: 'P-001', code: 'SA-002', title: '安全案例', version: 'V1.1', reviewerType: '内部', reviewer: '功能安全经理', sentAt: '2026-10-18', dueAt: '2026-10-30', status: '已答复', answers: [{ at: '2026-10-22', by: '功能安全经理', content: '4 条意见已关闭' }], escalated: false }
  ]

  const supervises: SuperviseItem[] = [
    { id: 'SV1', projectId: 'P-001', code: 'SUP-0011', title: 'OTS 台架排期冲突，须 3 日内锁定台架并签协议', owner: '冯磊', due: '2026-11-03', status: '交办', actions: [{ at: '2026-10-28', by: '许国栋', action: '交办', note: '台架冲突升级' }], escalated: true },
    { id: 'SV2', projectId: 'P-001', code: 'SUP-0012', title: '供应商 PPAP 资料延误，驻厂跟催并每周例会', owner: '沈雅', due: '2026-11-08', status: '反馈', actions: [{ at: '2026-10-29', by: '许国栋', action: '交办', note: '' }, { at: '2026-10-30', by: '沈雅', action: '反馈', note: '已驻厂' }], escalated: false },
    { id: 'SV3', projectId: 'P-001', code: 'SUP-0013', title: '刷写验签耗时优化，产线节拍恢复至 45s', owner: '顾晨', due: '2026-11-15', status: '已销项', actions: [{ at: '2026-10-20', by: '许国栋', action: '交办', note: '' }, { at: '2026-11-01', by: '顾晨', action: '反馈', note: '已完成' }, { at: '2026-11-01', by: '许国栋', action: '销项', note: '验收通过' }], escalated: false },
    { id: 'SV4', projectId: 'P-001', code: 'SUP-0014', title: '8D-007 线束端子压接不良纠正措施实施', owner: '沈雅', due: '2026-11-20', status: '交办', actions: [{ at: '2026-10-31', by: '许国栋', action: '交办', note: '' }], escalated: false }
  ]

  // —— PFM 组合与投资域（ROI 收益计划 / 决策留痕 / What-if 场景）——
  const investments: ProjectInvestment[] = [
    { id: 'IV1', projectId: 'P-001', currency: 'CNY', cashflows: [-1280, 320, 520, 620, 480], discountRateSource: '财务下发 2026Q4（8%）', createdAt: '2026-10-15' },
    { id: 'IV2', projectId: 'P-002', currency: 'CNY', cashflows: [-760, 240, 360, 380, 320], discountRateSource: '财务下发 2026Q4（8%）', createdAt: '2026-10-15' },
    { id: 'IV3', projectId: 'P-003', currency: 'CNY', cashflows: [-260, 80, 110, 90], discountRateSource: '财务下发 2026Q4（8%）', createdAt: '2026-10-15' }
  ]

  const decisions: DecisionRecord[] = [
    { id: 'DC1', code: 'DEC-001', reason: '年度预算超限 12%，须在组合层面取舍', decider: '许国栋', date: '2026-10-20', affectedProjectIds: ['P-002', 'P-003'], alternatives: 'A. 延后 P-003 开工；B. 缩减 P-002 范围', closurePlan: undefined, action: '延后', createdAt: '2026-10-20' }
  ]

  const whatIfs: WhatIfScenario[] = [
    { id: 'WF1', name: '延后 P-003 释放台架', baseProjectIds: ['P-001', 'P-002', 'P-003'], adjustments: [{ projectId: 'P-003', status: '策划中' }], createdAt: '2026-10-28', mergeStatus: '草稿' }
  ]

  // 三层日历（TEN-015）：企业 → 项目 → 资源，下层继承上层，例外日覆盖继承
  const calendars: CalendarDef[] = [
    {
      id: 'CAL-ENT', level: '企业', name: '集团标准日历', workdays: [1, 2, 3, 4, 5], hoursPerDay: 8,
      exceptions: [{ id: 'CE1', date: '2026-10-01', type: '休息日', reason: '国庆节' }, { id: 'CE2', date: '2026-10-02', type: '休息日', reason: '国庆节' }]
    },
    {
      id: 'CAL-PRJ', level: '项目', name: 'P-001 项目日历', parentId: 'CAL-ENT', workdays: [1, 2, 3, 4, 5], hoursPerDay: 8, scopeId: 'P-001',
      exceptions: [{ id: 'CE3', date: '2026-11-14', type: '工作日', reason: 'OTS 试制赶工加班' }]
    },
    {
      id: 'CAL-RES', level: '资源', name: '台架资源日历', parentId: 'CAL-PRJ', workdays: [1, 2, 3, 4, 5, 6], hoursPerDay: 10, scopeId: 'RIG-01',
      exceptions: [{ id: 'CE4', date: '2026-11-15', type: '休息日', reason: '台架保养' }]
    }
  ]

  // 治理配置（TEN-016）：分类码 / UDF / 步骤模板
  const codeDicts: CodeDict[] = [
    { id: 'CD1', domain: '项目', name: '产品线', values: ['整车控制器', '域控制器', '传感器'], version: 'V2.1' },
    { id: 'CD2', domain: '活动', name: '专业', values: ['结构', '硬件', '软件', '工艺'], version: 'V1.3' },
    { id: 'CD3', domain: '资源', name: '技能', values: ['结构设计', 'EMC', '标定', '测试'], version: 'V1.1' }
  ]
  const udfs: UdfDef[] = [
    { id: 'UD1', target: '项目', name: '客户内部编号', type: '文本', required: false, core: false },
    { id: 'UD2', target: '项目', name: '最高 ASIL 等级', type: '枚举', required: true, enumValues: ['QM', 'A', 'B', 'C', 'D'], core: true },
    { id: 'UD3', target: '活动', name: '试验台架编号', type: '文本', required: false, core: false }
  ]
  const stepTemplates: StepTemplate[] = [
    { id: 'ST1', name: 'OTS 试制装配步骤', version: 2, steps: [{ id: 'S1', name: '来料齐套核验', required: true }, { id: 'S2', name: '装配扭矩打点', required: true }, { id: 'S3', name: '外观目检', required: true }] },
    { id: 'ST2', name: '台架试验步骤', version: 1, steps: [{ id: 'S1', name: '上电自检', required: true }, { id: 'S2', name: '功能测试', required: true }] }
  ]
  const stepRuns: StepRun[] = [
    { id: 'SR1', templateId: 'ST1', activityId: 'WBS-OTS', doneStepIds: ['S1', 'S2'], templateVersion: 2 }
  ]

  // 消息与收件箱（POR-006 / POR-008）
  const messages: MessageItem[] = [
    { id: 'MSG1', userId: 'U003', eventKey: 'OTS-GATE4-READY', title: 'OTS 样件已具备 Gate4 评审条件', content: 'P-001 项目 OTS 样件完成，可发起 Gate4 准入评审', category: '决议', read: false, createdAt: '2026-11-01T08:00:00+08:00', refType: 'gate', refId: 'Gate4' },
    { id: 'MSG2', userId: 'U003', eventKey: 'SUP-0011-ESCALATE', title: '督办超期升级：台架排期冲突', content: 'SUP-0011 已超期，请 3 日内锁定台架并签协议', category: '督办', read: true, readAt: '2026-11-01T09:00:00+08:00', createdAt: '2026-10-31T18:00:00+08:00', refType: 'supervise', refId: 'SV1' }
  ]
  const inboxItems: InboxItem[] = [
    { id: 'IB1', kind: '送审件', userId: 'U003', title: 'A 样件图纸送审 v1.2', from: '结构设计 陈志远', sentAt: '2026-10-30', dueAt: '2026-11-03', status: '待处理', actions: [] },
    { id: 'IB2', kind: '联系单', userId: 'U003', title: 'RFI：旋变接口定义澄清', from: '客户 SQE 张工', sentAt: '2026-10-29', dueAt: '2026-11-02', status: '待处理', actions: [] },
    { id: 'IB3', kind: '决议', userId: 'U003', title: '线束走线修正决议', from: '会议 M-001', sentAt: '2026-10-28', dueAt: '2026-11-05', status: '已答复', actions: [{ at: '2026-10-30', by: '陈志远', action: '答复', note: '已出修正方案' }] }
  ]

  // 资源池成员（PFM-016 宿主，原 PoolView 硬编码假数据收编为受控实体）
  const resourcePool: ResourcePoolMember[] = [
    { id: 'RM1', name: '周立群', role: '项目经理', skills: ['计划', '风险', '组合'], nodeId: 'NODE-1', available: true },
    { id: 'RM2', name: '吴敏', role: '系统工程师', skills: ['需求', '追溯', '功能安全'], nodeId: 'NODE-1', available: true },
    { id: 'RM3', name: '赵启明', role: '硬件工程师', skills: ['PCB', 'EMC', '仿真'], nodeId: 'NODE-2', available: false },
    { id: 'RM4', name: '冯磊', role: '测试工程师', skills: ['DV', '台架', '标定'], nodeId: 'NODE-2', available: true },
    { id: 'RM5', name: '郑昊', role: '采购', skills: ['供应商', 'PPAP'], nodeId: 'NODE-1', available: true },
    { id: 'RM6', name: '顾晨', role: '软件工程师', skills: ['固件', '刷写', '诊断'], nodeId: 'NODE-3', available: true },
    { id: 'RM7', name: '沈雅', role: 'SQE', skills: ['质量', '8D'], nodeId: 'NODE-1', available: true },
    { id: 'RM8', name: '李文杰', role: 'SQE', skills: ['供应商', '审核'], nodeId: 'NODE-3', available: false }
  ]

  // 跨节点资源共享申请（PFM-016：未审批不得占用、到期自动释放）
  const resourceShares: ResourceShareApply[] = [
    { id: 'RS1', code: 'SHARE-2026-01', fromNodeId: 'NODE-1', toNodeId: 'NODE-2', resourceId: 'RM4', resourceName: '冯磊', startAt: '2026-11-01', expireAt: '2026-11-15', status: '待审批', createdAt: '2026-10-28' },
    { id: 'RS2', code: 'SHARE-2026-02', fromNodeId: 'NODE-1', toNodeId: 'NODE-3', resourceId: 'RM2', resourceName: '吴敏', startAt: '2026-10-25', expireAt: '2026-10-31', status: '已生效', approvedBy: '周立群', approvedAt: '2026-10-24', createdAt: '2026-10-23' }
  ]

  // 门户区块可配置（POR-003：不同角色看到不同门户）
  const portalSections: PortalSectionConfig[] = [
    { key: 'overview', title: '项目概览', visibleRoles: [], order: 1, enabled: true },
    { key: 'progress', title: '进度与里程碑', visibleRoles: [], order: 2, enabled: true },
    { key: 'risk', title: '风险与问题', visibleRoles: [], order: 3, enabled: true },
    { key: 'delivery', title: '交付件与齐套', visibleRoles: ['PM', 'SE', 'QDIR', 'TRIAL'], order: 4, enabled: true },
    { key: 'meeting', title: '会议与决议', visibleRoles: [], order: 5, enabled: true },
    { key: 'sendAudit', title: '送审件', visibleRoles: ['PM', 'SE', 'QE', 'TRIAL'], order: 6, enabled: true },
    { key: 'announce', title: '公告', visibleRoles: [], order: 7, enabled: true }
  ]

  // 我的草稿（POR-007：跨端续写）
  const drafts: FormDraft[] = [
    { id: 'DR1', userId: 'U003', objectType: '变更单', content: '{"title":"旋变信号共因失效规避","amount":"50000"}', updatedAt: '2026-11-01T07:30:00+08:00', createdAt: '2026-10-30T09:00:00+08:00' }
  ]

  const flags: Record<string, { ok: boolean; note: string }> = {
    'C-08': { ok: true, note: '缺陷逃逸率 2.1% ≤5%，2 条逃逸缺陷已回溯漏测原因' },
    'C-09': { ok: true, note: '返工 6 项全部复验，复验记录关联原始缺陷 DEF-221~226' },
    'C-18': { ok: false, note: 'ECR-2026-0042（E1）处于 ECN 验证阶段但尚未验证通过（同源判定）' },
    'C-21': { ok: true, note: 'A 样件签收完成，签收人：客户 SQE 张工' },
    'C-23': { ok: true, note: 'PM/质量/安全/SQE 四类关键角色到位率 100%' },
    'C-27': { ok: false, note: '2026Q3 供应商绩效仅完成 2/4 家评分' },
    'C-28': { ok: true, note: 'SPI/CPI 口径与指标字典 v3 一致' },
    'C-30': { ok: true, note: '等保三级测评报告 EN-2026-0187，密码应用合规' },
    'C-31': { ok: true, note: '安全评审由功能安全经理独立签署（SOD-02 满足）' },
    'C-33': { ok: true, note: '高危漏洞 0，中危 3 项已评估接受' },
    'C-34': { ok: false, note: 'P3 阶段复盘未完成（缺偏差原因与改进项）' },
    'C-35': { ok: false, note: '经验条目尚未入库打标签' },
    'C-36': { ok: true, note: '规则库 2026Q4 已发布，变更留痕 12 条' },
    'C-41': { ok: true, note: '成本口径与挣值计量规则已登记（CST-011 签署）' },
    'C-42': { ok: true, note: '管理储备动用申请与替代方案齐备，额度内审批完成' },
    'C-43': { ok: false, note: '本次组合调序未完成组合级评审' },
    'C-46': { ok: false, note: '纠偏措施已登记但未回写计划，偏差未重算' },
    'C-47': { ok: true, note: '驾驶舱三处取值同源（事务层/分析层/报表层一致）' },
    'C-48': { ok: true, note: '控制点变更回归 68 条用例全部通过' }
  }

  const schemeLinked = true
  const quoteLinked = true

  return {
    version: SEED_VERSION,
    tenantId: TENANT,
    tenant: { code: 'T-1001', name: '魔程科技（集团）', type: '集团租户', isolation: 'SHARED' },
    /** 集团—子租户两级结构（TEN-002/TEN-003）：T-1001 集团 + T-1002/T-1003 子租户 */
    tenants: [
      { code: 'T-1001', name: '魔程科技（集团）', type: '集团租户', isolation: 'SHARED' },
      { code: 'T-1002', name: '魔程智驾（子公司）', type: '子租户', isolation: 'SHARED', parentCode: 'T-1001', sharedMetrics: ['项目数', '在研项目', 'Gate 通过率'] },
      { code: 'T-1003', name: '魔程新能源（子公司）', type: '子租户', isolation: 'SCHEMA', parentCode: 'T-1001', sharedMetrics: ['项目数', '风险敞口'] }
    ],
    users,
    projects: projects.map((p) => ({ ...p, schemeLinked, quoteLinked }) as Project),
    wbs,
    reqs,
    links,
    suppliers,
    boms,
    risks,
    ecrs,
    deliverables,
    docs,
    samples,
    hours,
    baselines,
    retros,
    lessons,
    deviations,
    meetings,
    resolutions,
    sendAudits,
    supervises,
    investments,
    decisions,
    whatIfs,
    calendars,
    codeDicts,
    udfs,
    stepTemplates,
    stepRuns,
    messages,
    inboxItems,
    resourcePool,
    resourceShares,
    portalSections,
    drafts,
    audit,
    flags,
    flowDefinitions: [
      // ① 含「条件分支 + 超时升级」的 ECR 审批流程（FUN-017 验收样例：不发版生效）
      {
        id: 'DEF-ECR',
        code: 'FLOW-ECR',
        name: 'ECR 审批（高风险分支）',
        formFields: [
          { key: 'riskLevel', label: '风险等级' },
          { key: 'amount', label: '影响金额' }
        ],
        startNodeId: 'n1',
        nodes: [
          { id: 'n1', name: '提交', type: 'start' },
          { id: 'n2', name: '影响评估', type: 'approve', approverRole: '配置管理员', slaHours: 24, escalateToRole: '研发副总' },
          { id: 'n3', name: '风险判定', type: 'branch', branches: [{ field: 'riskLevel', op: 'eq', value: '高', toNodeId: 'n4' }], defaultNext: 'n5' },
          { id: 'n4', name: '技术评审（高风险）', type: 'sign', signMode: 'all', signRoles: ['结构工程师', '硬件工程师', '软件工程师', '功能安全经理'], slaHours: 48, escalateToRole: '质量总监', safety: true },
          { id: 'n5', name: '审批', type: 'approve', approverRole: '研发副总', slaHours: 24, escalateToRole: '总经理' },
          { id: 'n6', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 3
      },
      // ② Gate 放行（安全项超时即升级，无延展 GAT-008）
      {
        id: 'DEF-GATE',
        code: 'FLOW-GATE',
        name: 'Gate 放行',
        formFields: [{ key: 'gate', label: '闸门' }],
        startNodeId: 'g1',
        nodes: [
          { id: 'g1', name: '提交', type: 'start' },
          { id: 'g2', name: '技术评审', type: 'approve', approverRole: '研发副总', slaHours: 24, escalateToRole: '质量总监' },
          { id: 'g3', name: '安全评审', type: 'approve', approverRole: '功能安全经理', slaHours: 24, escalateToRole: '质量总监', safety: true },
          { id: 'g4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 2
      },
      // ③ 豁免申请（安全项不可豁免 GAT-009 在业务规则层写死）
      {
        id: 'DEF-EXEMPT',
        code: 'FLOW-EXEMPT',
        name: '豁免申请',
        formFields: [{ key: 'safety', label: '是否安全项' }],
        startNodeId: 'x1',
        nodes: [
          { id: 'x1', name: '提交', type: 'start' },
          { id: 'x2', name: '质量评审', type: 'approve', approverRole: '质量总监', slaHours: 24, escalateToRole: '总经理' },
          { id: 'x3', name: '安全评审', type: 'approve', approverRole: '功能安全经理', slaHours: 24, escalateToRole: '总经理', safety: true },
          { id: 'x4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 2
      },
      // ④ 工时审核
      {
        id: 'DEF-HOUR',
        code: 'FLOW-HOUR',
        name: '工时审核',
        formFields: [{ key: 'week', label: '周次' }],
        startNodeId: 'h1',
        nodes: [
          { id: 'h1', name: '填报', type: 'start' },
          { id: 'h2', name: '提交', type: 'approve', approverRole: '项目经理', slaHours: 48, escalateToRole: '研发副总' },
          { id: 'h3', name: '审核', type: 'approve', approverRole: '项目经理', slaHours: 48, escalateToRole: '研发副总' },
          { id: 'h4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      }
    ] as FlowDefinition[],
    flowInstances: [
      {
        id: 'F1', defId: 'DEF-GATE', defCode: 'FLOW-GATE', title: 'PRJ-2026-018 Gate3 设计闸门放行', submitter: '周立群',
        form: { gate: 'G3' }, currentNodeId: 'g2', status: '运行中', passedNodeIds: ['g1'], history: [],
        nodeEnteredAt: '2026-10-29T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-29T09:00:00+08:00'
      },
      {
        id: 'F2', defId: 'DEF-ECR', defCode: 'FLOW-ECR', title: 'ECR-2026-0042 旋变芯片替换（高风险）', submitter: '周立群',
        form: { riskLevel: '高', amount: 120000 }, currentNodeId: 'n2', status: '运行中', passedNodeIds: ['n1'], history: [],
        nodeEnteredAt: '2026-10-31T18:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-31T18:00:00+08:00'
      },
      {
        id: 'F3', defId: 'DEF-EXEMPT', defCode: 'FLOW-EXEMPT', title: 'DEL-004 安全分析报告延期提交', submitter: '吴敏',
        form: { safety: '是' }, currentNodeId: 'x2', status: '运行中', passedNodeIds: ['x1'], history: [],
        nodeEnteredAt: '2026-11-01T01:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-01T01:00:00+08:00'
      },
      {
        id: 'F4', defId: 'DEF-HOUR', defCode: 'FLOW-HOUR', title: '2026-W43 工时单审核（8 人）', submitter: '何晓东',
        form: { week: 'W43' }, currentNodeId: 'h2', status: '运行中', passedNodeIds: ['h1'], history: [],
        nodeEnteredAt: '2026-11-01T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-01T09:00:00+08:00'
      }
    ] as FlowInstance[],
    gateRuns: [
      { gate: 'G1', submittedAt: '2026-04-08T09:00:00+08:00', releasedBy: '陈志远', result: '通过' },
      { gate: 'G2', submittedAt: '2026-06-19T09:00:00+08:00', releasedBy: '陈志远', result: '通过' },
      { gate: 'G3', submittedAt: '2026-10-29T09:00:00+08:00', releasedBy: '', result: '待放行' }
    ]
  }
}

export type SeedData = ReturnType<typeof buildSeed>

/** 种子自检摘要（供 QA 与「规则体检」页展示） */
export function seedChecks(data: SeedData) {
  return {
    projects: data.projects.length,
    wbs: data.wbs.length,
    reqs: data.reqs.length,
    links: data.links.length,
    baselines: data.baselines.length,
    audit: data.audit.length,
    hash: hashOf({ v: data.version, p: data.projects.map((p) => p.code) })
  }
}
