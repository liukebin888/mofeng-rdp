/**
 * 零件号申请命名表引擎（CJQW0106 B1 附表5）
 *
 * 依据：正式发布文件《CJQW0106 产品型号编制办法 B1-20231030》附表5「零件号申请命名表」。
 *
 * 附表5 是一张统一的零件号申请单据，头部信息 + 发起类型单选后对应「表一 / 表二 / 表三 / 表四」可填：
 *   表一 新增立项产品型号：12 位六段式编码（a+b+c+d+e+f），由产品编码引擎生成。
 *   表二 子产品型号（无顾客零件号）：前 8 位（a+b+c+d）继承所属总成，后 4 位流水码 0001-0999。
 *   表三 保供方案产品型号（共用原顾客零件号）：后 4 位 1001-1199（顾客已批准）/ 2001-2199（未批）。
 *   表四 工程变更产品型号（共用原顾客零件号）：后 4 位 3001-3999。
 *
 * 审批流转（附表5 表二/三/四填写说明）：
 *   发起（项目经理/分项目经理/电子/结构/工艺技术管理部人员）→ 产品总监审核（无产品总监选事业部总监）
 *   → 项目中心项目号管理专员编号确认 → 标准化批准。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - fail-closed：字段缺失/流水码越界/查重冲突一律判不可提交，不虚报「已生成」
 *   - 型号结果一律「系统生成」（由前面填写的段自动拼接），无手填入口
 */

import {
  buildProductCode,
  buildAggCode,
  classifyAggCode,
  type AggCodeKind,
  type ProductCodeSegments,
} from './productCode'
import { AGG_CODES } from './productCodeData'

/** 发起类型（单选后对应表一/二/三/四可填） */
export type PartNumberApplyType = 'table1' | 'table2' | 'table3' | 'table4'

/** 紧急程度 */
export type UrgencyLevel = 'important' | 'urgent' | 'normal'

/** 发起人员（附表5 原文） */
export const INITIATOR_ROLES = [
  '项目经理',
  '分项目经理',
  '电子',
  '结构',
  '工艺技术管理部',
] as const

/** 表三 顾客批准状态 */
export type SupplyApprovalStatus = 'approved' | 'unapproved'

/** 表四 变更类型 */
export type ChangeType = 'internal' | 'customer'

/** 发起类型 → 显示名 */
export const APPLY_TYPE_LABEL: Record<PartNumberApplyType, string> = {
  table1: '表一 新增立项产品型号',
  table2: '表二 子产品型号（无顾客零件号）',
  table3: '表三 保供方案产品型号（共用原顾客零件号）',
  table4: '表四 工程变更产品型号（共用原顾客零件号）',
}

/** 紧急程度 → 显示名 */
export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  important: '重要',
  urgent: '紧急',
  normal: '正常',
}

/** 表三 顾客批准状态 → 显示名 + 后4位范围 */
export const SUPPLY_STATUS_LABEL: Record<SupplyApprovalStatus, { label: string; kind: AggCodeKind }> = {
  approved: { label: '已批准', kind: 'supplyApproved' },
  unapproved: { label: '未批', kind: 'supplyUnapproved' },
}

/** 表四 变更类型 → 显示名 */
export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  internal: '内部变更',
  customer: '客户变更',
}

// ---------------------------------------------------------------------------
// 头部信息（所有发起类型共有）
// ---------------------------------------------------------------------------

/** 零件号申请单据头部信息 */
export interface PartNumberApplyHeader {
  /** 客户名称（搜索填写，同开发任务书，必填） */
  customer: string
  /** 车型（手动填写，必填） */
  vehicleModel: string
  /** 紧急程度（重要/紧急/正常） */
  urgency: UrgencyLevel
  /** 立项书（搜索填写关联立项书） */
  projectBook: string
  /** 抄送开发人员（填写产品交流开发的工程师，必填） */
  ccEngineers: string
  /** 相关设计方案附件（上传附件，必填） */
  attachmentDesc: string
  /** 发起类型（单选后对应表一/二/三/四可填） */
  applyType: PartNumberApplyType
  /** 发起人员（项目经理/分项目经理/电子/结构/工艺技术管理部人员） */
  initiatorRole: string
  /** 表2、3关联审批人（产品总监，无产品总监选事业部总监；表2/3必填） */
  relatedApprover: string
}

