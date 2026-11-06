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
    account: `user.${r.code.toLowerCase()}`
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
      account: `user.eng${String(i + 1).padStart(2, '0')}`
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
    { id: 'G', name: '集团总部', level: 'group', parentId: null, leaderTitle: '总裁', leaderName: '陈志远', system: '集团', order: 1 },
    { id: 'C', name: '研发制造公司', level: 'company', parentId: 'G', leaderTitle: '总经理', leaderName: '林静', order: 1 },
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
    r('NM-1', 'customer', 'naming', '客户全称规范', '客户工商注册全称，不含「有限公司」缩写以外的简称', '客户全称示例', true, undefined, { minLength: 4, maxLength: 30 }),
    r('NM-2', 'customer', 'naming', '客户简称规范', '2~4 字通用简称，用于台账与报表展示', '客户甲 / 客户乙 / 客户丙', true, undefined, { minLength: 2, maxLength: 4 }),
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
  // 平台为通用研发项目管理工具，不预置任何演示项目数据。
  // 项目一律由用户通过「立项」工作流创建；发布基线中项目台账初始为空。
  void users
  return []
}

/** WBS：工作分解结构。平台为通用研发管理工具，不预置演示数据，由用户在项目下自行拆解。 */
function buildWbs(): WbsNode[] {
  return []
}

/** 跨专业交接点（界面计划管理 / Oracle Interface Plan 对标）：不预置演示数据。 */
function buildHandoffs(): HandoffPoint[] {
  return []
}

/**
 * 界面（接口）计划 seed（SCH-022 跨项目接口，四要素齐备）。
 * 与 handoffs（项目内跨专业）互补：此处为 A 项目 → B 项目的跨项目交付接口。
 * 平台为通用研发管理工具，不预置演示数据。
 */
function buildInterfacePlans(): InterfacePlan[] {
  return []
}

/**
 * 组合闸门一致性 seed（PFM-011）：各项目对 G1~G5 的判据集声明。
 * 不预置演示数据，判据集随项目立项后由用户建立。
 */
function buildGateDecls(): ProjectGateDecl[] {
  return []
}

/** 需求：平台为通用研发管理工具，不预置演示数据，由用户在项目下自行条目化。 */
function buildRequirements(): { reqs: Requirement[]; links: TraceLink[] } {
  return { reqs: [], links: [] }
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
  // 平台为通用研发管理工具，不预置演示 BOM，由用户在项目下自行建立。
  return []
}

/** 构造合规归档层（ARC-001：审批 + 输出物条目，保留期 15 年，复用归档引擎） */
function buildSampleArchive(): ArchiveLayer {
  // 平台为通用研发管理工具，不预置归档卷，归档卷随项目归档时产生。
  return { volumes: [] }
}

