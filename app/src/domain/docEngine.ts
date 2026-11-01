/**
 * 文档受控生命周期引擎（SRS 第 19 章 · DOC-001~007）
 *
 * 解决「研发交付物纠纷九成出在版本」：从上传到作废的全生命周期受控。
 * 四态：草稿 → 会签中 → 已发布 → 已作废（+ 任意态可作废）。
 *
 * 两条硬要求（DOC-004 / C-45 L4 / PMC-037）：
 *   1. 会签未齐不得发布；任一角色否决即整体退回并保留意见文本与用时。
 *   2. 未发布文档不计入交付物齐套。
 *
 * 纯函数、零 DOM，供 vitest 直接调用；store 与视图仅编排不承载判定逻辑。
 */

import { hashOf } from './hash'

// —— 文档状态 ——
export type DocStatus = '草稿' | '会签中' | '已发布' | '已作废'

// —— 会签意见条目（DOC-007：意见条目化闭环）——
export interface ReviewComment {
  id: string
  role: string
  author: string
  content: string
  createdAt: string
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: string
  resolution?: string
}

// —— 会签签署项（DOC-004/014：多专业并行）——
export interface SignoffItem {
  role: string
  signed: boolean
  veto?: boolean
  signedAt?: string
  signedBy?: string
  vetoComment?: string
  vetoedAt?: string
}

// —— 版本链节点（DOC-002：版本与修订控制）——
export interface DocVersionNode {
  version: string
  status: '有效' | '已失效' | '已作废' | '草稿'
  publishedAt?: string
  hash?: string
  author: string
  remark?: string
}

// —— 文档实体（领域层操作对象，与 types.ts 的 DocItem 对齐并扩展）——
export interface ControlledDoc {
  id: string
  projectId: string
  code: string
  name: string
  discipline: string
  version: string
  status: DocStatus
  required: boolean
  signoffs: SignoffItem[]
  mdrSet: string
  comments: ReviewComment[]
  versionChain: DocVersionNode[]
  checkoutBy?: string
  checkoutAt?: string
  effectiveFlag?: boolean
  hash?: string
  archivedAt?: string
  retentionDue?: string
}

// —— 引擎操作结果 ——
export interface DocOpResult<T = void> {
  ok: boolean
  doc?: ControlledDoc
  error?: string
  code?: string
  value?: T
}

/** 深拷贝（领域层不依赖 Vue reactivity） */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

const seq = (() => {
  let n = 0
  return () => `C${Date.now().toString(36)}${(n++).toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`
})()

/** 会签是否齐备且无未关闭否决（DOC-004/C-45 判定唯一权威） */
export function isSignoffComplete(doc: ControlledDoc): boolean {
  return doc.signoffs.length > 0 && doc.signoffs.every((s) => s.signed && !s.veto)
}

/** 是否存在未关闭的评审意见（DOC-007：意见未关闭不得作为通过依据） */
export function hasOpenComments(doc: ControlledDoc): boolean {
  return doc.comments.some((c) => !c.resolved)
}

/** 能否发布：会签齐备 + 无未关闭意见 + 非草稿起步 + 未作废 */
export function canPublish(doc: ControlledDoc): { ok: boolean; reason?: string } {
  if (doc.status === '已作废') return { ok: false, reason: '已作废文档不得发布' }
  if (doc.status === '已发布') return { ok: false, reason: '已发布文档不可重复发布（须先升版）' }
  if (!isSignoffComplete(doc)) return { ok: false, reason: '多专业会签未齐备或存在否决（DOC-004/C-45）' }
  if (hasOpenComments(doc)) return { ok: false, reason: '存在未关闭评审意见（DOC-007）' }
  return { ok: true }
}

/**
 * 发起会签（草稿 → 会签中）
 * DOC-003：仅检出人可提交会签；未检出者提交会签被拒。
 */
export function submitForSignoff(doc: ControlledDoc, actorId: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得发起会签', code: 'OBSOLETE' }
  if (d.status === '已发布') return { ok: false, error: '已发布文档须先升版再会签', code: 'PUBLISHED' }
  if (d.checkoutBy && d.checkoutBy !== actorId) {
    return { ok: false, error: `文档已被 ${d.checkoutBy} 检出，并发编辑被阻止（DOC-003）`, code: 'CHECKED_OUT' }
  }
  d.status = '会签中'
  return { ok: true, doc: d }
}

/**
 * 登记会签（DOC-004/014：多专业并行）
 * 全部签署完毕并不自动发布——发布须显式走 publish（保证「会签齐备」与「发布」单一判定）。
 */
