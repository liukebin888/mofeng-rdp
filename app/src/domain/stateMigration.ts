/**
 * 样件评审模板增量 · 幂等合并式 seed 迁移（Q9 / 主理人裁决 U1）
 *
 * 定位：`SEED_VERSION` 升级到 `mofeng.rdp.v1.0.42` 后，`syncFromBackend()` 在
 *   「远程 version 不符」分支必须以**远程 data 为基底**做增量合并，而不是用
 *   本地 `buildSeed()` 全量覆盖（后者会重置演示业务实体、破坏演示数据零改动）。
 *
 * 只做 4 件事（其余字段逐字段原样保留）：
 *   ① 写 `version = toVersion`；
 *   ② 缺 `sampleReviewTemplates` 则补 `[]`；
 *   ③ 按 `id` **就地替换** `flowDefinitions` 中的 `DEF-TRIAL-REVIEW`（缺失则追加）；
 *   ④ 其余所有字段（业务实体 / drafts / data.audit / 其余 35 条 def）原样保留。
 *
 * 设计约束：
 *   - 纯函数、零 DOM / vue / pinia（ARC-001），可被 vitest 直调；
 *   - 不修改入参（浅拷贝 + 仅在需要时新建 flowDefinitions 数组）；
 *   - fail-closed：对「已知违规样本」（旧五态 def / 审批先于结论 / 结论守卫带
 *     defaultNext / 非对象基底）直接抛错拦截，杜绝把错误顺序写回运行时；
 *   - 幂等：已迁移过的 data 二次调用返回 `changed=[]`、`idempotent=true`。
 */
import type { FlowDefinition, FlowNode } from './flowEngine'

/** 两段式样件评审流程定义 id（与 seed.ts 中 DEF-TRIAL-REVIEW 保持一致） */
export const SAMPLE_REVIEW_TEMPLATE_DEF_ID = 'DEF-TRIAL-REVIEW'

/** 本次增量目标种子版本（与 seed.ts SEED_VERSION 一致，仅作为默认参数提示） */
export const SAMPLE_REVIEW_TEMPLATE_SEED_VERSION = 'mofeng.rdp.v1.0.42'

/** 迁移结果：data 为合并后的新对象；idempotent 表示无需任何变更 */
export interface MigrationResult {
  data: Record<string, unknown>
  changed: string[]
  idempotent: boolean
}

/**
 * 稳定序列化（键排序，递归）：用于判定既有 def 与 newDef 是否已一致，
 * 避免 JSON 键顺序差异造成「假变更」而破坏幂等性。
 */
