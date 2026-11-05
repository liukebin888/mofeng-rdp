/**
 * 产品型号编制引擎（CJQW0106 B1）
 *
 * 依据：正式发布文件《CJQW0106 产品型号编制办法 B1-20231030》第 1 章「编制规定」。
 *
 * 核心规则（单一权威，禁止调用方自造判定）：
 *   R-PC-12     正常项目产品编码共 12 位固定代码，分六部分：
 *                 a 顾客代码(2) + b 车型代码(2) + c 产品类型代码(2) + d 配置变形代码(2) + e 技术特征代码(3) + f 生产基地代码(1)
 *   R-PC-CUST   a 顾客代码：固定 2 位数字或字母。原 1 位客户升级为 2 位（第 1 位补 0）；新增客户用 2 位大写字母；ES 为未立项前瞻输出。
 *   R-PC-VEH    b 车型代码：数字+大写字母（O、I、J、V 除外）固定 2 位，数字为 0 时不可省略。
 *   R-PC-TYPE   c 产品类型代码：固定 2 位数字+大写字母（O、I、J、V 除外），数字为 0 时不可省略。
 *   R-PC-VAR    d 配置变形代码：固定 2 位大写字母；无变形 AA，第一次变形 BA，第二次 CA，依次类推。
 *   R-PC-FEAT   e 技术特征代码：固定 3 位数字或大写字母（附表3）。第 1 位电子相关、第 2 位结构、第 3 位产品平台预定义。
 *   R-PC-BASE   f 生产基地代码：固定 1 位大写字母；A=温州，B=巴西。
 *   R-PC-SUB    复杂项目子总成编码：a+b+c+d+g（g 范围 0001-0999）。
 *   R-PC-SUPPLY 保供方案总成编码：a+b+c+d+h（h 范围 1001-1199 多物料保供已批 / 2001-2199 未获批准）。
 *   R-PC-ECN    工程变更总成编码：a+b+c+d+i（i 范围 3001-3999，一次工程变更增加一次流水码数字）。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - fail-closed：六段任一缺失/非法即判不可生成，不虚报「已生成」
 *   - 禁用字符：车型/产品类型代码不得使用 O、I、J、V
 */

import { CUSTOMER_CODES, VEHICLE_CODES, PRODUCT_TYPE_CODES, STRUCT_TYPE_BLOCKS } from './productCodeData'

/** 六段式编码的六个部分 */
export interface ProductCodeSegments {
  /** a 顾客代码（2 位） */
  customer: string
  /** b 车型代码（2 位） */
  vehicle: string
  /** c 产品类型代码（2 位） */
  productType: string
  /** d 配置变形代码（2 位） */
  variant: string
  /** e 技术特征代码（3 位） */
  feature: string
  /** f 生产基地代码（1 位） */
  base: string
}

/** 生产基地代码（附表原文固定） */
export const BASE_CODES: Record<string, string> = {
  A: '温州',
  B: '巴西',
}

/** 车型/产品类型代码禁用字母（O、I、J、V） */
export const FORBIDDEN_LETTERS = ['O', 'I', 'J', 'V']

/** 生产基地代码合法值 */
export const VALID_BASE_CODES = ['A', 'B']

/** 机动总成编码类型 */
export type AggCodeKind = 'sub' | 'supplyApproved' | 'supplyUnapproved' | 'ecn'

/** 机动总成编码流水码范围定义（附表7原文） */
export const AGG_CODE_RANGES: Record<AggCodeKind, { min: number; max: number; label: string }> = {
  sub: { min: 1, max: 999, label: '内部子总成编码（半成品）' },
  supplyApproved: { min: 1001, max: 1199, label: '多物料保供总成编码（顾客已批准）' },
  supplyUnapproved: { min: 2001, max: 2199, label: '多物料保供总成编码（未获顾客批准）' },
  ecn: { min: 3001, max: 3999, label: '工程变更总成编码' },
}

/** 校验结果 */
export interface ProductCodeCheck {
  /** 是否合法 */
  ok: boolean
  /** 错误信息列表 */
  errors: string[]
}

/**
 * 校验单个代码段是否为「数字 + 大写字母（O/I/J/V 除外）」且长度固定。
 */
function isAlnumNoForbidden(s: string, len: number): boolean {
  if (s.length !== len) return false
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') continue
    if (ch >= 'A' && ch <= 'Z') {
      if (FORBIDDEN_LETTERS.includes(ch)) return false
      continue
    }
    return false
  }
  return true
}

/**
 * 校验顾客代码（2 位）。
 * 规则：固定 2 位数字或大写字母。ES 为前瞻项目特殊顾客编码。
 */
export function checkCustomerCode(code: string): boolean {
  if (code === 'ES') return true
  return isAlnumNoForbidden(code, 2)
}

/**
 * 校验车型代码（2 位）：数字+大写字母（O/I/J/V 除外），数字为 0 时不可省略。
 */
export function checkVehicleCode(code: string): boolean {
  return isAlnumNoForbidden(code, 2)
}

/**
 * 校验产品类型代码（2 位）：数字+大写字母（O/I/J/V 除外）。
 */
export function checkProductTypeCode(code: string): boolean {
  return isAlnumNoForbidden(code, 2)
}

/**
 * 校验配置变形代码（2 位大写字母）。
 * 无变形 AA、第一次 BA、第二次 CA，依次类推。
 */
export function checkVariantCode(code: string): boolean {
  if (code.length !== 2) return false
  for (const ch of code) {
    if (!(ch >= 'A' && ch <= 'Z')) return false
  }
  return true
}

/**
 * 校验技术特征代码（3 位数字或大写字母）。
 */