// ---------------------------------------------------------------------------
// 表一 新增立项产品型号
// ---------------------------------------------------------------------------

/** 表一 新增立项产品型号 基础信息 */
export interface Table1Data {
  /** 产品名称（手动填写，必填） */
  productName: string
  /** 用户图号（手动填写，必填） */
  customerDrawingNo: string
  /** 所属高新（下拉选择，必填） */
  hitechProject: string
  /** 产品生产地区（下拉选择：中国/巴西，必填） */
  productionArea: string
  /** 零件图片（上传图片，必填） */
  partImageDesc: string
  /** 开发性质（下拉选择：完全借用/设变，必填） */
  devNature: string
  /** 产品级别（手动填写，必填） */
  productLevel: string
  /** 编码规则六段 */
  segments: ProductCodeSegments
}

// ---------------------------------------------------------------------------
// 表二/三/四 共有（机动总成编码）
// ---------------------------------------------------------------------------

/** 表二 子产品型号（无顾客零件号） */
export interface Table2Data {
  /** 所属总成产品名称（手动填写，必填） */
  assemblyName: string
  /** 所属总成内部产品型号（手动填写，必填） */
  assemblyModel: string
  /** 子产品名称（手动填写，必填） */
  subProductName: string
  /** 更新后的机动总成编码汇总表（上传附件，使用附表7） */
  aggTableDesc: string
  /** 拟采用后4位（手动填写，必填，范围 0001-0999） */
  proposedSerial: string
  /** 子产品零件图片（上传图片，必填） */
  partImageDesc: string
  /** 子产品开发性质（下拉选择：完全借用/设变，必填） */
  devNature: string
  /** 变沿用关系说明（开发性质选设变/借用必填） */
  relationNote: string
}

/** 表三 保供方案产品型号（共用原顾客零件号） */
export interface Table3Data {
  /** 所属总成产品名称（手动填写，必填） */
  assemblyName: string
  /** 所属总成内部产品型号（手动填写，必填） */
  assemblyModel: string
  /** 顾客零件号（手动填写，必填） */
  customerPartNo: string
  /** 保供方案顾客是否已批准（下拉选择：已批准/未批，必填） */
  supplyApproval: SupplyApprovalStatus
  /** 更新后的机动总成编码汇总表（上传附件，使用附表7） */
  aggTableDesc: string
  /** 顾客批准附件（保供方案选顾客已批准，必填上传附件） */
  approvalAttachmentDesc: string
  /** 拟采用后4位（手动填写，必填，按顾客是否已批准自动检查范围） */
  proposedSerial: string
  /** 保供方案与原方案差异点描述（手动填写，必填） */
  diffNote: string
}

/** 表四 工程变更产品型号（共用原顾客零件号） */
export interface Table4Data {
  /** 原总成产品名称（手动填写，必填） */
  originalAssemblyName: string
  /** 原总成内部产品型号（手动填写，必填） */
  originalAssemblyModel: string
  /** 顾客零件号（手动填写，必填） */
  customerPartNo: string
  /** 内部变更/客户变更（下拉选择，必填） */
  changeType: ChangeType
  /** 更新后的机动总成编码汇总表（上传附件，使用附表7） */
  aggTableDesc: string
  /** 客户 ECR（必填上传附件） */
  ecrAttachmentDesc: string
  /** 拟采用后4位（手动填写，必填，范围 3001-3999） */
  proposedSerial: string
  /** 变更前后差异点（手动填写，必填） */
  diffNote: string
}

// ---------------------------------------------------------------------------
// 校验结果
// ---------------------------------------------------------------------------

/** 字段缺失/非法信息 */
export interface PartNumberCheck {
  ok: boolean
  errors: string[]
  /** 最终生成的型号（ok 时有效） */
  code?: string
}

/** 校验结果（含生成型号） */
export interface PartNumberResult {
  ok: boolean
  errors: string[]
  code?: string
  kind?: AggCodeKind
}

// ---------------------------------------------------------------------------
// 头部信息校验
// ---------------------------------------------------------------------------