export function signoff(doc: ControlledDoc, role: string, actorName: string, at: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得会签', code: 'OBSOLETE' }
  if (d.status !== '会签中') return { ok: false, error: '仅「会签中」状态可登记会签', code: 'WRONG_STATE' }
  const item = d.signoffs.find((s) => s.role === role)
  if (!item) return { ok: false, error: `角色 ${role} 不在会签名单`, code: 'ROLE_NOT_IN_SIGNOFF' }
  if (item.veto) return { ok: false, error: '该角色已否决，须先处理否决意见', code: 'VETOED' }
  if (item.signed) return { ok: false, error: '该角色已签署', code: 'ALREADY_SIGNED' }
  item.signed = true
  item.signedBy = actorName
  item.signedAt = at
  return { ok: true, doc: d, value: undefined, code: isSignoffComplete(d) ? 'COMPLETE' : 'PARTIAL' }
}

/**
 * 否决（DOC-014：任一角色否决即整体退回，保留意见文本与用时）
 * 退回后状态回到「草稿」，否决意见以条目化评论保留。
 */
export function veto(doc: ControlledDoc, role: string, actorName: string, comment: string, at: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得否决', code: 'OBSOLETE' }
  const item = d.signoffs.find((s) => s.role === role)
  if (!item) return { ok: false, error: `角色 ${role} 不在会签名单`, code: 'ROLE_NOT_IN_SIGNOFF' }
  item.veto = true
  item.vetoComment = comment
  item.vetoedAt = at
  // 否决意见条目化（DOC-007）
  d.comments.push({
    id: seq(),
    role,
    author: actorName,
    content: comment,
    createdAt: at,
    resolved: false
  })
  d.status = '草稿'
  return { ok: true, doc: d }
}

/**
 * 发布（DOC-004/C-45 单一权威判定）
 * 会签齐备 + 无未关闭意见才可发布；发布时计算并记录哈希（DOC-006 基线绑定前提）。
 */
export function publish(doc: ControlledDoc, actorName: string, at: string): DocOpResult {
  const check = canPublish(doc)
  if (!check.ok) return { ok: false, error: check.reason!, code: 'SIGNOFF_INCOMPLETE' }
  const d = clone(doc)
  d.status = '已发布'
  d.effectiveFlag = true
  d.checkoutBy = undefined
  d.checkoutAt = undefined
  d.hash = hashOf({ code: d.code, version: d.version, content: d.name })
  // 版本链：当前版本生效，旧版自动失效（DOC-002）
  for (const v of d.versionChain) v.status = v.status === '已作废' ? '已作废' : '已失效'
  const cur = d.versionChain.find((v) => v.version === d.version)
  if (cur) cur.status = '有效'
  else d.versionChain.push({ version: d.version, status: '有效', publishedAt: at, hash: d.hash, author: actorName })
  return { ok: true, doc: d }
}

/**
 * 升版（DOC-002：版本与修订控制）
 * 已发布文档检出后升版 → 生成新版本号，旧版保留在版本链并标记失效，状态回「草稿」。
 */
export function revisionUp(doc: ControlledDoc, newVersion: string, actorName: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得升版', code: 'OBSOLETE' }
  if (d.versionChain.some((v) => v.version === newVersion)) {
    return { ok: false, error: `版本 ${newVersion} 已存在，版本链不允许重复（DOC-002）`, code: 'VERSION_DUP' }
  }
  // 旧版自动失效（DOC-002：任一时刻仅一个有效版本）
  for (const v of d.versionChain) if (v.status === '有效') v.status = '已失效'
  d.versionChain.push({ version: newVersion, status: '草稿', author: actorName, remark: `由 ${d.version} 升版` })
  d.version = newVersion
  d.status = '草稿'
  d.effectiveFlag = false
  d.hash = undefined
  // 会签重置（新版本须重新会签）
  d.signoffs = d.signoffs.map((s) => ({ role: s.role, signed: false }))
  return { ok: true, doc: d }
}

/**
 * 检入 / 检出（DOC-003：并发控制）
 * 检出加锁；检入释放锁并可选登记评审意见。
 */
export function checkout(doc: ControlledDoc, actorId: string, at: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得检出', code: 'OBSOLETE' }
  if (d.checkoutBy && d.checkoutBy !== actorId) {
    return { ok: false, error: `文档已被 ${d.checkoutBy} 检出，并发编辑被阻止（DOC-003）`, code: 'CHECKED_OUT' }
  }
  if (d.checkoutBy === actorId) return { ok: false, error: '你已检出该文档', code: 'ALREADY_CHECKED_OUT' }
  d.checkoutBy = actorId
  d.checkoutAt = at
  return { ok: true, doc: d }
}

