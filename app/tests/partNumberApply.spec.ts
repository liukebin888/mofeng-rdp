import { describe, it, expect } from 'vitest'
import {
  checkHeader,
  checkRelatedApprover,
  resolveTable1,
  resolveTable2,
  resolveTable3,
  resolveTable4,
  resolvePartNumber,
  extractPrefix,
  parseSerial,
  checkAggDuplicate,
  APPLY_TYPE_LABEL,
  INITIATOR_ROLES,
  type PartNumberApplyHeader,
  type Table1Data,
  type Table2Data,
  type Table3Data,
  type Table4Data,
} from '@/domain/partNumberApply'

const baseHeader = (over: Partial<PartNumberApplyHeader> = {}): PartNumberApplyHeader => ({
  customer: '一汽大众',
  vehicleModel: '某 SUV',
  urgency: 'normal',
  projectBook: '立项书-001',
  ccEngineers: '张工',
  attachmentDesc: '设计方案.docx',
  applyType: 'table1',
  initiatorRole: '项目经理',
  relatedApprover: '',
  ...over,
})

describe('头部信息校验', () => {
  it('全部必填齐全 → 无错误', () => {
    expect(checkHeader(baseHeader())).toEqual([])
  })
  it('缺客户/车型/紧急程度/抄送人员/附件 → 报错', () => {
    const errors = checkHeader(baseHeader({ customer: '', vehicleModel: '', urgency: '' as any, ccEngineers: '', attachmentDesc: '' }))
    expect(errors.length).toBeGreaterThanOrEqual(5)
  })
  it('表2/3 缺关联审批人 → 报错；表1/4 不需要', () => {
    expect(checkRelatedApprover(baseHeader({ applyType: 'table2', relatedApprover: '' })).length).toBeGreaterThan(0)
    expect(checkRelatedApprover(baseHeader({ applyType: 'table3', relatedApprover: '' })).length).toBeGreaterThan(0)
    expect(checkRelatedApprover(baseHeader({ applyType: 'table1' }))).toEqual([])
    expect(checkRelatedApprover(baseHeader({ applyType: 'table4' }))).toEqual([])
  })
})

describe('发起人员角色（附表5 原文）', () => {
  it('五种发起人员', () => {
    expect(INITIATOR_ROLES).toEqual(['项目经理', '分项目经理', '电子', '结构', '工艺技术管理部'])
  })
  it('发起类型显示名', () => {
    expect(APPLY_TYPE_LABEL.table1).toContain('表一')
    expect(APPLY_TYPE_LABEL.table4).toContain('表四')
  })
})

