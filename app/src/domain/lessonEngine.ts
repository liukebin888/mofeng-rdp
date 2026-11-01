/**
 * 经验教训登记与复用检索引擎（SRS 第 12 章 · COM-010 / 控制点 C-35）
 *
 * 解决「经验教训只登记不沉淀、立项时检索不到同类经验」：
 *   1. 登记必带主题（title）+ 阶段标签（stage），缺一即拒（COM-010 验收：登记必带主题与阶段标签）。
 *   2. 可按项目、阶段、问题类型、关键词四维检索复用（C-35：按项目/阶段/问题类型检索复用）。
 *   3. 回存资料库（pushToLibrary）幂等去重，逐条留推送记录（COM-010：推送记录可查）。
 *   4. 复用标记 reusedBy，供复用次数统计（C-35：经验复用次数指标）。
 *
 * 纯函数、零 DOM，供 vitest 直接调用；store 与视图仅编排不承载判定逻辑。
 */

import type { LessonItem, LessonPushRecord } from './types'

// —— 阶段标签合法集合（与项目阶段五段对齐，登记强校验）——
export const LESSON_STAGES = ['P1 立项', 'P2 需求', 'P3 方案与计划', 'P4 研发过程', 'P5 试制验证', 'P6 量产'] as const

// —— 问题类型标签（可按问题类型检索）——
export const LESSON_CATEGORIES = ['硬件', '软件', '结构', '工艺', '质量', '安全', '供应商', '流程', '成本', '其他'] as const

// —— 登记校验结果 ——
export interface LessonRegisterResult {
  ok: boolean
  errors: string[]
  lesson?: LessonItem
}

/** 登记校验：主题（title）+ 阶段标签（stage）必填，缺一即拒（COM-010 硬约束） */
export function validateLesson(input: {
  title: string
  content: string
  stage: string
  category: string
  tags?: string[]
}): string[] {
  const errors: string[] = []
  if (!input.title?.trim()) errors.push('主题不能为空')
  if (!input.stage?.trim()) errors.push('阶段标签不能为空')
  if (!LESSON_STAGES.includes(input.stage as (typeof LESSON_STAGES)[number])) {
    errors.push(`阶段标签非法，须为：${LESSON_STAGES.join('/')}`)
  }
  if (!input.content?.trim()) errors.push('内容不能为空')
  return errors
}

/** 生成经验条目编码（全局唯一，不复用；同一项目内按已有条目数递增） */
export function nextLessonCode(existing: LessonItem[], projectId: string): string {
  const mine = existing.filter((l) => l.projectId === projectId)
  return `LESS-${String(mine.length + 1).padStart(3, '0')}`
}

/**
 * 检索复用：按项目 / 阶段 / 问题类型 / 关键词 四维过滤（C-35 验收口径）。
 * projectId 传 '*' 或空表示跨项目全量检索（立项时检索同类经验）。
 */
export function searchLessons(
  lessons: LessonItem[],
  query: { projectId?: string; stage?: string; category?: string; keyword?: string },
): LessonItem[] {
  const kw = query.keyword?.trim().toLowerCase()
  return lessons.filter((l) => {
    if (query.projectId && query.projectId !== '*' && l.projectId !== query.projectId) return false
    if (query.stage && l.stage !== query.stage) return false
    if (query.category && l.category !== query.category) return false
    if (kw) {
      const hay = `${l.title} ${l.content} ${l.tags.join(' ')} ${l.code}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
}

/** 回存资料库：幂等去重（同一条经验不回存同一目标两次），逐条留推送记录 */
export function pushToLibrary(
  lesson: LessonItem,
  target: string,
  by: string,
  at: string,
): { lesson: LessonItem; pushed: boolean } {
  if (lesson.pushedTo.includes(target)) {
    return { lesson, pushed: false } // 幂等命中：不重复回存，不重复留痕
  }
  const record: LessonPushRecord = { at, target, by }
  return {
    lesson: {
      ...lesson,
      pushedTo: [...lesson.pushedTo, target],
      pushLog: [...lesson.pushLog, record],
    },
    pushed: true,
  }
}

/** 复用标记：后续项目立项时引用同类经验，记录复用关系（供复用次数统计） */
export function markReused(lesson: LessonItem, projectId: string): LessonItem {
  if (lesson.reusedBy.includes(projectId)) return lesson
  return { ...lesson, reusedBy: [...lesson.reusedBy, projectId] }
}

/** 复用次数统计：某经验被多少个不同项目复用（C-35 复用次数指标） */
export function reuseCount(lesson: LessonItem): number {
  return lesson.reusedBy.length
}

/** 知识资产指标汇总（C-35 / 第 8.6 节知识资产考核口径） */
export function knowledgeStats(lessons: LessonItem[]) {
  const tagged = lessons.filter((l) => l.tags.length > 0).length
  const pushed = lessons.filter((l) => l.pushedTo.length > 0).length
  const reused = lessons.reduce((s, l) => s + l.reusedBy.length, 0)
  return {
    total: lessons.length,
    tagged,
    pushed,
    reused,
    taggedOk: lessons.length === 0 || tagged === lessons.length,
  }
}
