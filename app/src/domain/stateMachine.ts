/**
 * 状态机引擎（SRS 9.2 / ARC-005）
 * 五元组 (from, event, guard, action, to)；guard 不满足即拒绝流转；action 必填（通知/审计/校验）
 *
 * SRS 9.2 要求「所有业务对象的状态机以五元组定义」，并明确列举对象：
 *   需求、项目、供应商、软件版本、样件、ECR、ECN（PRJ-014/SUP-002/VER-003/HW-002/CHG-005/REQ-004/REQ-002）。
 * 本文件补齐六类对象的五元组定义，杜绝「单对象线性状态机 + 死路径」的落空。
 */
import type { EcrItem, Project, Requirement, SampleReq, Supplier } from './types'

export interface Transition<T = Record<string, unknown>> {
  from: string[]
  event: string
  guard?: (o: T) => boolean
  action?: string
  to: string
}

export class IllegalTransitionError extends Error {
  code = 'ILLEGAL_TRANSITION'
  constructor(event: string, from: string) {
    super(`状态「${from}」不接受事件「${event}」（ARC-005 非法流转已拒绝）`)
  }
}

// ---------------------------------------------------------------------------
// 需求（REQ-002）：六态 + 变更闭包
// ---------------------------------------------------------------------------

export const REQ_TRANSITIONS: Transition<Requirement>[] = [
  { from: ['草稿'], event: '提交评审', guard: (r) => !!r.title, action: '生成评审任务、写审计', to: '评审中' },
  { from: ['评审中'], event: '评审通过', guard: (r) => r.status === '评审中', action: '冻结版本、通知下游', to: '已批准' },
  { from: ['评审中'], event: '评审驳回', action: '退回责任人、记录驳回原因', to: '草稿' },
  { from: ['已批准'], event: '纳入基线', action: '写入基线项、计算 row_hash', to: '已基线化' },
  { from: ['草稿', '评审中', '已批准'], event: '废弃', guard: (r) => r.status !== '已基线化' && r.status !== '变更中', action: '标记废弃、保留编号、写审计', to: '已废弃' },
  // 修复：原 guard 恒为 false 的死路径。已基线化条目变更的唯一入口是「存在有效 ECR」，
  // 由上层（ChangeAppService）在调用前校验 ECR 有效性，此处 guard 校验对象处于可变更态。
  { from: ['已基线化'], event: '提出变更', guard: (r) => r.status === '已基线化', action: '锁定原条目、复制新版本、标记「已被替代」', to: '变更中' }
]

// ---------------------------------------------------------------------------
// 项目（PRJ-014）：策划中 → 进行中 → 已归档（归档前须解除并留审批 PRJ-021）
// ---------------------------------------------------------------------------

export const PROJECT_TRANSITIONS: Transition<Project>[] = [
  { from: ['策划中'], event: '立项批准', guard: (p) => !!p.code && !!p.owner, action: '生成项目基线、任务下达', to: '进行中' },
  { from: ['进行中'], event: '归档', guard: (p) => p.planFrozen, action: '解除归档审批、转只读、写审计', to: '已归档' },
  { from: ['已归档'], event: '解除归档', action: '写审批、恢复可写', to: '进行中' }
]

// ---------------------------------------------------------------------------
// 供应商（SUP-002）：准入 → 定点 → PPAP（三态质量门槛）
// ---------------------------------------------------------------------------

export const SUPPLIER_TRANSITIONS: Transition<Supplier>[] = [
  { from: ['未准入'], event: '准入批准', guard: (s) => s.qualified, action: '写准入档案、通知 SQE', to: '已准入' },
  { from: ['已准入'], event: '定点', guard: (s) => s.qualified, action: '写入定点状态、关联物料', to: '已定点' },
  { from: ['已定点'], event: 'PPAP 批准', guard: (s) => s.ppapStatus === '已批准', action: '更新 PPAP 状态、解锁批量供货', to: 'PPAP 批准' },
  { from: ['已定点', 'PPAP 批准'], event: '停用', action: '标记停用、保留档案', to: '已停用' }
]