export function buildSeed() {
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

  const risks: RiskItem[] = []

  /** 机会型/威胁型极性风险（概率×影响量化，对标 Oracle 风险机会管理 P2） */
  const polarityRisks: PolarityRisk[] = []

  const ecrs: EcrItem[] = []

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

  const deliverables: Deliverable[] = []

  /** 成本科目（8 列归集表输入：估算/预算/控制/变更） */
  const costSubjects: CostSubject[] = [
    { code: 'C-100', name: '结构件材料', wbsCode: '3.1', estimate: 120, budget: 115, control: 115, change: 5 },
    { code: 'C-200', name: '电子物料采购', wbsCode: '3.2', estimate: 260, budget: 250, control: 250, change: -10 },
    { code: 'C-300', name: '软件外包', wbsCode: '4.1', estimate: 180, budget: 180, control: 180, change: 0 },
    { code: 'C-400', name: '试验与认证', wbsCode: '5.5', estimate: 140, budget: 135, control: 135, change: 8 },
    { code: 'C-500', name: '试制工装', wbsCode: '5.4', estimate: 90, budget: 85, control: 85, change: 0 }
  ]

  /** 四类成本单据（人工时/采购合同/服务合同/其它费用） */
  const costDocs: CostDoc[] = []

  /**
   * 报价费用明细（单一数据源）：八类费用的明细行，由「报价费用明细表单」填报，
   * 报价单自动汇总引入。平台为通用研发管理工具，不预置演示数据。
   */
  const quoteCosts: QuoteCostSheet = {
    material: [],
    manufacturing: [],
    packaging: [],
    development: [],
    tooling: [],
    equipment: [],
    testing: [],
    compliance: []
  }


  const docs: DocItem[] = []

  /**
   * OTS 认可三大条件附件（单一数据源）。
   * 三大条件结果只由这些附件数据自动导出（domain/otsApproval），视图不可手填。
   * 平台为通用研发管理工具，不预置演示数据。
   */
  const otsAttachments: {
    archiveTable: DesignArchiveTable
    sampleReview: SampleReviewReport
    dvReport: DvTestReport
  } = {
    archiveTable: { projectId: '', parts: [] },
    sampleReview: { projectId: '', sampleNo: '', reviewer: '', reviewedAt: '', items: [] },
    dvReport: { projectId: '', reportNo: '', hasMajorIssue: false, testBy: '', testedAt: '', items: [] }
  }

  /** 图文档在线批注（空间锚定，对标 Oracle 图文档批注 P2） */
  const docAnnotations: DocAnnotation[] = []

  const samples: SampleReq[] = []

  // —— 漏洞台账 + 8D（QMS-003/004/005）——
  const defects: { vulns: VulnerabilityItem[]; issues8D: Issue8D[] } = {
    vulns: [],
    issues8D: []
  }

  // —— 软件配置项 SCI + 兼容记录 + 发布双签（VER-001/008/009/015）——
  const softwareVersions: { scis: Sci[]; compat: CompatibilityRecord[]; signoff: ReleaseSignoff } = {
    scis: [],
    compat: [],
    signoff: { rndSignedBy: '', qualitySignedBy: '' }
  }

  const hours: HourRecord[] = []

  const baselines: Baseline[] = []

  const audit: AuditRow[] = []

  // —— C-34 阶段复盘 / C-35 经验库 / C-46 纠偏（业务实体，控制点同源判定）——
  const retros: RetroItem[] = []

  const lessons: LessonItem[] = []

  const deviations: DeviationItem[] = []

  // —— COM 协同沟通域（会议决议 / 送审件 / 督办，替换视图内硬编码假数据）——
  const resolutions: ResolutionItem[] = []

  const meetings: MeetingItem[] = []

  const sendAudits: SendAuditItem[] = []

  const supervises: SuperviseItem[] = []

  // —— PFM 组合与投资域（ROI 收益计划 / 决策留痕 / What-if 场景）——
  const investments: ProjectInvestment[] = []

  const decisions: DecisionRecord[] = []

  const whatIfs: WhatIfScenario[] = []

  // 三层日历（TEN-015）：企业 → 项目 → 资源，下层继承上层，例外日覆盖继承
  const calendars: CalendarDef[] = [
    {
      id: 'CAL-ENT', level: '企业', name: '集团标准日历', workdays: [1, 2, 3, 4, 5], hoursPerDay: 8,
      exceptions: [{ id: 'CE1', date: '2026-10-01', type: '休息日', reason: '国庆节' }, { id: 'CE2', date: '2026-10-02', type: '休息日', reason: '国庆节' }]
    },
    {
      id: 'CAL-RES', level: '资源', name: '台架资源日历', parentId: 'CAL-ENT', workdays: [1, 2, 3, 4, 5, 6], hoursPerDay: 10, scopeId: 'RIG-01',
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

  // 消息与收件箱（POR-006 / POR-008）：平台为通用研发管理工具，不预置演示数据
  const messages: MessageItem[] = []
  const inboxItems: InboxItem[] = []

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
  const aiCorpus: AiCorpusItem[] = []

  /** AI 两级开关（AIA-007）：总开关开启 + 项目级开关 + 一条已到期的临时开启（演示自动关闭） */
  const aiSwitch: AiSwitchConfig = {
    globalEnabled: true,
    projectSwitches: {},
    temporary: { enabled: false, reason: '', expireAt: '2026-10-01T00:00:00.000Z' }
  }

  /** AI 调用日志（附录 B.3 ai_call_log）：平台不预置演示数据 */
  const aiCallLogs: AiCallLog[] = []

  const schemeLinked = true
  const quoteLinked = true

  return {
    version: SEED_VERSION,
    tenantId: TENANT,
    /** 当前项目所用研发阶段模板（STG-001：默认汽车零部件六阶段，可配置切换） */
    stageTemplateId: 'TPL-AUTO',
    tenant: { code: 'T-1001', name: '默认集团租户', type: '集团租户', isolation: 'SHARED' },
    /** 集团—子租户两级结构（TEN-002/TEN-003）：T-1001 集团 + T-1002/T-1003 子租户 */
    tenants: [
      { code: 'T-1001', name: '默认集团租户', type: '集团租户', isolation: 'SHARED' },
      { code: 'T-1002', name: '子租户 A', type: '子租户', isolation: 'SHARED', parentCode: 'T-1001', sharedMetrics: ['项目数', '在研项目', 'Gate 通过率'] },
      { code: 'T-1003', name: '子租户 B', type: '子租户', isolation: 'SCHEMA', parentCode: 'T-1001', sharedMetrics: ['项目数', '风险敞口'] }
    ],
    /** 空间（项目组合，SPA-001）：租户之下的聚合维度，顶部切换器切换 */
    spaces: [
      { id: 'SP-001', code: 'SP-DEFAULT', name: '默认项目组合', tenantId: 'T-1001', type: '项目组合', roleBoundary: ['PM', 'SYS_ADMIN', 'OPS'], resourcePoolIds: ['NODE-1', 'NODE-2'], costSubjectIds: ['C-100'] },
      { id: 'SP-002', code: 'SP-GENERAL', name: '通用项目组合', tenantId: 'T-1001', type: '项目组合', roleBoundary: [], resourcePoolIds: ['NODE-3'], costSubjectIds: ['C-200'] },
      { id: 'SP-003', code: 'SP-SUB-A', name: '子租户 A 项目集', tenantId: 'T-1002', type: '项目组合', roleBoundary: [], resourcePoolIds: ['NODE-1'], costSubjectIds: ['C-300'] },
      { id: 'SP-004', code: 'SP-SUB-B', name: '子租户 B 项目集', tenantId: 'T-1003', type: '项目组合', roleBoundary: [], resourcePoolIds: ['NODE-2'], costSubjectIds: ['C-400'] }
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
    gateRuns: []
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