export function checkFeatureCode(code: string): boolean {
  if (code.length !== 3) return false
  for (const ch of code) {
    if (ch >= '0' && ch <= '9') continue
    if (ch >= 'A' && ch <= 'Z') continue
    return false
  }
  return true
}

/**
 * 校验生产基地代码（1 位大写字母，A/B）。
 */
export function checkBaseCode(code: string): boolean {
  return VALID_BASE_CODES.includes(code)
}

/**
 * 生成正常项目产品型号（12 位六段式）。
 * fail-closed：任一段非法即返回 { ok: false }，不产出型号。
 */
export function buildProductCode(seg: ProductCodeSegments): ProductCodeCheck & { code?: string } {
  const errors: string[] = []
  if (!checkCustomerCode(seg.customer)) errors.push('顾客代码应为固定 2 位数字或大写字母（ES 为前瞻项目）')
  if (!checkVehicleCode(seg.vehicle)) errors.push('车型代码应为固定 2 位数字+大写字母（O/I/J/V 除外）')
  if (!checkProductTypeCode(seg.productType)) errors.push('产品类型代码应为固定 2 位数字+大写字母（O/I/J/V 除外）')
  if (!checkVariantCode(seg.variant)) errors.push('配置变形代码应为固定 2 位大写字母')
  if (!checkFeatureCode(seg.feature)) errors.push('技术特征代码应为固定 3 位数字或大写字母')
  if (!checkBaseCode(seg.base)) errors.push('生产基地代码应为 1 位大写字母（A=温州，B=巴西）')

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  const code = seg.customer + seg.vehicle + seg.productType + seg.variant + seg.feature + seg.base
  return { ok: true, errors: [], code }
}

/**
 * 解析 12 位产品型号为六段。
 */
export function parseProductCode(code: string): ProductCodeSegments | null {
  if (code.length !== 12) return null
  return {
    customer: code.slice(0, 2),
    vehicle: code.slice(2, 4),
    productType: code.slice(4, 6),
    variant: code.slice(6, 8),
    feature: code.slice(8, 11),
    base: code.slice(11, 12),
  }
}

/**
 * 生成机动总成编码（子总成/保供/工程变更）。
 * 规则：前 8 位（a+b+c+d）与所属总成一致，后 4 位为流水码。
 */
export function buildAggCode(seg: Pick<ProductCodeSegments, 'customer' | 'vehicle' | 'productType' | 'variant'>, serial: number, kind: AggCodeKind): ProductCodeCheck & { code?: string } {
  const errors: string[] = []
  if (!checkCustomerCode(seg.customer)) errors.push('顾客代码应为固定 2 位数字或大写字母')
  if (!checkVehicleCode(seg.vehicle)) errors.push('车型代码应为固定 2 位数字+大写字母（O/I/J/V 除外）')
  if (!checkProductTypeCode(seg.productType)) errors.push('产品类型代码应为固定 2 位数字+大写字母（O/I/J/V 除外）')
  if (!checkVariantCode(seg.variant)) errors.push('配置变形代码应为固定 2 位大写字母')

  const range = AGG_CODE_RANGES[kind]
  if (!Number.isInteger(serial) || serial < range.min || serial > range.max) {
    errors.push(`流水码应在 ${range.min}-${range.max} 范围内（${range.label}）`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  const prefix = seg.customer + seg.vehicle + seg.productType + seg.variant
  const code = prefix + String(serial).padStart(4, '0')
  return { ok: true, errors: [], code }
}

/**
 * 根据流水码判断机动总成编码类型。
 */
export function classifyAggCode(code: string): AggCodeKind | null {
  if (code.length !== 12) return null
  const serial = Number(code.slice(8, 12))
  if (!Number.isInteger(serial)) return null
  if (serial >= 1 && serial <= 999) return 'sub'
  if (serial >= 1001 && serial <= 1199) return 'supplyApproved'
  if (serial >= 2001 && serial <= 2199) return 'supplyUnapproved'
  if (serial >= 3001 && serial <= 3999) return 'ecn'
  return null
}

/**
 * 校验 12 位产品型号的完整合法性（含查重之外的格式校验）。
 */
export function validateProductCode(code: string): ProductCodeCheck {
  const errors: string[] = []
  if (code.length !== 12) {
    return { ok: false, errors: ['产品型号应为 12 位固定代码'] }
  }
  const seg = parseProductCode(code)!
  if (!checkCustomerCode(seg.customer)) errors.push('顾客代码非法')
  if (!checkVehicleCode(seg.vehicle)) errors.push('车型代码非法（不得含 O/I/J/V）')
  if (!checkProductTypeCode(seg.productType)) errors.push('产品类型代码非法（不得含 O/I/J/V）')
  if (!checkVariantCode(seg.variant)) errors.push('配置变形代码应为 2 位大写字母')
  if (!checkFeatureCode(seg.feature)) errors.push('技术特征代码应为 3 位数字或大写字母')
  if (!checkBaseCode(seg.base)) errors.push('生产基地代码应为 A 或 B')
  return { ok: errors.length === 0, errors }
}

/**
 * 查重：在既有产品型号列表中检查是否重复。
 * 规则（编码原则②）：一个客户零件号对应一个内部零件号。
 */
export function checkDuplicate(code: string, existingCodes: string[]): boolean {
  return existingCodes.includes(code)
}

/** 查询字典 */
export function findCustomer(code: string) {
  return CUSTOMER_CODES.find((c) => c.code === code) ?? null
}

export function findVehicles(code: string) {
  return VEHICLE_CODES.filter((v) => v.code === code)
}

export function findProductType(code: string) {
  return PRODUCT_TYPE_CODES.find((p) => p.code === code) ?? null
}

export function findStructBlock(typeCode: string) {
  return STRUCT_TYPE_BLOCKS.find((b) => b.typeCode === typeCode) ?? null
}
