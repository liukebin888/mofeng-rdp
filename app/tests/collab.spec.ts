/**
 * 协同沟通引擎独立 QA 用例（SRS 第 12 章 / COM-001~009 / FUN-024）
 * 覆盖：决议条目化缺责任人/期限拒保存 / 决议转任务幂等 / 决议无证据关闭被拒 /
 *      决议逾期升级 / 会议策划四要素 / 送审件必带版本 / 送审答复留痕与超期升级 /
 *      督办四态闭环与非法流转拒绝
 */
import { describe, expect, it } from 'vitest'
import {
  advanceSupervise,
  answerSendAudit,
  closeResolution,
  escalateSendAudit,
  escalateSupervise,
  isOverdue,
  nextResolutionCode,
  overdueResolutions,
  resolutionToTask,
  validateMeeting,
  validateResolution,
  validateSendAudit
} from '../src/domain/collabEngine'
import type { MeetingItem, ResolutionItem, SendAuditItem, SuperviseItem } from '../src/domain/types'

const TODAY = '2026-11-01'

function mkResolution(overrides: Partial<ResolutionItem> = {}): ResolutionItem {
  return {
    id: 'RS-T1',
    projectId: 'P-001',
    meetingId: 'M1',
    code: 'RES-TST-001',
    content: '完成软件配置字回归',
    owner: '林静',
    due: '2026-11-06',
    status: '待执行',
    createdAt: '2026-10-29',
    ...overrides
  }
}

describe('COM-006 决议条目化（缺责任人/期限不可保存）', () => {
  it('内容为空即拒', () => {
    expect(validateResolution({ content: '', owner: '林静', due: '2026-11-06' })).toContain('决议内容不能为空')
  })
  it('缺责任人即拒', () => {
    expect(validateResolution({ content: 'x', owner: '', due: '2026-11-06' })).toContain('责任人不能为空')
  })
  it('缺期限即拒', () => {
    expect(validateResolution({ content: 'x', owner: '林静', due: '' })).toContain('期限不能为空')
  })
  it('三要素齐备则通过', () => {
    expect(validateResolution({ content: 'x', owner: '林静', due: '2026-11-06' })).toEqual([])
  })
})

describe('COM-007 决议转任务（幂等）', () => {
  it('首次转任务挂 taskId 并进入执行中', () => {
    const r = resolutionToTask(mkResolution(), 'TASK-001')
    expect(r.taskId).toBe('TASK-001')
    expect(r.status).toBe('执行中')
  })
  it('同一决议不重复建任务', () => {
    const once = resolutionToTask(mkResolution(), 'TASK-001')
    const twice = resolutionToTask(once, 'TASK-002')
    expect(twice.taskId).toBe('TASK-001')
  })
})

describe('COM-008 决议逾期升级与关闭判定', () => {
  it('无证据关闭被拒', () => {
    const { closed, errors } = closeResolution(mkResolution(), '', TODAY)
    expect(closed).toBe(false)
    expect(errors).toContain('无证据关闭被拒（COM-008）')
  })
  it('有证据关闭成功并留痕', () => {
    const { resolution, closed } = closeResolution(mkResolution(), '回归用例全部通过', TODAY)
    expect(closed).toBe(true)
    expect(resolution.status).toBe('已闭环')
    expect(resolution.evidence).toBe('回归用例全部通过')
  })
  it('逾期未闭环决议被列出', () => {
    const overdue = mkResolution({ id: 'a', due: '2026-10-20', status: '执行中' })
    const ok = mkResolution({ id: 'b', due: '2026-11-10', status: '执行中' })
    const closed = mkResolution({ id: 'c', due: '2026-10-01', status: '已闭环' })
    const list = overdueResolutions([overdue, ok, closed], TODAY)
    expect(list.map((r) => r.id)).toEqual(['a'])
  })
})

describe('COM-005 会议策划四要素', () => {
  it('缺参会人即拒', () => {
    const e = validateMeeting({ title: '评审', agenda: '议题', host: '陈志远', date: '2026-11-02', attendees: [] })
    expect(e).toContain('参会人不能为空')
  })
  it('四要素齐备通过', () => {
    expect(validateMeeting({ title: '评审', agenda: '议题', host: '陈志远', date: '2026-11-02', attendees: ['林静'] })).toEqual([])
  })
})

