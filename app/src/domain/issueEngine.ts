/**
 * 问题闭环引擎（单一权威）
 *
 * 定位：把问题管理从「录入 → 报警 → 直接跳态关闭」的半闭环，升级为
 *   「录入 → 报警 → 五态流转处理 → 三要素校验关闭 → 门禁消费 + 回执」的完整闭环。
 * 主台账 IssueLedgerItem 的五态流转、关闭门禁、报警回执、关联键均由本引擎求值，
 * store/视图不得各自硬编码状态口径（同源判定铁律）。
 *
 * 五态状态机（用户裁决：扩展为五态含独立验证环节）：
 *   问题描述 → 原因分析 → 纠正措施执行 → 验证 → 关闭
 *   只能按序推进，不可跳态/回退；「关闭」须经三要素校验（根因/纠正措施/验证人）。
 *
 * 关闭三要素（fail-closed，缺一不可）：
 *   - rootCause：根本原因（原因分析阶段沉淀）
 *   - correctiveAction：纠正措施（纠正措施执行阶段沉淀）
 *   - verifiedBy：验证人（验证阶段确认；自动带入 closedBy 亦需显式）
 *
 * 历史兼容（不迁移旧数据）：
 *   旧 status 三态 '开放'|'处理中'|'已关闭' 通过 phase/status 镜像函数
 *   读写，不新增必填字段、不改已有台账；phase 缺省时按 status 推导。
 *
 * 报警回执状态机（补齐「发出→响应→确认」回流）：
 *   已发送 → 已响应 → 已确认（按序，可幂等重复确认不改变状态）
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 配置驱动：流转表 + 关闭要素清单为数据定义，判定函数统一求值（两段式）；
 *   - 同源判定：状态机表是唯一流转权威，canTransition 与 next 同源于表；
 *   - 关联键 checklistId/ncId/eightDId 串联问题清单/不符合项/8D（可选兼容）。
 */

/** 问题五态（与不符合项 NTTT 同源但扩展独立验证环节） */
export type IssuePhase = '问题描述' | '原因分析' | '纠正措施执行' | '验证' | '关闭'

export const ISSUE_PHASES: IssuePhase[] = ['问题描述', '原因分析', '纠正措施执行', '验证', '关闭']

/** 配置驱动：合法流转表（唯一权威，判定与推进同源） */
const PHASE_TRANSITIONS: Record<IssuePhase, IssuePhase[]> = {
  问题描述: ['原因分析'],
  原因分析: ['纠正措施执行'],
  纠正措施执行: ['验证'],
  验证: ['关闭'],
  关闭: []
}

/** 关闭三要素（配置：缺一不可） */
export const CLOSURE_REQUIRED_FIELDS = ['rootCause', 'correctiveAction', 'verifiedBy'] as const
export type ClosureField = (typeof CLOSURE_REQUIRED_FIELDS)[number]

/** 关闭要素输入 */
export interface IssueClosure {
  rootCause?: string
  correctiveAction?: string
  verifiedBy?: string
}

/** 状态流转校验：只能按序推进，不可跳态/回退 */
export function issuePhaseCanTransition(from: IssuePhase, to: IssuePhase): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: '状态未变化' }
  const allowed = PHASE_TRANSITIONS[from]
  if (!allowed || !allowed.includes(to)) {
    return { ok: false, reason: `不允许从「${from}」直接流转到「${to}」，须按序推进` }
  }
  return { ok: true }
}

/** 下一合法状态（关闭为终点，返回 null） */
export function issuePhaseNext(from: IssuePhase): IssuePhase | null {
  const next = PHASE_TRANSITIONS[from]
  return next && next.length > 0 ? next[0] : null
}

/** 是否终态 */
export function isIssueClosed(phase: IssuePhase): boolean {
  return phase === '关闭'
}

/**
 * 历史三态 → 五态镜像（兼容旧数据）。
 * 旧 '开放'→问题描述，'处理中'→原因分析（保留"进行中"语义的最早态），
 * '已关闭'→关闭。已是五态的值原样返回。
 */
export function statusToPhase(status: string): IssuePhase {
  if ((ISSUE_PHASES as string[]).includes(status)) return status as IssuePhase
  if (status === '已关闭') return '关闭'
  if (status === '处理中') return '原因分析'
  return '问题描述'
}

