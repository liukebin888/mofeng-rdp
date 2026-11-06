/**
 * 种子数据（首次启动写入 localStorage；可重置）
 * 对齐 SRS 附录 B 字段命名；规模：3 项目（L1/L3/L4）、32 个 WBS 节点、25 条需求、4 类断链样本
 */
import { CUSTOMER_CODES, VEHICLE_CODES } from '@/domain/productCodeData'
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
  CostDoc,
  CostSubject,
  DecisionRecord,
  Deliverable,
  DeviationItem,
  DocItem,
  EcrItem,
  HandoffPoint,
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
  ThresholdIssue,
  TraceLink,
  UdfDef,
  WbsNode,
  WhatIfScenario,
  OrgNode,
  OrgMembership,
  Customer,
  ProductCategory,
  ProductLine,
  Product,
  NamingRule,
  NamingRuleHistory,
  CodeIssue,
  CodePattern,
  NamingPattern
} from '@/domain/types'
import { ROLES } from '@/domain/rbac'
import type { FlowDefinition, FlowInstance } from '@/domain/flowEngine'
import type { ComplianceItem } from '@/domain/compliance'
import type { PolarityRisk } from '@/domain/riskOpportunity'
import type { DocAnnotation } from '@/domain/docAnnotation'
import type { AiCorpusItem, AiSwitchConfig, AiCallLog } from '@/domain/aiAssist'
import type { HumanReview } from '@/domain/projectReview'
import type { InterfacePlan } from '@/domain/interfacePlan'
import type { ProjectGateDecl } from '@/domain/gateConsistency'
import type { VulnerabilityItem, Issue8D } from '@/domain/defect'
import type { Sci, CompatibilityRecord, ReleaseSignoff } from '@/domain/softwareVersion'
import type { Space } from '@/domain/spaceEngine'
import { buildApprovalChain, DEFAULT_APPROVAL_ROLES, type ApprovalBinding } from '@/domain/approvalBinding'
import type { DeliverableApprovalBinding } from '@/domain/deliverableApproval'
import { appendRecord, manifestHashOf, type ArchiveLayer, type ArchiveVolume } from '@/domain/archiveLayer'
import { DEFAULT_REJECTION_POLICIES, type RejectionPolicyItem } from '@/domain/rejectionPolicy'
import type { QuoteCostSheet, QuoteCostLine } from '@/domain/quoteCost'
import type { DesignArchiveTable, SampleReviewReport, DvTestReport } from '@/domain/otsApproval'

export const SEED_VERSION = 'mofeng.rdp.v1.0.32'
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
  const base = ROLES.map((r, i) => ({
    id: `U${String(i + 1).padStart(3, '0')}`,
    name: names[i] || `用户${i + 1}`,
    roleCode: r.code,
    roleName: r.name,
    dept: ['项目管理部', '研发中心', '质量部', '采购部', '制造部', 'IT'][i % 6],
    account: `mofeng.${r.code.toLowerCase()}`
  }))
  // 新增 36 名工程师（U019~U054），对应 9 个事业部 × 4 个小组（硬件一组/二组、软件一组/二组）
  const engNames = [
    '韩晓峰', '罗建华', '蒋文博', '曹志强',
    '邓海涛', '梁永刚', '谢国平', '韩雪梅',
    '唐志明', '袁伟东', '崔永强', '龙海峰',
    '曾志远', '彭建国', '蔡文静', '潘晓东',
    '董丽华', '苏志强', '魏海涛', '叶国华',
    '田文博', '万晓峰', '石志明', '于海燕',
    '邵建国', '孟晓东', '秦文静', '段志强',
    '郝海涛', '侯国华', '邹晓峰', '武志明',
    '廖海燕', '龚建国', '姚晓东', '冯文静'
  ]
  const engs = engNames.map((n, i) => {
    const idx = ROLES.length + i + 1
    return {
      id: `U${String(idx).padStart(3, '0')}`,
      name: n,
      roleCode: 'SE',
      roleName: '系统工程师',
      dept: '研发中心',
      account: `mofeng.eng${String(i + 1).padStart(2, '0')}`
    }
  })
  return [...base, ...engs]
}

/**
 * 组织架构（TEN-009 六级组织：集团→公司→中心→部门→科室→小组）
 * 中心归属：电子/结构/工艺/模具/项目管理 5 中心 → 研发系统；制造/计划物流 2 中心 → 制造系统；
 * 市场/采购/质量/财务/人力资源/企业管理/总经办 → 职能系统。
 */
