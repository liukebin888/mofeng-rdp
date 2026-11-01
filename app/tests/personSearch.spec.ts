import { describe, it, expect } from 'vitest'
import { pinyinInitials, initialOfChar, searchPersons } from '@/domain/personSearch'

const people = [
  { id: 'U001', name: '陈志远' },
  { id: 'U003', name: '周立群' },
  { id: 'U004', name: '吴敏' },
  { id: 'U018', name: '唐峰' },
  { id: 'U002', name: '林静' }
]

describe('姓名首拼提取', () => {
  it('单字取首字母（已收录汉字）', () => {
    expect(initialOfChar('陈')).toBe('c')
    expect(initialOfChar('吴')).toBe('w')
  })
  it('未收录汉字降级为原字符，不抛异常', () => {
    expect(initialOfChar('鑫')).toBe('鑫')
  })
  it('姓名转全拼首字母串', () => {
    expect(pinyinInitials('周立群')).toBe('zlq')
    expect(pinyinInitials('吴敏')).toBe('wm')
    expect(pinyinInitials('陈志远')).toBe('czy')
    expect(pinyinInitials('唐峰')).toBe('tf')
    expect(pinyinInitials('林静')).toBe('lj')
  })
})

describe('人员首拼搜索', () => {
  it('首拼精确命中', () => {
    const r = searchPersons(people, 'zlq')
    expect(r[0].name).toBe('周立群')
  })
  it('全名精确命中优先于首拼', () => {
    const r = searchPersons(people, '吴敏')
    expect(r[0].name).toBe('吴敏')
  })
  it('首拼前缀命中', () => {
    const r = searchPersons(people, 'z')
    expect(r.map((x) => x.name)).toContain('周立群')
  })
  it('空关键字返回空', () => {
    expect(searchPersons(people, '')).toEqual([])
    expect(searchPersons(people, '  ')).toEqual([])
  })
  it('大小写不敏感', () => {
    expect(searchPersons(people, 'ZLQ')[0].name).toBe('周立群')
  })
  it('结果去重', () => {
    const dup = [...people, { id: 'U003', name: '周立群' }]
    const r = searchPersons(dup, 'zlq')
    expect(r.filter((x) => x.name === '周立群')).toHaveLength(1)
  })
  it('候选带 initials 供 UI 展示', () => {
    const r = searchPersons(people, 'wm')
    expect(r[0].initials).toBe('wm')
  })
})
