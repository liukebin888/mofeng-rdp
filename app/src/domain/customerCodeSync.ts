/**
 * 客户/车型主数据与产品型号编制办法（CJQW0106 B1）同步引擎
 *
 * 目标：让「基础数据 → 客户管理」中的客户编号与车型，与《产品型号编制办法》
 * 附表1（顾客编码，77 条）与附表2（车型代码，1254 条）保持一致，统一由
 * 正式发布的权威字典驱动，杜绝客户主数据另起一套自定义编号/自由文本车型。
 *
 * 规则（单一权威，禁止调用方自造判定）：
 *   R-CS-CUST  客户编号必须取自附表1 顾客编码（2 位，0A~0Z 或 AA~AT）；
 *              ES 为前瞻输出特殊编码，允许存在但不计入量产客户。
 *   R-CS-VEH   车型必须取自附表2 车型代码；车型代码为 2 位数字+大写字母
 *              （O/I/J/V 除外），且必须属于所选客户（host 后缀 = 顾客编码）。
 *   R-CS-HOST  附表2 host 字段以「(顾客编码)」后缀标注主机厂，与附表1 顾客
 *              编码一一对应，据此做「客户 → 车型」的联动过滤。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - fail-closed：客户编号不在附表1 或车型代码不在附表2 时，不返回匹配结果
 *   - 数据字典只读复用，绝不改写 productCodeData.ts 原文
 */

import { CUSTOMER_CODES, VEHICLE_CODES } from './productCodeData'
import type { CustomerCode, VehicleCode } from './productCodeData'

/** 顾客编码字典（附表1 转发，供视图下拉） */
export const CUSTOMER_DICT: CustomerCode[] = CUSTOMER_CODES

/** 车型代码字典（附表2 转发，供视图下拉） */
export const VEHICLE_DICT: VehicleCode[] = VEHICLE_CODES

/** 附表2 host 字段中「(顾客编码)」后缀的提取正则 */
const HOST_CODE_RE = /\(([0-9A-Z]{2})\)\s*$/

/**
 * 从附表2 host 字段中提取主机厂对应的顾客编码。
 * 例如「一汽集团(...)\n(0A)」→ "0A"；无后缀则返回 null。
 */
export function hostCodeOf(host: string): string | null {
  const m = HOST_CODE_RE.exec(host ?? '')
  return m ? m[1] : null
}

/**
 * 校验客户编号是否合法（必须存在于附表1 顾客编码字典，或为 ES 前瞻编码）。
 */
export function isValidCustomerCode(code: string): boolean {
  if (code === 'ES') return true
  return CUSTOMER_CODES.some((c) => c.code === code)
}

/**
 * 按顾客编码查找权威客户信息（附表1）。
 */
export function customerByCode(code: string): CustomerCode | null {
  return CUSTOMER_CODES.find((c) => c.code === code) ?? null
}

/**
 * 按名称/简称/英文缩写模糊匹配权威顾客编码（附表1），用于客户主数据回填。
 * 匹配优先级：code 精确 > 简称精确 > 英文精确 > 名称包含。
 * fail-closed：找不到时返回 null，不臆造编码。
 */
export function matchCustomerCode(name: string): CustomerCode | null {
  const q = (name ?? '').trim()
  if (!q) return null
  if (CUSTOMER_CODES.some((c) => c.code === q)) return CUSTOMER_CODES.find((c) => c.code === q) ?? null
  const byShort = CUSTOMER_CODES.find((c) => c.short === q)
  if (byShort) return byShort
  const byEng = CUSTOMER_CODES.find((c) => c.eng?.toUpperCase() === q.toUpperCase())
  if (byEng) return byEng
  const byName = CUSTOMER_CODES.find((c) => c.name.includes(q))
  return byName ?? null
}

/**
 * 按顾客编码从附表2 过滤该客户名下的全部车型（联动过滤）。
 * host 后缀与顾客编码一致即归属该客户。
 */
export function vehiclesForCustomer(customerCode: string): VehicleCode[] {
  return VEHICLE_CODES.filter((v) => hostCodeOf(v.host) === customerCode)
}

/**
 * 校验车型代码是否合法：2 位数字+大写字母（O/I/J/V 除外）。
 */
export function isValidVehicleCode(code: string): boolean {
  if (code.length !== 2) return false
  for (const ch of code) {
    if (ch >= '0' && ch <= '9') continue
    if (ch >= 'A' && ch <= 'Z') {
      if (['O', 'I', 'J', 'V'].includes(ch)) return false
      continue
    }
    return false
  }
  return true
}

/**
 * 将客户主数据中现有的自定义编号（如 CUST-SGMW）映射为权威顾客编码。
 * 匹配依据（按序）：已有 code 命中附表1 → 简称命中 → 名称命中 → 英文命中。
 * 返回 null 表示无法映射（fail-closed，调用方应提示用户手工选择）。
 */
export function resolveCustomerAuthority(customer: { code?: string; name: string; shortName?: string }): CustomerCode | null {
  if (customer.code && isValidCustomerCode(customer.code)) return customerByCode(customer.code)!
  const byShort = customer.shortName ? matchCustomerCode(customer.shortName) : null
  if (byShort) return byShort
  return matchCustomerCode(customer.name)
}

/**
 * 生成统一的客户+车型组合描述（视图展示用，格式「车型代码 车型名」）。
 */
export function vehicleLabel(v: VehicleCode): string {
  return `${v.code} ${v.name}`
}
