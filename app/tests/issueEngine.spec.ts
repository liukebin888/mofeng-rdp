import { describe, it, expect } from 'vitest'
import {
  ISSUE_PHASES,
  issuePhaseCanTransition,
  issuePhaseNext,
  isIssueClosed,
  statusToPhase,
  phaseToStatus,
  phaseOf,
  canCloseIssue,
  evaluateAdvance,
  ISSUE_ALERT_ACK_STATUSES,
  alertAckCanTransition,
  alertAckNext,
  validateIssueLinks,
  issuePhaseStats,
  CLOSURE_REQUIRED_FIELDS,
  type IssuePhase
} from '@/domain/issueEngine'

const fullClosure = { rootCause: '设计余量不足', correctiveAction: '加大安全系数并重算', verifiedBy: '质量张工' }

describe('issueEngine 五态状态机', () => {
  it('配置五态齐全且顺序正确', () => {
    expect(ISSUE_PHASES).toEqual(['问题描述', '原因分析', '纠正措施执行', '验证', '关闭'])
  })

  it('按序推进每一步合法', () => {
    for (let i = 0; i < ISSUE_PHASES.length - 1; i++) {
      expect(issuePhaseCanTransition(ISSUE_PHASES[i], ISSUE_PHASES[i + 1]).ok).toBe(true)
    }
  })

  it('跳态被拒（回退验证：问题描述→关闭）', () => {
    const r = issuePhaseCanTransition('问题描述', '关闭')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('按序推进')
  })

  it('任意跨级跳态均被拒', () => {
    const invalid: Array<[IssuePhase, IssuePhase]> = [
      ['问题描述', '纠正措施执行'], ['问题描述', '验证'],
      ['原因分析', '验证'], ['原因分析', '关闭'],
      ['纠正措施执行', '关闭']
    ]
    for (const [a, b] of invalid) expect(issuePhaseCanTransition(a, b).ok).toBe(false)
  })

  it('回退被拒（关闭→验证）', () => {
    expect(issuePhaseCanTransition('关闭', '验证').ok).toBe(false)
  })

  it('同态被拒（状态未变化）', () => {
    const r = issuePhaseCanTransition('验证', '验证')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('未变化')
  })

  it('next 与 canTransition 同源：next 返回的目标必可被 canTransition 接受', () => {
    for (const p of ISSUE_PHASES) {
      const n = issuePhaseNext(p)
      if (n) expect(issuePhaseCanTransition(p, n).ok).toBe(true)
      else expect(isIssueClosed(p)).toBe(true)
    }
  })

  it('关闭为终态，无下一态', () => {
    expect(issuePhaseNext('关闭')).toBeNull()
    expect(isIssueClosed('关闭')).toBe(true)
    expect(isIssueClosed('验证')).toBe(false)
  })
})

describe('issueEngine 历史三态兼容（不迁移旧数据）', () => {
  it('旧状态映射到五态', () => {
    expect(statusToPhase('开放')).toBe('问题描述')
    expect(statusToPhase('处理中')).toBe('原因分析')
    expect(statusToPhase('已关闭')).toBe('关闭')
  })

  it('已是五态的值原样返回', () => {
    for (const p of ISSUE_PHASES) expect(statusToPhase(p)).toBe(p)
  })

  it('五态镜像回三态，保留 OTS/偏差门禁的 已关闭 口径', () => {
    expect(phaseToStatus('问题描述')).toBe('开放')
    expect(phaseToStatus('原因分析')).toBe('处理中')
    expect(phaseToStatus('纠正措施执行')).toBe('处理中')
    expect(phaseToStatus('验证')).toBe('处理中')
    expect(phaseToStatus('关闭')).toBe('已关闭')
  })

  it('phaseOf 缺省时按 status 推导，有 phase 时优先', () => {
    expect(phaseOf({ status: '处理中' })).toBe('原因分析')
    expect(phaseOf({ status: '开放', phase: '验证' })).toBe('验证')
  })

  it('镜像往返：五态→三态→五态 丢失粒度属预期（历史兼容）', () => {
    expect(statusToPhase(phaseToStatus('关闭'))).toBe('关闭')
    // 处理中的细分态回退到最早态，不臆造
    expect(statusToPhase(phaseToStatus('验证'))).toBe('原因分析')
  })
})

