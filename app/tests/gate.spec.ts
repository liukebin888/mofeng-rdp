import { describe, it, expect } from 'vitest'
import {
  GATE_TEMPLATES,
  resolveGateTemplate,
  rejectUnknownGate,
  runGate,
  sodRelease,
  slaState
} from '@/domain/gate'
import type { ControlPointResult } from '@/domain/types'

function cp(code: string, verdict: ControlPointResult['verdict'] = 'PASS'): ControlPointResult {
  return {
    code,
    object: 'obj',
    timing: '统计日',
    criteria: `${code} 判据`,
    strength: 'L1',
    disposition: '保持',
    verdict,
    measured: `${code} 达标`,
    evidence: []
  }
}

function fullCps(tpl: typeof GATE_TEMPLATES[number]): ControlPointResult[] {
  return tpl.items.filter((i) => i.cp).map((i) => cp(i.cp!))
}

describe('gate 引擎（GAT-001~013 / 附录 A）', () => {
  describe('权威模板（D-15 裁决：项目不得自建判据）', () => {
    it('resolveGateTemplate 仅接受权威模板集内 code', () => {
      expect(resolveGateTemplate('G1')?.name).toBe('立项闸门')
      expect(resolveGateTemplate('G5')?.name).toBe('交付闸门')
      // 未知 / 自建判据
      expect(resolveGateTemplate('G9')).toBeNull()
      expect(resolveGateTemplate('G1-CUSTOM')).toBeNull()
      expect(resolveGateTemplate('')).toBeNull()
    })

    it('runGate 对非权威 gate 返回拒绝而非崩溃（回退验证：自建判据被拒）', () => {
      const r = runGate({
        gate: 'G9',
        projectId: 'P-001',
        cpResults: [],
        submitter: 'pm',
        baselineFrozen: true,
        safetySigned: true
      })
      expect(r.passed).toBe(false)
      expect(r.missing).toContain('G9 非权威闸门模板')
      expect(r.results[0].note).toContain('不得自建判据')
    })

    it('rejectUnknownGate 显式返回拒绝语义', () => {
      const r = rejectUnknownGate('GX', 'P-002', 'pm')
      expect(r.passed).toBe(false)
      expect(r.safetyBlocked).toBe(false)
      expect(r.missing).toHaveLength(1)
    })

    it('权威模板集覆盖 G1~G5 五道闸门', () => {
      expect(GATE_TEMPLATES.map((g) => g.code).sort()).toEqual(['G1', 'G2', 'G3', 'G4', 'G5'])
    })
  })

  describe('runGate 准入校验', () => {
    it('权威 gate 全部控制点 PASS → 放行', () => {
      const tpl = GATE_TEMPLATES.find((g) => g.code === 'G1')!
      const r = runGate({
        gate: 'G1',
        projectId: 'P-001',
        cpResults: fullCps(tpl),
        submitter: 'pm',
        baselineFrozen: true,
        safetySigned: true
      })
      expect(r.passed).toBe(true)
      expect(r.missing).toHaveLength(0)
    })

    it('控制点缺评估结果 → 缺项判不合格（CLS-007，严禁 fail-open）', () => {
      const r = runGate({
        gate: 'G1',
        projectId: 'P-001',
        cpResults: [], // 空评估
        submitter: 'pm',
        baselineFrozen: true,
        safetySigned: true
      })
      expect(r.passed).toBe(false)
      expect(r.results.every((x) => !x.ok)).toBe(true)
      expect(r.results[0].note).toContain('CLS-007')
    })

    it('安全项不可豁免（GAT-009）', () => {
      const r = runGate({
        gate: 'G2',
        projectId: 'P-001',
        cpResults: fullCps(GATE_TEMPLATES.find((g) => g.code === 'G2')!),
        submitter: 'pm',
        baselineFrozen: true,
        safetySigned: true,
        exemptItems: ['G2-06'] // 安全项 C-31
      })
      const safeItem = r.results.find((x) => x.code === 'G2-06')
      expect(safeItem?.ok).toBe(false)
      expect(safeItem?.note).toContain('安全项不可豁免')
    })
  })

  describe('SOD-01 职责分离', () => {
    it('提交人与放行人不同 → 放行', () => {
      expect(sodRelease('pm', 'quality').ok).toBe(true)
    })
    it('同一人 → 拒绝', () => {
      const r = sodRelease('pm', 'pm')
      expect(r.ok).toBe(false)
      expect(r.message).toContain('SOD-01')
    })
  })

  describe('GAT-008 SLA 超时', () => {
    it('权威 gate 计算超时状态', () => {
      const r = slaState('G1', '2026-11-01T00:00:00', new Date('2026-11-02T00:00:00'))
      expect(r?.hours).toBe(24)
      expect(r?.limit).toBe(24)
    })
    it('非权威 gate 返回 null（不崩溃）', () => {
      expect(slaState('G9', '2026-11-01T00:00:00')).toBeNull()
    })
  })
})
