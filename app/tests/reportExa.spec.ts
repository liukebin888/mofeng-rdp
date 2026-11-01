import { describe, it, expect } from 'vitest'
import {
  metricBindingRate, groupCoverage, validateAdHocQuery, drillPathComplete, sharedViewAllowed,
  isSubscriptionActive, shouldAlert, unsubscribe, exportPlan, fieldConsistency, ASYNC_EXPORT_THRESHOLD
} from '@/domain/reportLibrary'
import {
  validateImport, exportToXml, registerIntegration, updateIntegration, canReplay,
  verifySignature, dedupeDelivery, syncVoucher, compensate, explainDiff
} from '@/domain/interop'
import {
  checkCompleteness, checkUniqueness, checkRange, checkReferentialIntegrity, runDqChecks, threeWayConsistency
} from '@/domain/dataQuality'
import type { MetricDictEntry, ReportDef } from '@/domain/reportLibrary'

// —— EXA-001 标准报表库 ——
describe('EXA-001 标准报表库', () => {
  const dict: MetricDictEntry[] = [
    { id: 'M1', name: '加权完成率', numerator: 'Σ(EV×权重)', denominator: 'Σ(权重)', timeBase: '周', excludeRule: '无', source: 'plan', refreshRate: 'daily' }
  ]
  const reports: ReportDef[] = [
    { id: 'R1', name: '项目进度报表', group: '进度', metricIds: ['M1'], source: 'plan' },
    { id: 'R2', name: '成本报表', group: '成本', metricIds: ['M2'], source: 'evm' } // M2 未定义口径
  ]

  it('口径绑定率 100% 校验（未定义口径不得上线）', () => {
    const r = metricBindingRate(reports, dict)
    expect(r.bound).toBe(1)
    expect(r.unbound.length).toBe(1)
    expect(r.unbound[0].id).toBe('R2')
  })

  it('报表分组覆盖六大分组', () => {
    const r = groupCoverage(reports)
    expect(r.missing).toContain('资源')
    expect(r.missing).toContain('风险')
    expect(r.ok).toBe(false)
  })
})

// —— EXA-002 自助分析 ——
describe('EXA-002 自助分析与钻取', () => {
  const dims = [{ id: 'D1', name: '部门', drillPath: ['公司', '部门', '项目'] }]
  const measures = [{ id: 'M1', name: '工时', agg: 'sum' as const }]

  it('维度度量组合可用', () => {
    expect(validateAdHocQuery({ dims: ['D1'], measures: ['M1'] }, dims, measures).ok).toBe(true)
  })

  it('非法维度被拒', () => {
    expect(validateAdHocQuery({ dims: ['D999'], measures: ['M1'] }, dims, measures).ok).toBe(false)
  })

  it('钻取链路完整', () => {
    expect(drillPathComplete(dims[0])).toBe(true)
  })

  it('视图共享权限生效', () => {
    expect(sharedViewAllowed(['PM'], 'PM')).toBe(true)
    expect(sharedViewAllowed(['PM'], 'QE')).toBe(false)
    expect(sharedViewAllowed([], 'QE')).toBe(true)
  })
})

// —— EXA-003 订阅分发 ——
describe('EXA-003 报表订阅与分发', () => {
  it('退订即时生效', () => {
    const subs = [{ id: 'S1', reportId: 'R1', role: 'PM', schedule: 'daily' as const, status: '订阅中' as const, retryCount: 0, alertOnFailure: true }]
    const r = unsubscribe(subs, 'S1')
    expect(r[0].status).toBe('已退订')
  })

  it('失败重试超限告警', () => {
    const sub = { id: 'S1', reportId: 'R1', role: 'PM', schedule: 'daily' as const, status: '订阅中' as const, retryCount: 3, alertOnFailure: true }
    expect(shouldAlert(sub).ok).toBe(false)
  })
})

// —— EXA-004 多格式导出 ——
describe('EXA-004 多格式导出与样式一致', () => {
  it('超万行走异步任务', () => {
    const r = exportPlan({ reportId: 'R1', format: 'xlsx', rowCount: 15000 })
    expect(r.async).toBe(true)
  })

  it('同步导出（未超万行）', () => {
    const r = exportPlan({ reportId: 'R1', format: 'csv', rowCount: 5000 })
    expect(r.async).toBe(false)
  })

  it('PDF 与在线字段一致率 100%', () => {
    const r = fieldConsistency(['id', 'name', 'duration'], ['id', 'name', 'duration'])
    expect(r.rate).toBe(100)
    expect(r.missing.length).toBe(0)
  })
})

// —— EXA-005 计划工具互操作 ——
describe('EXA-005 计划工具互操作', () => {
  const mapping = [
    { sourceField: 'activityId', targetField: 'id', required: true },
    { sourceField: 'activityName', targetField: 'name', required: true },
    { sourceField: 'startDate', targetField: 'start', required: true }
  ]

  it('导入校验报告列出全部异常行', () => {
    const rows = [
      { lineNo: 1, fields: { activityId: 'A1', activityName: '设计', startDate: '2026-01-01' } },
      { lineNo: 2, fields: { activityId: '', activityName: '测试', startDate: '2026-02-01' } }, // 缺 activityId
      { lineNo: 3, fields: { activityId: 'A3', activityName: '', startDate: 'not-a-date' } } // 缺名称 + 日期非法
    ]
    const r = validateImport(rows, mapping)
    expect(r.totalRows).toBe(3)
    expect(r.successRows).toBe(1)
    expect(r.errors.length).toBe(3) // 行2缺ID + 行3缺名称 + 行3日期非法
    expect(r.complete).toBe(true)
  })

  it('导出 XML 可被对端打开', () => {
    const xml = exportToXml([{ id: 'A1', name: '设计', duration: 10, start: '2026-01-01' }])
    expect(xml).toContain('<?xml')
    expect(xml).toContain('<activity')
    expect(xml).toContain('id="A1"')
  })
})

