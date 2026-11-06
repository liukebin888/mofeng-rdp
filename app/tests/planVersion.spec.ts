import { describe, it, expect } from 'vitest'
import {
  nextVersion,
  parseVersion,
  isValidVersion,
  compareVersion,
  versionAt,
  INITIAL_PLAN_VERSION,
  VERSION_DIGIT_MAX
} from '@/domain/planVersion'

describe('项目主计划版本引擎（MPV-001：A1→A2→A3→A4→B1→…）', () => {
  it('parseVersion：合法版本号解析', () => {
    expect(parseVersion('A1')).toEqual({ letter: 'A', digit: 1 })
    expect(parseVersion('B4')).toEqual({ letter: 'B', digit: 4 })
    expect(parseVersion('Z3')).toEqual({ letter: 'Z', digit: 3 })
    expect(parseVersion('AA1')).toEqual({ letter: 'AA', digit: 1 })
  })

  it('parseVersion：小写 / 空白归一化', () => {
    expect(parseVersion('a1')).toEqual({ letter: 'A', digit: 1 })
    expect(parseVersion(' b2 ')).toEqual({ letter: 'B', digit: 2 })
  })

  it('parseVersion：非法版本号返回 null（fail-closed）', () => {
    expect(parseVersion('')).toBeNull()
    expect(parseVersion('A0')).toBeNull() // 数字位 <1
    expect(parseVersion('A5')).toBeNull() // 数字位 >4
    expect(parseVersion('A')).toBeNull() // 缺数字位
    expect(parseVersion('1A')).toBeNull() // 字母数字颠倒
    expect(parseVersion('A1B')).toBeNull() // 多余后缀
    expect(parseVersion('V1.0')).toBeNull() // 旧式自由版本格式
  })

  it('isValidVersion：与 parseVersion 同源', () => {
    expect(isValidVersion('A1')).toBe(true)
    expect(isValidVersion('B4')).toBe(true)
    expect(isValidVersion('A5')).toBe(false)
    expect(isValidVersion('V1.0')).toBe(false)
  })

  it('nextVersion：数字位 1→4 递增，满 4 进位到下一字母', () => {
    expect(nextVersion('A1')).toBe('A2')
    expect(nextVersion('A2')).toBe('A3')
    expect(nextVersion('A3')).toBe('A4')
    expect(nextVersion('A4')).toBe('B1')
    expect(nextVersion('B1')).toBe('B2')
    expect(nextVersion('B4')).toBe('C1')
  })

  it('nextVersion：跨字母连续（A4→B1→…→C1→…）', () => {
    expect(nextVersion('C1')).toBe('C2')
    expect(nextVersion('C2')).toBe('C3')
    expect(nextVersion('C3')).toBe('C4')
    expect(nextVersion('C4')).toBe('D1')
  })

  it('nextVersion：Z 之后进双字母', () => {
    expect(nextVersion('Y4')).toBe('Z1')
    expect(nextVersion('Z1')).toBe('Z2')
    expect(nextVersion('Z4')).toBe('AA1')
    expect(nextVersion('AA1')).toBe('AA2')
  })

  it('nextVersion：非法输入返回 null', () => {
    expect(nextVersion('A5')).toBeNull()
    expect(nextVersion('V1.0')).toBeNull()
    expect(nextVersion('')).toBeNull()
  })

  it('compareVersion：全序比较', () => {
    expect(compareVersion('A1', 'A2')).toBeLessThan(0)
    expect(compareVersion('A4', 'B1')).toBeLessThan(0)
    expect(compareVersion('B1', 'A4')).toBeGreaterThan(0)
    expect(compareVersion('A1', 'A1')).toBe(0)
    expect(compareVersion('Z4', 'AA1')).toBeLessThan(0)
  })

  it('versionAt：序列号 → 版本号（第 1 版 = A1）', () => {
    expect(versionAt(1)).toBe('A1')
    expect(versionAt(4)).toBe('A4')
    expect(versionAt(5)).toBe('B1')
    expect(versionAt(8)).toBe('B4')
    expect(versionAt(9)).toBe('C1')
  })

  it('INITIAL_PLAN_VERSION：新编制主计划首个版本', () => {
    expect(INITIAL_PLAN_VERSION).toBe('A1')
    expect(nextVersion(INITIAL_PLAN_VERSION)).toBe('A2')
  })

  it('VERSION_DIGIT_MAX：数字位上限为 4', () => {
    expect(VERSION_DIGIT_MAX).toBe(4)
  })

  it('连续递增 60 次覆盖 A1→Z4→AA…，无重复无跳跃', () => {
    let cur = INITIAL_PLAN_VERSION
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const nxt = nextVersion(cur)
      expect(nxt).not.toBeNull()
      const v = nxt as string
      // 每个版本只出现一次（无重复）
      expect(seen.has(v)).toBe(false)
      seen.add(v)
      // 严格递增
      expect(compareVersion(v, cur)).toBeGreaterThan(0)
      cur = v
    }
  })
})