function buildOrgNodes(): OrgNode[] {
  const c = (id: string, name: string, system: string, order: number, leaderName?: string): OrgNode => ({
    id, name, level: 'center', parentId: 'C', system, leaderTitle: '执行总监', leaderName, order
  })
  // 9 个事业部（智能交互/控制/座舱/驾驶）各加硬件科 + 软件科，每科下硬件/软件一、二组
  const divisionDepts: string[] = ['ELEC-D1', 'ELEC-D2', 'ELEC-D3', 'ELEC-D4', 'ELEC-D5', 'ELEC-D6', 'ELEC-D7', 'ELEC-D8', 'ELEC-D9']
  const divisionNodes: OrgNode[] = []
  divisionDepts.forEach((deptId) => {
    const hwId = `${deptId}-HW`
    const swId = `${deptId}-SW`
    divisionNodes.push(
      { id: hwId, name: '硬件科', level: 'section', parentId: deptId, leaderTitle: '高级经理', order: 1 },
      { id: swId, name: '软件科', level: 'section', parentId: deptId, leaderTitle: '高级经理', order: 2 },
      { id: `${hwId}-T1`, name: '硬件一组', level: 'team', parentId: hwId, leaderTitle: '经理', order: 1 },
      { id: `${hwId}-T2`, name: '硬件二组', level: 'team', parentId: hwId, leaderTitle: '经理', order: 2 },
      { id: `${swId}-T1`, name: '软件一组', level: 'team', parentId: swId, leaderTitle: '经理', order: 1 },
      { id: `${swId}-T2`, name: '软件二组', level: 'team', parentId: swId, leaderTitle: '经理', order: 2 }
    )
  })
  return [
    { id: 'G', name: '魔程集团', level: 'group', parentId: null, leaderTitle: '总裁', leaderName: '陈志远', system: '集团', order: 1 },
    { id: 'C', name: '魔程汽车电子有限公司', level: 'company', parentId: 'G', leaderTitle: '总经理', leaderName: '林静', order: 1 },
    // 研发系统（5 中心）
    c('ELEC', '电子研发中心', '研发系统', 1, '周立群'),
    c('STRU', '结构研发中心', '研发系统', 2, '吴敏'),
    c('PROC', '工艺技术中心', '研发系统', 3, '赵启明'),
    c('MOLD', '模具中心', '研发系统', 4, '钱伟'),
    c('PMO', '项目管理中心', '研发系统', 5, '孙烨'),
    // 制造系统（2 中心）
    c('MFG', '制造中心', '制造系统', 6, '李文杰'),
    c('LOG', '计划物流中心', '制造系统', 7, '郑昊'),
    // 职能系统（7 中心）
    c('MKT', '市场中心', '职能系统', 8, '王琳'),
    c('PUR', '采购中心', '职能系统', 9, '冯磊'),
    c('QA', '质量中心', '职能系统', 10, '何晓东'),
    c('FIN', '财务中心', '职能系统', 11, '徐宁'),
    c('HR', '人力资源中心', '职能系统', 12, '马强'),
    c('ADM', '企业管理中心', '职能系统', 13, '顾晨'),
    c('EXEC', '总经办', '职能系统', 14, '沈雅'),
    // 部门（电子研发中心下属）
    { id: 'ELEC-D1', name: '智能交互一部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 1 },
    { id: 'ELEC-D2', name: '智能交互二部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 2 },
    { id: 'ELEC-D3', name: '智能交互三部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 3 },
    { id: 'ELEC-D4', name: '智能控制一部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 4 },
    { id: 'ELEC-D5', name: '智能控制二部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 5 },
    { id: 'ELEC-D6', name: '智能座舱一部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 6 },
    { id: 'ELEC-D7', name: '智能座舱二部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 7 },
    { id: 'ELEC-D8', name: '智能驾驶一部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 8 },
    { id: 'ELEC-D9', name: '智能驾驶二部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 9 },
    { id: 'ELEC-D10', name: '验证中心', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 10 },
    { id: 'ELEC-D11', name: '技术中心', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 11 },
    { id: 'ELEC-D12', name: '综合管理部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 12 },
    { id: 'ELEC-D13', name: 'AI 实验室', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 13 },
    // 事业部科室 + 小组（9 部 × 硬件科/软件科 × 硬件/软件一、二组）
    ...divisionNodes,
    // 科室（技术中心下）
    { id: 'ELEC-D11-S1', name: '标准化科', level: 'section', parentId: 'ELEC-D11', leaderTitle: '高级经理', order: 1 },
    { id: 'ELEC-D11-S2', name: '体系科', level: 'section', parentId: 'ELEC-D11', leaderTitle: '高级经理', order: 2 },
    { id: 'ELEC-D11-S3', name: '原器件科', level: 'section', parentId: 'ELEC-D11', leaderTitle: '高级经理', order: 3 },
    // 科室（综合管理部下）
    { id: 'ELEC-D12-S1', name: '项目管理科', level: 'section', parentId: 'ELEC-D12', leaderTitle: '高级经理', order: 1 },
    { id: 'ELEC-D12-S2', name: '行政管理科', level: 'section', parentId: 'ELEC-D12', leaderTitle: '高级经理', order: 2 },
    { id: 'STRU-D1', name: '结构设计部', level: 'department', parentId: 'STRU', leaderTitle: '总监', order: 1 },
    { id: 'PROC-D1', name: '工艺工程部', level: 'department', parentId: 'PROC', leaderTitle: '总监', order: 1 },
    { id: 'MKT-D1', name: '销售部', level: 'department', parentId: 'MKT', leaderTitle: '总监', order: 1 }
  ]
}

/** 人员挂靠（跨组织兼职 + 岗位序列；U-004 吴敏主职智能座舱一部 + 兼职制造中心） */
function buildOrgMemberships(users: SeedUser[]): OrgMembership[] {
  const u = (id: string) => users.find((x) => x.id === id)!
  const m = (userId: string, orgId: string, track: OrgMembership['track'], postLevel: string, primary = false): OrgMembership => ({
    userId, userName: u(userId).name, orgId, track, postLevel, primary, active: true
  })
  // 9 个事业部 × 4 个小组（硬件一组/二组、软件一组/二组）各 1 名工程师，U019~U054
  const divisionDepts: string[] = ['ELEC-D1', 'ELEC-D2', 'ELEC-D3', 'ELEC-D4', 'ELEC-D5', 'ELEC-D6', 'ELEC-D7', 'ELEC-D8', 'ELEC-D9']
  const engineerMemberships: OrgMembership[] = []
  divisionDepts.forEach((deptId, di) => {
    const base = 19 + di * 4 // U019 起
    const hwId = `${deptId}-HW`
    const swId = `${deptId}-SW`
    const uid = (o: number) => `U${String(base + o).padStart(3, '0')}`
    engineerMemberships.push(
      m(uid(0), `${hwId}-T1`, 'tech', '硬件工程师', true),
      m(uid(1), `${hwId}-T2`, 'tech', '硬件工程师', true),
      m(uid(2), `${swId}-T1`, 'software', '软件工程师', true),
      m(uid(3), `${swId}-T2`, 'software', '软件工程师', true)
    )
  })
  return [
    m('U001', 'G', 'tech-mgmt', '首席总工', true),
    m('U002', 'C', 'tech-mgmt', '总工', true),
    m('U003', 'ELEC', 'tech', '资深高级工程师', true),
    m('U004', 'ELEC-D6', 'tech', '高级工程师', true),
    m('U004', 'MFG', 'project', '项目工程师', false), // 跨组织兼职
    m('U005', 'STRU', 'tech', '工程师', true),
    m('U006', 'PROC', 'tech', '高级工程师', true),
    m('U007', 'MOLD', 'tech', '资深工程师', true),
    m('U008', 'PMO', 'project', '项目工程师', true),
    m('U009', 'QA', 'tech-mgmt', '主任工程师', true),
    m('U010', 'PUR', 'tech', '工程师', true),
    m('U011', 'MFG', 'tech', '工程师', true),
    m('U012', 'FIN', 'tech-mgmt', '主管工程师', true),
    m('U013', 'HR', 'software', '系统工程', true),
    m('U014', 'LOG', 'project', '项目助理工程师', true),
    m('U015', 'MKT', 'project', '项目管理员', true),
    m('U016', 'ADM', 'tech-mgmt', '主任工程师', true),
    m('U017', 'EXEC', 'software', '架构师', true),
    m('U018', 'ELEC-D4', 'software', '网络工程师', true),
    ...engineerMemberships
  ]
}

/** 客户（车厂）主数据：名称 + 编号 + 车型 */
function buildCustomers(): Customer[] {
  // 客户主数据与《产品型号编制办法》(CJQW0106 B1) 完全同步：
  // 客户编号取自附表1 顾客编码（全部 77 条），车型取自附表2 车型代码（按顾客编码联动）。
  // 每个客户带出其名下前 2 款车型代码作为初始示例，其余车型仍可在客户管理中从附表2 选择。
  const hostCodeOf = (host: string): string | null => {
    const m = /\(([0-9A-Z]{2})\)\s*$/.exec(host ?? '')
    return m ? m[1] : null
  }
  return CUSTOMER_CODES.map((c, i) => {
    const models = VEHICLE_CODES.filter((v) => hostCodeOf(v.host) === c.code).slice(0, 2).map((v) => v.code)
    return {
      id: `CUST-${i + 1}`,
      code: c.code,
      name: c.name,
      shortName: c.short,
      vehicleModels: models,
    }
  })
}

/** 产品三级分类：产品类别 → 产品线 → 产品 */
function buildProductCategories(): ProductCategory[] {
  return [
    { id: 'CAT-1', name: '智能交互', order: 1 },
    { id: 'CAT-2', name: '智能控制', order: 2 },
    { id: 'CAT-3', name: '智能座舱', order: 3 },
    { id: 'CAT-4', name: '智能驾驶', order: 4 },
    { id: 'CAT-5', name: '动力能源', order: 5 },
    { id: 'CAT-6', name: '底盘控制', order: 6 },
    { id: 'CAT-7', name: '车载电器', order: 7 }
  ]
}

function buildProductLines(): ProductLine[] {
  const mk = (id: string, categoryId: string, name: string, order: number, code?: string): ProductLine => ({ id, categoryId, name, code, order })
  return [
    // 智能交互
    mk('PL-1', 'CAT-1', '门窗控制', 1), mk('PL-2', 'CAT-1', '灯光控制', 2), mk('PL-3', 'CAT-1', '视野控制', 3),
    mk('PL-4', 'CAT-1', '方向盘开关', 4), mk('PL-5', 'CAT-1', '电子排档', 5), mk('PL-6', 'CAT-1', '组合开关', 6),
    mk('PL-7', 'CAT-1', '中控面板', 7), mk('PL-8', 'CAT-1', '开关组', 8), mk('PL-9', 'CAT-1', '座椅控制', 9),
    // 智能控制
    mk('PL-10', 'CAT-2', '空调控制器', 1, 'ECC'), mk('PL-11', 'CAT-2', '域控制器', 2),
    // 智能座舱
    mk('PL-12', 'CAT-3', '中控屏', 1), mk('PL-13', 'CAT-3', '仪表屏', 2), mk('PL-14', 'CAT-3', '扶手屏', 3), mk('PL-15', 'CAT-3', '吸顶屏', 4),
    mk('PL-25', 'CAT-3', 'HUD 抬头显示', 5),
    // 智能驾驶
    mk('PL-16', 'CAT-4', '智驾域控', 1), mk('PL-17', 'CAT-4', '雷达', 2), mk('PL-18', 'CAT-4', '摄像头', 3),
    mk('PL-26', 'CAT-4', '激光雷达', 4), mk('PL-27', 'CAT-4', '超声波雷达', 5),
    // 动力能源
    mk('PL-19', 'CAT-5', '高压电驱', 1), mk('PL-20', 'CAT-5', 'BMS 电池管理', 2),
    mk('PL-28', 'CAT-5', '车载充电机', 3), mk('PL-29', 'CAT-5', 'DC-DC 变换器', 4),
    // 底盘控制
    mk('PL-21', 'CAT-6', '转向控制', 1), mk('PL-22', 'CAT-6', '制动控制', 2),
    // 车载电器
    mk('PL-23', 'CAT-7', '车身控制器', 1, 'BCM'), mk('PL-24', 'CAT-7', '雨刮控制', 2),
    mk('PL-30', 'CAT-7', '网关控制器', 3)
  ]
}

function buildProducts(): Product[] {
  const mk = (id: string, lineId: string, name: string, order: number, code?: string): Product => ({ id, lineId, name, code, order })
  return [
    mk('PRD-1', 'PL-1', '左前门控制模块', 1), mk('PRD-2', 'PL-1', '右前门控制模块', 2),
    mk('PRD-3', 'PL-10', 'ECC 空调控制器', 1, 'ECC-01'), mk('PRD-4', 'PL-10', '双区自动空调', 2),
    mk('PRD-5', 'PL-12', '12.3 寸中控屏', 1), mk('PRD-6', 'PL-13', '全液晶仪表', 1),
    mk('PRD-7', 'PL-16', '智驾域控制器', 1), mk('PRD-8', 'PL-17', '前向毫米波雷达', 1),
    mk('PRD-9', 'PL-25', 'AR-HUD 抬头显示', 1), mk('PRD-10', 'PL-26', '固态激光雷达', 1),
    mk('PRD-11', 'PL-28', '车载充电机 OBC', 1, 'OBC-01'), mk('PRD-12', 'PL-23', '车身控制器', 1, 'BCM-01')
  ]
}

/** 命名与编码规则（客户/产品/文档/部门/人员 五大对象的命名规范与编码规范） */
function buildNamingRules(): NamingRule[] {
  const lit = (value: string) => ({ type: 'literal' as const, value })
  const seq = (width: number) => ({ type: 'sequence' as const, width })
  const varr = (variable: string) => ({ type: 'variable' as const, variable })
  const pat = (segments: CodePattern['segments'], separator = '-'): CodePattern => ({ segments, separator })
  const r = (
    id: string,
    object: NamingRule['object'],
    kind: NamingRule['kind'],
    name: string,
    description: string,
    example?: string,
    enabled = true,
    pattern?: CodePattern,
    namePattern?: NamingPattern
  ): NamingRule => ({ id, object, kind, name, description, example, enabled, pattern, namePattern, version: 1, updatedAt: '2026-11-01T00:00:00+08:00', updatedBy: '系统初始化' })

  return [
    // 客户
    r('NM-1', 'customer', 'naming', '客户全称规范', '客户工商注册全称，不含「有限公司」缩写以外的简称', '示例汽车制造股份有限公司', true, undefined, { minLength: 4, maxLength: 30 }),
    r('NM-2', 'customer', 'naming', '客户简称规范', '2~4 字通用简称，用于台账与报表展示', '示例客户甲 / 示例客户乙 / 示例客户丙', true, undefined, { minLength: 2, maxLength: 4 }),
    r('NM-3', 'customer', 'coding', '客户编号规则', '已统一为《产品型号编制办法》(CJQW0106 B1) 附表1 顾客编码（2 位，0A~0Z 或 AA~AT，ES 为前瞻输出），不再使用 CUST- 前缀', '0A、0U、AB', false, pat([lit('CUST'), varr('abbr')])),
    r('NM-4', 'customer', 'coding', '车型编号规则', '已统一为《产品型号编制办法》(CJQW0106 B1) 附表2 车型代码（2 位数字+大写字母，O/I/J/V 除外），不再使用 MODEL- 前缀', '0A、1A', false, pat([lit('MODEL'), seq(3)])),
    // 产品
    r('NM-5', 'product', 'naming', '产品名称规范', '功能 + 型号/规格，中文优先，同类产品命名风格统一', '12.3 寸中控屏、双区自动空调', true, undefined, { maxLength: 24 }),
    r('NM-6', 'product', 'coding', '产品编码规则', '产品线代码 + 两位流水号（如 ECC-01），产品线代码 3~4 位大写字母', 'ECC-01、BCM-01', true, pat([varr('lineCode'), seq(2)])),
    r('NM-7', 'product', 'coding', '产品线编码规则', '3~4 位大写字母缩写，取自英文全称首字母组合', 'ECC（空调）、BCM（车身）', true, pat([varr('abbr'), seq(2)])),
    // 文档
    r('NM-8', 'document', 'naming', '文档命名规则', '文档类别缩写 + 专业缩写 + 三位流水号 + 版本，如 DOC-HW-011', 'DOC-SYS-001、DOC-HW-011', true, undefined, { prefix: 'DOC-' }),
    r('NM-9', 'document', 'coding', '文档编号规则', '前缀 DOC + 专业代码（SYS/HW/SW/SAF/QUA）+ 三位流水号，受控发布后编号不可变', 'DOC-SW-024、DOC-SAF-004', true, pat([lit('DOC'), varr('discipline'), seq(3)])),
    r('NM-10', 'document', 'naming', '文档版本规则', '主版本 V + 副版本，正式发布用 Vx.y，草稿可用 Vx.y-draft', 'V1.4、V2.1', true, undefined, { prefix: 'V' }),
    // 部门
    r('NM-11', 'department', 'naming', '部门命名规则', '按六级组织：集团→公司→中心→部门→科室→小组，名称唯一且层级语义清晰', '研发中心 / 电子电器部 / 车身控制科', true),
    r('NM-12', 'department', 'coding', '部门编号规则', '前缀 DEPT + 层级代码 + 两位流水号，上级编号作为下级前缀', 'DEPT-RD-01、DEPT-RD-EE-02', true, pat([lit('DEPT'), varr('sys'), seq(2)])),
    // 人员
    r('NM-13', 'person', 'naming', '人员姓名规范', '实名制，中文姓名，工号与姓名一一对应', '陈志远、赵启明', true, undefined, { minLength: 2, maxLength: 4, forbidden: '\\d' }),
    r('NM-14', 'person', 'coding', '人员工号规则', '前缀 EMP + 四位流水号，入职即定、离职保留不复用', 'EMP-0001、EMP-0002', true, pat([lit('EMP'), seq(4)])),
    r('NM-15', 'person', 'coding', '岗位编号规则', '岗位序列代码 + 等级代码，如 PM-01（项目管理岗）', 'SE-01、PM-02', true, pat([varr('trackCode'), seq(2)]))
  ]
}

/** 规则变更历史（初始空，后续变更 append-only） */
function buildNamingRuleHistory(): NamingRuleHistory[] {
  return []
}

/** 编号生成实例（编号实例审计闭环，初始为空，运行时 append） */
function buildCodeIssues(): CodeIssue[] {
  return []
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
    customer: '示例汽车',
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
      planFrozen: true,
      spaceId: 'SP-001'
    },
    {
      ...base,
      id: 'P-002',
      code: 'PRJ-2026-023',
      name: 'B30 智能座舱域控平台',
      customer: '示例汽车',
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
      planFrozen: true,
      spaceId: 'SP-001'
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
      planFrozen: false,
      spaceId: 'SP-002'
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
      tenantId: 'T-1002',
      spaceId: 'SP-003'
    },
    {
      ...base,
      id: 'P-005',
      code: 'PRJ-2026-052',
      name: 'E30 高压集成电驱（子租户 T-1003）',
      customer: '示例商用车',
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
      tenantId: 'T-1003',
      spaceId: 'SP-004'
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

/** 跨专业交接点（界面计划管理 / Oracle Interface Plan 对标）：覆盖三态闭环 + 逾期 + 硬约束 */
function buildHandoffs(): HandoffPoint[] {
  return [
    { id: 'IF1', projectId: 'P-001', code: 'IF-001', name: '结构总成数模交接', fromRole: '结构工程师', toRole: '硬件工程师', deliverable: '结构总成数模 V1.2', mustFinishBy: '2026-10-28', handedAt: '2026-10-26', stage: '硬件开发', wbsId: 'w09' },
    { id: 'IF2', projectId: 'P-001', code: 'IF-002', name: 'PCB Layout 交付', fromRole: '硬件工程师', toRole: '试制负责人', deliverable: 'Gerber + BOM + 坐标文件', mustFinishBy: '2026-11-12', handedAt: '2026-11-08', receivedAt: '2026-11-09', stage: '样件与试验', wbsId: 'w10' },
    { id: 'IF3', projectId: 'P-001', code: 'IF-003', name: 'BSW 配置包移交', fromRole: '软件工程师', toRole: '测试工程师', deliverable: 'BSW 配置 + 接口头文件', mustFinishBy: '2026-11-20', stage: '软件开发', wbsId: 'w13' },
    { id: 'IF4', projectId: 'P-001', code: 'IF-004', name: '安全分析报告送审', fromRole: '功能安全经理', toRole: '质量工程师', deliverable: 'HARA/TARA 报告', mustFinishBy: '2026-10-30', stage: '需求与系统方案', wbsId: 'w07' },
    { id: 'IF5', projectId: 'P-001', code: 'IF-005', name: 'OTS 样件认可放行', fromRole: '质量工程师', toRole: '配置管理员', deliverable: 'OTS 放行单', mustFinishBy: '2026-12-05', stage: '样件与试验', wbsId: 'w23' }
  ]
}

/**
 * 界面（接口）计划 seed（SCH-022 跨项目接口，四要素齐备）。
 * 与 handoffs（项目内跨专业）互补：此处为 A 项目 → B 项目的跨项目交付接口。
 */
function buildInterfacePlans(): InterfacePlan[] {
  return [
    // P-001 → P-002：车身域控制器交付给座舱域控平台（数模接口）
    {
      id: 'IFP-1',
      code: 'IFP-P001-P002-01',
      sourceProjectId: 'P-001',
      targetProjectId: 'P-002',
      deliverable: 'E15 车身域控制器结构总成数模 V2.0',
      deliverableKind: '数模',
      sourceRole: '结构工程师',
      targetRole: '硬件工程师',
      dueDate: '2026-11-20',
      acceptanceCriteria: '数模通过 GD&T 尺寸校核且与座舱域控安装面无干涉'
    },
    // P-001 → P-002：CAN 接口协议定义（软件接口，已逾期未验收 → 下游标红样例）
    {
      id: 'IFP-2',
      code: 'IFP-P001-P002-02',
      sourceProjectId: 'P-001',
      targetProjectId: 'P-002',
      deliverable: 'CAN 通信矩阵 DBC 文件',
      deliverableKind: '数据',
      sourceRole: '软件工程师',
      targetRole: '软件工程师',
      dueDate: '2026-10-25',
      acceptanceCriteria: '信号定义与整车网络架构一致，报文周期/优先级经网络管理评审确认'
    },
    // P-002 → P-001：座舱域控电源需求（已验收闭环样例）
    {
      id: 'IFP-3',
      code: 'IFP-P002-P001-01',
      sourceProjectId: 'P-002',
      targetProjectId: 'P-001',
      deliverable: '座舱域控供电需求规格书',
      deliverableKind: '报告',
      sourceRole: '硬件工程师',
      targetRole: '硬件工程师',
      dueDate: '2026-10-15',
      acceptanceCriteria: '供电电压范围/功耗/上电时序满足车身域控整机集成要求',
      deliveredAt: '2026-10-12',
      acceptedAt: '2026-10-14'
    },
    // P-001 → P-003：线束接口（缺验收标准 → 四要素不齐备样例）
    {
      id: 'IFP-4',
      code: 'IFP-P001-P003-01',
      sourceProjectId: 'P-001',
      targetProjectId: 'P-003',
      deliverable: '高压连接器选型推荐表',
      deliverableKind: 'BOM',
      sourceRole: '结构工程师',
      targetRole: '结构工程师',
      dueDate: '2026-12-10',
      acceptanceCriteria: ''
    }
  ]
}

/**
 * 组合闸门一致性 seed（PFM-011）：各项目对 G1~G5 的判据集声明。
 * 演示「谁的项目松」：P-001 全合规、P-002 豁免已登记（合规）、
 * P-003 存在版本偏离 + 未登记豁免（违规）。
 */
function buildGateDecls(): ProjectGateDecl[] {
  const base = (projectId: string, projectName: string) =>
    (['G1', 'G2', 'G3', 'G4', 'G5'] as const).map((gate) => ({
      projectId,
      projectName,
      gate,
      templateVersion: 'GATE-2026.11',
      exemptItems: [] as string[],
      registeredExemptions: [] as string[]
    }))

  const p1 = base('P-001', 'E15 车身域控制器开发')
  const p2 = base('P-002', 'B30 智能座舱域控平台')
  const p3 = base('P-003', 'C11 电池管理线束改型')

  // P-002：G4 豁免「资源超分配已裁决」（G4-06，非必填项），已登记 → 合规
  const p2g4 = p2.find((d) => d.gate === 'G4')!
  p2g4.exemptItems = ['G4-06']
  p2g4.registeredExemptions = ['G4-06']

  // P-003：G3 豁免「安全链路追溯覆盖率」但未登记 → 违规；G2 引用旧版本 → 违规
  const p3g3 = p3.find((d) => d.gate === 'G3')!
  p3g3.exemptItems = ['G3-01']
  const p3g2 = p3.find((d) => d.gate === 'G2')!
  p3g2.templateVersion = 'GATE-2025.01'

  return [...p1, ...p2, ...p3]
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

/** 构造示例合规归档卷（ARC-001：审批 + 输出物条目，保留期 15 年，复用归档引擎） */
function buildSampleArchive(): ArchiveLayer {
  let vol: ArchiveVolume = {
    id: 'AV-P-001-2026Q4',
    name: 'P-001 电驱控制器合规归档卷',
    projectId: 'P-001',
    windowStart: '2026-10-01T00:00:00+08:00',
    windowEnd: '2026-12-31T23:59:59+08:00',
    createdAt: '2026-11-03T10:00:00+08:00',
    createdBy: '系统',
    retentionYears: 15,
    records: [],
    manifestHash: ''
  }
  vol = appendRecord(vol, {
    id: 'AR-1001', volumeId: vol.id, kind: '审批', objType: 'Gate', objId: 'G1', title: 'G1 立项闸门放行审批',
    stageCode: 'S1', projectId: 'P-001', snapshot: { gate: 'G1', passed: true, releasedBy: '总经理' },
    archivedAt: '2026-11-03T10:00:00+08:00', archivedBy: '系统'
  })
  vol = appendRecord(vol, {
    id: 'AR-1002', volumeId: vol.id, kind: '输出物', objType: 'Doc', objId: 'DOC-001', title: '立项申请书（已批准）',
    stageCode: 'S1', projectId: 'P-001', snapshot: { code: 'DOC-001', name: '立项申请书', version: 3, approved: true },
    archivedAt: '2026-11-03T10:01:00+08:00', archivedBy: '系统'
  })
  vol = appendRecord(vol, {
    id: 'AR-1003', volumeId: vol.id, kind: '审批', objType: 'Flow', objId: 'PRE-3-001', title: '立项申请审批链（三中心总监会签+总经理批准）',
    stageCode: 'S1', projectId: 'P-001', snapshot: { flow: 'FLOW-PRE-3', status: '已完成', approvedBy: '总经理' },
    archivedAt: '2026-11-03T10:02:00+08:00', archivedBy: '系统'
  })
  vol = { ...vol, manifestHash: manifestHashOf(vol) }
  return { volumes: [vol] }
}

export function buildDemoSeed() {
  const users = buildUsers()
  const projects = buildProjects(users)
  const wbs = buildWbs()
  const handoffs = buildHandoffs()
  const interfacePlans = buildInterfacePlans()
  const gateDecls = buildGateDecls()
  const { reqs, links } = buildRequirements()
  const suppliers = buildSuppliers()
  const boms = buildBom()
  const orgNodes = buildOrgNodes()
  const orgMemberships = buildOrgMemberships(users)
  const customers = buildCustomers()
  const productCategories = buildProductCategories()
  const productLines = buildProductLines()
  const products = buildProducts()
  const namingRules = buildNamingRules()
  const namingRuleHistory = buildNamingRuleHistory()
  const codeIssues = buildCodeIssues()

  const risks: RiskItem[] = [
    { id: 'RK1', projectId: 'P-001', code: 'RSK-018', title: '双路旋变信号共因失效', failureMode: '两路信号同时受同一干扰源影响', cause: '走线并行走同一屏蔽层', consequence: '助力误判，ASIL B 不可接受', trigger: 'EMC 辐射抗扰度试验 200V/m', severity: 7, occurrence: 6, detection: 6, strategy: '改分层走线 + 增加独立滤波，DV 阶段验证', owner: '赵启明', status: '缓解中' },
    { id: 'RK2', projectId: 'P-001', code: 'RSK-021', title: '长周期 MCU 交期延长至 32 周', failureMode: '关键芯片断供', cause: '晶圆产能紧张', consequence: 'B 样件延期 6 周，Gate4 推迟', trigger: '供应商月度交付承诺 <80%', severity: 6, occurrence: 6, detection: 6, strategy: '', owner: '郑昊', status: '开放' },
    { id: 'RK3', projectId: 'P-001', code: 'RSK-024', title: 'OTS 试验台架排期冲突', failureMode: 'DV 试验排队超期', cause: '集团台架资源集中于另一项目', consequence: '试验延期 2 周', trigger: '台架排期表冲突', severity: 5, occurrence: 4, detection: 5, strategy: '提前锁定台架并签内部协议', owner: '冯磊', status: '缓解中' },
    { id: 'RK4', projectId: 'P-001', code: 'RSK-027', title: '刷写签名验签耗时超限', failureMode: '产线刷写节拍不达标', cause: 'SM2 验签算法未优化', consequence: '产线节拍 45s→62s', trigger: '试生产节拍实测', severity: 4, occurrence: 3, detection: 5, strategy: '验签结果缓存 + 并行处理', owner: '顾晨', status: '开放' },
    { id: 'RK5', projectId: 'P-001', code: 'RSK-011', title: '供应商 PPAP 资料延误', failureMode: 'PPAP 未按期提交', cause: '供应商新产线爬坡', consequence: '量产放行推迟', trigger: 'PPAP 里程碑逾期', severity: 3, occurrence: 2, detection: 5, strategy: '驻厂跟催 + 每周例会', owner: '沈雅', status: '已关闭', residual: 30, signatures: ['质量工程师 沈雅'] }
  ]

  /** 机会型/威胁型极性风险（概率×影响量化，对标 Oracle 风险机会管理 P2） */
  const polarityRisks: PolarityRisk[] = [
    { id: 'PR1', projectId: 'P-001', code: 'OPP-001', title: '新工艺良率提升带来降本', polarity: 'opportunity', probability: 0.4, impactAmount: 80000, strategy: '增强', owner: '顾晨', status: '开放' },
    { id: 'PR2', projectId: 'P-001', code: 'OPP-002', title: '平台化复用缩短开发周期', polarity: 'opportunity', probability: 0.6, impactAmount: 50000, strategy: '开拓', owner: '赵启明', status: '应对中' },
    { id: 'PR3', projectId: 'P-001', code: 'OPP-003', title: '提前锁定长交期物料锁定价格', polarity: 'opportunity', probability: 0.5, impactAmount: 30000, strategy: '分享', owner: '郑昊', status: '开放' },
    { id: 'PR4', projectId: 'P-001', code: 'THR-001', title: '芯片持续涨价侵蚀毛利', polarity: 'threat', probability: 0.6, impactAmount: -50000, strategy: '转移', owner: '郑昊', status: '应对中' },
    { id: 'PR5', projectId: 'P-001', code: 'THR-002', title: '关键试验台架产能不足', polarity: 'threat', probability: 0.3, impactAmount: -40000, strategy: '缓解', owner: '冯磊', status: '开放' }
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

  /** 成本科目（8 列归集表输入：估算/预算/控制/变更） */
  const costSubjects: CostSubject[] = [
    { code: 'C-100', name: '结构件材料', wbsCode: '3.1', estimate: 120, budget: 115, control: 115, change: 5 },
    { code: 'C-200', name: '电子物料采购', wbsCode: '3.2', estimate: 260, budget: 250, control: 250, change: -10 },
    { code: 'C-300', name: '软件外包', wbsCode: '4.1', estimate: 180, budget: 180, control: 180, change: 0 },
    { code: 'C-400', name: '试验与认证', wbsCode: '5.5', estimate: 140, budget: 135, control: 135, change: 8 },
    { code: 'C-500', name: '试制工装', wbsCode: '5.4', estimate: 90, budget: 85, control: 85, change: 0 }
  ]

  /** 四类成本单据（人工时/采购合同/服务合同/其它费用） */
  const costDocs: CostDoc[] = [
    { id: 'CD1', projectId: 'P-001', type: '人工时', code: 'TS-001', costCode: 'C-400', amount: 42, currency: 'CNY', date: '2026-08-10', note: 'DV 试验人工' },
    { id: 'CD2', projectId: 'P-001', type: '采购合同', code: 'PO-100', costCode: 'C-100', amount: 60, currency: 'CNY', date: '2026-05-15', note: '壳体模具采购' },
    { id: 'CD3', projectId: 'P-001', type: '采购合同', code: 'PO-101', costCode: 'C-200', amount: 130, currency: 'CNY', date: '2026-06-02', note: 'MCU 芯片采购' },
    { id: 'CD4', projectId: 'P-001', type: '服务合同', code: 'SR-020', costCode: 'C-300', amount: 95, currency: 'CNY', date: '2026-07-18', note: '软件外包首付款' },
    { id: 'CD5', projectId: 'P-001', type: '其它费用', code: 'OT-001', costCode: 'C-500', amount: 28, currency: 'CNY', date: '2026-08-22', note: '试制工装辅材' },
    { id: 'CD6', projectId: 'P-001', type: '人工时', code: 'TS-002', costCode: 'C-400', amount: 18, currency: 'CNY', date: '2026-09-05', note: 'PV 试验人工' }
  ]

  /**
   * 报价费用明细（单一数据源）：八类费用的明细行，由「报价费用明细表单」填报，
   * 报价单自动汇总引入。source='form' 表示来自费用表单（权威），报价单可在此基础上手工补行。
   * 演示数据对齐参考报价单基准值（材料 233.69 / 制造 157.25 / NRE 5705200 / 包装 18.15）。
   */
  const quoteCosts: QuoteCostSheet = {
    // 01 材料成本（单件，含损耗率）
    material: [
      { id: 'QC-M1', name: '6061-T6 铝型材', spec: '6系 / 壁厚2.5mm', qty: 4.8, unit: 'kg', unitPrice: 26.5, lossRate: 0.03, source: 'form', projectId: 'P-001', remark: '铝锭价+加工费，季度联动调价' },
      { id: 'QC-M2', name: '5052-H32 铝板', spec: 't=2.0mm', qty: 1.6, unit: 'kg', unitPrice: 24, lossRate: 0.05, source: 'form', projectId: 'P-001' },
      { id: 'QC-M3', name: 'M6 拉铆螺母', spec: '304不锈钢', qty: 16, unit: '件', unitPrice: 1.85, lossRate: 0.01, source: 'form', projectId: 'P-001' },
      { id: 'QC-M4', name: '双组分结构胶', spec: '导热型 1.8W/m·K', qty: 0.12, unit: 'kg', unitPrice: 68, lossRate: 0.08, source: 'form', projectId: 'P-001' },
      { id: 'QC-M5', name: 'EPDM 密封胶条', spec: '邵氏A 55', qty: 3.5, unit: 'm', unitPrice: 3.2, lossRate: 0.04, source: 'form', projectId: 'P-001' },
      { id: 'QC-M6', name: '阳极氧化处理', spec: '膜厚 15μm', qty: 1, unit: '件', unitPrice: 12, lossRate: 0, source: 'form', projectId: 'P-001', remark: '外协加工费' }
    ],
    // 02 制造费用（单件，工时×费率）
    manufacturing: [
      { id: 'QC-F1', name: '挤压成型', spec: '挤压线 1#', qty: 0.18, unit: '小时', unitPrice: 85, source: 'form', projectId: 'P-001' },
      { id: 'QC-F2', name: 'CNC 精加工', spec: '五轴加工中心', qty: 0.35, unit: '小时', unitPrice: 120, source: 'form', projectId: 'P-001' },
      { id: 'QC-F3', name: 'FSW 搅拌摩擦焊', spec: '龙门焊机', qty: 0.22, unit: '小时', unitPrice: 180, source: 'form', projectId: 'P-001' },
      { id: 'QC-F4', name: '清洗烘干', spec: '通过式清洗机', qty: 0.05, unit: '小时', unitPrice: 60, source: 'form', projectId: 'P-001' },
      { id: 'QC-F5', name: '气密检测', spec: '氦检工位', qty: 0.08, unit: '小时', unitPrice: 75, source: 'form', projectId: 'P-001' },
      { id: 'QC-F6', name: '总装', spec: '装配线 3#', qty: 0.15, unit: '小时', unitPrice: 65, source: 'form', projectId: 'P-001' },
      { id: 'QC-F7', name: '辅料与耗材', spec: '切削液/焊丝/砂带', qty: 1, unit: '件', unitPrice: 8.5, source: 'form', projectId: 'P-001' },
      { id: 'QC-F8', name: '设备折旧分摊', spec: '专用设备原值', qty: 0.9, unit: '小时', unitPrice: 22, source: 'form', projectId: 'P-001' },
      { id: 'QC-F9', name: '能耗', spec: '电/气/水', qty: 1, unit: '件', unitPrice: 6.4, source: 'form', projectId: 'P-001' },
      { id: 'QC-F10', name: '废品与返工损失', spec: '综合废品率 2%', qty: 1, unit: '件', unitPrice: 6.9, source: 'form', projectId: 'P-001' }
    ],
    // 08 包装物流（单件）
    packaging: [
      { id: 'QC-P1', name: '专用周转架（摊销）', spec: '金属骨架+EPE定位，寿命3年', qty: 1, unit: '件', unitPrice: 0.35, source: 'form', projectId: 'P-001' },
      { id: 'QC-P2', name: 'EPE 内衬', spec: '定制成型', qty: 1, unit: '件', unitPrice: 2.8, source: 'form', projectId: 'P-001' },
      { id: 'QC-P3', name: '外包装纸箱', spec: '五层瓦楞，5件/箱', qty: 1, unit: '件', unitPrice: 1.6, source: 'form', projectId: 'P-001' },
      { id: 'QC-P4', name: '厂内物流与仓储', spec: '叉车/AGV/库位占用', qty: 1, unit: '件', unitPrice: 0.9, source: 'form', projectId: 'P-001' },
      { id: 'QC-P5', name: '干线运输', spec: '工厂至客户装配厂320km', qty: 1, unit: '件', unitPrice: 12.5, source: 'form', projectId: 'P-001' }
    ],
    // 03 研发费用（NRE）
    development: [
      { id: 'QC-D1', name: '结构设计与 3D 建模', spec: '总成三维模型、二维图纸、GD&T', qty: 1, unit: '项', unitPrice: 86000, source: 'form', projectId: 'P-001' },
      { id: 'QC-D2', name: 'CAE 强度/模态/疲劳仿真', spec: '静强度、一阶模态≥45Hz', qty: 1, unit: '项', unitPrice: 52000, source: 'form', projectId: 'P-001' },
      { id: 'QC-D3', name: '热管理与密封仿真', spec: '热流耦合、密封压缩变形', qty: 1, unit: '项', unitPrice: 28000, source: 'form', projectId: 'P-001', remark: '外委，含2轮优化' },
      { id: 'QC-D4', name: 'DFMEA / DVP&R 编制', spec: 'DFMEA、控制计划、DVP&R文件包', qty: 1, unit: '项', unitPrice: 18000, source: 'form', projectId: 'P-001' },
      { id: 'QC-D5', name: '手工样件试制（3轮）', spec: '快速原型、手工装配', qty: 3, unit: '套', unitPrice: 26000, source: 'form', projectId: 'P-001' },
      { id: 'QC-D6', name: '软模样件（CNC 铝块）', spec: '6件软模件', qty: 6, unit: '件', unitPrice: 8500, source: 'form', projectId: 'P-001' },
      { id: 'QC-D7', name: '工装夹具设计', spec: '焊接/加工/检测夹具设计', qty: 1, unit: '项', unitPrice: 35000, source: 'form', projectId: 'P-001' },
      { id: 'QC-D8', name: '工艺文件与作业指导书', spec: '工艺流程图、PFMEA、SOP', qty: 1, unit: '项', unitPrice: 16000, source: 'form', projectId: 'P-001' },
      { id: 'QC-D9', name: '项目管理与客户对接', spec: 'APQP节点管理', qty: 1, unit: '项', unitPrice: 42000, source: 'form', projectId: 'P-001' }
    ],
    // 04 工装模具（NRE）
    tooling: [
      { id: 'QC-T1', name: 'FSW 焊接夹具', spec: '焊接夹具', qty: 1, unit: '套', unitPrice: 285000, source: 'form', projectId: 'P-001' },
      { id: 'QC-T2', name: 'CNC 加工夹具（双工位）', spec: '加工夹具', qty: 1, unit: '套', unitPrice: 96000, source: 'form', projectId: 'P-001' },
      { id: 'QC-T3', name: '气密检测工装', spec: '检具', qty: 1, unit: '套', unitPrice: 68000, source: 'form', projectId: 'P-001' },
      { id: 'QC-T4', name: '综合检具', spec: '检具', qty: 1, unit: '套', unitPrice: 145000, source: 'form', projectId: 'P-001', remark: '客户要求产权归客户' },
      { id: 'QC-T5', name: '包装内衬吸塑模', spec: '包装模具', qty: 1, unit: '套', unitPrice: 32000, source: 'form', projectId: 'P-001' },
      { id: 'QC-T6', name: 'PCD 专用铣刀', spec: '专用刀具', qty: 4, unit: '把', unitPrice: 3800, source: 'form', projectId: 'P-001' }
    ],
    // 05 产线设备（NRE）
    equipment: [
      { id: 'QC-E1', name: 'FSW 搅拌摩擦焊机（龙门式）', spec: '焊接', qty: 1, unit: '台', unitPrice: 1850000, source: 'form', projectId: 'P-001' },
      { id: 'QC-E2', name: '五轴加工中心', spec: '机加工', qty: 1, unit: '台', unitPrice: 1260000, source: 'form', projectId: 'P-001' },
      { id: 'QC-E3', name: '气密检测线（含氦检）', spec: '检测', qty: 1, unit: '条', unitPrice: 480000, source: 'form', projectId: 'P-001' },
      { id: 'QC-E4', name: '自动化上下料单元', spec: '物流/搬运', qty: 1, unit: '套', unitPrice: 320000, source: 'form', projectId: 'P-001' },
      { id: 'QC-E5', name: '现有产线改造', spec: '输送/电气/气路', qty: 1, unit: '项', unitPrice: 180000, source: 'form', projectId: 'P-001', remark: '通用部分按折旧分摊' }
    ],
    // 06 试验验证（NRE）
    testing: [
      { id: 'QC-S1', name: '随机振动耐久', spec: 'GB/T 28046.3 / ISO 16750-3', qty: 3, unit: '次', unitPrice: 8500, source: 'form', projectId: 'P-001' },
      { id: 'QC-S2', name: '机械冲击', spec: 'GB/T 28046.2', qty: 1, unit: '次', unitPrice: 12000, source: 'form', projectId: 'P-001' },
      { id: 'QC-S3', name: 'IP67 浸水试验', spec: 'GB/T 4208', qty: 1, unit: '次', unitPrice: 6800, source: 'form', projectId: 'P-001' },
      { id: 'QC-S4', name: '中性盐雾 480h', spec: 'GB/T 10125', qty: 1, unit: '次', unitPrice: 9600, source: 'form', projectId: 'P-001' },
      { id: 'QC-S5', name: '高低温循环', spec: '-40℃~85℃，50循环', qty: 1, unit: '次', unitPrice: 18500, source: 'form', projectId: 'P-001' },
      { id: 'QC-S6', name: '温度冲击', spec: '-40℃⇄125℃，100循环', qty: 1, unit: '次', unitPrice: 15000, source: 'form', projectId: 'P-001' },
      { id: 'QC-S7', name: '材料拉伸/硬度/金相', spec: 'GB/T 228.1 / GB/T 4340.1', qty: 1, unit: '次', unitPrice: 4200, source: 'form', projectId: 'P-001' },
      { id: 'QC-S8', name: '焊接接头强度', spec: '拉剪/正弯，ISO 4136', qty: 1, unit: '次', unitPrice: 7800, source: 'form', projectId: 'P-001' },
      { id: 'QC-S9', name: '整车道路耐久', spec: '客户规范（20万km）', qty: 1, unit: '次', unitPrice: 260000, source: 'form', projectId: 'P-001' },
      { id: 'QC-S10', name: '第三方 CNAS 报告', spec: '报告出具与备案', qty: 1, unit: '次', unitPrice: 22000, source: 'form', projectId: 'P-001' }
    ],
    // 07 合规认证（NRE）
    compliance: [
      { id: 'QC-C1', name: 'IATF 16949 体系监督审核', spec: 'IATF 16949:2016', qty: 1, unit: '项', unitPrice: 68000, source: 'form', projectId: 'P-001' },
      { id: 'QC-C2', name: 'PPAP 文件包编制与提交', spec: 'AIAG PPAP 第4版 Level 3', qty: 1, unit: '项', unitPrice: 36000, source: 'form', projectId: 'P-001' },
      { id: 'QC-C3', name: 'IMDS 材料数据申报', spec: 'IMDS 国际材料数据系统', qty: 1, unit: '项', unitPrice: 12000, source: 'form', projectId: 'P-001' },
      { id: 'QC-C4', name: 'ELV / RoHS / REACH 检测', spec: 'RoHS 2.0、REACH SVHC', qty: 1, unit: '项', unitPrice: 15600, source: 'form', projectId: 'P-001' },
      { id: 'QC-C5', name: '产品 3C / 法规准入', spec: 'GB 38031 等适用法规', qty: 1, unit: '项', unitPrice: 28000, source: 'form', projectId: 'P-001' },
      { id: 'QC-C6', name: '碳足迹核算与报告', spec: 'ISO 14067', qty: 1, unit: '项', unitPrice: 18000, source: 'form', projectId: 'P-001' },
      { id: 'QC-C7', name: '客户特殊要求（CSR）审核', spec: '客户 CSR 清单', qty: 1, unit: '项', unitPrice: 9000, source: 'form', projectId: 'P-001' }
    ]
  }


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

  /**
   * OTS 认可三大条件附件（单一数据源）。
   * 三大条件结果只由这些附件数据自动导出（domain/otsApproval），视图不可手填。
   * 演示数据：三中心归档齐全 + 样件评审合格 + DV 试验合格 → 判定 L1。
   */
  const otsAttachments: {
    archiveTable: DesignArchiveTable
    sampleReview: SampleReviewReport
    dvReport: DvTestReport
  } = {
    // 附件 A《设计文件归档汇总表》：A-1 电子 / A-2 结构 / A-3 工艺
    archiveTable: {
      projectId: 'P-001',
      parts: [
        {
          center: '电子研发中心',
          items: [
            { code: 'E-001', name: '硬件原理图', archived: true, archivedBy: '赵启明', archivedAt: '2026-11-01' },
            { code: 'E-002', name: 'PCB 版图', archived: true, archivedBy: '赵启明', archivedAt: '2026-11-01' },
            { code: 'E-003', name: '软件发布包与版本说明', archived: true, archivedBy: '吴敏', archivedAt: '2026-11-01' },
            { code: 'E-004', name: 'HARA/功能安全分析', archived: true, archivedBy: '功能安全经理', archivedAt: '2026-11-01' }
          ]
        },
        {
          center: '结构研发中心',
          items: [
            { code: 'S-001', name: '结构总成 3D 模型', archived: true, archivedBy: '郑昊', archivedAt: '2026-11-01' },
            { code: 'S-002', name: '二维工程图（含 GD&T）', archived: true, archivedBy: '郑昊', archivedAt: '2026-11-01' },
            { code: 'S-003', name: 'DFMEA', archived: true, archivedBy: '郑昊', archivedAt: '2026-11-01' }
          ]
        },
        {
          center: '工艺技术中心',
          items: [
            { code: 'P-001', name: '工艺流程图', archived: true, archivedBy: '顾晨', archivedAt: '2026-11-01' },
            { code: 'P-002', name: 'PFMEA', archived: true, archivedBy: '顾晨', archivedAt: '2026-11-01' },
            { code: 'P-003', name: '控制计划 CP', archived: true, archivedBy: '顾晨', archivedAt: '2026-11-01' },
            { code: 'P-004', name: '作业指导书 SOP', archived: true, archivedBy: '顾晨', archivedAt: '2026-11-01' }
          ]
        }
      ]
    },
    // 附件 B《OTS 样件评审报告》
    sampleReview: {
      projectId: 'P-001',
      sampleNo: 'SMP-OTS-01',
      reviewer: '质量工程师',
      reviewedAt: '2026-11-03',
      items: [
        { code: 'B-01', name: '全尺寸检验（CMM）', result: '合格' },
        { code: 'B-02', name: '材料性能（拉伸/硬度/金相）', result: '合格' },
        { code: 'B-03', name: '外观与标识', result: '合格' },
        { code: 'B-04', name: '功能与装配', result: '合格' }
      ]
    },
    // 附件 C《DV 试验报告》
    dvReport: {
      projectId: 'P-001',
      reportNo: 'DV-2026-001',
      hasMajorIssue: false,
      testBy: '试验中心',
      testedAt: '2026-11-02',
      items: [
        { code: 'DV-01', name: '随机振动耐久', result: '合格', critical: true },
        { code: 'DV-02', name: '机械冲击', result: '合格', critical: true },
        { code: 'DV-03', name: 'IP67 浸水', result: '合格', critical: true },
        { code: 'DV-04', name: '中性盐雾 480h', result: '合格', critical: false },
        { code: 'DV-05', name: '高低温循环', result: '合格', critical: false },
        { code: 'DV-06', name: '温度冲击', result: '合格', critical: true }
      ]
    }
  }

  /** 图文档在线批注（空间锚定，对标 Oracle 图文档批注 P2） */
  const docAnnotations: DocAnnotation[] = [
    { id: 'AN1', docId: 'DC1', projectId: 'P-001', author: '郑昊', content: '此处安全目标 ASIL 等级需与 HARA 一致', type: '圈注', anchor: { page: 4, x: 0.32, y: 0.48, region: '表 3-2 安全目标' }, createdAt: '2026-11-01T09:00:00Z', status: '开放' },
    { id: 'AN2', docId: 'DC1', projectId: 'P-001', author: '赵启明', content: '需求编号 FSR-002 引用已过时，建议升版', type: '高亮', anchor: { page: 2, x: 0.55, y: 0.3, region: '第 2.3 节' }, createdAt: '2026-11-02T10:00:00Z', status: '开放' },
    { id: 'AN3', docId: 'DC2', projectId: 'P-001', author: '顾晨', content: '旋变解码芯片封装改为 B 型后钢网开孔需复核', type: '文字', anchor: { page: 1, x: 0.7, y: 0.65, region: '原理图右下' }, createdAt: '2026-10-30T14:00:00Z', status: '已解决', resolvedBy: '赵启明', resolvedAt: '2026-10-31T09:00:00Z', resolution: '已更新封装并复核钢网' },
    { id: 'AN4', docId: 'DC3', projectId: 'P-001', author: '吴敏', content: '诊断服务会话超时未覆盖 CAN FD 场景', type: '下划线', anchor: { page: 6, x: 0.4, y: 0.72, region: '第 6.4 节' }, createdAt: '2026-11-03T08:00:00Z', status: '开放' }
  ]

  const samples: SampleReq[] = [
    { id: 'SM1', projectId: 'P-001', code: 'SMP-A-01', type: 'A', qty: 12, needDate: '2026-08-14', gate: 'G3', status: '已交付', ebomVersion: 'V1.2' },
    { id: 'SM2', projectId: 'P-001', code: 'SMP-B-01', type: 'B', qty: 24, needDate: '2026-11-27', gate: 'G4', status: '试制中', ebomVersion: 'V1.2' },
    { id: 'SM3', projectId: 'P-001', code: 'SMP-OTS-01', type: 'OTS', qty: 30, needDate: '2027-02-26', gate: 'G4', status: '计划中', ebomVersion: 'V1.3' }
  ]

  // —— 漏洞台账 + 8D（QMS-003/004/005）——
  const defects: { vulns: VulnerabilityItem[]; issues8D: Issue8D[] } = {
    vulns: [
      { id: 'VU1', vulnId: 'VUL-014', cvss: 5.3, affectedVersion: 'V2.3.0', remediation: '诊断服务增加会话超时与锁定', status: '已关闭', retestConclusion: '通过', retestedBy: '吴敏', retestedAt: '2026-10-20' },
      { id: 'VU2', vulnId: 'VUL-018', cvss: 6.1, affectedVersion: 'V2.3.1', remediation: '量产件关闭调试口并熔断', status: '修复中' },
      { id: 'VU3', vulnId: 'VUL-021', cvss: 7.5, affectedVersion: 'V2.3.0', remediation: '刷写包 SM2 验签强制校验', status: '已修复待验证', retestConclusion: '通过', retestedBy: '赵启明', retestedAt: '2026-10-28' },
      { id: 'VU4', vulnId: 'VUL-026', cvss: 3.7, affectedVersion: 'V2.3.1', remediation: '日志脱敏 VIN', status: '已关闭', retestConclusion: '通过', retestedBy: '吴敏', retestedAt: '2026-10-25' }
    ],
    issues8D: [
      { id: '8D1', projectId: 'P-001', tag: '不合格', stage: 'DV 试验', batch: 'B-2026-03', rootCause: 'MOSFET 驱动电阻取值偏大导致开关损耗过高', rootCauseVerified: true, completedSteps: ['D1 组建团队', 'D2 描述问题', 'D3 临时遏制措施', 'D4 根本原因分析', 'D5 选择与验证纠正措施', 'D6 实施纠正措施', 'D7 预防再发生', 'D8 祝贺与关闭'], status: '已关闭' },
      { id: '8D2', projectId: 'P-001', tag: '客户投诉', stage: '装车', batch: 'B-2026-04', rootCause: '连接器端子压接高度超差', rootCauseVerified: false, completedSteps: ['D1 组建团队', 'D2 描述问题', 'D3 临时遏制措施', 'D4 根本原因分析'], status: '开放' }
    ]
  }

  // —— 软件配置项 SCI + 兼容记录 + 发布双签（VER-001/008/009/015）——
  const softwareVersions: { scis: Sci[]; compat: CompatibilityRecord[]; signoff: ReleaseSignoff } = {
    scis: [
      { id: 'SCI1', code: 'SCI-1000', name: '主控 MCU 固件', architectureIds: ['ARCH-001'], securityReqIds: ['R17'] },
      { id: 'SCI2', code: 'SCI-1001', name: '刷写 Bootloader', architectureIds: ['ARCH-002'], securityReqIds: ['R18'] },
      { id: 'SCI3', code: 'SCI-1002', name: '诊断数据库 ODX', architectureIds: ['ARCH-003'], securityReqIds: ['R17'] }
    ],
    compat: [
      { versionId: 'V2.3.1', hardwareVersions: ['HW-REV-A', 'HW-REV-B'], busTypes: ['CAN', 'CAN-FD'], rollbackPlan: '双分区回滚脚本已验证，回滚时长 <10 分钟' },
      { versionId: 'V2.3.0', hardwareVersions: ['HW-REV-A'], busTypes: ['CAN'] }
    ],
    signoff: { rndSignedBy: '郑昊', qualitySignedBy: '沈雅' }
  }

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

  // 服务端拒绝拦截策略（SRP-001/002：16 项问题事项，三档可配置，管理员可在系统设置自定义）
  const rejectionPolicies: RejectionPolicyItem[] = DEFAULT_REJECTION_POLICIES

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

  /**
   * 合规测评证据链（C-30 / NFR-009/010/011 / SEC-012/013）
   * 取代 C-30 的 flag 静态登记「等保三级测评已通过」——此处为结构化证据：
   * 机构 / 报告编号 / 结论 / 符合率 / 高风险 / 整改项 / 有效期。
   * 注意：seed 为演示基线，等保三级与国密传输的「真实测评」由外部机构出具，
   * 此处登记的是「待启动/待整改」的真实状态，而非虚假的「已通过」——
   * 因此 C-30 在演示基线中应如实判 FAIL，而非 flag 兜底通过（杜绝虚假闭环）。
   */
  const complianceItems: ComplianceItem[] = [
    {
      id: 'COMP-001',
      kind: '等保三级',
      ref: 'NFR-009',
      agency: '（待定）等保测评机构',
      reportNo: '待启动',
      conclusion: '待整改',
      complianceRate: 0,
      highRiskCount: 0,
      assessedAt: '2026-10-01',
      validUntil: '2027-10-01',
      rectifications: [
        { id: 'DJ-1', issue: '等保三级测评尚未启动（D-07 第 8 周前须预约）', severity: '高', status: '开放', deadline: '2026-11-21' }
      ]
    },
    {
      id: 'COMP-002',
      kind: '商用密码(密评)',
      ref: 'NFR-010',
      agency: '（待定）密评机构',
      reportNo: '待启动',
      conclusion: '待整改',
      complianceRate: 0,
      highRiskCount: 0,
      assessedAt: '2026-10-01',
      validUntil: '2027-10-01',
      rectifications: [
        { id: 'MM-1', issue: '商用密码应用密评尚未启动', severity: '高', status: '开放', deadline: '2026-11-21' }
      ],
      cipherSubItems: [
        { dimension: '算法', pass: false },
        { dimension: '密钥管理', pass: false },
        { dimension: '传输', pass: false },
        { dimension: '存储', pass: false }
      ]
    },
    {
      id: 'COMP-003',
      kind: '国密传输',
      ref: 'SEC-012',
      agency: '平台网关',
      reportNo: 'GM-TLS-未部署',
      conclusion: '待整改',
      complianceRate: 0,
      highRiskCount: 0,
      assessedAt: '2026-10-01',
      validUntil: '2027-10-01',
      rectifications: [
        { id: 'GM-1', issue: '国密网关（SM2/SM3/SM4 套件）尚未部署，当前为明文 HTTP', severity: '高', status: '开放', deadline: '2026-12-01' }
      ]
    },
    {
      id: 'COMP-004',
      kind: '数据分类分级',
      ref: 'NFR-011',
      agency: '平台内部',
      reportNo: 'CLS-2026-001',
      conclusion: '通过',
      complianceRate: 100,
      highRiskCount: 0,
      assessedAt: '2026-09-15',
      validUntil: '2027-09-15',
      rectifications: []
    }
  ]

  /**
   * AI 智能辅助（SRS 第 24 章 / AIA-001~007，R1 批次）
   * 语料：由真实需求/风险/交付物投影出的受控对象，带租户/项目/密级归属，
   * 供「检索前置过滤」演示——跨租户/越密级对象必须在检索阶段被剔除（越权命中 0）。
   * 注意：seed 为演示基线，模型选型（D-08）待拍板，此处语料为规则型 RAG 的依据，
   * 真实 LLM 接入后同一套语料继续作为「引用可溯 + 前置过滤」的校验对象。
   */
  const aiCorpus: AiCorpusItem[] = [
    // P-001（T-1001 集团租户）核心需求语料
    { id: 'R01', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-001', class: 'L2', text: '避免转向助力在行驶中非预期失效（ASIL B）', version: 1 },
    { id: 'R03', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-001', class: 'L2', text: '系统应在助力扭矩偏差 >15% 时 100ms 内进入降级模式', version: 1 },
    { id: 'R05', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-001', class: 'L2', text: '系统应在通信丢失 3 个周期内点亮故障灯', version: 1 },
    { id: 'R17', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-001', class: 'L4', text: '诊断服务 0x27 安全访问采用 SM4 加密种子（涉密安全机制）', version: 1 },
    { id: 'TC-001', objType: 'TC', tenantId: 'T-1001', projectId: 'P-001', class: 'L2', text: '旋变信号交叉校验用例（含单路失效注入）', version: 1 },
    { id: 'VER-001', objType: 'VER', tenantId: 'T-1001', projectId: 'P-001', class: 'L2', text: 'SW 1.4.2 版本验证记录', version: 1 },
    // 断链/歧义样本（供追溯断链、质量体检场景）
    { id: 'R13', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-001', class: 'L2', text: 'PWM 调光频率配置为 200Hz±5%，具体取值适当即可', version: 1 },
    // 跨租户对象（越权测试样本：T-1002 子租户，A 租户检索 B 租户专有词须命中 0）
    { id: 'P004-SEC', objType: 'REQ', tenantId: 'T-1002', projectId: 'P-004', class: 'L2', text: 'B 租户专有的自动驾驶域控安全需求', version: 1 },
    { id: 'P005-SEC', objType: 'REQ', tenantId: 'T-1003', projectId: 'P-005', class: 'L2', text: 'C 租户专有的新能源电池热管理需求', version: 1 }
  ]

  /** AI 两级开关（AIA-007）：总开关开启 + 项目级开关 + 一条已到期的临时开启（演示自动关闭） */
  const aiSwitch: AiSwitchConfig = {
    globalEnabled: true,
    projectSwitches: { 'P-001': true, 'P-002': true },
    temporary: { enabled: false, reason: '历史临时开启（已到期示例）', expireAt: '2026-10-01T00:00:00.000Z' }
  }

  /** AI 调用日志（附录 B.3 ai_call_log）：一条待复核、一条已采纳、一条已驳回，覆盖三态 */
  const aiCallLogs: AiCallLog[] = [
    {
      id: 'AILOG-001',
      projectId: 'P-001',
      userId: 'u-pm',
      sceneCode: '需求检索问答',
      modelKey: 'rule-rag',
      promptVer: 'v1.0.0',
      inputHash: 'seed-hash-001',
      citedIds: ['R01', 'R03'],
      reviewStatus: 'PENDING'
    },
    {
      id: 'AILOG-002',
      projectId: 'P-001',
      userId: 'u-pm',
      sceneCode: '追溯断链提示',
      modelKey: 'rule-rag',
      promptVer: 'v1.0.0',
      inputHash: 'seed-hash-002',
      citedIds: ['R13'],
      reviewStatus: 'ACCEPTED',
      reviewerId: 'u-qa',
      reviewedAt: '2026-10-30T10:00:00.000Z'
    },
    {
      id: 'AILOG-003',
      projectId: 'P-001',
      userId: 'u-pm',
      sceneCode: '需求质量体检',
      modelKey: 'rule-rag',
      promptVer: 'v1.0.0',
      inputHash: 'seed-hash-003',
      citedIds: ['R13'],
      reviewStatus: 'REJECTED',
      reviewerId: 'u-qa',
      reviewedAt: '2026-10-31T09:30:00.000Z'
    }
  ]

  const schemeLinked = true
  const quoteLinked = true

  return {
    version: SEED_VERSION,
    tenantId: TENANT,
    /** 当前项目所用研发阶段模板（STG-001：默认汽车零部件六阶段，可配置切换） */
    stageTemplateId: 'TPL-AUTO',
    tenant: { code: 'T-1001', name: '魔程科技（集团）', type: '集团租户', isolation: 'SHARED' },
    /** 集团—子租户两级结构（TEN-002/TEN-003）：T-1001 集团 + T-1002/T-1003 子租户 */
    tenants: [
      { code: 'T-1001', name: '魔程科技（集团）', type: '集团租户', isolation: 'SHARED' },
      { code: 'T-1002', name: '魔程智驾（子公司）', type: '子租户', isolation: 'SHARED', parentCode: 'T-1001', sharedMetrics: ['项目数', '在研项目', 'Gate 通过率'] },
      { code: 'T-1003', name: '魔程新能源（子公司）', type: '子租户', isolation: 'SCHEMA', parentCode: 'T-1001', sharedMetrics: ['项目数', '风险敞口'] }
    ],
    /** 空间（项目组合，SPA-001）：租户之下的聚合维度，顶部切换器切换 */
    spaces: [
      { id: 'SP-001', code: 'SP-DEMO', name: '演示科技有限公司', tenantId: 'T-1001', type: '项目组合', roleBoundary: ['PM', 'SYS_ADMIN', 'OPS'], resourcePoolIds: ['NODE-1', 'NODE-2'], costSubjectIds: ['C-100'] },
      { id: 'SP-002', code: 'SP-SAMPLE', name: '示例电子有限公司', tenantId: 'T-1001', type: '项目组合', roleBoundary: [], resourcePoolIds: ['NODE-3'], costSubjectIds: ['C-200'] },
      { id: 'SP-003', code: 'SP-ZJ', name: '智驾项目集', tenantId: 'T-1002', type: '项目组合', roleBoundary: [], resourcePoolIds: ['NODE-1'], costSubjectIds: ['C-300'] },
      { id: 'SP-004', code: 'SP-XNY', name: '新能源项目集', tenantId: 'T-1003', type: '项目组合', roleBoundary: [], resourcePoolIds: ['NODE-2'], costSubjectIds: ['C-400'] }
    ] as Space[],
    users,
    orgNodes,
    orgMemberships,
    customers,
    productCategories,
    productLines,
    products,
    namingRules,
    namingRuleHistory,
    codeIssues,
    projects: projects.map((p) => ({ ...p, schemeLinked, quoteLinked }) as Project),
    wbs,
    handoffs,
    interfacePlans,
    gateDecls,
    reqs,
    links,
    suppliers,
    boms,
    risks,
    polarityRisks,
    ecrs,
    deliverables,
    costSubjects,
    costDocs,
    quoteCosts,
    docs,
    docAnnotations,
    samples,
    otsAttachments,
    defects,
    softwareVersions,
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
    rejectionPolicies,
    messages,
    inboxItems,
    thresholdIssues: [] as ThresholdIssue[],
    resourcePool,
    resourceShares,
    portalSections,
    drafts,
    audit,
    /** 15 年合规归档层（ARC-001：示例归档卷，含审批+输出物条目，保留期 15 年） */
    archiveLayer: buildSampleArchive(),
    flags,
    complianceItems,
    aiCorpus,
    aiSwitch,
    aiCallLogs,
    projectReviews: [] as HumanReview[],
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
      },
      // ⑤ 项目前期 · 前期交流申请（市场客户经理发起 → 市场总监审核 → 三中心总监会签 → 总经理批准）
      {
        id: 'DEF-PRE-1',
        code: 'FLOW-PRE-1',
        name: '前期交流申请',
        formFields: [
          { key: 'customer', label: '客户' },
          { key: 'productLine', label: '产品线' },
          { key: 'budget', label: '预估金额' }
        ],
        startNodeId: 'p1',
        nodes: [
          { id: 'p1', name: '发起', type: 'start' },
          { id: 'p2', name: '市场总监审核', type: 'approve', approverRole: '市场总监', slaHours: 24, escalateToRole: '总经理' },
          { id: 'p3', name: '三中心总监会签', type: 'sign', signMode: 'all', signRoles: ['电子研发中心总监', '结构研发中心总监', '工艺技术中心总监'], slaHours: 48, escalateToRole: '总经理' },
          { id: 'p4', name: '总经理批准', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 'p5', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      // ⑥ 项目前期 · 项目/产品报价（并行填报 + 财务汇总 + 总经理批准）
      {
        id: 'DEF-PRE-2',
        code: 'FLOW-PRE-2',
        name: '项目/产品报价',
        formFields: [
          { key: 'customer', label: '客户名称' },
          { key: 'projectName', label: '项目名称' },
          { key: 'productLine', label: '产品线' },
          { key: 'annualVolume', label: '年需求量(件/年)' },
          { key: 'lifecycle', label: '生命周期(年)' },
          { key: 'unitCostSubtotal', label: '单件成本小计' },
          { key: 'nreTotal', label: 'NRE 合计' },
          { key: 'fullCost', label: '完全成本' },
          { key: 'unitPriceExVat', label: '建议单价(未税)' },
          { key: 'unitPriceInVat', label: '建议单价(含税)' }
        ],
        startNodeId: 'q1',
        nodes: [
          { id: 'q1', name: '发起（市场客户经理）', type: 'start' },
          { id: 'q2', name: '四角色并行填报', type: 'sign', signMode: 'all', signRoles: ['电子研发工程师', '结构研发工程师', '工艺技术工艺师', '采购部'], slaHours: 72, escalateToRole: '市场总监' },
          { id: 'q3', name: '财务汇总核对', type: 'approve', approverRole: '财务部', slaHours: 24, escalateToRole: '总经理' },
          { id: 'q4', name: '总经理批准报价', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 'q5', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      // ⑥a 项目前期 · 技术方案（TR）（报价前置技术输入，C-02：评审委员会评审 → 总经理批准）
      {
        id: 'DEF-PRE-5',
        code: 'FLOW-PRE-5',
        name: '技术方案（TR）',
        formFields: [
          { key: 'name', label: '方案名称' },
          { key: 'version', label: '方案版本' },
          { key: 'trResult', label: 'TR 评审结论' }
        ],
        startNodeId: 'tr1',
        nodes: [
          { id: 'tr1', name: '发起（技术负责人）', type: 'start' },
          { id: 'tr2', name: 'TR 技术评审', type: 'approve', approverRole: '评审委员会', slaHours: 72, escalateToRole: '总经理' },
          { id: 'tr3', name: '总经理批准', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 'tr4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      // ⑦ 项目前期 · 立项申请（市场客户经理发起 → 市场总监审核 → 三中心总监会签 → 总经理批准，与前期交流申请同审批链）
      {
        id: 'DEF-PRE-3',
        code: 'FLOW-PRE-3',
        name: '立项申请',
        formFields: [
          { key: 'name', label: '项目名称' },
          { key: 'code', label: '项目编码' },
          { key: 'customer', label: '客户' },
          { key: 'productLine', label: '产品线' },
          { key: 'otsDate', label: 'OTS 期' },
          { key: 'sopDate', label: 'SOP 日期' },
          { key: 'annualVolume', label: '车型年产量' },
          { key: 'lifecycleYears', label: '生命周期（年）' }
        ],
        startNodeId: 'b1',
        nodes: [
          { id: 'b1', name: '发起', type: 'start' },
          { id: 'b2', name: '市场总监审核', type: 'approve', approverRole: '市场总监', slaHours: 24, escalateToRole: '总经理' },
          { id: 'b3', name: '三中心总监会签', type: 'sign', signMode: 'all', signRoles: ['电子研发中心总监', '结构研发中心总监', '工艺技术中心总监'], slaHours: 48, escalateToRole: '总经理' },
          { id: 'b4', name: '总经理批准', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 'b5', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 2
      },
      // ⑦a 项目前期 · 立项评审（立项申请勾选「是」时自动触发：评审人评估 → 总经理确认）
      {
        id: 'DEF-PRE-4',
        code: 'FLOW-PRE-4',
        name: '立项评审',
        formFields: [
          { key: 'name', label: '项目名称' },
          { key: 'level', label: '分级判定' },
          { key: 'reviewConclusion', label: '评审结论' }
        ],
        startNodeId: 'r1',
        nodes: [
          { id: 'r1', name: '发起', type: 'start' },
          { id: 'r2', name: '立项评审（四维度评估）', type: 'approve', approverRole: '评审委员会', slaHours: 72, escalateToRole: '总经理' },
          { id: 'r3', name: '总经理确认', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 'r4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      {
        id: 'DEF-PRJ-TASK',
        code: 'FLOW-PRJ-TASK',
        name: '项目任务书',
        formFields: [
          { key: 'name', label: '项目名称' },
          { key: 'objective', label: '任务目标' },
          { key: 'deliverables', label: '交付物' },
          { key: 'milestones', label: '关键里程碑' }
        ],
        startNodeId: 't1',
        nodes: [
          { id: 't1', name: '发起（项目经理）', type: 'start' },
          { id: 't2', name: '研发副总审核', type: 'approve', approverRole: '研发副总', slaHours: 48, escalateToRole: '总经理' },
          { id: 't3', name: '总经理批准', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 't4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      {
        id: 'DEF-PRJ-PLAN',
        code: 'FLOW-PRJ-PLAN',
        name: '项目主计划',
        formFields: [
          { key: 'name', label: '项目名称' },
          { key: 'startDate', label: '计划开始' },
          { key: 'endDate', label: '计划结束' },
          { key: 'milestones', label: '关键里程碑' },
          { key: 'resource', label: '资源需求' }
        ],
        startNodeId: 'pl1',
        nodes: [
          { id: 'pl1', name: '发起（项目经理）', type: 'start' },
          { id: 'pl2', name: 'PMO 审核', type: 'approve', approverRole: 'PMO', slaHours: 48, escalateToRole: '研发副总' },
          { id: 'pl3', name: '部门会签（并行）', type: 'sign', signMode: 'all', signRoles: ['电子研发中心', '结构研发中心', '工艺技术中心', '项目管理中心'], slaHours: 72, escalateToRole: '研发副总' },
          { id: 'pl4', name: '总经理批准', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 'pl5', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      {
        id: 'DEF-PRJ-OTS',
        code: 'FLOW-PRJ-OTS',
        name: 'OTS 认可',
        formFields: [
          { key: 'name', label: '项目名称' },
          { key: 'sampleNo', label: '样件编号' },
          { key: 'reportNo', label: 'OTS 报告编号' },
          { key: 'level', label: '认可等级' },
          { key: 'conclusion', label: '认可结论' },
          { key: 'dueDate', label: '临时认可到期日期' }
        ],
        startNodeId: 'o1',
        nodes: [
          { id: 'o1', name: '发起（质量工程师）', type: 'start' },
          { id: 'o2', name: '部门会签（并行）', type: 'sign', signMode: 'all', signRoles: ['质量中心', '试验中心', '制造中心'], slaHours: 72, escalateToRole: '质量总监' },
          { id: 'o3', name: '客户认可', type: 'approve', approverRole: '质量总监', slaHours: 48, escalateToRole: '总经理' },
          { id: 'o4', name: '总经理批准', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 'o5', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      {
        id: 'DEF-PRJ-PPAP',
        code: 'FLOW-PRJ-PPAP',
        name: 'PPAP 提交',
        formFields: [
          { key: 'name', label: '项目名称' },
          { key: 'level', label: 'PPAP 等级' },
          { key: 'pkgNo', label: '文件包编号' },
          { key: 'elements', label: '18 要素齐全性' }
        ],
        startNodeId: 'pp1',
        nodes: [
          { id: 'pp1', name: '发起（质量工程师）', type: 'start' },
          { id: 'pp2', name: '部门会签（并行）', type: 'sign', signMode: 'all', signRoles: ['供应链', '质量中心', '工艺技术中心'], slaHours: 72, escalateToRole: '质量总监' },
          { id: 'pp3', name: '客户批准', type: 'approve', approverRole: '质量总监', slaHours: 48, escalateToRole: '总经理' },
          { id: 'pp4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      {
        id: 'DEF-PRJ-SOP',
        code: 'FLOW-PRJ-SOP',
        name: 'SOP（量产启动）',
        formFields: [
          { key: 'name', label: '项目名称' },
          { key: 'sopDate', label: 'SOP 日期' },
          { key: 'capacity', label: '设计产能' },
          { key: 'rampPlan', label: '爬坡计划' }
        ],
        startNodeId: 's1',
        nodes: [
          { id: 's1', name: '发起（制造中心）', type: 'start' },
          { id: 's2', name: '部门会签（并行）', type: 'sign', signMode: 'all', signRoles: ['制造中心', '计划物流中心', '质量中心'], slaHours: 72, escalateToRole: '总经理' },
          { id: 's3', name: '总经理批准', type: 'approve', approverRole: '总经理', slaHours: 24 },
          { id: 's4', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      },
      // ⑧ 研发阶段标准审批链（APR-001：发起→审核→并行会签→批准，绑定 S1~S6 阶段闸门）
      buildApprovalChain('DEF-STAGE-S1', 'FLOW-STAGE-S1', 'S1 立项与策划审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['电子研发中心', '结构研发中心', '工艺技术中心', '项目管理中心', '质量中心'] }, [{ key: 'name', label: '项目名称' }]),
      buildApprovalChain('DEF-STAGE-S2', 'FLOW-STAGE-S2', 'S2 产品设计与开发审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['电子研发中心', '结构研发中心', '工艺技术中心', '质量中心'] }, [{ key: 'design', label: '设计方案' }]),
      buildApprovalChain('DEF-STAGE-S3', 'FLOW-STAGE-S3', 'S3 过程设计与开发审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['工艺技术中心', '制造中心', '质量中心'] }, [{ key: 'process', label: '过程方案' }]),
      buildApprovalChain('DEF-STAGE-S4', 'FLOW-STAGE-S4', 'S4 试制与 OTS 验证审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['制造中心', '质量中心', '试验中心'] }, [{ key: 'ots', label: 'OTS 结果' }]),
      buildApprovalChain('DEF-STAGE-S5', 'FLOW-STAGE-S5', 'S5 量产与交付审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['制造中心', '计划物流中心', '质量中心'] }, [{ key: 'sop', label: 'SOP 准备' }]),
      buildApprovalChain('DEF-STAGE-S6', 'FLOW-STAGE-S6', 'S6 反馈与改进审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['质量中心', '项目管理中心'] }, [{ key: 'feedback', label: '反馈结论' }]),
      // ⑨ 交付物审批链（P3：交付物绑定审批，交付物「有效提供」= 审批完成）
      buildApprovalChain('DEF-DEL-D1', 'FLOW-DEL-1', 'DEL-001 系统需求规格书审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['电子研发中心', '功能安全', '质量中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D2', 'FLOW-DEL-2', 'DEL-002 系统架构设计说明审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['电子研发中心', '结构研发中心', '质量中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D3', 'FLOW-DEL-3', 'DEL-003 硬件原理图与 PCB 审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['硬件', '工艺技术中心', '质量中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D4', 'FLOW-DEL-4', 'DEL-004 安全分析报告审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['功能安全', '信息安全', '质量中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D5', 'FLOW-DEL-5', 'DEL-005 软件发布包审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['软件', '测试中心', '配置管理'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D6', 'FLOW-DEL-6', 'DEL-006 DV/PV 试验报告审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['试验中心', '质量中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D7', 'FLOW-DEL-7', 'DEL-007 OTS 样件认可报告审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['质量中心', '试验中心', '制造中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D8', 'FLOW-DEL-8', 'DEL-008 PPAP 文件包审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['供应链', '质量中心', '工艺技术中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D9', 'FLOW-DEL-9', 'DEL-009 追溯矩阵审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['系统', '软件', '质量中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      buildApprovalChain('DEF-DEL-D10', 'FLOW-DEL-10', 'DEL-010 交付清单与签收单审批', { ...DEFAULT_APPROVAL_ROLES, signRoles: ['计划物流中心', '质量中心'] }, [{ key: 'deliverable', label: '交付物' }]),
      // ⑩ 零件号申请命名（CJQW0106 B1 附表5：发起 → 产品总监审核 → 项目号管理专员编号确认 → 标准化批准）
      {
        id: 'DEF-PN',
        code: 'FLOW-PN',
        name: '零件号申请',
        formFields: [
          { key: 'customer', label: '客户名称' },
          { key: 'vehicleModel', label: '车型' },
          { key: 'applyType', label: '发起类型' },
          { key: 'productName', label: '产品名称' },
          { key: 'generatedCode', label: '最终内部型号' }
        ],
        startNodeId: 'pn1',
        nodes: [
          { id: 'pn1', name: '发起（项目经理/分项目经理/电子/结构/工艺技术管理部）', type: 'start' },
          { id: 'pn2', name: '产品总监审核', type: 'approve', approverRole: '产品总监', slaHours: 48, escalateToRole: '总经理' },
          { id: 'pn3', name: '项目号管理专员编号确认', type: 'approve', approverRole: '项目号管理专员', slaHours: 24, escalateToRole: '产品总监' },
          { id: 'pn4', name: '标准化批准', type: 'approve', approverRole: '标准化专员', slaHours: 24, escalateToRole: '产品总监' },
          { id: 'pn5', name: '结束', type: 'end' }
        ],
        enabled: true,
        version: 1
      }
    ] as FlowDefinition[],
    /** 审批链—阶段绑定（APR-002：每个阶段走一条标准四步审批链，作为闸门放行的审批证据） */
    approvalBindings: [
      { stageCode: 'S1', defId: 'DEF-STAGE-S1', label: '立项与策划审批' },
      { stageCode: 'S2', defId: 'DEF-STAGE-S2', label: '产品设计与开发审批' },
      { stageCode: 'S3', defId: 'DEF-STAGE-S3', label: '过程设计与开发审批' },
      { stageCode: 'S4', defId: 'DEF-STAGE-S4', label: '试制与 OTS 验证审批' },
      { stageCode: 'S5', defId: 'DEF-STAGE-S5', label: '量产与交付审批' },
      { stageCode: 'S6', defId: 'DEF-STAGE-S6', label: '反馈与改进审批' }
    ] as ApprovalBinding[],
    /** 交付物—审批链绑定（P3：必交交付物走审批链，审批完成才算「有效提供」） */
    deliverableApprovalBindings: [
      { deliverableId: 'D1', defId: 'DEF-DEL-D1', label: '系统需求规格书审批' },
      { deliverableId: 'D2', defId: 'DEF-DEL-D2', label: '系统架构设计说明审批' },
      { deliverableId: 'D3', defId: 'DEF-DEL-D3', label: '硬件原理图与 PCB 审批' },
      { deliverableId: 'D4', defId: 'DEF-DEL-D4', label: '安全分析报告审批' },
      { deliverableId: 'D5', defId: 'DEF-DEL-D5', label: '软件发布包审批' },
      { deliverableId: 'D6', defId: 'DEF-DEL-D6', label: 'DV/PV 试验报告审批' },
      { deliverableId: 'D7', defId: 'DEF-DEL-D7', label: 'OTS 样件认可报告审批' },
      { deliverableId: 'D8', defId: 'DEF-DEL-D8', label: 'PPAP 文件包审批' },
      { deliverableId: 'D9', defId: 'DEF-DEL-D9', label: '追溯矩阵审批' },
      { deliverableId: 'D10', defId: 'DEF-DEL-D10', label: '交付清单与签收单审批' }
    ] as DeliverableApprovalBinding[],
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
      },
      // 项目前期审批实例（演示，按项目聚合监视）
      // P-001 E15 车身域控制器：五条流程齐全，其中前期交流/TR/报价进行中，立项/立项评审已完成
      {
        id: 'PRE-1-001', defId: 'DEF-PRE-1', defCode: 'FLOW-PRE-1', title: 'E15 车身域控制器项目前期交流申请', submitter: '市场客户经理 王芳', projectId: 'P-001',
        form: { customer: '示例汽车', productLine: '车身域控制器', budget: 1280000 }, currentNodeId: 'p3', status: '运行中', passedNodeIds: ['p1', 'p2'], history: [],
        nodeEnteredAt: '2026-11-03T08:30:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-28T08:30:00+08:00'
      },
      {
        id: 'PRE-5-001', defId: 'DEF-PRE-5', defCode: 'FLOW-PRE-5', title: 'E15 车身域控制器技术方案（TR）', submitter: '技术负责人 郑昊', projectId: 'P-001',
        form: { name: '车身域控制器技术方案', version: 'V1.2', trResult: '待评审' }, currentNodeId: 'tr2', status: '运行中', passedNodeIds: ['tr1'], history: [],
        nodeEnteredAt: '2026-11-03T10:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-03T10:00:00+08:00'
      },
      {
        id: 'PRE-2-001', defId: 'DEF-PRE-2', defCode: 'FLOW-PRE-2', title: 'E15 车身域控制器报价', submitter: '市场客户经理 王芳', projectId: 'P-001',
        form: { productLine: '车身域控制器', annualVolume: 120000, unitPriceInVat: 576.85 }, currentNodeId: 'q2', status: '运行中', passedNodeIds: ['q1'], history: [],
        nodeEnteredAt: '2026-11-04T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-04T09:00:00+08:00'
      },
      {
        id: 'PRE-3-001', defId: 'DEF-PRE-3', defCode: 'FLOW-PRE-3', title: 'E15 车身域控制器立项申请', submitter: '市场客户经理 王芳', projectId: 'P-001',
        form: { name: 'E15 车身域控制器开发', annualVolume: 150000, lifecycleYears: 5 }, currentNodeId: 'b5', status: '已完成', passedNodeIds: ['b1', 'b2', 'b3', 'b4'], history: [],
        nodeEnteredAt: '2026-10-20T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-20T09:00:00+08:00', finishedAt: '2026-10-22T18:00:00+08:00'
      },
      {
        id: 'PRE-4-001', defId: 'DEF-PRE-4', defCode: 'FLOW-PRE-4', title: 'E15 车身域控制器立项评审', submitter: '市场客户经理 王芳', projectId: 'P-001',
        form: { name: 'E15 车身域控制器开发', level: 'L2', reviewConclusion: '通过' }, currentNodeId: 'r4', status: '已完成', passedNodeIds: ['r1', 'r2', 'r3'], history: [],
        nodeEnteredAt: '2026-10-22T10:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-22T10:00:00+08:00', finishedAt: '2026-10-24T17:00:00+08:00'
      },
      // P-002 B30 智能座舱：前期交流已完成，TR 运行中，其余未启动
      {
        id: 'PRE-1-002', defId: 'DEF-PRE-1', defCode: 'FLOW-PRE-1', title: 'B30 智能座舱域控平台前期交流申请', submitter: '市场客户经理 李敏', projectId: 'P-002',
        form: { customer: '示例汽车', productLine: '智能座舱', budget: 7600000 }, currentNodeId: 'p5', status: '已完成', passedNodeIds: ['p1', 'p2', 'p3', 'p4'], history: [],
        nodeEnteredAt: '2026-10-15T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-15T09:00:00+08:00', finishedAt: '2026-10-18T16:00:00+08:00'
      },
      {
        id: 'PRE-5-002', defId: 'DEF-PRE-5', defCode: 'FLOW-PRE-5', title: 'B30 智能座舱域控平台技术方案（TR）', submitter: '技术负责人 郑昊', projectId: 'P-002',
        form: { name: '智能座舱域控平台技术方案', version: 'V1.0', trResult: '待评审' }, currentNodeId: 'tr2', status: '运行中', passedNodeIds: ['tr1'], history: [],
        nodeEnteredAt: '2026-11-04T14:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-04T14:00:00+08:00'
      },
      // P-003 C11 电池管理线束：仅前期交流申请，被驳回
      {
        id: 'PRE-1-003', defId: 'DEF-PRE-1', defCode: 'FLOW-PRE-1', title: 'C11 电池管理线束改型前期交流申请', submitter: '市场客户经理 王芳', projectId: 'P-003',
        form: { customer: '宁德时代', productLine: '高压电气', budget: 2600000 }, currentNodeId: 'p2', status: '已驳回', passedNodeIds: ['p1'], history: [],
        nodeEnteredAt: '2026-11-02T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-02T09:00:00+08:00', finishedAt: '2026-11-02T11:00:00+08:00'
      },
      // 交付物审批实例（P3：交付物绑定审批，体现「已批准」与「进行中」两态）
      {
        id: 'FD-001', defId: 'DEF-DEL-D1', defCode: 'FLOW-DEL-1', title: 'DEL-001 系统需求规格书审批', submitter: '郑昊',
        form: { deliverable: 'DEL-001' }, currentNodeId: 'en', status: '已完成', passedNodeIds: ['st', 'rv', 'sg', 'ap'], history: [],
        nodeEnteredAt: '2026-10-20T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-20T09:00:00+08:00', finishedAt: '2026-10-23T18:00:00+08:00'
      },
      {
        id: 'FD-002', defId: 'DEF-DEL-D2', defCode: 'FLOW-DEL-2', title: 'DEL-002 系统架构设计说明审批', submitter: '郑昊',
        form: { deliverable: 'DEL-002' }, currentNodeId: 'en', status: '已完成', passedNodeIds: ['st', 'rv', 'sg', 'ap'], history: [],
        nodeEnteredAt: '2026-10-22T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-10-22T09:00:00+08:00', finishedAt: '2026-10-25T17:00:00+08:00'
      },
      {
        id: 'FD-004', defId: 'DEF-DEL-D4', defCode: 'FLOW-DEL-4', title: 'DEL-004 安全分析报告（HARA/TARA/FMEDA）审批', submitter: '吴敏',
        form: { deliverable: 'DEL-004' }, currentNodeId: 'rv', status: '运行中', passedNodeIds: ['st'], history: [],
        nodeEnteredAt: '2026-11-02T10:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-02T10:00:00+08:00'
      },
      {
        id: 'FD-007', defId: 'DEF-DEL-D7', defCode: 'FLOW-DEL-7', title: 'DEL-007 OTS 样件认可报告审批', submitter: '质量工程师 顾晨',
        form: { deliverable: 'DEL-007' }, currentNodeId: 'rv', status: '运行中', passedNodeIds: ['st'], history: [],
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

export type SeedData = ReturnType<typeof buildDemoSeed>

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
