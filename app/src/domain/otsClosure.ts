/**
 * OTS 认可闭环引擎（单一权威，fail-closed）
 *
 * 定位：在 otsApproval（三大条件 + L1-L4 等级判定）之上，补齐 OTS 认可的「闭环」能力。
 * 使 OTS 认可从「发起→审批」的单向流，成为「发起→审批→结论落账→偏差整改→复评升级→到期跟踪」
 * 的完整受控闭环。
 *
 * 四项闭环能力（用户裁决）：
 *   1. 审批完成回写台账：OTS 认可审批走完后，自动生成/更新认可台账记录，
 *      并联动更新 OTS 样件状态。
 *   2. 客户认可三态结论：客户认可环节支持「认可 / 有条件认可 / 拒收」三态，
 *      结论写入台账；拒收强制退回整改。
 *   3. L3 到期跟踪与升级：临时认可到期前提醒、到期未闭环自动升级为待办/问题，
 *      防止临时认可无限期悬挂。
 *   4. 偏差整改闭环联动：L2/L3 的问题清单与问题台账（IssueLedger）双向联动，
 *      问题关闭后触发复评，整改完成可将 L2 升级为 L1。
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 认可等级只由 otsApproval.determineLevel 判定，本引擎只做「闭环」判定与状态推进；
 *   - fail-closed：缺到期日期 / 问题未关闭 / 审批未走完，一律不判「已闭环」，不臆造。
 */

import { OTS_LEVEL_LABEL, type OtsApprovalLevel } from './otsApproval'

/** 客户认可三态结论（客户认可环节可表达的三态） */
export type CustomerConclusion = '认可' | '有条件认可' | '拒收'

export const CUSTOMER_CONCLUSIONS: CustomerConclusion[] = ['认可', '有条件认可', '拒收']

export const CUSTOMER_CONCLUSION_LABEL: Record<CustomerConclusion, string> = {
  认可: '认可',
  有条件认可: '有条件认可',
  拒收: '拒收'
}

/**
 * OTS 认可台账记录（单一权威）。
 * 一条记录对应一次 OTS 认可（以报告编号/样件编号 + 项目 区分）。
 */
export interface OtsApprovalRecord {
  /** 台账 id */
  id: string
  /** 关联审批流实例 id（审批链绑定） */
  flowInstanceId?: string
  /** 关联项目名称 */
  projectName: string
  /** 样件编号 */
  sampleNo: string
  /** OTS 报告编号 */
  reportNo: string
  /** 认可等级 L1-L4 */
  level: OtsApprovalLevel
  /** 客户认可三态结论（审批链客户认可环节写入） */
  customerConclusion?: CustomerConclusion
  /** 是否完成总经理批准（审批链走完） */
  approved: boolean
  /** L3 临时认可到期日期（YYYY-MM-DD，仅 L3） */
  dueDate?: string
  /** 审批完成时间（ISO） */
  approvedAt?: string
  /** 客户认可结论写入时间（ISO） */
  customerConcludedAt?: string
  /** 关联问题清单条目（L2/L3/L4 提交） */
  issueIds: string[]
  /** 是否已复评升级（L2→L1 整改闭环后） */
  upgraded: boolean
  /** 复评升级后的等级（若已升级） */
  upgradedLevel?: OtsApprovalLevel
  /** 复评时间（ISO） */
  upgradedAt?: string
  /** 创建时间（ISO） */
  createdAt: string
}

/** 闭环状态 */
export type OtsClosureStatus = '进行中' | '待整改' | '已闭环' | '已过期' | '需复评'

export const OTS_CLOSURE_LABEL: Record<OtsClosureStatus, string> = {
  进行中: '进行中',
  待整改: '待整改',
  已闭环: '已闭环',
  已过期: '已过期',
  需复评: '需复评'
}

/** 问题清单条目引用（供闭环判定输入，仅需 status） */
export interface IssueRef {
  id: string
  status: string
}

/** 闭环判定输入 */
export interface ClosureInput {
  level: OtsApprovalLevel
  approved: boolean
  customerConclusion?: CustomerConclusion
  dueDate?: string
  issueIds: string[]
  /** 已关闭的问题 id 集合（来自问题台账） */
  closedIssueIds: ReadonlySet<string>
  /** 复评升级后的等级（若已复评） */
  upgraded?: boolean
  upgradedLevel?: OtsApprovalLevel
  /** 判定参考时间（ISO，缺省用当前时间） */
  now?: string
}