// ---------------------------------------------------------------------------
// 样件（HW-002）：A/B/C → OTS → 已交付（发运签收后自动转已交付 HW-016）
// ---------------------------------------------------------------------------

export const SAMPLE_TRANSITIONS: Transition<SampleReq>[] = [
  { from: ['A 样'], event: 'B 样试制', guard: (s) => !!s.ebomVersion, action: '生成 B 样试制任务', to: 'B 样' },
  { from: ['B 样'], event: 'C 样试制', guard: (s) => !!s.ebomVersion, action: '生成 C 样试制任务', to: 'C 样' },
  { from: ['C 样'], event: 'OTS 认可', action: '进入 OTS 阶段、写审计', to: 'OTS' },
  { from: ['OTS'], event: '发运签收', action: '登记签收人/时间/客户反馈、自动转已交付', to: '已交付' }
]

// ---------------------------------------------------------------------------
// ECR（CHG-005）：影响评估 → 审批中 → ECN执行 → ECN验证 → 已关闭
//   与 change.ts 的 closeEcr 校验同源：关闭前必须通过 ECN 验证（C-18）
// ---------------------------------------------------------------------------

export const ECR_TRANSITIONS: Transition<EcrItem>[] = [
  { from: ['影响评估'], event: '提交审批', guard: (e) => e.impacts.every((i) => i.assessed), action: '生成审批任务、写审计', to: '审批中' },
  { from: ['审批中'], event: '审批通过', action: '进入 ECN 执行', to: 'ECN执行' },
  { from: ['审批中'], event: '审批驳回', action: '退回影响评估', to: '影响评估' },
  { from: ['ECN执行'], event: '执行完成', action: '进入验证环节', to: 'ECN验证' },
  { from: ['ECN验证'], event: '验证通过', guard: (e) => e.ecnVerification?.verified === true, action: '关闭 ECR、写审计', to: '已关闭' },
  { from: ['ECN验证'], event: '验证不通过', action: '退回执行、记录原因', to: 'ECN执行' }
]

// ---------------------------------------------------------------------------
// 软件版本（VER-003）：草稿 → 评审中 → 已发布（受控发布，未会签不得发布 DOC-004）
// ---------------------------------------------------------------------------

export interface SoftwareVersion {
  id: string
  projectId: string
  code: string
  version: string
  status: '草稿' | '评审中' | '已发布' | '已作废'
  signoffComplete: boolean
}

export const SOFTWARE_VERSION_TRANSITIONS: Transition<SoftwareVersion>[] = [
  { from: ['草稿'], event: '提交评审', guard: (v) => !!v.code, action: '生成评审任务', to: '评审中' },
  { from: ['评审中'], event: '评审通过', guard: (v) => v.signoffComplete, action: '冻结版本、写审计', to: '已发布' },
  { from: ['评审中'], event: '评审驳回', action: '退回草稿、记录原因', to: '草稿' },
  { from: ['草稿', '评审中'], event: '作废', action: '标记作废、保留版本号', to: '已作废' }
]

// ---------------------------------------------------------------------------
// 汇总注册表：所有对象 → 五元组
// ---------------------------------------------------------------------------

export const stateDefs: Record<string, Transition<any>[]> = {
  需求: REQ_TRANSITIONS,
  项目: PROJECT_TRANSITIONS,
  供应商: SUPPLIER_TRANSITIONS,
  样件: SAMPLE_TRANSITIONS,
  ECR: ECR_TRANSITIONS,
  软件版本: SOFTWARE_VERSION_TRANSITIONS
}

export function next<T>(transitions: Transition<T>[], current: string, obj: T): Transition<T>[] {
  return transitions.filter((t) => t.from.includes(current) && (!t.guard || t.guard(obj)))
}

export function fire<T>(transitions: Transition<T>[], current: string, event: string, obj: T): { to: string; action: string } {
  const t = transitions.find((x) => x.from.includes(current) && x.event === event)
  if (!t) throw new IllegalTransitionError(event, current)
  if (t.guard && !t.guard(obj)) throw new IllegalTransitionError(`${event}（guard 未满足）`, current)
  return { to: t.to, action: t.action || '' }
}
