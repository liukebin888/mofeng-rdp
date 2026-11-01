/**
 * 基线引擎（SRS 20.2 / BAS-001~006、附录 B.3）
 * 基线 = 对象版本集合 + 逐项 row_hash + manifest_hash + 冻结签名；冻结后不可变
 */
import { hashOf } from './hash'
import type { Baseline } from './types'

export class BaselineImmutableError extends Error {
  code = 'BASELINE_IMMUTABLE'
  constructor(public baselineNo: string) {
    super(`基线 ${baselineNo} 已冻结，任何修改被拒绝（BASELINE_IMMUTABLE）`)
  }
}

export interface BaselineItemInput {
  objType: string
  objId: string
  objVersion: number
  snapshot: Record<string, unknown>
}

export const BASELINE_TYPES = [
  '需求基线',
  '设计基线',
  '软件基线',
  '硬件基线',
  '样件基线',
  '测试基线',
  '交付基线',
  '成本基线',
  '文档基线'
]

export function buildBaseline(params: {
  id: string
  projectId: string
  no: string
  type: string
  items: BaselineItemInput[]
  frozenBy?: string
  frozenAt?: string
}): Baseline {
  const items = params.items.map((i) => ({ ...i, rowHash: hashOf({ type: i.objType, id: i.objId, v: i.objVersion, snap: i.snapshot }) }))
  const manifestHash = hashOf(items.map((i) => `${i.objType}:${i.objId}:${i.objVersion}:${i.rowHash}`).sort())
  return {
    id: params.id,
    projectId: params.projectId,
    no: params.no,
    type: params.type,
    status: params.frozenBy ? '已冻结' : '组建中',
    items,
    manifestHash,
    frozenAt: params.frozenAt,
    frozenBy: params.frozenBy
  }
}

/** 冻结：生成签名与时间，之后整行不可改（BAS-002） */
export function freeze(b: Baseline, actor: string, at = new Date().toISOString()): Baseline {
  if (b.status === '已冻结') throw new BaselineImmutableError(b.no)
  return { ...b, status: '已冻结', frozenBy: actor, frozenAt: at }
}

/** 冻结后写入/修改基线项一律拒绝（SOD-05） */
export function guardMutable(b: Baseline): void {
  if (b.status === '已冻结') throw new BaselineImmutableError(b.no)
}

/** 校验：逐项比对快照哈希，返回定位到项的不一致清单（BAS-003） */
export function verifyBaseline(b: Baseline, current: Map<string, Record<string, unknown>>) {
  const mismatches: { objType: string; objId: string; expected: string; actual: string }[] = []
  for (const it of b.items) {
    const key = `${it.objType}:${it.objId}`
    const now = current.get(key)
    const actual = now ? hashOf({ type: it.objType, id: it.objId, v: it.objVersion, snap: now }) : '(对象不存在)'
    if (actual !== it.rowHash) mismatches.push({ objType: it.objType, objId: it.objId, expected: it.rowHash, actual })
  }
  const manifest = hashOf(b.items.map((i) => `${i.objType}:${i.objId}:${i.objVersion}:${i.rowHash}`).sort())
  return {
    ok: mismatches.length === 0 && manifest === b.manifestHash,
    manifestMatch: manifest === b.manifestHash,
    manifestHash: manifest,
    mismatches
  }
}

/** 替代：冻结基线只能由新基线经 replacedBy 替代（BAS-002） */
export function replace(prev: Baseline, nextId: string): Baseline {
  return { ...prev, status: '已被替代', replacedBy: nextId } as Baseline & { replacedBy: string }
}