/** 闭环判定结果 */
export interface ClosureResult {
  status: OtsClosureStatus
  label: string
  reason: string
  /** 是否需要升级（到期未闭环） */
  needEscalation: boolean
}

/** 取 ISO 时间（YYYY-MM-DD 截断） */
function toDate(iso: string): string {
  return iso.slice(0, 10)
}

/** 解析 YYYY-MM-DD 为可比较的时间戳（当天零点） */
function dateOf(d: string): number {
  const t = new Date(`${d}T00:00:00`)
  return Number.isNaN(t.getTime()) ? Number.POSITIVE_INFINITY : t.getTime()
}

/**
 * L3 到期状态判定。
 * 返回：未到期 / 临期（≤7 天）/ 已过期。
 * fail-closed：无到期日期视为「未知」，不判未到期。
 */
export type ExpiryState = '未到期' | '临期' | '已过期' | '无到期日期'

export const EXPIRY_LABEL: Record<ExpiryState, string> = {
  未到期: '未到期',
  临期: '临期',
  已过期: '已过期',
  无到期日期: '无到期日期'
}

export function evaluateExpiry(dueDate: string | undefined, now?: string): ExpiryState {
  if (!dueDate) return '无到期日期'
  const nowD = now ? dateOf(toDate(now)) : Date.now()
  const due = dateOf(dueDate)
  if (due === Number.POSITIVE_INFINITY) return '无到期日期'
  const diffDays = (due - nowD) / 86400000
  if (diffDays < 0) return '已过期'
  if (diffDays <= 7) return '临期'
  return '未到期'
}

/**
 * 客户认可三态结论校验。
 * fail-closed：结论必须是三态之一；「拒收」不允许与「已闭环」并存（拒收即退回整改）。
 */
export function validateCustomerConclusion(
  conclusion: CustomerConclusion | undefined,
  level: OtsApprovalLevel
): { ok: boolean; reason: string } {
  if (!conclusion) return { ok: false, reason: '客户认可结论缺失' }
  if (!CUSTOMER_CONCLUSIONS.includes(conclusion)) {
    return { ok: false, reason: `客户认可结论非法：${String(conclusion)}` }
  }
  // L4 不予认可，客户结论只可能是「拒收」
  if (level === 'L4' && conclusion !== '拒收') {
    return { ok: false, reason: 'L4 不予认可时客户结论应为「拒收」' }
  }
  if (conclusion === '拒收') {
    return { ok: true, reason: '客户拒收，退回整改后重新提交' }
  }
  return { ok: true, reason: `客户结论：${CUSTOMER_CONCLUSION_LABEL[conclusion]}` }
}

/**
 * 问题清单是否全部关闭（用于 L2/L3 偏差整改闭环判定）。
 * 有任一问题未关闭 → 未闭环。
 */
export function allIssuesClosed(
  issueIds: string[],
  closedIssueIds: ReadonlySet<string>
): boolean {
  if (issueIds.length === 0) return true
  return issueIds.every((id) => closedIssueIds.has(id))
}

/**
 * OTS 认可闭环状态判定（单一权威）。
 *
 * 规则（fail-closed，优先级从高到低）：
 *   1. 审批未走完（approved=false）→ 「进行中」；
 *   2. L4 或客户拒收 → 「待整改」（退回整改）；
 *   3. L3 且已过期 → 「已过期」（needEscalation=true，须升级）；
 *   4. 已复评升级且升级到 L1 → 「已闭环」；
 *   5. L2/L3 且问题未全部关闭 → 「需复评」（整改中，待问题关闭后复评升级）；
 *   6. 其余（L1 审批完成 / L2 问题关闭且复评）→ 「已闭环」。
 */
