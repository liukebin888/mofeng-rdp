import { describe, it, expect } from 'vitest'
import {
  CONTROL_DEPTS,
  CONTROL_STAGES,
  CONTROL_LEVELS,
  deptNames,
  deptByName,
  deptItemCount,
  totalItemCount,
  itemsByStage,
  itemsByLevel,
  searchItems,
  cutPolicyOf,
} from '@/domain/deliverableControl'

describe('deliverableControl —— 产品开发输出物管控标准引擎', () => {
  it('部门数 10、阶段数 7、等级数 5', () => {
    expect(deptNames().length).toBe(10)
    expect(CONTROL_STAGES.length).toBe(7)
    expect(CONTROL_LEVELS.length).toBe(5)
  })

  it('门控阶段固定 CG0-CG1 至 CG6-CG7', () => {
    expect(CONTROL_STAGES.map((s) => s.code)).toEqual([
      'CG0-CG1', 'CG1-CG2', 'CG2-CG3', 'CG3-CG4', 'CG4-CG5', 'CG5-CG6', 'CG6-CG7',
    ])
  })

  it('等级含 关键/重要/一般/辅助/前置条件', () => {
    expect(CONTROL_LEVELS.map((l) => l.level)).toEqual(['关键', '重要', '一般', '辅助', '前置条件'])
  })

  it('deptByName 返回权威部门定义，未知部门 fail-closed 返回 null', () => {
    expect(deptByName('市场部')?.name).toBe('市场部')
    expect(deptByName('不存在的部门')).toBeNull()
  })

  it('deptItemCount / totalItemCount 计数正确（总条目 > 300）', () => {
    expect(deptItemCount('市场部')).toBeGreaterThan(0)
    expect(totalItemCount()).toBeGreaterThan(300)
    // 各部门条目之和 = 总条目
    const sum = deptNames().reduce((s, n) => s + deptItemCount(n), 0)
    expect(sum).toBe(totalItemCount())
  })

  it('itemsByStage 按部门+阶段检索（fail-closed 未知阶段返回空）', () => {
    const r = itemsByStage('市场部', 'CG0-CG1')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => x.slot >= 1 && x.slot <= 5)).toBe(true)
    expect(itemsByStage('市场部', 'CGX-YY')).toEqual([])
  })

  it('itemsByLevel 按部门+等级检索', () => {
    const r = itemsByLevel('市场部', '关键')
    expect(r.length).toBeGreaterThan(0)
    expect(itemsByLevel('市场部', '关键').every((x) => x.name.length > 0)).toBe(true)
  })

  it('searchItems 关键词模糊检索', () => {
    const r = searchItems('BOM')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => x.name.includes('BOM') || x.dept.includes('BOM'))).toBe(true)
    expect(searchItems('')).toEqual([])
  })

  it('cutPolicyOf 裁剪口径（关键不可裁剪，重要/一般/辅助可裁剪）', () => {
    expect(cutPolicyOf('关键').trimmable).toBe(false)
    expect(cutPolicyOf('重要').trimmable).toBe(true)
    expect(cutPolicyOf('一般').trimmable).toBe(true)
    expect(cutPolicyOf('辅助').trimmable).toBe(true)
    expect(cutPolicyOf('前置条件').trimmable).toBe(false)
  })

  it('CONTROL_DEPTS 数据完整性：每部门至少一个等级、等级有 mark', () => {
    for (const d of CONTROL_DEPTS) {
      expect(d.levels.length).toBeGreaterThan(0)
      for (const l of d.levels) {
        expect(l.level).toBeTruthy()
      }
    }
  })
})