function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value)
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => canonicalStringify(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(',')}}`
}

/**
 * fail-closed 校验：newDef 必须是「先评审结论守卫、后提交审批」的两段式定义。
 * 任何违反「审批不得先于结论」的已知违规样本都在此被拦截（回退验证的断言点）。
 *
 * @throws Error 当定义不符合两段式顺序时
 */
export function assertTwoStageReviewDef(def: FlowDefinition): void {
  if (!def || typeof def !== 'object') {
    throw new Error('迁移被拦截：newDef 不是合法的 FlowDefinition 对象')
  }
  if (def.id !== SAMPLE_REVIEW_TEMPLATE_DEF_ID) {
    throw new Error(`迁移被拦截：newDef.id 须为 ${SAMPLE_REVIEW_TEMPLATE_DEF_ID}，实际为 ${String(def.id)}`)
  }
  if (!Number.isFinite(def.version) || def.version < 2) {
    throw new Error('迁移被拦截：两段式定义 version 须 >= 2（旧五态定义不得写入）')
  }
  const nodes: FlowNode[] = Array.isArray(def.nodes) ? def.nodes : []
  const branchIdx = nodes.findIndex(
    (n) =>
      n &&
      n.type === 'branch' &&
      Array.isArray(n.branches) &&
      n.branches.some((b) => b && b.field === 'verdict' && b.op === 'neq' && b.value === '' && !!b.toNodeId)
  )
  const approveIdx = nodes.findIndex((n) => n && n.type === 'approve')
  if (branchIdx < 0) {
    throw new Error('迁移被拦截：缺少「阶段一 · 评审结论守卫」分支节点（verdict ≠ \'\'）')
  }
  if (approveIdx < 0) {
    throw new Error('迁移被拦截：缺少「阶段二 · 提交审批」审批节点')
  }
  if (approveIdx <= branchIdx) {
    throw new Error('迁移被拦截：审批节点不得先于评审结论守卫（须先结论、后审批）')
  }
  const guard = nodes[branchIdx]
  if (guard.defaultNext) {
    throw new Error('迁移被拦截：评审结论守卫不得配置 defaultNext（fail-closed 双保险）')
  }
  const guardTarget = (guard.branches ?? []).find(
    (b) => b && b.field === 'verdict' && b.op === 'neq' && b.value === ''
  )?.toNodeId
  if (guardTarget !== nodes[approveIdx].id) {
    throw new Error('迁移被拦截：评审结论守卫命中后须直达阶段二审批节点')
  }
  if (!Array.isArray(def.formFields) || !def.formFields.some((f) => f && f.key === 'verdict')) {
    throw new Error('迁移被拦截：formFields 须含 verdict（审批节点据此回读阶段一结论）')
  }
  if (def.startNodeId !== nodes[0]?.id) {
    throw new Error('迁移被拦截：startNodeId 须指向首个节点')
  }
}

/**
 * 幂等合并式迁移：以远程 data 为基底，仅补/换 4 处增量字段，其余原样保留。
 *
 * @param prevData 远程 `data` 对象（作为基底，不修改）
 * @param newDef   改造后的 `DEF-TRIAL-REVIEW`（两段式，version 2）
 * @param toVersion 目标种子版本（如 `mofeng.rdp.v1.0.42`）
 * @returns `{ data, changed, idempotent }`
 * @throws Error 当 newDef 为已知违规样本或 prevData 非对象时（fail-closed 拦截）
 */
export function migrateSampleReviewState(
  prevData: Record<string, unknown>,
  newDef: FlowDefinition,
  toVersion: string
): MigrationResult {
  assertTwoStageReviewDef(newDef)
  if (!prevData || typeof prevData !== 'object' || Array.isArray(prevData)) {
    throw new Error('迁移被拦截：prevData 须为远程 data 对象')
  }
  if (!toVersion || typeof toVersion !== 'string') {
    throw new Error('迁移被拦截：toVersion 须为非空字符串')
  }
  if (Object.prototype.hasOwnProperty.call(prevData, 'flowDefinitions') && !Array.isArray(prevData.flowDefinitions)) {
    throw new Error('迁移被拦截：既有 flowDefinitions 不是数组，拒绝整表重置')
  }

  // 浅拷贝基底：其余所有字段按引用原样保留（业务实体 / drafts / audit / 其余 def）
  const data: Record<string, unknown> = { ...prevData }
  const changed: string[] = []

  // ① version
  if (data.version !== toVersion) {
    data.version = toVersion
    changed.push('version')
  }

  // ② sampleReviewTemplates（缺则补空数组，已有则原样保留）
  if (!Array.isArray(data.sampleReviewTemplates)) {
    data.sampleReviewTemplates = []
    changed.push('sampleReviewTemplates')
  }

  // ③ 按 id 就地替换 DEF-TRIAL-REVIEW（缺失则追加）；其余 35 条 def 引用不变
  const defs: FlowDefinition[] = Array.isArray(data.flowDefinitions)
    ? [...(data.flowDefinitions as FlowDefinition[])]
    : []
  const idx = defs.findIndex((d) => d && d.id === SAMPLE_REVIEW_TEMPLATE_DEF_ID)
  if (idx < 0) {
    defs.push(newDef)
    data.flowDefinitions = defs
    changed.push(`flowDefinitions:${SAMPLE_REVIEW_TEMPLATE_DEF_ID}:append`)
  } else if (canonicalStringify(defs[idx]) !== canonicalStringify(newDef)) {
    defs[idx] = newDef
    data.flowDefinitions = defs
    changed.push(`flowDefinitions:${SAMPLE_REVIEW_TEMPLATE_DEF_ID}:replace`)
  }
  // 已一致：不改写 data.flowDefinitions，保持引用完全不变（幂等）

  return { data, changed, idempotent: changed.length === 0 }
}