export function determineClosureStatus(input: ClosureInput): ClosureResult {
  const now = input.now ?? new Date().toISOString()

  // 1. 审批未走完
  if (!input.approved) {
    return { status: '进行中', label: OTS_CLOSURE_LABEL['进行中'], reason: '审批链未走完', needEscalation: false }
  }

  // 2. L4 或客户拒收 → 待整改
  if (input.level === 'L4' || input.customerConclusion === '拒收') {
    return { status: '待整改', label: OTS_CLOSURE_LABEL['待整改'], reason: '不予认可/客户拒收，退回整改后重新提交', needEscalation: false }
  }

  // 3. L3 到期检查（先于闭环判定，避免已过期却判已闭环）
  if (input.level === 'L3' && input.dueDate) {
    const expiry = evaluateExpiry(input.dueDate, now)
    if (expiry === '已过期') {
      return { status: '已过期', label: OTS_CLOSURE_LABEL['已过期'], reason: `L3 临时认可已于 ${input.dueDate} 到期，未闭环`, needEscalation: true }
    }
  }

  // 4. 已复评升级到 L1 → 已闭环
  if (input.upgraded && input.upgradedLevel === 'L1') {
    return { status: '已闭环', label: OTS_CLOSURE_LABEL['已闭环'], reason: '偏差整改完成并复评升级为 L1，闭环', needEscalation: false }
  }

  // 5. L2/L3 问题未全部关闭 → 需复评
  if (input.level === 'L2' || input.level === 'L3') {
    if (!allIssuesClosed(input.issueIds, input.closedIssueIds)) {
      return { status: '需复评', label: OTS_CLOSURE_LABEL['需复评'], reason: '偏差/临时认可问题未全部关闭，待整改完成后复评', needEscalation: false }
    }
    // 问题已全部关闭，但尚未复评升级（L2 可升级 L1；L3 到期后可升级）
    return { status: '需复评', label: OTS_CLOSURE_LABEL['需复评'], reason: '问题已全部关闭，待复评升级', needEscalation: false }
  }

  // 6. L1 审批完成 → 已闭环
  return { status: '已闭环', label: OTS_CLOSURE_LABEL['已闭环'], reason: 'L1 认可，审批完成，闭环', needEscalation: false }
}

/**
 * 偏差整改复评升级判定：L2 → L1 的准入条件。
 * 准入（fail-closed）：
 *   - 当前等级为 L2；
 *   - 审批已走完；
 *   - 问题清单全部关闭；
 *   - 客户结论为「认可」或「有条件认可」（非拒收）。
 * 满足则允许升级到 L1，否则给出拒绝原因。
 */
export function evaluateUpgrade(input: ClosureInput): { ok: boolean; level?: OtsApprovalLevel; reason: string } {
  if (input.level !== 'L2') {
    return { ok: false, reason: '仅 L2 偏差认可可复评升级为 L1' }
  }
  if (!input.approved) {
    return { ok: false, reason: '审批未完成，不可复评升级' }
  }
  if (input.customerConclusion === '拒收') {
    return { ok: false, reason: '客户已拒收，须退回整改，不可复评升级' }
  }
  if (!allIssuesClosed(input.issueIds, input.closedIssueIds)) {
    return { ok: false, reason: '偏差问题未全部关闭，不可复评升级' }
  }
  return { ok: true, level: 'L1', reason: '偏差问题已全部关闭，复评通过，升级为 L1 认可' }
}

/** 台账记录汇总（供视图 KPI 展示） */
export interface OtsClosureSummary {
  total: number
  closed: number
  inProgress: number
  pendingRework: number
  expired: number
  needReview: number
}

export function summarizeClosure(records: OtsApprovalRecord[], now?: string): OtsClosureSummary {
  const summary: OtsClosureSummary = {
    total: records.length,
    closed: 0,
    inProgress: 0,
    pendingRework: 0,
    expired: 0,
    needReview: 0
  }
  for (const r of records) {
    const st = determineClosureStatus({
      level: r.level,
      approved: r.approved,
      customerConclusion: r.customerConclusion,
      dueDate: r.dueDate,
      issueIds: r.issueIds,
      closedIssueIds: new Set(r.issueIds),
      upgraded: r.upgraded,
      upgradedLevel: r.upgradedLevel,
      now
    })
    switch (st.status) {
      case '已闭环':
        summary.closed++
        break
      case '进行中':
        summary.inProgress++
        break
      case '待整改':
        summary.pendingRework++
        break
      case '已过期':
        summary.expired++
        break
      case '需复评':
        summary.needReview++
        break
    }
  }
  return summary
}

/** 等级标签（转发 otsApproval 的映射） */
export function levelLabel(level: OtsApprovalLevel): string {
  return OTS_LEVEL_LABEL[level]
}