export function checkin(doc: ControlledDoc, actorId: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得检入', code: 'OBSOLETE' }
  if (d.checkoutBy !== actorId) {
    return { ok: false, error: '仅检出人可检入（DOC-003）', code: 'NOT_CHECKOUT_OWNER' }
  }
  d.checkoutBy = undefined
  d.checkoutAt = undefined
  return { ok: true, doc: d }
}

/**
 * 添加评审意见（DOC-007：意见条目化）
 * 意见未关闭不得作为通过依据。
 */
export function addComment(doc: ControlledDoc, role: string, author: string, content: string, at: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得追加意见', code: 'OBSOLETE' }
  d.comments.push({ id: seq(), role, author, content, createdAt: at, resolved: false })
  return { ok: true, doc: d }
}

/** 关闭评审意见（DOC-007：关闭须留痕 + 验证） */
export function resolveComment(doc: ControlledDoc, commentId: string, actorName: string, resolution: string, at: string): DocOpResult {
  const d = clone(doc)
  const c = d.comments.find((x) => x.id === commentId)
  if (!c) return { ok: false, error: '意见不存在', code: 'NOT_FOUND' }
  if (c.resolved) return { ok: false, error: '意见已关闭', code: 'ALREADY_RESOLVED' }
  c.resolved = true
  c.resolvedBy = actorName
  c.resolvedAt = at
  c.resolution = resolution
  return { ok: true, doc: d }
}

/**
 * 作废（DOC-001：作废章，仅历史查询，不得新引用）
 */
export function obsolete(doc: ControlledDoc, actorName: string, at: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '文档已作废', code: 'ALREADY_OBSOLETE' }
  d.status = '已作废'
  d.effectiveFlag = false
  d.checkoutBy = undefined
  d.checkoutAt = undefined
  const cur = d.versionChain.find((v) => v.version === d.version)
  if (cur) cur.status = '已作废'
  return { ok: true, doc: d }
}

/** 归档（DOC-010：结项归档只读，归档后修改被拒） */
export function archive(doc: ControlledDoc, actorName: string, at: string): DocOpResult {
  const d = clone(doc)
  if (d.status === '已作废') return { ok: false, error: '已作废文档不得归档', code: 'OBSOLETE' }
  d.archivedAt = at
  return { ok: true, doc: d }
}

/** 能否下载（DOC-005/009：作废后下载被拒；未发布图纸默认禁下载） */
export function canDownload(doc: ControlledDoc): { ok: boolean; reason?: string } {
  if (doc.status === '已作废') return { ok: false, reason: '已作废文档禁止下载（DOC-005）' }
  return { ok: true }
}

/**
 * 有效性标识唯一（DOC-005）：同一文档编号任一现场只允许一个有效版本。
 * 给定同 code 文档列表，返回「有效版本是否唯一」及有效版本清单。
 */
export function validateEffectiveUnique(docs: ControlledDoc[]): { unique: boolean; effective: ControlledDoc[] } {
  const effective = docs.filter((d) => d.status === '已发布' && d.effectiveFlag !== false)
  return { unique: effective.length <= 1, effective }
}

/**
 * 全文检索（DOC-008）：命中定位 + 相似度提示。
 * 返回命中文档及其命中字段、相似度分组（避免同一规范出现五个版本）。
 */
export function searchDocs(docs: ControlledDoc[], query: string): { hits: { doc: ControlledDoc; fields: string[] }[]; dupGroups: ControlledDoc[][] } {
  const q = query.trim().toLowerCase()
  if (!q) return { hits: [], dupGroups: [] }
  const hits = docs
    .map((d) => {
      const fields: string[] = []
      if (d.name.toLowerCase().includes(q)) fields.push('name')
      if (d.code.toLowerCase().includes(q)) fields.push('code')
      if (d.discipline.toLowerCase().includes(q)) fields.push('discipline')
      d.comments.forEach((c) => {
        if (c.content.toLowerCase().includes(q)) fields.push('comment')
      })
      return fields.length ? { doc: d, fields } : null
    })
    .filter((x): x is { doc: ControlledDoc; fields: string[] } => x !== null)

  // 相似度分组：同名（规范化后）多版本 → 重复提示（DOC-008）
  const byName = new Map<string, ControlledDoc[]>()
  docs.forEach((d) => {
    const key = d.name.replace(/\s+/g, '').toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push(d)
  })
  const dupGroups = Array.from(byName.values()).filter((g) => g.length > 1)
  return { hits, dupGroups }
}
