/**
 * 经验教训登记与复用检索引擎独立 QA 用例（SRS 第 12 章 / COM-010 / C-35）
 * 覆盖：登记必带主题+阶段 / 阶段标签合法性 / 四维检索复用 /
 *      回存资料库幂等去重 + 推送记录 / 复用标记与复用次数统计
 */
import { describe, expect, it } from 'vitest'
import {
  knowledgeStats,
  markReused,
  nextLessonCode,
  pushToLibrary,
  searchLessons,
  validateLesson
} from '../src/domain/lessonEngine'
import type { LessonItem } from '../src/domain/types'

function mkLesson(overrides: Partial<LessonItem> = {}): LessonItem {
  return {
    id: 'LS-T1',
    projectId: 'P-001',
    code: 'LESS-TST-001',
    title: '旋变信号共因失效规避',
    content: '双路信号分层走线',
    tags: ['硬件', 'EMC'],
    stage: 'P4 研发过程',
    category: '硬件',
    pushedTo: [],
    pushLog: [],
    reusedBy: [],
    createdAt: '2026-06-12',
    ...overrides
  }
}

describe('COM-010 登记校验（主题 + 阶段必填）', () => {
  it('主题为空即拒', () => {
    const e = validateLesson({ title: '', content: 'x', stage: 'P4 研发过程', category: '硬件' })
    expect(e).toContain('主题不能为空')
  })

  it('阶段标签为空即拒', () => {
    const e = validateLesson({ title: '主题', content: 'x', stage: '', category: '硬件' })
    expect(e).toContain('阶段标签不能为空')
  })

  it('阶段标签非法即拒', () => {
    const e = validateLesson({ title: '主题', content: 'x', stage: '随便写', category: '硬件' })
    expect(e.some((m) => m.includes('阶段标签非法'))).toBe(true)
  })

  it('主题 + 阶段齐备则通过', () => {
    const e = validateLesson({ title: '主题', content: 'x', stage: 'P4 研发过程', category: '硬件' })
    expect(e).toEqual([])
  })
})

describe('C-35 四维检索复用', () => {
  const pool: LessonItem[] = [
    mkLesson({ id: 'a', projectId: 'P-001', title: '旋变失效', stage: 'P4 研发过程', category: '硬件', tags: ['EMC'] }),
    mkLesson({ id: 'b', projectId: 'P-002', title: '刷写耗时', stage: 'P5 试制验证', category: '软件', tags: ['性能'] })
  ]

  it('按项目过滤', () => {
    expect(searchLessons(pool, { projectId: 'P-002' }).map((l) => l.id)).toEqual(['b'])
  })

  it('按阶段过滤', () => {
    expect(searchLessons(pool, { stage: 'P5 试制验证' }).map((l) => l.id)).toEqual(['b'])
  })

  it('按问题类型过滤', () => {
    expect(searchLessons(pool, { category: '硬件' }).map((l) => l.id)).toEqual(['a'])
  })

  it('按关键词检索标题/内容/标签', () => {
    expect(searchLessons(pool, { keyword: 'EMC' }).map((l) => l.id)).toEqual(['a'])
    expect(searchLessons(pool, { keyword: '刷写' }).map((l) => l.id)).toEqual(['b'])
  })

  it('projectId=* 跨项目全量检索（立项复用）', () => {
    expect(searchLessons(pool, { projectId: '*' }).length).toBe(2)
  })
})

describe('COM-010 回存资料库（幂等 + 推送记录）', () => {
  it('首次回存成功并留推送记录', () => {
    const { lesson, pushed } = pushToLibrary(mkLesson(), '研发经验库/通用', '张工', '2026-11-01T10:00:00+08:00')
    expect(pushed).toBe(true)
    expect(lesson.pushedTo).toEqual(['研发经验库/通用'])
    expect(lesson.pushLog).toHaveLength(1)
    expect(lesson.pushLog[0].by).toBe('张工')
  })

  it('同目标重复回存被幂等去重，不重复留痕', () => {
    const once = pushToLibrary(mkLesson(), '研发经验库/通用', '张工', 'T')
    const twice = pushToLibrary(once.lesson, '研发经验库/通用', '李工', 'T2')
    expect(twice.pushed).toBe(false)
    expect(twice.lesson.pushedTo).toHaveLength(1)
    expect(twice.lesson.pushLog).toHaveLength(1)
  })

  it('不同目标可多次回存，各自留痕', () => {
    const once = pushToLibrary(mkLesson(), '研发经验库/通用', '张工', 'T')
    const twice = pushToLibrary(once.lesson, 'PMO 知识库', '张工', 'T2')
    expect(twice.pushed).toBe(true)
    expect(twice.lesson.pushedTo).toHaveLength(2)
    expect(twice.lesson.pushLog).toHaveLength(2)
  })
})

describe('C-35 复用标记与统计', () => {
  it('复用标记去重，同一项目不重复计数', () => {
    const a = markReused(mkLesson(), 'P-004')
    const b = markReused(a, 'P-004')
    expect(b.reusedBy).toEqual(['P-004'])
  })

  it('复用次数统计跨项目累计', () => {
    let l = markReused(mkLesson(), 'P-004')
    l = markReused(l, 'P-005')
    expect(l.reusedBy).toHaveLength(2)
  })

  it('知识资产指标汇总（总数/已打标签/已回存/复用次数）', () => {
    const a = pushToLibrary(mkLesson({ id: 'a' }), '研发经验库', '张工', 'T')
    const stats = knowledgeStats([a.lesson, mkLesson({ id: 'b', tags: [] })])
    expect(stats.total).toBe(2)
    expect(stats.tagged).toBe(1)
    expect(stats.pushed).toBe(1)
    expect(stats.reused).toBe(0)
    expect(stats.taggedOk).toBe(false)
  })
})

describe('经验编码生成', () => {
  it('按项目内已有条目数递增，全局不复用', () => {
    const existing = [mkLesson({ id: 'a', projectId: 'P-001', code: 'LESS-001' }), mkLesson({ id: 'b', projectId: 'P-001', code: 'LESS-002' })]
    expect(nextLessonCode(existing, 'P-001')).toBe('LESS-003')
  })
})
