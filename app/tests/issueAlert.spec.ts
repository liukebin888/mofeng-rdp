import { describe, it, expect } from 'vitest'
import {
  isHighSeverity,
  primaryOrgOf,
  supervisorOf,
  directorOf,
  resolveAlertRecipients,
  buildIssueAlertMail,
  validateIssueLedger,
  issueLedgerStats,
  exportAlertMails,
  type IssueLedgerItem
} from '@/domain/issueAlert'
import type { OrgNode, OrgMembership } from '@/domain/types'

// 组织树样本（group → company → center → department → section → team）
const nodes: OrgNode[] = [
  { id: 'G', name: '集团总部', level: 'group', parentId: null, leaderTitle: '总裁', leaderName: '陈志远', order: 1 },
  { id: 'C', name: '研发制造公司', level: 'company', parentId: 'G', leaderTitle: '总经理', leaderName: '林静', order: 1 },
  { id: 'ELEC', name: '电子研发中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', leaderName: '周立群', order: 1 },
  { id: 'ELEC-D1', name: '智能交互一部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', leaderName: '王总监', order: 1 },
  { id: 'ELEC-D1-SW', name: '软件科', level: 'section', parentId: 'ELEC-D1', leaderTitle: '高级经理', leaderName: '李经理', order: 2 },
  { id: 'ELEC-D1-SW-T1', name: '软件一组', level: 'team', parentId: 'ELEC-D1-SW', leaderTitle: '经理', leaderName: '赵组长', order: 1 }
]

// 人员挂靠：韩晓峰 主职在软件一组
const memberships: OrgMembership[] = [
  { userId: 'U019', userName: '韩晓峰', orgId: 'ELEC-D1-SW-T1', track: 'software', postLevel: '软件工程师', primary: true, active: true }
]

describe('isHighSeverity', () => {
  it('P1/P2 为高严重度', () => {
    expect(isHighSeverity('P1')).toBe(true)
    expect(isHighSeverity('P2')).toBe(true)
  })
  it('P3/P4 为一般', () => {
    expect(isHighSeverity('P3')).toBe(false)
    expect(isHighSeverity('P4')).toBe(false)
  })
})

describe('primaryOrgOf', () => {
  it('返回主职挂靠组织', () => {
    expect(primaryOrgOf(memberships, '韩晓峰')?.orgId).toBe('ELEC-D1-SW-T1')
  })
  it('找不到时返回 undefined', () => {
    expect(primaryOrgOf(memberships, '不存在的人')).toBeUndefined()
  })
})

describe('supervisorOf', () => {
  it('上级 = 挂靠组织 leader（team 经理）', () => {
    const s = supervisorOf(nodes, memberships, '韩晓峰')
    expect(s.name).toBe('赵组长')
    expect(s.title).toBe('经理')
  })
})

describe('directorOf', () => {
  it('部门总监 = 向上回溯 department 层 leader', () => {
    const d = directorOf(nodes, memberships, '韩晓峰')
    expect(d.name).toBe('王总监')
    expect(d.deptName).toBe('智能交互一部')
  })
})

describe('resolveAlertRecipients', () => {
  it('P3/P4：仅责任人 + 上级，不含部门总监', () => {
    const r = resolveAlertRecipients(nodes, memberships, '韩晓峰', 'P3')
    expect(r.recipients).toEqual(['韩晓峰', '赵组长'])
    expect(r.recipients.includes('王总监')).toBe(false)
  })
  it('P1/P2：责任人 + 上级 + 部门总监', () => {
    const r = resolveAlertRecipients(nodes, memberships, '韩晓峰', 'P1')
    expect(r.recipients).toEqual(['韩晓峰', '赵组长', '王总监'])
  })
  it('责任人不明：仅责任人本人（fail-closed，不臆造）', () => {
    const r = resolveAlertRecipients(nodes, memberships, '', 'P1')
    expect(r.recipients).toEqual([])
  })
})

describe('buildIssueAlertMail', () => {
  const issue: IssueLedgerItem = {
    id: 'IL-1', code: 'MAN-001', title: '软件缺陷', desc: '', severity: 'P1',
    owner: '韩晓峰', source: '人工', status: '开放', createdAt: '2026-11-14T00:00:00Z'
  }
  it('生成严重报警邮件，含收件人与标题', () => {
    const mail = buildIssueAlertMail(issue, ['韩晓峰', '王总监'], ['责任人', '部门总监'], '2026-11-14T00:00:01Z')
    expect(mail.level).toBe('严重')
    expect(mail.subject).toContain('MAN-001')
    expect(mail.subject).toContain('P1')
    expect(mail.recipients).toEqual(['韩晓峰', '王总监'])
  })
  it('P3 生成一般报警邮件', () => {
    const mail = buildIssueAlertMail({ ...issue, severity: 'P3' }, ['韩晓峰'], ['责任人'], 'x')
    expect(mail.level).toBe('一般')
  })
})

describe('validateIssueLedger', () => {
  it('齐全通过', () => {
    expect(validateIssueLedger({ title: 'x', owner: 'y', severity: 'P2' }).ok).toBe(true)
  })
  it('缺失项返回清单', () => {
    const r = validateIssueLedger({ title: '', owner: '', severity: undefined })
    expect(r.ok).toBe(false)
    expect(r.missing.length).toBe(3)
  })
})

describe('issueLedgerStats', () => {
  const items: IssueLedgerItem[] = [
    { id: '1', code: 'A', title: 'x', desc: '', severity: 'P1', owner: 'a', source: '自动', status: '开放', createdAt: '' },
    { id: '2', code: 'B', title: 'x', desc: '', severity: 'P4', owner: 'a', source: '人工', status: '已关闭', createdAt: '' }
  ]
  it('统计开放/高/关闭', () => {
    const s = issueLedgerStats(items)
    expect(s.open).toBe(1)
    expect(s.high).toBe(1)
    expect(s.closed).toBe(1)
  })
})

describe('exportAlertMails', () => {
  it('导出 CSV 含表头与收件人', () => {
    const mail = buildIssueAlertMail(
      { id: '1', code: 'MAN-001', title: 'x', desc: '', severity: 'P1', owner: '韩晓峰', source: '人工', status: '开放', createdAt: '' },
      ['韩晓峰', '王总监'], ['责任人', '部门总监'], '2026-11-14T00:00:00Z'
    )
    const csv = exportAlertMails([mail])
    expect(csv).toContain('发送时间')
    expect(csv).toContain('MAN-001')
    expect(csv).toContain('韩晓峰(责任人)')
  })
})
