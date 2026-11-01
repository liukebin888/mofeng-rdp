import { describe, it, expect } from 'vitest'
import {
  RISK_CATEGORIES,
  riskLevel,
  closeRiskLedger,
  validateVulnerability,
  findVulnsByVersion,
  closeVulnerability,
  EIGHT_D_STEPS,
  EIGHT_D_STEP_COUNT,
  ISSUE_TAGS,
  canClose8D,
  countByTag,
  closeSafetyDefect,
  markResidualRisk
} from '@/domain/defect'
import type { Issue8D, RiskLedgerItem, VulnerabilityItem } from '@/domain/defect'

const vuln = (over: Partial<VulnerabilityItem> = {}): VulnerabilityItem => ({
  id: 'V-1',
  vulnId: 'CVE-2026-0001',
  cvss: 9.8,
  affectedVersion: '1.2.3',
  remediation: '升级依赖',
  status: '已修复待验证',
  ...over
})

describe('defect — QMS-001 风险台账', () => {
  it('七类齐全', () => {
    expect(RISK_CATEGORIES).toHaveLength(7)
    expect(RISK_CATEGORIES).toEqual(['技术', '供应链', '进度', '成本', '合规', '安全', '质量'])
  })

  it('等级叠加显示正确（概率×影响）', () => {
    expect(riskLevel('高', '高')).toBe('重大')
    expect(riskLevel('高', '中')).toBe('高')
    expect(riskLevel('中', '中')).toBe('中')
    expect(riskLevel('低', '中')).toBe('低')
    expect(riskLevel('低', '低')).toBe('轻微')
  })
})

describe('defect — QMS-002 风险 PDCA 闭环', () => {
  const item: RiskLedgerItem = {
    id: 'r1', projectId: 'P-1', category: '技术',
    probability: '高', impact: '高', level: '重大',
    strategy: '减轻', owner: '张工', due: '2026-12-01',
    pdcaStatus: 'C'
  }

  it('闭环需责任人确认，系统无法代确认', () => {
    expect(closeRiskLedger(item, { confirmedByOwner: false, bySystem: true }).ok).toBe(false)
    expect(closeRiskLedger(item, { confirmedByOwner: false, bySystem: false }).ok).toBe(false)
    expect(closeRiskLedger(item, { confirmedByOwner: true, bySystem: false }).ok).toBe(true)
  })
})

describe('defect — QMS-003 漏洞台账', () => {
  it('字段齐全率 100%', () => {
    expect(validateVulnerability(vuln()).ok).toBe(true)
    const r = validateVulnerability({ vulnId: 'CVE-1' })
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(expect.arrayContaining(['cvss', 'affectedVersion', 'remediation']))
  })

  it('可按版本反查漏洞', () => {
    const vulns = [vuln(), vuln({ id: 'V-2', vulnId: 'CVE-2026-0002', affectedVersion: '2.0.0' })]
    expect(findVulnsByVersion(vulns, '1.2.3')).toHaveLength(1)
    expect(findVulnsByVersion(vulns, '9.9.9')).toHaveLength(0)
  })
})

describe('defect — QMS-004 漏洞关闭控制', () => {
  it('无复测结论关闭被拒', () => {
    expect(closeVulnerability(vuln({ retestConclusion: undefined }), 'human').ok).toBe(false)
    expect(closeVulnerability(vuln({ retestConclusion: '不通过' }), 'human').ok).toBe(false)
  })

  it('AI 调用关闭接口被拒', () => {
    expect(closeVulnerability(vuln({ retestConclusion: '通过' }), 'ai').ok).toBe(false)
  })

  it('复测通过 + 人工关闭成功', () => {
    expect(closeVulnerability(vuln({ retestConclusion: '通过' }), 'human').ok).toBe(true)
  })
})

describe('defect — QMS-005 8D 问题台账', () => {
  const fullIssue: Issue8D = {
    id: '8d1', projectId: 'P-1', tag: '不合格',
    stage: '试制', batch: 'B-01',
    rootCause: '焊接参数漂移', rootCauseVerified: true,
    completedSteps: [...EIGHT_D_STEPS],
    status: '开放'
  }

  it('八步齐备 + D4 根因验证才可关闭', () => {
    expect(EIGHT_D_STEP_COUNT).toBe(8)
    expect(canClose8D(fullIssue).ok).toBe(true)
  })

  it('缺步不可关闭', () => {
    const partial = { ...fullIssue, completedSteps: EIGHT_D_STEPS.slice(0, 7) }
    const r = canClose8D(partial)
    expect(r.ok).toBe(false)
    expect(r.missing).toHaveLength(1)
  })

  it('D4 根因未验证不可关闭', () => {
    const r = canClose8D({ ...fullIssue, rootCauseVerified: false })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('根因')
  })

  it('六类标签各建 1 条，分类统计正确', () => {
    expect(ISSUE_TAGS).toHaveLength(6)
    const issues = ISSUE_TAGS.map((tag, i) => ({ ...fullIssue, id: `8d-${i}`, tag }))
    const stat = countByTag(issues)
    for (const t of ISSUE_TAGS) expect(stat[t]).toBe(1)
  })
})

describe('defect — QMS-006 安全缺陷闭环证据', () => {
  it('缺证据不可闭环，补齐后可闭环', () => {
    expect(closeSafetyDefect({ id: 'sd1', description: 'x', status: '开放' }).ok).toBe(false)
    expect(closeSafetyDefect({ id: 'sd1', description: 'x', status: '开放' }, '测试报告-001').ok).toBe(true)
  })
})

describe('defect — QMS-009 遗留风险审批', () => {
  it('无审批不可标记为遗留风险', () => {
    expect(markResidualRisk(undefined).ok).toBe(false)
  })

  it('审批人须质量总监及以上', () => {
    expect(markResidualRisk({ riskId: 'r1', approverLevel: '其他', approver: 'x', deadline: '2026-12-01' }).ok).toBe(false)
    expect(markResidualRisk({ riskId: 'r1', approverLevel: '质量总监', approver: 'x', deadline: '2026-12-01' }).ok).toBe(true)
    expect(markResidualRisk({ riskId: 'r1', approverLevel: '研发副总', approver: 'x', deadline: '2026-12-01' }).ok).toBe(true)
  })

  it('须设定期限', () => {
    expect(markResidualRisk({ riskId: 'r1', approverLevel: '质量总监', approver: 'x', deadline: '' }).ok).toBe(false)
  })
})
