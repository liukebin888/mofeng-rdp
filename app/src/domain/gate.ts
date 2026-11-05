/**
 * Gate 门禁引擎（SRS 14 / GAT-001~013、附录 A）
 * 五要素：输入物清单、可机器校验判据、放行人与评审人分离、时限、驳回与豁免
 */
import type { ControlPointResult, GateRun } from './types'
import { hashOf } from './hash'

/**
 * 门禁模板版本（与后端 GateEngine.GATE_TEMPLATE_VERSION 保持一致）。
 * 变更门禁判据（item/required/safety/cp/slaHours）时必须递增版本并同步后端，
 * 判定结果携带该版本，支撑 K1「历史判定可复算」。
 */
export const GATE_TEMPLATE_VERSION = 'GATE-2026.11'

/** 门禁模板快照哈希（确定性，供判定留痕 / K1 复算）。 */
export function gateTemplateHash(): string {
  return hashOf({ version: GATE_TEMPLATE_VERSION, templates: GATE_TEMPLATES })
}

export interface GateItem {
  code: string
  name: string
  required: boolean
  safety?: boolean
  cp?: string
  note?: string
}

export interface GateTemplate {
  code: string
  name: string
  stage: string
  slaHours: number
  items: GateItem[]
}

export const GATE_TEMPLATES: GateTemplate[] = [
  {
    code: 'G1',
    name: '立项闸门',
    stage: 'P1–P2 立项与策划',
    slaHours: 24,
    items: [
      { code: 'G1-01', name: '项目等级已判定（L1~L4）且依据可回看', required: true, cp: 'C-01' },
      { code: 'G1-02', name: '技术方案与报价已关联', required: true, cp: 'C-02' },
      { code: 'G1-03', name: '预算已批准并挂 WBS 成本科目', required: true, cp: 'C-10' },
      { code: 'G1-04', name: '需求基线已形成、无孤儿需求', required: true, cp: 'C-03' },
      { code: 'G1-05', name: '关键角色到位（PM/质量/安全/SQE）', required: true, cp: 'C-23' },
      { code: 'G1-06', name: '立项评审结论明确（三态之一）', required: true, cp: 'C-07' }
    ]
  },
  {
    code: 'G2',
    name: '方案闸门',
    stage: 'P3 方案与计划',
    slaHours: 24,
    items: [
      { code: 'G2-01', name: 'WBS 分解至可估算层级、依赖完整', required: true, cp: 'C-04' },
      { code: 'G2-02', name: '计划已通过 13 项质量检查并冻结', required: true, cp: 'C-37' },
      { code: 'G2-03', name: '风险四要素齐全且完成 RPN 量化', required: true, cp: 'C-14' },
      { code: 'G2-04', name: '高风险已完成策略登记与储备测算', required: true, cp: 'C-44' },
      { code: 'G2-05', name: '成本口径与挣值计量规则已登记', required: true, cp: 'C-41' },
      { code: 'G2-06', name: '安全评审独立通过', required: true, safety: true, cp: 'C-31' }
    ]
  },
  {
    code: 'G3',
    name: '设计闸门',
    stage: 'P4 研发过程',
    slaHours: 24,
    items: [
      { code: 'G3-01', name: '安全链路追溯覆盖率 ≥98%、断链为空', required: true, safety: true, cp: 'C-32' },
      { code: 'G3-02', name: '图纸与关键文档多专业会签齐备', required: true, cp: 'C-45' },
      { code: 'G3-03', name: '交付物清单齐套（缺件率 0）', required: true, cp: 'C-19' },
      { code: 'G3-04', name: '对应基线已冻结、哈希校验通过', required: true, cp: 'C-20' },
      { code: 'G3-05', name: 'ECR 影响闭包已逐项确认', required: true, cp: 'C-17' },
      { code: 'G3-06', name: '控制点/阈值变更已回归测试', required: false, cp: 'C-48' }
    ]
  },
  {
    code: 'G4',
    name: '样件闸门',
    stage: 'P5 样件试制与 OTS',
    slaHours: 48,
    items: [
      { code: 'G4-01', name: '供应商已准入且在有效期内', required: true, cp: 'C-25' },
      { code: 'G4-02', name: 'PPAP 要素齐全并批准', required: true, cp: 'C-26' },
      { code: 'G4-03', name: '关键物料齐套率 100%', required: true, cp: 'C-19' },
      { code: 'G4-04', name: '样件与文件成套、基线已冻结', required: true, cp: 'C-20' },
      { code: 'G4-05', name: '高风险项已完成量化与策略登记', required: true, safety: true, cp: 'C-44' },
      { code: 'G4-06', name: '资源超分配已裁决', required: false, cp: 'C-40' }
    ]
  },
  {
    code: 'G5',
    name: '交付闸门',
    stage: 'P6–P7 交付与结项',
    slaHours: 48,
    items: [
      { code: 'G5-01', name: '交付基线已冻结、哈希校验通过', required: true, cp: 'C-20' },
      { code: 'G5-02', name: '交付物齐套、缺件率 0', required: true, cp: 'C-19' },
      { code: 'G5-03', name: '客户签收或拒收结论明确并留痕', required: true, cp: 'C-21' },
      { code: 'G5-04', name: '高危漏洞为 0，中危已评估', required: true, safety: true, cp: 'C-33' },
      { code: 'G5-05', name: '审计哈希链连续、11 类动作覆盖', required: true, cp: 'C-29' },
      { code: 'G5-06', name: '阶段复盘完成（目标/偏差/改进项）', required: false, cp: 'C-34' }
    ]
  }
]

