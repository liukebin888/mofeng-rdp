import { describe, it, expect } from 'vitest'
import {
  validAnchor,
  createAnnotation,
  resolveAnnotation,
  groupByPage,
  openAnnotationCount,
  summarizeAnnotations,
  anchorConflicts,
  ANNOTATION_COLORS,
  type DocAnnotation
} from '@/domain/docAnnotation'

function makeAnno(over: Partial<DocAnnotation> = {}): DocAnnotation {
  return {
    id: 'A1',
    docId: 'DOC1',
    projectId: 'P-001',
    author: '赵启明',
    content: '此处接线冗余',
    type: '圈注',
    anchor: { page: 3, x: 0.4, y: 0.6, region: '图 5 左上方' },
    createdAt: '2026-11-03T00:00:00Z',
    status: '开放',
    ...over
  }
}

describe('图文档在线批注引擎（docAnnotation）', () => {
  it('validAnchor 校验页码/坐标/区域', () => {
    expect(validAnchor({ page: 3, x: 0.4, y: 0.6, region: '图 5' }).ok).toBe(true)
    expect(validAnchor({ page: 0, x: 0.4, y: 0.6, region: '图' }).ok).toBe(false)
    expect(validAnchor({ page: 3, x: 1.2, y: 0.6, region: '图' }).ok).toBe(false)
    expect(validAnchor({ page: 3, x: 0.4, y: 0.6, region: ' ' }).ok).toBe(false)
  })

  it('createAnnotation 校验内容/作者非空', () => {
    const r = createAnnotation({ docId: 'DOC1', projectId: 'P-001', author: '赵', content: '冗余', type: '圈注', anchor: { page: 3, x: 0.4, y: 0.6, region: '图5' } })
    expect(r.ok).toBe(true)
    expect(r.annotation!.id.startsWith('A')).toBe(true)
    expect(r.annotation!.status).toBe('开放')
    // 内容空
    expect(createAnnotation({ docId: 'D', projectId: 'P', author: '赵', content: '  ', type: '圈注', anchor: { page: 1, x: 0.1, y: 0.1, region: 'r' } }).ok).toBe(false)
    // 作者空
    expect(createAnnotation({ docId: 'D', projectId: 'P', author: ' ', content: 'x', type: '圈注', anchor: { page: 1, x: 0.1, y: 0.1, region: 'r' } }).ok).toBe(false)
  })

  it('resolveAnnotation 解决须留痕且填结论', () => {
    const r = resolveAnnotation(makeAnno(), '沈雅', '已整改并复测', '2026-11-03T01:00:00Z')
    expect(r.ok).toBe(true)
    expect(r.annotation!.status).toBe('已解决')
    expect(r.annotation!.resolvedBy).toBe('沈雅')
    // 已解决再解决
    expect(resolveAnnotation(r.annotation!, '沈雅', 'x', 't').ok).toBe(false)
    // 结论空
    expect(resolveAnnotation(makeAnno(), '沈雅', ' ', 't').ok).toBe(false)
  })

  it('groupByPage 按页聚合', () => {
    const list = [makeAnno({ id: 'A1' }), makeAnno({ id: 'A2', anchor: { page: 5, x: 0.1, y: 0.2, region: 'r' } })]
    const m = groupByPage(list)
    expect(m.get(3)!.length).toBe(1)
    expect(m.get(5)!.length).toBe(1)
  })

  it('openAnnotationCount 统计未解决批注', () => {
    const list = [makeAnno({ id: 'A1', docId: 'D1' }), makeAnno({ id: 'A2', docId: 'D1', status: '已解决' }), makeAnno({ id: 'A3', docId: 'D2' })]
    expect(openAnnotationCount(list, 'D1')).toBe(1)
  })

  it('summarizeAnnotations 汇总解决率', () => {
    const s = summarizeAnnotations([makeAnno({ id: 'A1' }), makeAnno({ id: 'A2', status: '已解决' })])
    expect(s.total).toBe(2)
    expect(s.open).toBe(1)
    expect(s.resolved).toBe(1)
    expect(s.resolveRate).toBe(50)
    // 空列表
    expect(summarizeAnnotations([]).resolveRate).toBe(100)
  })

  it('anchorConflicts 检测同页坐标重叠', () => {
    const a = makeAnno({ id: 'A1', docId: 'D1', anchor: { page: 3, x: 0.5, y: 0.5, region: 'r' } })
    const b = makeAnno({ id: 'A2', docId: 'D1', anchor: { page: 3, x: 0.51, y: 0.5, region: 'r' } })
    const c = makeAnno({ id: 'A3', docId: 'D1', anchor: { page: 3, x: 0.9, y: 0.9, region: 'r' } })
    const groups = anchorConflicts([a, b, c], 'D1')
    expect(groups.length).toBe(1)
    expect(groups[0].length).toBe(2)
  })

  it('ANNOTATION_COLORS 覆盖四类批注', () => {
    expect(Object.keys(ANNOTATION_COLORS).sort()).toEqual(['圈注', '下划线', '文字', '高亮'].sort())
  })
})
