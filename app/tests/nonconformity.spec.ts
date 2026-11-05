import { describe, it, expect } from 'vitest'
import {
  urgencyOf,
  canTransition,
  stayDaysOf,
  overdueDaysOf,
  isOverdue,
  aggregateBySource,
  aggregateByStage,
  aggregateByType,
  aggregateByUrgency,
  openCount,
  closedCount,
  overdueCount,
  highUrgencyCount,
  NONCONFORMITY_STATUSES,
  type Nonconformity
} from '@/domain/nonconformity'

const item = (p: Partial<Nonconformity> = {}): Nonconformity => ({
  id: 'NC-1',
  checkReport: '检查报告',
  code: 'RPT-1-1',
  source: '需求工程',
  stage: 'CG2',
  type: '过程',
  description: '描述',
  correctiveAction: '组织输出',
  urgency: '高',
  raisedAt: '2025-12-13',
  status: '问题描述',
  owner: '张三',
  actionDate: '2025-12-13',
  requiredDate: '2025-12-20',
  actualDate: '',
  cause: '设计员自身原因',
  section: '科',
  dept: '部',
  ...p
})

describe('nonconformity 紧急度判定（与 PQSR 同源）', () => {
  it('驻留 ≥5 → 高', () => expect(urgencyOf(5)).toBe('高'))
  it('驻留 ≥3 → 中', () => expect(urgencyOf(3)).toBe('中'))
  it('驻留 <3 → 低', () => expect(urgencyOf(2)).toBe('低'))
  it('加急/无解升级高', () => {
    expect(urgencyOf(1, true)).toBe('高')
    expect(urgencyOf(1, false, true)).toBe('高')
  })
})

describe('nonconformity 四态状态机', () => {
  it('按序推进合法', () => {
    expect(canTransition('问题描述', '原因分析').ok).toBe(true)
    expect(canTransition('原因分析', '纠正措施执行').ok).toBe(true)
    expect(canTransition('纠正措施执行', '关闭').ok).toBe(true)
  })
  it('跳态非法', () => {
    expect(canTransition('问题描述', '关闭').ok).toBe(false)
    expect(canTransition('问题描述', '纠正措施执行').ok).toBe(false)
  })
  it('回退非法', () => {
    expect(canTransition('原因分析', '问题描述').ok).toBe(false)
  })
  it('同态非法', () => {
    expect(canTransition('问题描述', '问题描述').ok).toBe(false)
  })
  it('关闭态不可再流转', () => {
    expect(canTransition('关闭', '原因分析').ok).toBe(false)
  })
})

describe('nonconformity 驻留与延期天数', () => {
  it('未关闭：驻留 = 追踪日 - 提出日', () => {
    expect(stayDaysOf('2025-12-13', '问题描述', '', '2025-12-19')).toBe(6)
  })
  it('已关闭：驻留 = 实际完成 - 提出', () => {
    expect(stayDaysOf('2025-12-13', '关闭', '2025-12-19', '2025-12-19')).toBe(6)
  })
  it('延期天数：超过要求完成日期', () => {
    expect(overdueDaysOf('2025-12-20', '关闭', '2025-12-23', '2025-12-23')).toBe(3)
  })
  it('延期天数为负归 0', () => {
    expect(overdueDaysOf('2025-12-20', '关闭', '2025-12-15', '2025-12-15')).toBe(0)
  })
  it('isOverdue 判断', () => {
    expect(isOverdue('2025-12-20', '关闭', '2025-12-23', '2025-12-23')).toBe(true)
    expect(isOverdue('2025-12-20', '关闭', '2025-12-15', '2025-12-15')).toBe(false)
  })
})

describe('nonconformity 附表统计', () => {
  const items = [
    item({ id: '1', source: '需求工程', stage: 'CG2', type: '过程', urgency: '高' }),
    item({ id: '2', source: '需求工程', stage: 'CG2', type: '过程', urgency: '高' }),
    item({ id: '3', source: '测试', stage: 'CG3', type: '工作产品', urgency: '中' })
  ]
  it('按来源聚合', () => {
    const r = aggregateBySource(items)
    expect(r.find((x) => x.source === '需求工程')?.count).toBe(2)
    expect(r.find((x) => x.source === '测试')?.count).toBe(1)
    expect(r.find((x) => x.source === '配置管理')?.count).toBe(0)
  })
  it('按阶段聚合', () => {
    const r = aggregateByStage(items)
    expect(r.find((x) => x.stage === 'CG2')?.count).toBe(2)
    expect(r.find((x) => x.stage === 'CG3')?.count).toBe(1)
  })
  it('按类型聚合', () => {
    const r = aggregateByType(items)
    expect(r.find((x) => x.type === '过程')?.count).toBe(2)
    expect(r.find((x) => x.type === '工作产品')?.count).toBe(1)
    expect(r.find((x) => x.type === '体系文件')?.count).toBe(0)
  })
  it('按紧急度聚合', () => {
    const r = aggregateByUrgency(items)
    expect(r.find((x) => x.urgency === '高')?.count).toBe(2)
    expect(r.find((x) => x.urgency === '中')?.count).toBe(1)
    expect(r.find((x) => x.urgency === '低')?.count).toBe(0)
  })
  it('附表统计完整覆盖全部枚举（含 0）', () => {
    expect(aggregateBySource([]).length).toBe(15)
    expect(aggregateByStage([]).length).toBe(8)
    expect(aggregateByType([]).length).toBe(3)
    expect(aggregateByUrgency([]).length).toBe(3)
  })
})

describe('nonconformity 计数', () => {
  const items = [
    item({ id: '1', status: '关闭', actualDate: '2025-12-19', requiredDate: '2025-12-20', urgency: '低' }),
    item({ id: '2', status: '问题描述', requiredDate: '2026-01-01', urgency: '中' }),
    item({ id: '3', status: '问题描述', urgency: '高', requiredDate: '2025-01-01' })
  ]
  it('未关闭 / 已关闭', () => {
    expect(openCount(items)).toBe(2)
    expect(closedCount(items)).toBe(1)
  })
  it('高紧急度', () => {
    expect(highUrgencyCount(items)).toBe(1)
  })
  it('逾期（相对 asOf 2026-01-10）', () => {
    expect(overdueCount(items, '2026-01-10')).toBe(2)
  })
  it('状态枚举四态', () => {
    expect(NONCONFORMITY_STATUSES).toEqual(['问题描述', '原因分析', '纠正措施执行', '关闭'])
  })
})