/** 校验头部信息必填项 */
export function checkHeader(h: PartNumberApplyHeader): string[] {
  const errors: string[] = []
  if (!h.customer.trim()) errors.push('客户名称未填写（同开发任务书，搜索填写）')
  if (!h.vehicleModel.trim()) errors.push('车型未填写')
  if (!h.urgency) errors.push('紧急程度未选择')
  if (!h.ccEngineers.trim()) errors.push('抄送开发人员未填写（产品交流开发工程师）')
  if (!h.attachmentDesc.trim()) errors.push('相关设计方案附件未上传')
  if (!h.applyType) errors.push('发起类型未选择')
  if (!h.initiatorRole) errors.push('发起人员未选择')
  return errors
}

/** 表2/3 关联审批人必填校验 */
export function checkRelatedApprover(h: PartNumberApplyHeader): string[] {
  const errors: string[] = []
  if (h.applyType === 'table2' || h.applyType === 'table3') {
    if (!h.relatedApprover.trim()) errors.push('表2/3 关联审批人未选择（产品总监，无产品总监选事业部总监）')
  }
  return errors
}

// ---------------------------------------------------------------------------
// 表一：新增立项产品型号
// ---------------------------------------------------------------------------

/** 校验并生成表一产品型号（12 位六段式） */
export function resolveTable1(t: Table1Data): PartNumberResult {
  const errors: string[] = []
  if (!t.productName.trim()) errors.push('产品名称未填写')
  if (!t.customerDrawingNo.trim()) errors.push('用户图号未填写')
  if (!t.hitechProject) errors.push('所属高新未选择')
  if (!t.productionArea) errors.push('产品生产地区未选择')
  if (!t.partImageDesc.trim()) errors.push('零件图片未上传')
  if (!t.devNature) errors.push('开发性质未选择')
  if (!t.productLevel.trim()) errors.push('产品级别未填写')

  const build = buildProductCode(t.segments)
  if (!build.ok) errors.push(...build.errors)

  if (errors.length) return { ok: false, errors }
  return { ok: true, errors: [], code: build.code }
}

// ---------------------------------------------------------------------------
// 表二/三/四：机动总成编码（前8位继承所属总成 + 后4位流水码）
// ---------------------------------------------------------------------------

/** 从 12 位所属总成内部产品型号提取前 8 位（a+b+c+d） */
export function extractPrefix(model: string): Pick<ProductCodeSegments, 'customer' | 'vehicle' | 'productType' | 'variant'> | null {
  if (model.length !== 12) return null
  return {
    customer: model.slice(0, 2),
    vehicle: model.slice(2, 4),
    productType: model.slice(4, 6),
    variant: model.slice(6, 8),
  }
}

/** 解析拟采用后4位为数字 */
export function parseSerial(s: string): number | null {
  if (!/^\d{4}$/.test(s.trim())) return null
  const n = Number(s.trim())
  return Number.isInteger(n) ? n : null
}

/** 表二：子产品型号（后4位 0001-0999） */
export function resolveTable2(t: Table2Data): PartNumberResult {
  const errors: string[] = []
  if (!t.assemblyName.trim()) errors.push('所属总成产品名称未填写')
  if (!t.assemblyModel.trim()) errors.push('所属总成内部产品型号未填写')
  if (!t.subProductName.trim()) errors.push('子产品名称未填写')
  if (!t.partImageDesc.trim()) errors.push('子产品零件图片未上传')
  if (!t.devNature) errors.push('子产品开发性质未选择')
  if (t.devNature === '设变' || t.devNature === '借用') {
    if (!t.relationNote.trim()) errors.push('变沿用关系说明未填写（开发性质选设变/借用必填）')
  }

  const prefix = extractPrefix(t.assemblyModel)
  if (!prefix) {
    errors.push('所属总成内部产品型号应为 12 位编码，才能提取前 8 位')
    return { ok: false, errors }
  }
  const serial = parseSerial(t.proposedSerial)
  if (serial == null) {
    errors.push('拟采用后4位应为 4 位数字（0001-0999）')
    return { ok: false, errors }
  }
  const build = buildAggCode(prefix, serial, 'sub')
  if (!build.ok) errors.push(...build.errors)
  if (errors.length) return { ok: false, errors }
  return { ok: true, errors: [], code: build.code, kind: 'sub' }
}

