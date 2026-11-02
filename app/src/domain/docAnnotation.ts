/**
 * 图文档在线批注引擎（对标 Oracle 图文档批注，P2）
 *
 * 与现有 docEngine.ts 的「会签意见（ReviewComment）」互补：
 *   - ReviewComment：会签流程中的文字意见，无空间锚点；
 *   - DocAnnotation：图文档上的「锚定批注」，有页码 + 坐标 + 区域 + 批注类型，
 *     支持在图纸/文档页面上定位圈画（高亮/圈注/下划线/文字）。
 *
 * 边界（单一权威）：
 *   - 不改变 docEngine 的会签意见权威；本引擎是「空间锚定批注」的补充层。
 *   - 批注须锚定到（docId + page + 区域），坐标越界或区域非法即拒绝。
 *   - 解决批注须留痕（解决人 + 时间 + 结论），未解决批注可统计。
 */

/** 批注类型：高亮 / 圈注 / 下划线 / 文字便签 */
export type AnnotationType = '高亮' | '圈注' | '下划线' | '文字'

/** 批注锚点：页码 + 归一化坐标（0~1）+ 区域描述 */
export interface AnnotationAnchor {
  /** 页码（从 1 开始） */
  page: number
  /** 归一化横坐标 0~1 */
  x: number
  /** 归一化纵坐标 0~1 */
  y: number
  /** 区域描述（如「表 3-2」「图 5 左上方」），便于无坐标阅读 */
  region: string
}

/** 图文档批注实体 */
export interface DocAnnotation {
  id: string
  docId: string
  projectId: string
  author: string
  content: string
  type: AnnotationType
  anchor: AnnotationAnchor
  createdAt: string
  status: '开放' | '已解决'
  resolvedBy?: string
  resolvedAt?: string
  resolution?: string
}

/** 锚点校验：页码 ≥1、坐标在 [0,1]、区域非空 */
export function validAnchor(a: AnnotationAnchor): { ok: boolean; error?: string } {
  if (!a.page || a.page < 1) return { ok: false, error: '页码须 ≥1' }
  if (a.x < 0 || a.x > 1 || a.y < 0 || a.y > 1) return { ok: false, error: '坐标须在 0~1（归一化）' }
  if (!a.region.trim()) return { ok: false, error: '区域描述不能为空' }
  return { ok: true }
}

/** 创建批注（校验锚点 + 内容非空） */
export function createAnnotation(
  input: Omit<DocAnnotation, 'id' | 'createdAt' | 'status'>
): { ok: boolean; error?: string; annotation?: DocAnnotation } {
  const anchorCheck = validAnchor(input.anchor)
  if (!anchorCheck.ok) return { ok: false, error: anchorCheck.error }
  if (!input.content.trim()) return { ok: false, error: '批注内容不能为空' }
  if (!input.author.trim()) return { ok: false, error: '批注人不能为空' }
  const annotation: DocAnnotation = {
    ...input,
    id: `A${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`,
    createdAt: new Date().toISOString(),
    status: '开放'
  }
  return { ok: true, annotation }
}

/** 解决批注（留痕：解决人 + 时间 + 结论） */
export function resolveAnnotation(
  annotation: DocAnnotation,
  actorName: string,
  resolution: string,
  at: string
): { ok: boolean; error?: string; annotation?: DocAnnotation } {
  if (annotation.status === '已解决') return { ok: false, error: '批注已解决' }
  if (!resolution.trim()) return { ok: false, error: '解决须填写结论' }
  return {
    ok: true,
    annotation: {
      ...annotation,
      status: '已解决',
      resolvedBy: actorName,
      resolvedAt: at,
      resolution
    }
  }
}

/** 按页聚合批注（供页面视图按页展示） */
export function groupByPage(annotations: DocAnnotation[]): Map<number, DocAnnotation[]> {
  const m = new Map<number, DocAnnotation[]>()
  for (const a of annotations) {
    const list = m.get(a.anchor.page) || []
    list.push(a)
    m.set(a.anchor.page, list)
  }
  return m
}

/** 按文档聚合未解决批注数（供文档清单标红） */
export function openAnnotationCount(annotations: DocAnnotation[], docId: string): number {
  return annotations.filter((a) => a.docId === docId && a.status === '开放').length
}

/** 批注统计摘要：总数 / 开放数 / 已解决数 / 解决率 */
export interface AnnotationSummary {
  total: number
  open: number
  resolved: number
  resolveRate: number
}

export function summarizeAnnotations(annotations: DocAnnotation[]): AnnotationSummary {
  const total = annotations.length
  const open = annotations.filter((a) => a.status === '开放').length
  const resolved = total - open
  return {
    total,
    open,
    resolved,
    resolveRate: total === 0 ? 100 : Math.round((resolved / total) * 1000) / 10
  }
}

/** 锚点冲突检测：同一文档同一页坐标重叠（距离 < 阈值）视为冲突，提示合并 */
export function anchorConflicts(annotations: DocAnnotation[], docId: string, threshold = 0.05): DocAnnotation[][] {
  const sameDoc = annotations.filter((a) => a.docId === docId)
  const groups: DocAnnotation[][] = []
  const used = new Set<string>()
  for (let i = 0; i < sameDoc.length; i++) {
    if (used.has(sameDoc[i].id)) continue
    const group = [sameDoc[i]]
    for (let j = i + 1; j < sameDoc.length; j++) {
      if (used.has(sameDoc[j].id)) continue
      const a = sameDoc[i].anchor
      const b = sameDoc[j].anchor
      if (a.page === b.page && Math.hypot(a.x - b.x, a.y - b.y) < threshold) {
        group.push(sameDoc[j])
        used.add(sameDoc[j].id)
      }
    }
    if (group.length > 1) groups.push(group)
    used.add(sameDoc[i].id)
  }
  return groups
}

/** 批注类型标注颜色（视图用） */
export const ANNOTATION_COLORS: Record<AnnotationType, string> = {
  高亮: '#f59e0b',
  圈注: '#ef4444',
  下划线: '#3b82f6',
  文字: '#4ade80'
}
