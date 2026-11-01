/**
 * 合规证据台账引擎（SRS 第 23 章 / NFR-009、NFR-010、NFR-011、SEC-012、SEC-013；控制点 C-30）
 *
 * 背景：C-30 此前以「flag 静态登记『等保三级测评已通过』」兜底，属虚假闭环——
 * 无测评机构、无报告编号、无结论判定、无到期重评，一旦登记通过就永远通过。
 * 本引擎把合规底线升级为「证据链驱动」：每一项测评都是结构化证据
 * （机构 / 报告编号 / 结论 / 符合率 / 高风险数 / 整改项 / 有效期），
 * 由纯函数判定，且「到期未重评」自动判 FAIL，从机制上杜绝虚假闭环。
 *
 * 关键语义：等保测评、密评的「真实通过」本质是外部机构结论，系统内无法自证；
 * 但系统内能做且必须做的是——把结论作为证据登记、判定、到期失效、整改闭环追踪，
 * 让「未通过不得上线」（C-30 事前准入）成为可执行、可审计、可回退验证的机制。
 */

import type { Evidence, Verdict } from './types'

/** 合规测评项类型 */
export type ComplianceKind = '等保三级' | '商用密码(密评)' | '数据分类分级' | '国密传输'

/** 整改项状态 */
export type RectifyStatus = '开放' | '整改中' | '已闭环' | '接受风险'

/** 单条合规测评证据 */
export interface ComplianceItem {
  id: string
  /** 测评项（对应 NFR-009/010/011、SEC-012） */
  kind: ComplianceKind
  /** 关联需求条目号 */
  ref: string
  /** 测评机构（外部权威源，非平台自身） */
  agency: string
  /** 测评报告编号（可追溯的权威凭证） */
  reportNo: string
  /** 结论：通过 / 未通过 / 待整改 */
  conclusion: '通过' | '未通过' | '待整改'
  /** 符合率（%），等保判据：符合项 ≥90% 且高风险 0 */
  complianceRate: number
  /** 高风险项数（判据：高风险 0） */
  highRiskCount: number
  /** 测评日期（ISO yyyy-mm-dd） */
  assessedAt: string
  /** 有效期至（ISO yyyy-mm-dd），到期须重评 */
  validUntil: string
  /** 整改项 */
  rectifications: RectifyItem[]
  /** 密评四项（算法/密钥管理/传输/存储）逐项结论，仅密评项用 */
  cipherSubItems?: CipherSubItem[]
}

/** 整改项 */
export interface RectifyItem {
  id: string
  issue: string
  severity: '高' | '中' | '低'
  status: RectifyStatus
  deadline: string
}

/** 密评四项子项 */
export interface CipherSubItem {
  dimension: '算法' | '密钥管理' | '传输' | '存储'
  pass: boolean
}

/** 单项测评判定结果 */
export interface ComplianceResult {
  id: string
  kind: ComplianceKind
  ref: string
  verdict: Verdict
  /** 判定依据（人话） */
  note: string
  /** 是否已到期须重评 */
  expired: boolean
  /** 未闭环整改项 */
  openRectify: RectifyItem[]
  evidence: Evidence[]
}

/** 校验单条合规证据是否合格（结论通过 + 符合率达标 + 高风险 0 + 未过期） */
export function assessItem(item: ComplianceItem, today = new Date().toISOString().slice(0, 10)): ComplianceResult {
  const openRectify = item.rectifications.filter((r) => r.status === '开放' || r.status === '整改中')
  const expired = item.validUntil < today

  const evidence: Evidence[] = [
    { kind: 'file', ref: item.reportNo, label: '测评报告', value: item.agency },
    { kind: 'metric', ref: 'complianceRate', label: '符合率', value: `${item.complianceRate}%` },
    { kind: 'metric', ref: 'highRisk', label: '高风险项', value: item.highRiskCount }
  ]

  // 判定优先级：到期未重评 > 结论未通过 > 高风险 > 整改未闭环 > 符合率不达标
  let verdict: Verdict = 'PASS'
  let note = ''
  if (expired) {
    verdict = 'FAIL'
    note = `${item.kind}测评已于 ${item.validUntil} 到期，未重评（有效期 ${item.assessedAt}~${item.validUntil}）`
  } else if (item.conclusion !== '通过') {
    verdict = 'FAIL'
    note = `${item.kind}测评结论「${item.conclusion}」，未通过`
  } else if (item.highRiskCount > 0) {
    verdict = 'FAIL'
    note = `${item.kind}存在 ${item.highRiskCount} 项高风险未关闭`
  } else if (openRectify.length > 0) {
    verdict = 'CONDITIONAL'
    note = `${item.kind}已通过但 ${openRectify.length} 项整改未闭环`
  } else if (item.complianceRate < 90) {
    verdict = 'CONDITIONAL'
    note = `${item.kind}符合率 ${item.complianceRate}% 低于 90% 阈值`
  } else {
    note = `${item.kind}测评通过（符合率 ${item.complianceRate}%，高风险 0，${item.agency} ${item.reportNo}）`
  }

  return { id: item.id, kind: item.kind, ref: item.ref, verdict, note, expired, openRectify, evidence }
}

/** 逐项评估合规台账 */
export function evaluateCompliance(items: ComplianceItem[], today?: string): ComplianceResult[] {
  return items.map((i) => assessItem(i, today)).sort((a, b) => a.kind.localeCompare(b.kind, 'zh'))
}

/** C-30 事前准入：合规底线是否满足「未通过不得上线」 */
export function complianceGate(results: ComplianceResult[]): { pass: boolean; blockers: ComplianceResult[] } {
  // 等保、密评、国密传输为上线硬闸门；数据分类分级 SEC-013 为 R2（P1），仅作告警不阻断
  const hardKinds: ComplianceKind[] = ['等保三级', '商用密码(密评)', '国密传输']
  const blockers = results.filter((r) => hardKinds.includes(r.kind) && r.verdict === 'FAIL')
  return { pass: blockers.length === 0, blockers }
}

/** 汇总合规台账（供 C-30 与视图展示） */
export function summarizeCompliance(results: ComplianceResult[]) {
  const byVerdict = results.reduce(
    (a, r) => {
      a[r.verdict]++
      return a
    },
    { PASS: 0, CONDITIONAL: 0, FAIL: 0 } as Record<Verdict, number>
  )
  const gate = complianceGate(results)
  return { total: results.length, byVerdict, gatePass: gate.pass, blockers: gate.blockers, expired: results.filter((r) => r.expired).length }
}