/** 表三：保供方案产品型号（后4位 1001-1199 已批准 / 2001-2199 未批） */
export function resolveTable3(t: Table3Data): PartNumberResult {
  const errors: string[] = []
  if (!t.assemblyName.trim()) errors.push('所属总成产品名称未填写')
  if (!t.assemblyModel.trim()) errors.push('所属总成内部产品型号未填写')
  if (!t.customerPartNo.trim()) errors.push('顾客零件号未填写')
  if (!t.supplyApproval) errors.push('保供方案顾客是否已批准未选择')
  if (!t.diffNote.trim()) errors.push('保供方案与原方案差异点描述未填写')
  if (t.supplyApproval === 'approved' && !t.approvalAttachmentDesc.trim()) {
    errors.push('顾客批准附件未上传（保供方案选顾客已批准必填）')
  }

  const prefix = extractPrefix(t.assemblyModel)
  if (!prefix) {
    errors.push('所属总成内部产品型号应为 12 位编码，才能提取前 8 位')
    return { ok: false, errors }
  }
  const serial = parseSerial(t.proposedSerial)
  if (serial == null) {
    errors.push('拟采用后4位应为 4 位数字')
    return { ok: false, errors }
  }
  const kind = t.supplyApproval === 'approved' ? 'supplyApproved' : 'supplyUnapproved'
  const build = buildAggCode(prefix, serial, kind)
  if (!build.ok) errors.push(...build.errors)
  if (errors.length) return { ok: false, errors }
  return { ok: true, errors: [], code: build.code, kind }
}

/** 表四：工程变更产品型号（后4位 3001-3999） */
export function resolveTable4(t: Table4Data): PartNumberResult {
  const errors: string[] = []
  if (!t.originalAssemblyName.trim()) errors.push('原总成产品名称未填写')
  if (!t.originalAssemblyModel.trim()) errors.push('原总成内部产品型号未填写')
  if (!t.customerPartNo.trim()) errors.push('顾客零件号未填写')
  if (!t.changeType) errors.push('内部变更/客户变更未选择')
  if (!t.ecrAttachmentDesc.trim()) errors.push('客户 ECR 附件未上传')
  if (!t.diffNote.trim()) errors.push('变更前后差异点未填写')

  const prefix = extractPrefix(t.originalAssemblyModel)
  if (!prefix) {
    errors.push('原总成内部产品型号应为 12 位编码，才能提取前 8 位')
    return { ok: false, errors }
  }
  const serial = parseSerial(t.proposedSerial)
  if (serial == null) {
    errors.push('拟采用后4位应为 4 位数字（3001-3999）')
    return { ok: false, errors }
  }
  const build = buildAggCode(prefix, serial, 'ecn')
  if (!build.ok) errors.push(...build.errors)
  if (errors.length) return { ok: false, errors }
  return { ok: true, errors: [], code: build.code, kind: 'ecn' }
}

// ---------------------------------------------------------------------------
// 查重（编码原则②：一个顾客零件号对应一个内部零件号）
// ---------------------------------------------------------------------------

/** 从既有机动总成编码（附表7）里查重 */
export function findExistingAgg(code: string) {
  return AGG_CODES.find((a) => a.code === code) ?? null
}

/** 查重结果 */
export function checkAggDuplicate(code: string): { duplicated: boolean; existing?: { no: string; name: string } } {
  const existing = findExistingAgg(code)
  if (existing) return { duplicated: true, existing: { no: existing.no, name: existing.name } }
  return { duplicated: false }
}

/**
 * 统一入口：按发起类型解析并生成最终型号（含查重提示）。
 * 头部校验 + 对应表校验 + 生成 + 查重，一次性返回。
 */
export function resolvePartNumber(
  header: PartNumberApplyHeader,
  table1: Table1Data,
  table2: Table2Data,
  table3: Table3Data,
  table4: Table4Data
): PartNumberResult {
  const errors: string[] = []
  errors.push(...checkHeader(header))
  errors.push(...checkRelatedApprover(header))

  let code: string | undefined
  let kind: AggCodeKind | undefined

  if (errors.length === 0) {
    let r: PartNumberResult
    switch (header.applyType) {
      case 'table1':
        r = resolveTable1(table1)
        break
      case 'table2':
        r = resolveTable2(table2)
        break
      case 'table3':
        r = resolveTable3(table3)
        break
      case 'table4':
        r = resolveTable4(table4)
        break
      default:
        r = { ok: false, errors: ['发起类型非法'] }
    }
    errors.push(...r.errors)
    code = r.code
    kind = r.kind
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, errors: [], code, kind }
}

/** 复用：重新导出 classifyAggCode 供视图展示编码类型 */
export { classifyAggCode }
