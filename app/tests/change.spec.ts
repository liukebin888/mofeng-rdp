import { describe, it, expect } from 'vitest'
import {
  IMPACT_DIMS,
  impactComplete,
  requiredApprovers,
  closureStatus,
  closeEcr,
  SUPPLY_CHAIN_DIM,
  supplyChainInvolved,
  approversWithSupplyChain,
  approvalComplete,
  CHANGE_LEDGER_FIELDS,
  toChangeLedger,
  exportChangeLedger
} from '@/domain/change'
import type { EcrItem } from '@/domain/types'

const ecr = (p: Partial<EcrItem> = {}): EcrItem => ({
  id: 'E-1',
  projectId: 'P-1',
  code: 'ECR-001',
  title: '变更标题',
  sourceObjType: '图纸',
  sourceObjId: 'D-1',
  stage: '影响评估',
  impacts: [{ dim: '软件', assessed: true, note: '' }],
  closure: [{ objType: '图纸', objId: 'D-1', objCode: 'D-1', decision: '修改', note: '' }],
  highRisk: false,
  ...p
})

describe('change CHG-004 供应链参与', () => {
  it('供应链维度未评估 → 不参与', () => {
    const e = ecr({ impacts: [{ dim: '软件', assessed: true, note: '' }] })
    expect(supplyChainInvolved(e)).toBe(false)
  })
  it('供应链维度已评估 → 参与', () => {
    const e = ecr({ impacts: [{ dim: '供应链', assessed: true, note: '' }] })
    expect(supplyChainInvolved(e)).toBe(true)
  })
  it('供应链参与时审批人增补供应链经理', () => {
    const e = ecr({ impacts: [{ dim: '供应链', assessed: true, note: '' }] })
    expect(approversWithSupplyChain(e)).toContain('供应链经理')
  })
  it('供应链不参与时不增补供应链经理', () => {
    const e = ecr({ impacts: [{ dim: '软件', assessed: true, note: '' }] })
    expect(approversWithSupplyChain(e)).not.toContain('供应链经理')
  })
  it('供应链参与但供应链经理缺签 → 不可批准', () => {
    const e = ecr({ impacts: [{ dim: '供应链', assessed: true, note: '' }] })
    const r = approvalComplete(e, ['研发项目经理', '系统工程师'])
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('供应链经理')
  })
  it('供应链经理已签 → 可批准', () => {
    const e = ecr({ impacts: [{ dim: '供应链', assessed: true, note: '' }] })
    const r = approvalComplete(e, ['研发项目经理', '系统工程师', '供应链经理'])
    expect(r.ok).toBe(true)
  })
  it('高风险增补与供应链增补叠加', () => {
    const e = ecr({ highRisk: true, impacts: [{ dim: '供应链', assessed: true, note: '' }] })
    const approvers = approversWithSupplyChain(e)
    expect(approvers).toContain('供应链经理')
    expect(approvers).toContain('功能安全经理')
    expect(approvers).toContain('架构师')
  })
})

describe('change CHG-010 变更台账', () => {
  it('台账含 8 个关键字段', () => {
    expect(CHANGE_LEDGER_FIELDS.length).toBe(8)
  })
  it('台账行 8 字段取值正确', () => {
    const e = ecr({ highRisk: true, impacts: [{ dim: '供应链', assessed: true, note: '' }] })
    const row = toChangeLedger(e)
    expect(row.code).toBe('ECR-001')
    expect(row.highRisk).toBe('是')
    expect(row.supplyChain).toBe('是')
    expect(row.stage).toBe('影响评估')
  })
  it('导出台账含表头 + 数据行，字段数一致', () => {
    const e1 = ecr({ code: 'ECR-001' })
    const e2 = ecr({ id: 'E-2', code: 'ECR-002', highRisk: true })
    const csv = exportChangeLedger([e1, e2])
    const lines = csv.split('\n')
    expect(lines[0].split(',')).toHaveLength(8)
    expect(lines).toHaveLength(3)
  })
  it('含逗号的字段被正确转义', () => {
    const e = ecr({ title: '标题,含逗号' })
    const csv = exportChangeLedger([e])
    expect(csv).toContain('"标题,含逗号"')
  })
})

describe('change 既有 CHG-001~008 回归', () => {
  it('影响未评估 → 不完整', () => {
    const e = ecr({ impacts: [{ dim: '软件', assessed: false, note: '' }] })
    expect(impactComplete(e).ok).toBe(false)
  })
  it('高风险增补审批人', () => {
    const e = ecr({ highRisk: true })
    expect(requiredApprovers(e)).toContain('功能安全经理')
  })
  it('未确认闭包不可关闭', () => {
    const e = ecr({ closure: [{ objType: '图纸', objId: 'D-1', objCode: 'D-1', decision: '', note: '' }] })
    const s = closureStatus(e)
    expect(s.canClose).toBe(false)
    expect(closeEcr(e).ok).toBe(false)
  })
  it('四维影响维度常量', () => {
    expect(IMPACT_DIMS).toEqual(['软件', '硬件', '安全', '供应链'])
  })
})