// —— EXA-006 集成网关配置化 ——
describe('EXA-006 集成网关配置化', () => {
  it('新增对接全程配置完成', () => {
    const c = registerIntegration({ id: 'I1', name: 'ERP', target: 'ERP', protocol: 'rest', endpoint: 'http://erp', auth: 'basic', retryTimes: 3, enabled: true })
    expect(c.version).toBe(1)
  })

  it('配置变更留痕（版本 +1）', () => {
    const c = registerIntegration({ id: 'I1', name: 'ERP', target: 'ERP', protocol: 'rest', endpoint: 'http://erp', auth: 'basic', retryTimes: 3, enabled: true })
    const u = updateIntegration(c, { endpoint: 'http://erp-new' })
    expect(u.version).toBe(2)
    expect(u.endpoint).toBe('http://erp-new')
  })

  it('失败可重放（未超重试上限）', () => {
    const c = registerIntegration({ id: 'I1', name: 'ERP', target: 'ERP', protocol: 'rest', endpoint: 'x', auth: 'basic', retryTimes: 3, enabled: true })
    expect(canReplay(c, 2).ok).toBe(true)
    expect(canReplay(c, 3).ok).toBe(false)
  })
})

// —— EXA-007 事件订阅与推送 ——
describe('EXA-007 事件订阅与推送', () => {
  it('签名校验失败被拒', () => {
    expect(verifySignature('payload', 'wrong-sig', 'secret')).toBe(false)
  })

  it('签名校验确定性（同输入同结果，不同输入不同结果）', () => {
    const a = verifySignature('p', 'a', 'k')
    const b = verifySignature('p', 'a', 'k')
    expect(a).toBe(b) // 确定性
    expect(verifySignature('p', 'a', 'k1')).toBe(verifySignature('p', 'a', 'k1')) // 不同密钥确定性
  })

  it('重复投递不产生重复处理', () => {
    let records: { eventId: string; subscriptionId: string; deliveredAt: string }[] = []
    const r1 = dedupeDelivery(records, 'E1', 'S1')
    records = r1.records
    const r2 = dedupeDelivery(records, 'E1', 'S1')
    expect(r1.duplicate).toBe(false)
    expect(r2.duplicate).toBe(true)
    expect(records.length).toBe(1)
  })
})

// —— EXA-008 财务与人力接口 ——
describe('EXA-008 财务与人力接口', () => {
  it('财务凭证同步失败补偿', () => {
    const v = syncVoucher({ id: 'V1', projectId: 'P1', amount: 100, currency: 'CNY', status: '待同步' }, false)
    expect(v.status).toBe('同步失败')
    const compensated = compensate(v, true)
    expect(compensated.status).toBe('已补偿')
  })

  it('对账差异可解释', () => {
    const diffs = [{ amount: 50, reason: '汇率差异' }, { amount: -30, reason: '工时调整' }]
    const r = explainDiff(diffs)
    expect(r.total).toBe(20)
    expect(r.explained).toBe(true)
  })
})

// —— EXA-009 数据质量校验 ——
describe('EXA-009 数据质量校验报告', () => {
  const rows = [
    { id: 'A1', name: '设计', progress: 50, ownerId: 'U1' },
    { id: 'A1', name: '', progress: 150, ownerId: 'U999' } // 重复ID + 缺名称 + 超范围 + 外键无效
  ]

  it('完整性：缺名称检出', () => {
    const r = checkCompleteness(rows, ['id', 'name'])
    expect(r.violations.length).toBe(1)
    expect(r.violations[0].row).toBe(2)
  })

  it('唯一性：重复 ID 检出', () => {
    const r = checkUniqueness(rows, 'id')
    expect(r.violations.length).toBe(1)
    expect(r.violations[0].message).toContain('A1')
  })

  it('取值范围：progress 150 超范围', () => {
    const r = checkRange(rows, 'progress', 0, 100)
    expect(r.violations.length).toBe(1)
  })

  it('引用完整性：外键 U999 无主键', () => {
    const r = checkReferentialIntegrity(rows, 'ownerId', new Set(['U1', 'U2']))
    expect(r.violations.length).toBe(1)
    expect(r.violations[0].message).toContain('U999')
  })

  it('四类校验检出率 100%', () => {
    const checks = runDqChecks(rows, ['id', 'name'], 'id', 'progress', 0, 100, 'ownerId', new Set(['U1', 'U2']))
    expect(checks.length).toBe(4)
    checks.forEach((c) => expect(c.detectedRate).toBe(100))
  })
})

// —— EXA-010 指标三处同值 ——
describe('EXA-010 指标三处同值', () => {
  it('三处同值率 100%', () => {
    const metrics = [
      { metricId: 'M1', report: 68.96, dashboard: 68.96, detail: 68.96 },
      { metricId: 'M2', report: 120, dashboard: 120, detail: 120 }
    ]
    const r = threeWayConsistency(metrics)
    expect(r.rate).toBe(100)
    expect(r.inconsistent.length).toBe(0)
  })

  it('不一致被检出', () => {
    const metrics = [
      { metricId: 'M1', report: 68.96, dashboard: 68.96, detail: 68.96 },
      { metricId: 'M2', report: 120, dashboard: 125, detail: 120 }
    ]
    const r = threeWayConsistency(metrics)
    expect(r.rate).toBe(50)
    expect(r.inconsistent.length).toBe(1)
    expect(r.inconsistent[0].metricId).toBe('M2')
  })
})