export interface GateSubmitInput {
  gate: string
  projectId: string
  cpResults: ControlPointResult[]
  submitter: string
  baselineFrozen: boolean
  safetySigned: boolean
  exemptItems?: string[]
  at?: string
}

/** 未知 gate code 的权威解析结果（供视图/调用方显式处理，不静默放行） */
export interface GateRejection {
  gate: string
  projectId: string
  passed: false
  conditional: false
  missing: string[]
  safetyBlocked: false
  results: { code: string; name: string; ok: false; note: string }[]
  submittedBy?: string
}

/**
 * GAT-001 / D-15 裁决：Gate 模板由 PMO 统一维护、唯一权威，项目不得自建判据。
 * 权威模板解析：仅接受 GATE_TEMPLATES 内登记的 gate code；未知/自建 code 返回 null，
 * 由调用方显式拒绝（而非以 `!` 非空断言静默崩溃）。
 */
export function resolveGateTemplate(gate: string): GateTemplate | null {
  return GATE_TEMPLATES.find((g) => g.code === gate) ?? null
}

/** 构造「非权威 gate」拒绝结果（D-15：项目自建判据一律拒绝） */
export function rejectUnknownGate(gate: string, projectId: string, submitter?: string): GateRejection {
  return {
    gate,
    projectId,
    passed: false,
    conditional: false,
    missing: [`${gate} 非权威闸门模板`],
    safetyBlocked: false,
    results: [
      {
        code: gate,
        name: '非权威闸门模板',
        ok: false,
        note: '该闸门不在 PMO 统一维护的权威模板集内（GAT-001 / D-15），项目不得自建判据，拒绝执行'
      }
    ],
    submittedBy: submitter
  }
}

