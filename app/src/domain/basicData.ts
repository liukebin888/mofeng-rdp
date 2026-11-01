/**
 * 基础数据引擎：客户（车厂）与产品三级分类（产品类别→产品线→产品）
 *
 * 能力：
 * - 客户增删改（名称/编号/车型唯一性校验）
 * - 产品三级层级校验（产品线必须挂在存在的类别下、产品必须挂在存在的产品线下）
 * - 导入（CSV 逐行解析 + 逐行校验，返回错误定位）
 * - 导出（序列化为 CSV）
 */
import type { Customer, ProductCategory, ProductLine, Product } from './types'

/** 生成短 id（演示用，确定性不足但简单） */
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// ============ 客户 ============

/** 客户名称或编号唯一性校验 */
export function validateCustomer(input: Pick<Customer, 'name' | 'code'>, list: Customer[], ignoreId?: string): { ok: boolean; note: string } {
  if (!input.name?.trim()) return { ok: false, note: '客户名称必填' }
  if (!input.code?.trim()) return { ok: false, note: '客户编号必填' }
  const dupName = list.find((c) => c.name === input.name.trim() && c.id !== ignoreId)
  if (dupName) return { ok: false, note: `客户名称「${input.name}」已存在` }
  const dupCode = list.find((c) => c.code === input.code.trim() && c.id !== ignoreId)
  if (dupCode) return { ok: false, note: `客户编号「${input.code}」已存在` }
  return { ok: true, note: '' }
}

export function addCustomer(list: Customer[], input: Omit<Customer, 'id'>): { list: Customer[]; item?: Customer; error?: string } {
  const v = validateCustomer(input, list)
  if (!v.ok) return { list, error: v.note }
  const item: Customer = { id: uid('CUST'), ...input, name: input.name.trim(), code: input.code.trim(), vehicleModels: input.vehicleModels ?? [] }
  return { list: [...list, item], item }
}

export function updateCustomer(list: Customer[], id: string, patch: Partial<Customer>): { list: Customer[]; error?: string } {
  const origin = list.find((c) => c.id === id)
  if (!origin) return { list, error: '客户不存在' }
  const merged = { ...origin, ...patch, name: (patch.name ?? origin.name).trim(), code: (patch.code ?? origin.code).trim() }
  const v = validateCustomer(merged, list, id)
  if (!v.ok) return { list, error: v.note }
  return { list: list.map((c) => (c.id === id ? merged : c)) }
}

export function removeCustomer(list: Customer[], id: string): { list: Customer[]; removed?: Customer } {
  const removed = list.find((c) => c.id === id)
  return { list: list.filter((c) => c.id !== id), removed }
}

// ============ 产品三级 ============

/** 校验产品线：类别必须存在 */
export function validateProductLine(input: { categoryId: string; name: string }, categories: ProductCategory[], lines: ProductLine[], ignoreId?: string): { ok: boolean; note: string } {
  if (!input.name?.trim()) return { ok: false, note: '产品线名称必填' }
  if (!categories.some((c) => c.id === input.categoryId)) return { ok: false, note: '所属产品类别不存在' }
  const dup = lines.find((l) => l.categoryId === input.categoryId && l.name === input.name.trim() && l.id !== ignoreId)
  if (dup) return { ok: false, note: `类别下产品线「${input.name}」已存在` }
  return { ok: true, note: '' }
}

/** 校验产品：产品线必须存在 */
export function validateProduct(input: { lineId: string; name: string }, lines: ProductLine[], products: Product[], ignoreId?: string): { ok: boolean; note: string } {
  if (!input.name?.trim()) return { ok: false, note: '产品名称必填' }
  if (!lines.some((l) => l.id === input.lineId)) return { ok: false, note: '所属产品线不存在' }
  const dup = products.find((p) => p.lineId === input.lineId && p.name === input.name.trim() && p.id !== ignoreId)
  if (dup) return { ok: false, note: `产品线下产品「${input.name}」已存在` }
  return { ok: true, note: '' }
}

/** 新增产品类别（名称唯一） */
export function addCategory(categories: ProductCategory[], name: string): { list: ProductCategory[]; item?: ProductCategory; error?: string } {
  if (!name?.trim()) return { list: categories, error: '类别名称必填' }
  if (categories.some((c) => c.name === name.trim())) return { list: categories, error: `类别「${name}」已存在` }
  const item: ProductCategory = { id: uid('CAT'), name: name.trim(), order: categories.length + 1 }
  return { list: [...categories, item], item }
}

export function addProductLine(lines: ProductLine[], categories: ProductCategory[], input: Omit<ProductLine, 'id'>): { list: ProductLine[]; item?: ProductLine; error?: string } {  const v = validateProductLine(input, categories, lines)
  if (!v.ok) return { list: lines, error: v.note }
  const item: ProductLine = { id: uid('PL'), ...input, name: input.name.trim(), order: input.order ?? lines.length + 1 }
  return { list: [...lines, item], item }
}

export function addProduct(products: Product[], lines: ProductLine[], input: Omit<Product, 'id'>): { list: Product[]; item?: Product; error?: string } {
  const v = validateProduct(input, lines, products)
  if (!v.ok) return { list: products, error: v.note }
  const item: Product = { id: uid('PRD'), ...input, name: input.name.trim(), order: input.order ?? products.length + 1 }
  return { list: [...products, item], item }
}

