import { describe, it, expect } from 'vitest'
import {
  SUPPLIER_STATUSES,
  SUPPLIER_TRANSITIONS,
  transitionSupplier,
  validateSupplierProfile,
  checkAdmission,
  NOMINATION_FIVE_ITEMS,
  checkNomination,
  PPAP_ELEMENTS,
  PPAP_ELEMENT_COUNT,
  checkPpapComplete,
  checkGate4Nominated,
  validateProxyEntry,
  proxyRatio,
  PROXY_RATIO_THRESHOLD
} from '@/domain/supplier'
import type { SupplierProfile } from '@/domain/supplier'

const profile = (over: Partial<SupplierProfile> = {}): SupplierProfile => ({
  id: 'S-1',
  code: 'SUP-001',
  name: '某供应商',
  type: '结构件',
  status: '潜在',
  qualified: false,
  nominated: false,
  materialCodes: ['M-1'],
  projectIds: ['P-1'],
  ppapStatus: '未提交',
  ppapElements: 0,
  riskLevel: '低',
  sqe: '王工',
  ...over
})

describe('supplier — SUP-001 供应商档案', () => {
  it('字段齐全时 ok', () => {
    expect(validateSupplierProfile(profile()).ok).toBe(true)
  })

  it('缺 code/name/sqe 时命中缺失字段', () => {
    const r = validateSupplierProfile({ riskLevel: '低' })
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(expect.arrayContaining(['code', 'name', 'sqe']))
  })
})

describe('supplier — SUP-002 供应商状态机', () => {
  it('全路径走通：潜在→准入评审中→准入通过→定点评审中→定点确认', () => {
    expect(transitionSupplier('潜在', '提交准入').to).toBe('准入评审中')
    expect(transitionSupplier('准入评审中', '准入通过').to).toBe('准入通过')
    expect(transitionSupplier('准入通过', '提交定点').to).toBe('定点评审中')
    expect(transitionSupplier('定点评审中', '定点确认').to).toBe('定点确认')
  })

  it('暂停可恢复，淘汰不可逆', () => {
    expect(transitionSupplier('暂停', '恢复').to).toBe('定点确认')
    expect(transitionSupplier('定点确认', '暂停').to).toBe('暂停')
    // 淘汰后无任何迁移
    expect(transitionSupplier('淘汰', '恢复').ok).toBe(false)
    expect(SUPPLIER_TRANSITIONS['淘汰']).toEqual({})
  })

  it('非法迁移被拒', () => {
    expect(transitionSupplier('潜在', '定点确认').ok).toBe(false)
  })

  it('状态机枚举完整', () => {
    expect(SUPPLIER_STATUSES).toHaveLength(7)
    expect(SUPPLIER_STATUSES).toContain('淘汰')
  })
})

describe('supplier — SUP-003 准入流程', () => {
  it('高风险件缺现场审核不得准入；普通件可跳过', () => {
    expect(checkAdmission({ riskLevel: '高', siteAuditDone: false }).ok).toBe(false)
    expect(checkAdmission({ riskLevel: '高', siteAuditDone: true }).ok).toBe(true)
    expect(checkAdmission({ riskLevel: '低', siteAuditDone: false }).ok).toBe(true)
    expect(checkAdmission({ riskLevel: '中', siteAuditDone: false }).ok).toBe(true)
  })
})

describe('supplier — SUP-004 定点评审五项齐全', () => {
  it('五项齐全方可联合审批', () => {
    expect(NOMINATION_FIVE_ITEMS).toHaveLength(5)
    const full = checkNomination([...NOMINATION_FIVE_ITEMS])
    expect(full.ok).toBe(true)
    const missing = checkNomination(['报价', '技术方案'])
    expect(missing.ok).toBe(false)
    expect(missing.missing).toEqual(expect.arrayContaining(['交期承诺', '质量协议']))
  })
})

describe('supplier — SUP-005 PPAP 18 项要素', () => {
  it('18 项状态可见，缺项不得判定通过', () => {
    expect(PPAP_ELEMENT_COUNT).toBe(18)
    expect(PPAP_ELEMENTS).toHaveLength(18)
    const full = checkPpapComplete([...PPAP_ELEMENTS])
    expect(full.ok).toBe(true)
    const partial = checkPpapComplete(PPAP_ELEMENTS.slice(0, 17))
    expect(partial.ok).toBe(false)
    expect(partial.missing).toHaveLength(1)
    expect(partial.rate).toBeCloseTo(94.44)
  })
})

describe('supplier — SUP-006 定点未闭环阻塞 Gate4', () => {
  it('未定点时 Gate4 被拒，定点后恢复', () => {
    expect(checkGate4Nominated({ nominated: false }).ok).toBe(false)
    expect(checkGate4Nominated({ nominated: true }).ok).toBe(true)
  })
})

describe('supplier — SUP-014 代录强制标记', () => {
  it('代录须标记代录人，无来源被拒（P-02）', () => {
    expect(validateProxyEntry({ source: '代录', proxyBy: '张工', supplierId: 'S-1', at: 'x' }).ok).toBe(true)
    expect(validateProxyEntry({ source: '代录', supplierId: 'S-1' }).ok).toBe(false)
    expect(validateProxyEntry({ supplierId: 'S-1' }).ok).toBe(false)
  })

  it('代录占比统计，超 30% 视为协同失效', () => {
    expect(PROXY_RATIO_THRESHOLD).toBe(30)
    const entries = [
      { id: '1', source: '代录' as const, proxyBy: 'a', supplierId: 'S-1', at: 'x' },
      { id: '2', source: '代录' as const, proxyBy: 'a', supplierId: 'S-1', at: 'x' },
      { id: '3', source: '代录' as const, proxyBy: 'a', supplierId: 'S-1', at: 'x' },
      { id: '4', source: '供应商自助' as const, supplierId: 'S-1', at: 'x' }
    ]
    const r = proxyRatio(entries)
    expect(r.ratio).toBe(75)
    expect(r.failed).toBe(true)
  })
})
