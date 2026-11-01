/**
 * 齐套引擎（SRS 18.2 / HW-004、K9）
 * EBOM 三层用量自下而上汇总；齐套率 = 满足需求的可开工项 / 应有项
 */
import type { BomNode, SampleReq } from './types'

export interface KitLine {
  materialCode: string
  name: string
  level: number
  requiredQty: number
  available: number
  shortage: number
  supplierCode?: string
  ok: boolean
}

/** 按样件需求数量展开 EBOM：自下而上汇总用量 */
export function explodeBom(bom: BomNode[], sampleQty: number): KitLine[] {
  const byCode = new Map(bom.map((b) => [b.materialCode, b]))
  const children = new Map<string, BomNode[]>()
  for (const b of bom) {
    if (!b.parentMaterialCode) continue
    children.set(b.parentMaterialCode, [...(children.get(b.parentMaterialCode) || []), b])
  }
  const lines: KitLine[] = []
  const walk = (code: string, mult: number, level: number) => {
    const node = byCode.get(code)
    if (!node) return
    const requiredQty = Math.round(node.qty * mult * sampleQty * 1000) / 1000
    const available = node.stock + node.incoming
    lines.push({
      materialCode: node.materialCode,
      name: node.name,
      level,
      requiredQty,
      available,
      shortage: Math.max(0, Math.round((requiredQty - available) * 1000) / 1000),
      supplierCode: node.supplierCode,
      ok: available >= requiredQty
    })
    for (const c of children.get(code) || []) walk(c.materialCode, mult * node.qty, level + 1)
  }
  const roots = bom.filter((b) => !b.parentMaterialCode)
  for (const r of roots) walk(r.materialCode, 1, 1)
  return lines
}

export function kitRate(lines: KitLine[]) {
  if (!lines.length) return { rate: 100, blocked: false, shortages: [] as KitLine[] }
  const ok = lines.filter((l) => l.ok).length
  const rate = Math.round((ok / lines.length) * 10000) / 100
  const shortages = lines.filter((l) => !l.ok)
  return { rate, blocked: shortages.length > 0, shortages }
}

/** 样件开工门（K9：不齐套不开工） */
export function canStartTrial(sample: SampleReq, lines: KitLine[]) {
  const { rate, blocked, shortages } = kitRate(lines)
  return {
    ok: !blocked && sample.status !== '已开工' ? !blocked : !blocked,
    rate,
    message: blocked
      ? `齐套率 ${rate}%，${shortages.length} 项缺料：${shortages.slice(0, 3).map((s) => s.name).join('、')}，禁止开工（K9）`
      : `齐套率 ${rate}%，允许开工`
  }
}