export function removeProductLine(lines: ProductLine[], products: Product[], id: string): { lines: ProductLine[]; products: Product[]; error?: string } {
  if (products.some((p) => p.lineId === id)) {
    return { lines, products, error: '该产品线下仍有产品，请先移除产品' }
  }
  return { lines: lines.filter((l) => l.id !== id), products }
}

export function removeProduct(products: Product[], id: string): Product[] {
  return products.filter((p) => p.id !== id)
}

/** 删除产品类别：类别下仍有产品线则拒绝 */
export function removeCategory(categories: ProductCategory[], lines: ProductLine[], id: string): { categories: ProductCategory[]; lines: ProductLine[]; error?: string } {
  if (lines.some((l) => l.categoryId === id)) {
    return { categories, lines, error: '该类别下仍有产品线，请先移除产品线' }
  }
  return { categories: categories.filter((c) => c.id !== id), lines }
}

// ============ 导入 / 导出（CSV） ============

/** 简单 CSV 转义 */
const csvCell = (v: string | number) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 客户导出为 CSV（含表头） */
export function exportCustomers(list: Customer[]): string {
  const head = ['编号', '名称', '车型']
  const rows = list.map((c) => [c.code, c.name, c.vehicleModels.join('；')].map(csvCell).join(','))
  return [head.join(','), ...rows].join('\n')
}

/** 客户导入（CSV 逐行解析 + 逐行校验，返回错误定位） */
export function parseCustomers(csv: string, existing: Customer[]): { list: Customer[]; errors: { line: number; note: string }[] } {
  const errors: { line: number; note: string }[] = []
  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { list: existing, errors: [{ line: 0, note: '文件为空' }] }
  // 跳过表头（首行含"编号"或"名称"）
  const start = lines[0].includes('编号') || lines[0].includes('名称') ? 1 : 0
  const out = [...existing]
  for (let i = start; i < lines.length; i++) {
    const lineNo = i + 1
    const cells = lines[i].split(',').map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"'))
    const code = (cells[0] || '').trim()
    const name = (cells[1] || '').trim()
    const models = (cells[2] || '').split(/[；;]/).map((m) => m.trim()).filter(Boolean)
    if (!code || !name) {
      errors.push({ line: lineNo, note: '编号或名称为空' })
      continue
    }
    const v = validateCustomer({ name, code }, out)
    if (!v.ok) {
      errors.push({ line: lineNo, note: v.note })
      continue
    }
    out.push({ id: uid('CUST'), code, name, vehicleModels: models })
  }
  return { list: out, errors }
}

/** 产品三级导出为 CSV（类别/产品线/产品） */
export function exportProducts(categories: ProductCategory[], lines: ProductLine[], products: Product[]): string {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? ''
  const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? ''
  const head = ['产品类别', '产品线', '产品']
  const rows: string[] = []
  categories.forEach((c) => {
    const cls = lines.filter((l) => l.categoryId === c.id)
    if (cls.length === 0) rows.push([c.name, '', ''].map(csvCell).join(','))
    cls.forEach((l) => {
      const ps = products.filter((p) => p.lineId === l.id)
      if (ps.length === 0) rows.push([c.name, l.name, ''].map(csvCell).join(','))
      ps.forEach((p) => rows.push([c.name, l.name, p.name].map(csvCell).join(',')))
    })
  })
  return [head.join(','), ...rows].join('\n')
}

/** 产品导入（三级结构解析，自动补建缺失的类别/产品线） */
export function parseProducts(
  csv: string,
  categories: ProductCategory[],
  lines: ProductLine[],
  products: Product[]
): { categories: ProductCategory[]; lines: ProductLine[]; products: Product[]; errors: { line: number; note: string }[] } {
  const errors: { line: number; note: string }[] = []
  const rawLines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (rawLines.length === 0) return { categories, lines, products, errors: [{ line: 0, note: '文件为空' }] }
  const start = rawLines[0].includes('产品类别') ? 1 : 0
  const cats = [...categories]
  const lns = [...lines]
  const prds = [...products]
  for (let i = start; i < rawLines.length; i++) {
    const lineNo = i + 1
    const cells = rawLines[i].split(',').map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"'))
    const catName = (cells[0] || '').trim()
    const lineName = (cells[1] || '').trim()
    const prodName = (cells[2] || '').trim()
    if (!catName) {
      errors.push({ line: lineNo, note: '产品类别为空' })
      continue
    }
    // 找或建类别
    let cat = cats.find((c) => c.name === catName)
    if (!cat) {
      cat = { id: uid('CAT'), name: catName, order: cats.length + 1 }
      cats.push(cat)
    }
    if (!lineName) continue // 只有类别，无产品线
    // 找或建产品线
    let ln = lns.find((l) => l.categoryId === cat!.id && l.name === lineName)
    if (!ln) {
      ln = { id: uid('PL'), categoryId: cat!.id, name: lineName, order: lns.length + 1 }
      lns.push(ln)
    }
    if (!prodName) continue // 只有产品线，无产品
    // 产品去重
    if (!prds.some((p) => p.lineId === ln!.id && p.name === prodName)) {
      prds.push({ id: uid('PRD'), lineId: ln!.id, name: prodName, order: prds.length + 1 })
    }
  }
  return { categories: cats, lines: lns, products: prds, errors }
}