describe('issueEngine 关闭三要素 fail-closed', () => {
  it('验证阶段 + 三要素齐全 → 允许关闭', () => {
    expect(canCloseIssue(fullClosure, '验证')).toEqual({ ok: true, missing: [] })
  })

  it('非验证阶段即使三要素齐全也拒绝（不可跳态关闭）', () => {
    const r = canCloseIssue(fullClosure, '原因分析')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('验证')
  })

  it('缺任一要素即拒绝并列出缺失字段（回退验证）', () => {
    const cases = [
      { rootCause: '', correctiveAction: '措施', verifiedBy: '质量张工' },
      { rootCause: '根因', correctiveAction: '  ', verifiedBy: '质量张工' },
      { rootCause: '根因', correctiveAction: '措施', verifiedBy: '' }
    ]
    for (const c of cases) {
      const r = canCloseIssue(c, '验证')
      expect(r.ok).toBe(false)
      expect(r.missing.length).toBeGreaterThan(0)
    }
  })

  it('纯空格视为缺失', () => {
    const r = canCloseIssue({ rootCause: '   ', correctiveAction: '措施', verifiedBy: '质量' }, '验证')
    expect(r.missing).toContain('rootCause')
  })

  it('三要素配置清单固定为三项', () => {
    expect([...CLOSURE_REQUIRED_FIELDS]).toEqual(['rootCause', 'correctiveAction', 'verifiedBy'])
  })
})

describe('issueEngine 推进求值', () => {
  it('前三态推进不要求关闭要素', () => {
    for (const p of ['问题描述', '原因分析', '纠正措施执行'] as IssuePhase[]) {
      const r = evaluateAdvance(p)
      expect(r.ok).toBe(true)
      expect(r.requiresClosure).toBe(false)
    }
  })

  it('验证→关闭 标记 requiresClosure', () => {
    const r = evaluateAdvance('验证')
    expect(r.ok).toBe(true)
    expect(r.next).toBe('关闭')
    expect(r.requiresClosure).toBe(true)
  })

  it('终态推进被拒', () => {
    const r = evaluateAdvance('关闭')
    expect(r.ok).toBe(false)
    expect(r.requiresClosure).toBe(false)
  })
})

describe('issueEngine 报警回执状态机', () => {
  it('回执三态齐全', () => {
    expect(ISSUE_ALERT_ACK_STATUSES).toEqual(['已发送', '已响应', '已确认'])
  })

  it('按序流转合法', () => {
    expect(alertAckCanTransition('已发送', '已响应').ok).toBe(true)
    expect(alertAckCanTransition('已响应', '已确认').ok).toBe(true)
  })

  it('跳态/回退被拒（回退验证：已发送→已确认）', () => {
    expect(alertAckCanTransition('已发送', '已确认').ok).toBe(false)
    expect(alertAckCanTransition('已确认', '已响应').ok).toBe(false)
  })

  it('next 与 canTransition 同源', () => {
    for (const s of ISSUE_ALERT_ACK_STATUSES) {
      const n = alertAckNext(s)
      if (n) expect(alertAckCanTransition(s, n).ok).toBe(true)
      else expect(s).toBe('已确认')
    }
  })
})

describe('issueEngine 关联键与统计', () => {
  it('关联键缺省合法，空串声明视为非法', () => {
    expect(validateIssueLinks({}).ok).toBe(true)
    expect(validateIssueLinks({ checklistId: 'IC-1', ncId: 'NC-2' }).ok).toBe(true)
    const bad = validateIssueLinks({ eightDId: '   ' })
    expect(bad.ok).toBe(false)
    expect(bad.invalid).toContain('eightDId')
  })

  it('相位统计按五态分桶，含历史数据', () => {
    const items = [
      { status: '开放' },
      { status: '处理中' },
      { status: '已关闭' },
      { status: '开放', phase: '验证' as IssuePhase }
    ]
    const st = issuePhaseStats(items)
    expect(st.total).toBe(4)
    expect(st.byPhase['问题描述']).toBe(1)
    expect(st.byPhase['原因分析']).toBe(1)
    expect(st.byPhase['验证']).toBe(1)
    expect(st.byPhase['关闭']).toBe(1)
    expect(st.closed).toBe(1)
    expect(st.open).toBe(3)
  })
})