/** 五态 → 历史三态镜像（写回 status，保证 OTS/偏差门禁的 '已关闭' 口径不变） */
export function phaseToStatus(phase: IssuePhase): '开放' | '处理中' | '已关闭' {
  if (phase === '问题描述') return '开放'
  if (phase === '关闭') return '已关闭'
  return '处理中'
}

/** 从台账条目取当前相位（phase 优先，缺省按 status 推导） */
export function phaseOf(item: { phase?: IssuePhase; status: string }): IssuePhase {
  return item.phase ?? statusToPhase(item.status)
}

/**
 * 关闭三要素校验（fail-closed）。
 * @param closure 三要素输入
 * @param phase 当前相位（须为「验证」才允许关闭）
 */
export function canCloseIssue(
  closure: IssueClosure,
  phase: IssuePhase
): { ok: boolean; missing: ClosureField[]; reason?: string } {
  if (phase !== '验证') {
    return { ok: false, missing: [], reason: `当前处于「${phase}」，须先推进到「验证」方可关闭` }
  }
  const missing = CLOSURE_REQUIRED_FIELDS.filter((f) => {
    const v = closure[f]
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
  })
  if (missing.length > 0) {
    return { ok: false, missing: [...missing], reason: `关闭三要素缺失：${missing.join('、')}` }
  }
  return { ok: true, missing: [] }
}

/** 推进结果（相位流转 + 是否触发关闭校验） */
export interface AdvanceResult {
  ok: boolean
  next?: IssuePhase
  /** 下一态为「关闭」时 true，调用方须同时提供三要素并经 canCloseIssue 校验 */
  requiresClosure: boolean
  reason?: string
}

/**
 * 计算推进结果（纯求值，不写状态）。
 * 下一态为「关闭」时返回 requiresClosure=true，调用方须校验三要素。
 */
export function evaluateAdvance(from: IssuePhase): AdvanceResult {
  const next = issuePhaseNext(from)
  if (!next) return { ok: false, requiresClosure: false, reason: '已处于终态，无法继续推进' }
  return { ok: true, next, requiresClosure: next === '关闭' }
}

/** 报警回执状态（站内邮件回流） */
export type IssueAlertAckStatus = '已发送' | '已响应' | '已确认'

export const ISSUE_ALERT_ACK_STATUSES: IssueAlertAckStatus[] = ['已发送', '已响应', '已确认']

const ACK_TRANSITIONS: Record<IssueAlertAckStatus, IssueAlertAckStatus[]> = {
  已发送: ['已响应'],
  已响应: ['已确认'],
  已确认: []
}

/** 回执流转校验（按序；已确认重复确认视为幂等成功由调用方处理） */
export function alertAckCanTransition(from: IssueAlertAckStatus, to: IssueAlertAckStatus): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: '回执状态未变化' }
  const allowed = ACK_TRANSITIONS[from]
  if (!allowed || !allowed.includes(to)) {
    return { ok: false, reason: `不允许从「${from}」直接流转到「${to}」` }
  }
  return { ok: true }
}

/** 回执推进：返回下一回执态，终态 null */
export function alertAckNext(from: IssueAlertAckStatus): IssueAlertAckStatus | null {
  const next = ACK_TRANSITIONS[from]
  return next && next.length > 0 ? next[0] : null
}

/**
 * 关联键聚合校验：问题台账可挂问题清单/不符合项/8D 三类关联。
 * 仅校验「若声明关联则 id 非空」，不强制必须有关联（历史兼容）。
 */
export interface IssueLinks {
  checklistId?: string
  ncId?: string
  eightDId?: string
}

export function validateIssueLinks(links: IssueLinks): { ok: boolean; invalid: string[] } {
  const invalid: string[] = []
  for (const [k, v] of Object.entries(links)) {
    if (v !== undefined && (typeof v !== 'string' || v.trim() === '')) invalid.push(k)
  }
  return { ok: invalid.length === 0, invalid }
}

/** 闭环进度统计（按相位，供 KPI/看板） */
export function issuePhaseStats(items: Array<{ phase?: IssuePhase; status: string }>): {
  total: number
  byPhase: Record<IssuePhase, number>
  closed: number
  open: number
} {
  const byPhase: Record<IssuePhase, number> = {
    问题描述: 0, 原因分析: 0, 纠正措施执行: 0, 验证: 0, 关闭: 0
  }
  for (const it of items) byPhase[phaseOf(it)] += 1
  return { total: items.length, byPhase, closed: byPhase['关闭'], open: items.length - byPhase['关闭'] }
}