/** Gate 准入校验：L4 阻断、L3 条件放行、安全项不可豁免；非权威 gate 直接拒绝 */
export function runGate(input: GateSubmitInput): GateRun {
  const tpl = resolveGateTemplate(input.gate)
  if (!tpl) return rejectUnknownGate(input.gate, input.projectId, input.submitter)
  const cpMap = new Map(input.cpResults.map((r) => [r.code, r]))
  const results = tpl.items.map((it) => {
    if (input.gate !== 'G1' && it.cp === 'C-20' && !input.baselineFrozen) {
      return { code: it.code, name: it.name, ok: false, cp: it.cp, note: '基线未冻结，前置条件不满足（GAT-004）' }
    }
    if (it.safety && !input.safetySigned) {
      return { code: it.code, name: it.name, ok: false, cp: it.cp, note: '安全评审未独立签署（SOD-02）' }
    }
    const cp = it.cp ? cpMap.get(it.cp) : undefined
    // CLS-007 缺项按最严：控制点未被评估 = 无证据 = 不可放行。
    // 严禁 fail-open（此前此处返回 ok:true「按人工确认」，导致 cpResults 为空时整道闸门默认通过）。
    if (!cp) {
      return {
        code: it.code,
        name: it.name,
        ok: false,
        cp: it.cp,
        note: `控制点 ${it.cp ?? '（未绑定）'} 无评估结果，按缺项判不合格（CLS-007），须补评估后重新提交`
      }
    }
    const exempt = (input.exemptItems || []).includes(it.code)
    if (exempt && it.safety) return { code: it.code, name: it.name, ok: false, cp: it.cp, note: '安全项不可豁免（GAT-009）' }
    return {
      code: it.code,
      name: it.name,
      ok: cp.verdict !== 'FAIL',
      cp: it.cp,
      note: cp.verdict === 'FAIL' ? `控制点 ${cp.code} 不合格：${cp.measured}` : cp.verdict === 'CONDITIONAL' ? `有条件：${cp.measured}` : `通过：${cp.measured}`
    }
  })
  const missing = results.filter((r) => !r.ok).map((r) => `${r.code} ${r.name}`)
  const safetyBlocked = results.some((r) => !r.ok && tpl.items.find((i) => i.code === r.code)?.safety)
  const requiredMissing = results.filter((r) => !r.ok && tpl.items.find((i) => i.code === r.code)?.required)
  return {
    gate: input.gate,
    projectId: input.projectId,
    passed: requiredMissing.length === 0 && !safetyBlocked,
    conditional: requiredMissing.length === 0 && results.some((r) => r.note.startsWith('有条件')),
    missing,
    safetyBlocked,
    results,
    submittedBy: input.submitter,
    templateVersion: GATE_TEMPLATE_VERSION,
    templateHash: gateTemplateHash()
  }
}

/**
 * GAT-003：安全评审独立放行。当安全项缺失签署时，须精确定位到具体缺签的安全项
 * （评审单号 = 安全项 code），而非笼统「安全未签署」。
 *
 * 返回：该 gate 下所有安全项及其签署状态；safetySigned=false 时，列出缺签项清单
 * （对齐 R1 精表「提示精确到评审单号」）。
 */
export function safetyReviewDetail(gate: string, safetySigned: boolean): {
  gate: string
  safetyItems: { code: string; name: string; signed: boolean }[]
  missingSafetyReviews: string[]
  blocked: boolean
} {
  const tpl = resolveGateTemplate(gate)
  if (!tpl) {
    return { gate, safetyItems: [], missingSafetyReviews: [], blocked: false }
  }
  const safetyItems = tpl.items.filter((it) => it.safety).map((it) => ({ code: it.code, name: it.name, signed: safetySigned }))
  const missingSafetyReviews = safetySigned ? [] : safetyItems.map((it) => `${it.code}（${it.name}）`)
  return { gate, safetyItems, missingSafetyReviews, blocked: safetyItems.length > 0 && !safetySigned }
}

/** SOD-01：提交人与放行人不得为同一人 */
export function sodRelease(submitter: string, releaser: string): { ok: boolean; message: string } {
  return submitter !== releaser
    ? { ok: true, message: `提交人 ${submitter} / 放行人 ${releaser}，职责分离满足` }
    : { ok: false, message: `提交人与放行人为同一人（${submitter}），违反 SOD-01，放行被拒` }
}

/** GAT-008 超时升级；非权威 gate 返回 null（不崩溃） */
export function slaState(gate: string, submittedAt: string, now = new Date()): { hours: number; overdue: boolean; limit: number } | null {
  const tpl = resolveGateTemplate(gate)
  if (!tpl) return null
  const hours = (now.getTime() - new Date(submittedAt).getTime()) / 36e5
  return { hours: Math.round(hours * 10) / 10, overdue: hours > tpl.slaHours, limit: tpl.slaHours }
}