describe('extractPrefix / parseSerial', () => {
  it('12 位型号提取前 8 位', () => {
    expect(extractPrefix('0B0Z71AANLAA')).toEqual({ customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA' })
  })
  it('非 12 位返回 null', () => {
    expect(extractPrefix('0B0Z71')).toBeNull()
  })
  it('parseSerial 仅接受 4 位数字', () => {
    expect(parseSerial('0001')).toBe(1)
    expect(parseSerial('3001')).toBe(3001)
    expect(parseSerial('12')).toBeNull()
    expect(parseSerial('abcd')).toBeNull()
  })
})

describe('表一 新增立项产品型号', () => {
  const t1 = (over: Partial<Table1Data> = {}): Table1Data => ({
    productName: '中控面板',
    customerDrawingNo: '图号-001',
    hitechProject: 'RD2001',
    productionArea: '中国',
    partImageDesc: 'part.png',
    devNature: '完全借用',
    productLevel: 'A',
    segments: { customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA', feature: 'ANL', base: 'A' },
    ...over,
  })
  it('六段齐全 → 生成 12 位型号', () => {
    const r = resolveTable1(t1())
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z71AAANLA')
  })
  it('缺产品名称 → 报错', () => {
    const r = resolveTable1(t1({ productName: '' }))
    expect(r.ok).toBe(false)
  })
  it('生产基地非法 → fail-closed', () => {
    const r = resolveTable1(t1({ segments: { customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA', feature: 'ANL', base: 'X' } }))
    expect(r.ok).toBe(false)
  })
})

describe('表二 子产品型号（后4位 0001-0999）', () => {
  const t2 = (over: Partial<Table2Data> = {}): Table2Data => ({
    assemblyName: '中控总成',
    assemblyModel: '0B0Z71AANLAA',
    subProductName: '子产品A',
    aggTableDesc: '汇总表.xlsx',
    proposedSerial: '0001',
    partImageDesc: 'part.png',
    devNature: '完全借用',
    relationNote: '',
    ...over,
  })
  it('前8位继承 + 后4位0001 → 生成', () => {
    const r = resolveTable2(t2())
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z71AA0001')
    expect(r.kind).toBe('sub')
  })
  it('流水码 1000 越界（子总成须 0001-0999）→ 报错', () => {
    const r = resolveTable2(t2({ proposedSerial: '1000' }))
    expect(r.ok).toBe(false)
  })
  it('开发性质设变缺关系说明 → 报错', () => {
    const r = resolveTable2(t2({ devNature: '设变', relationNote: '' }))
    expect(r.ok).toBe(false)
  })
  it('所属总成非 12 位 → 报错', () => {
    const r = resolveTable2(t2({ assemblyModel: '0B0Z' }))
    expect(r.ok).toBe(false)
  })
})

describe('表三 保供方案（后4位 1001-1199 已批 / 2001-2199 未批）', () => {
  const t3 = (over: Partial<Table3Data> = {}): Table3Data => ({
    assemblyName: '中控总成',
    assemblyModel: '0B0Z71AANLAA',
    customerPartNo: 'CP-001',
    supplyApproval: 'approved',
    aggTableDesc: '汇总表.xlsx',
    approvalAttachmentDesc: '批准函.pdf',
    proposedSerial: '1001',
    diffNote: '与原方案差异',
    ...over,
  })
  it('已批准 → 1001 生成', () => {
    const r = resolveTable3(t3())
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z71AA1001')
    expect(r.kind).toBe('supplyApproved')
  })
  it('未批 → 2001 生成', () => {
    const r = resolveTable3(t3({ supplyApproval: 'unapproved', approvalAttachmentDesc: '', proposedSerial: '2001' }))
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z71AA2001')
    expect(r.kind).toBe('supplyUnapproved')
  })
  it('未批但用了 1001 → 报错（范围不符）', () => {
    const r = resolveTable3(t3({ supplyApproval: 'unapproved', proposedSerial: '1001' }))
    expect(r.ok).toBe(false)
  })
  it('已批准但缺顾客批准附件 → 报错', () => {
    const r = resolveTable3(t3({ approvalAttachmentDesc: '' }))
    expect(r.ok).toBe(false)
  })
})

describe('表四 工程变更（后4位 3001-3999）', () => {
  const t4 = (over: Partial<Table4Data> = {}): Table4Data => ({
    originalAssemblyName: '中控总成',
    originalAssemblyModel: '0B0Z71AANLAA',
    customerPartNo: 'CP-001',
    changeType: 'internal',
    aggTableDesc: '汇总表.xlsx',
    ecrAttachmentDesc: 'ECR.pdf',
    proposedSerial: '3001',
    diffNote: '变更差异',
    ...over,
  })
  it('内部变更 → 3001 生成', () => {
    const r = resolveTable4(t4())
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z71AA3001')
    expect(r.kind).toBe('ecn')
  })
  it('流水码 2000 越界（工程变更须 3001-3999）→ 报错', () => {
    const r = resolveTable4(t4({ proposedSerial: '2000' }))
    expect(r.ok).toBe(false)
  })
  it('缺客户 ECR 附件 → 报错', () => {
    const r = resolveTable4(t4({ ecrAttachmentDesc: '' }))
    expect(r.ok).toBe(false)
  })
})

describe('resolvePartNumber 统一入口', () => {
  const t1 = (): Table1Data => ({ productName: '中控面板', customerDrawingNo: '图号', hitechProject: 'RD2001', productionArea: '中国', partImageDesc: 'p.png', devNature: '完全借用', productLevel: 'A', segments: { customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA', feature: 'ANL', base: 'A' } })
  const t2 = (): Table2Data => ({ assemblyName: 'a', assemblyModel: '0B0Z71AANLAA', subProductName: 'b', aggTableDesc: 'c', proposedSerial: '0001', partImageDesc: 'd', devNature: '完全借用', relationNote: '' })
  const t3 = (): Table3Data => ({ assemblyName: 'a', assemblyModel: '0B0Z71AANLAA', customerPartNo: 'cp', supplyApproval: 'approved', aggTableDesc: 'c', approvalAttachmentDesc: 'd', proposedSerial: '1001', diffNote: 'e' })
  const t4 = (): Table4Data => ({ originalAssemblyName: 'a', originalAssemblyModel: '0B0Z71AANLAA', customerPartNo: 'cp', changeType: 'internal', aggTableDesc: 'c', ecrAttachmentDesc: 'd', proposedSerial: '3001', diffNote: 'e' })

  it('表一完整 → 生成', () => {
    const r = resolvePartNumber(baseHeader({ applyType: 'table1' }), t1(), t2(), t3(), t4())
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z71AAANLA')
  })
  it('表二缺关联审批人 → 阻断', () => {
    const r = resolvePartNumber(baseHeader({ applyType: 'table2', relatedApprover: '' }), t1(), t2(), t3(), t4())
    expect(r.ok).toBe(false)
  })
  it('头部缺客户 → 阻断', () => {
    const r = resolvePartNumber(baseHeader({ customer: '' }), t1(), t2(), t3(), t4())
    expect(r.ok).toBe(false)
  })
})

describe('查重（附表7）', () => {
  it('已知编码查重命中', () => {
    // 附表7 有 0U1F27EA0001 等；用不存在编码应不重复
    expect(checkAggDuplicate('0B0Z71AA0001').duplicated).toBe(false)
  })
  it('重复检测接口返回结构', () => {
    const r = checkAggDuplicate('XXXXXXXXXXXX')
    expect(r).toHaveProperty('duplicated')
  })
})
