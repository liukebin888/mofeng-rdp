import { describe, it, expect } from 'vitest'
import {
  parseDeadline,
  constraintOfDeliverable,
  isParsed,
  coverageOf,
  unknownConstraint
} from '@/domain/deliverableDeadline'
import { APQP_DELIVERABLE_NODES } from '@/domain/apqpDeliverable'

// 收集清单里全部非空 deadline 原文
function allDeadlines(): string[] {
  const out: string[] = []
  for (const n of APQP_DELIVERABLE_NODES) {
    for (const d of n.deliverables) {
      if (d.deadline && d.deadline.trim()) out.push(d.deadline)
    }
  }
  return out
}

describe('输出物完成时间要求解析引擎（APQ-007 相对规则结构化）', () => {
  it('质量门相对：读取CGn数据±d天', () => {
    const r = parseDeadline('读取CG3数据-3天')
    expect(r.main.kind).toBe('gate')
    expect(r.main.anchor).toBe('CG3')
    expect(r.main.offsetDays).toBe(-3)
    expect(r.main.direction).toBe('before')
    expect(r.main.parsed).toBe(true)
  })

  it('质量门相对：读取CGn数据+20天', () => {
    const r = parseDeadline('读取CG2数据+20天')
    expect(r.main.anchor).toBe('CG2')
    expect(r.main.offsetDays).toBe(20)
    expect(r.main.direction).toBe('after')
  })

  it('质量门相对：CGn结束前/后', () => {
    const before = parseDeadline('CG2结束前15天完成')
    expect(before.main.anchor).toBe('CG2')
    expect(before.main.direction).toBe('before')
    expect(before.main.offsetDays).toBe(-15)

    const after = parseDeadline('CG3结束后15天内完成（OTS认可主导部门）')
    expect(after.main.anchor).toBe('CG3')
    expect(after.main.direction).toBe('after')
    expect(after.main.offsetDays).toBe(15)
  })

  it('质量门相对：简写 CGn+d / CGn-d天', () => {
    expect(parseDeadline('CG2+10').main.offsetDays).toBe(10)
    expect(parseDeadline('CG4-7天').main.offsetDays).toBe(-7)
  })

  it('3D 发布相对：3D发布d天内', () => {
    const r = parseDeadline('3D发布30天内完成')
    expect(r.main.kind).toBe('event')
    expect(r.main.anchor).toBe('3D发布')
    expect(r.main.offsetDays).toBe(30)
  })

  it('事件相对：主计划归档后d天 / 试生产后+d天', () => {
    const a = parseDeadline('主计划归档后7天内完成')
    expect(a.main.anchor).toBe('主计划归档')
    expect(a.main.offsetDays).toBe(7)

    const b = parseDeadline('试生产后+30天')
    expect(b.main.anchor).toBe('试生产')
    expect(b.main.offsetDays).toBe(30)
  })

  it('双事件区间：在《A》和《B》输出后d个工作日', () => {
    const r = parseDeadline('在《开发任务书》和《过程策划初始评估表》输出后14个工作日')
    expect(r.main.kind).toBe('dualEvent')
    expect(r.main.offsetDays).toBe(14)
    expect(r.main.workdays).toBe(true)
  })

  it('专线/非专线分支解析', () => {
    const r = parseDeadline('专线：电气装配完成时间+10天 非专线：电气装配完成时间+4天')
    expect(r.main.parsed).toBe(true)
    expect(r.main.anchor).toBe('电气装配完成时间')
    expect(r.main.offsetDays).toBe(10)
    expect(r.alt).not.toBeNull()
    expect(r.alt!.offsetDays).toBe(4)
  })

  it('空 deadline 返回 fail-closed 空约束', () => {
    const r = constraintOfDeliverable('')
    expect(r.main.parsed).toBe(false)
    expect(r.alt).toBeNull()
  })

  it('未知规则返回 unknown（fail-closed，不臆造）', () => {
    const r = parseDeadline('按外协外购件BOM')
    expect(r.main.parsed).toBe(false)
    expect(unknownConstraint('x').parsed).toBe(false)
  })

  it('清单 64 条非空 deadline 覆盖率统计正确', () => {
    const dl = allDeadlines()
    expect(dl.length).toBe(64)
    const cov = coverageOf(dl)
    expect(cov.total).toBe(64)
    expect(cov.empty).toBe(0)
    // 绝大多数规则应可解析；无法解析的少数规则（「按外协外购件BOM」「或双条件」）如实暴露
    expect(cov.parsed + cov.unparsed).toBe(64)
    expect(cov.parsed).toBe(62)
    expect(cov.unparsed).toBe(2)
  })

  it('「或」双条件规则 fail-closed（不臆造单一锚点）', () => {
    const r = parseDeadline('数据冻结指令后7天内或3D发布前20天完成')
    expect(r.main.parsed).toBe(false)
  })

  it('isParsed 对空/非空判定正确', () => {
    expect(isParsed('')).toBe(false)
    expect(isParsed('读取CG5数据-7天')).toBe(true)
  })
})