describe('COM-001/002 送审件（版本必填 + 答复留痕 + 超期升级）', () => {
  const mk = (overrides: Partial<SendAuditItem> = {}): SendAuditItem => ({
    id: 'SA-T1', projectId: 'P-001', code: 'SA-TST-001', title: 'DV 大纲', version: 'V1.0',
    reviewerType: '客户', reviewer: '客户 SQE', sentAt: '2026-10-24', dueAt: '2026-11-02',
    status: '待答复', answers: [], escalated: false, ...overrides
  })

  it('缺版本即拒', () => {
    expect(validateSendAudit({ title: 'DV 大纲', version: '', reviewerType: '客户', reviewer: 'SQE', dueAt: '2026-11-02' }))
      .toContain('版本不能为空（COM-001）')
  })
  it('答复留痕并记录往返', () => {
    const { item, errors } = answerSendAudit(mk(), '张工', '同意', '2026-11-01T10:00', TODAY)
    expect(errors).toEqual([])
    expect(item.answers).toHaveLength(1)
    expect(item.status).toBe('已答复')
  })
  it('答复超期自动升级', () => {
    const { item } = answerSendAudit(mk({ dueAt: '2026-10-20' }), '张工', '同意', '2026-11-01T10:00', TODAY)
    expect(item.escalated).toBe(true)
  })
  it('未答复且逾期 → 升级为已超期', () => {
    const item = escalateSendAudit(mk({ dueAt: '2026-10-20' }), TODAY)
    expect(item.status).toBe('已超期')
    expect(item.escalated).toBe(true)
  })
})

describe('COM-009 督办四态闭环', () => {
  const mk = (overrides: Partial<SuperviseItem> = {}): SuperviseItem => ({
    id: 'SV-T1', projectId: 'P-001', code: 'SUP-0001', title: '锁定台架', owner: '冯磊', due: '2026-11-03',
    status: '交办', actions: [{ at: 't0', by: '许', action: '交办', note: '' }], escalated: false, ...overrides
  })

  it('交办态只能反馈，非法动作被拒', () => {
    const { advanced, errors } = advanceSupervise(mk(), '销项', '许', '', 't1', TODAY)
    expect(advanced).toBe(false)
    expect(errors[0]).toContain('只能执行「反馈」')
  })
  it('四态顺序流转：交办→反馈→复核→销项', () => {
    let cur = mk()
    const s1 = advanceSupervise(cur, '反馈', '冯', '', 't1', TODAY)
    expect(s1.item.status).toBe('反馈')
    const s2 = advanceSupervise(s1.item, '复核', '许', '', 't2', TODAY)
    expect(s2.item.status).toBe('复核')
    const s3 = advanceSupervise(s2.item, '销项', '许', '验收通过', 't3', TODAY)
    expect(s3.item.status).toBe('已销项')
    expect(s3.item.actions).toHaveLength(4)
  })
  it('已销项不可再推进', () => {
    const done = mk({ status: '已销项', actions: [] })
    const { advanced, errors } = advanceSupervise(done, '销项', '许', '', 't1', TODAY)
    expect(advanced).toBe(false)
    expect(errors).toContain('已销项事项不可再推进')
  })
  it('超期自动升级', () => {
    const item = escalateSupervise(mk({ due: '2026-10-20' }), TODAY)
    expect(item.escalated).toBe(true)
  })
})

describe('编码生成与逾期判定', () => {
  it('决议编码按项目内递增', () => {
    const pool = [mkResolution({ id: 'a', code: 'RES-001' }), mkResolution({ id: 'b', code: 'RES-002' })]
    expect(nextResolutionCode(pool, 'P-001')).toBe('RES-003')
  })
  it('isOverdue 字典序比较', () => {
    expect(isOverdue('2026-10-20', '2026-11-01')).toBe(true)
    expect(isOverdue('2026-11-02', '2026-11-01')).toBe(false)
  })
})
