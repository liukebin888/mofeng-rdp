/**
 * 可配置流程引擎（SRS 4.4 审批能力 / FUN-017 / GAT-008 / DOC-004 / DOC-014）
 *
 * 规格要求（SRS 4.4 通用能力基线「审批能力」）：
 *   节点、条件分支、会签或签、加签转签、超时升级
 * 验收标准（FUN-017）：
 *   配置一条含条件分支与超时的流程，无需发版生效；超时升级触达率 100%。
 *
 * 设计约束（ARC-001）：
 *   本层纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   流程「定义」是数据（可配置、可持久化、不发版生效），业务规则（SOD/安全不可豁免等）
 *   仍在领域层写死，不可通过配置绕过（GAT-013）。
 *
 * 数据模型：
 *   FlowDefinition —— 流程模板（节点序列 + 分支 + 会签/或签 + SLA + 超时升级规则）
 *   FlowInstance    —— 流程实例（当前节点、已完成节点、审批记录、超时状态、加签/转办记录）
 */

export type NodeType = 'start' | 'approve' | 'branch' | 'sign' | 'end'
export type SignMode = 'all' | 'any' // 会签（全通过才过） / 或签（任一通过即过）
export type BranchOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'

/** 条件分支：对表单字段做比较，命中则走指定下一节点 */
export interface FlowBranch {
  field: string
  op: BranchOp
  value: string | number
  toNodeId: string
}

/** 审批节点：可配置审批角色、时限、会签/或签、超时升级目标 */
export interface FlowNode {
  id: string
  name: string
  type: NodeType
  /** 审批角色（approve/sign 节点必填） */
  approverRole?: string
  /** 会签/或签（sign 节点）；approve 节点默认为单人审批 */
  signMode?: SignMode
  /** 会签参与角色列表（会签节点） */
  signRoles?: string[]
  /** 超时工作小时数（超时自动升级） */
  slaHours?: number
  /** 超时升级目标角色（为空则不升级，仅提醒） */
  escalateToRole?: string
  /** 是否安全相关项（超时即升级，无延展 GAT-008） */
  safety?: boolean
  /** 条件分支：命中即跳转（branch 节点） */
  branches?: FlowBranch[]
  /** 未命中任何分支时的默认下一节点 */
  defaultNext?: string
}

/** 流程定义（可配置、可持久化，修改后新实例即生效，无需发版） */
export interface FlowDefinition {
  id: string
  code: string
  name: string
  /** 表单字段说明（分支条件引用的字段） */
  formFields: { key: string; label: string }[]
  nodes: FlowNode[]
  /** 起始节点 id */
  startNodeId: string
  /** 生效状态 */
  enabled: boolean
  /** 定义版本（配置变更留痕） */
  version: number
}

/** 单个审批记录 */
export interface ApprovalRecord {
  nodeId: string
  nodeName: string
  approverRole: string
  approverName?: string
  action: 'approve' | 'reject' | 'counterSign' | 'addSign' | 'transfer' | 'escalate'
  at: string
  note?: string
  /** 会签时各签署人结论 */
  signatures?: { role: string; name?: string; pass: boolean; at: string }[]
}

/** 流程实例运行时状态 */
export interface FlowInstance {
  id: string
  defId: string
  defCode: string
  title: string
  /** 发起人 */
  submitter: string
  /** 流程表单数据（分支条件据此判定） */
  form: Record<string, string | number | boolean>
  /** 当前所处节点 id */
  currentNodeId: string
  /** 实例状态 */
  status: '运行中' | '已完成' | '已驳回' | '已终止'
  /** 已通过的节点 id 序列 */
  passedNodeIds: string[]
  /** 审批历史 */
  history: ApprovalRecord[]
  /** 当前节点进入时间（ISO），用于超时判定 */
  nodeEnteredAt: string
  /** 是否已触发超时升级 */
  escalated: boolean
  /** 超时升级目标角色（触发后写入，触达记录留痕） */
  escalatedToRole?: string
  /** 已加签的角色列表 */
  addedSigners?: string[]
  createdAt: string
  finishedAt?: string
}

// ---------------------------------------------------------------------------
// 纯函数：节点查找 / 下一步解析 / 超时判定
// ---------------------------------------------------------------------------

export function getNode(def: FlowDefinition, nodeId: string): FlowNode | undefined {
  return def.nodes.find((n) => n.id === nodeId)
}

/** 解析某节点 → 候选下一步（不含条件分支求值，仅静态后继） */
export function staticNext(def: FlowDefinition, nodeId: string): string[] {
  const node = getNode(def, nodeId)
  if (!node) return []
  if (node.type === 'end') return []
  const next: string[] = []
  if (node.type === 'branch') {
    node.branches?.forEach((b) => next.push(b.toNodeId))
    if (node.defaultNext) next.push(node.defaultNext)
    return next
  }
  // 非分支节点：按定义中的顺序找下一个节点（线性流程）
  const idx = def.nodes.findIndex((n) => n.id === nodeId)
  const following = def.nodes[idx + 1]
  return following ? [following.id] : []
}

/** 条件分支求值：命中第一个满足条件的分支；无命中走 defaultNext */
export function evalBranch(def: FlowDefinition, node: FlowNode, form: FlowInstance['form']): string | undefined {
  if (node.type !== 'branch') return undefined
  for (const b of node.branches ?? []) {
    const v = form[b.field]
    if (v === undefined) continue
    if (compareValue(v, b.op, b.value)) return b.toNodeId
  }
  return node.defaultNext
}

function compareValue(v: string | number | boolean, op: BranchOp, target: string | number): boolean {
  if (op === 'eq') return String(v) === String(target)
  if (op === 'neq') return String(v) !== String(target)
  const nv = typeof v === 'number' ? v : Number(v)
  const nt = typeof target === 'number' ? target : Number(target)
  if (Number.isNaN(nv) || Number.isNaN(nt)) return false
  switch (op) {
    case 'gt': return nv > nt
    case 'gte': return nv >= nt
    case 'lt': return nv < nt
    case 'lte': return nv <= nt
    default: return false
  }
}

/** 超时判定：超过 slaHours 工作小时则需升级（安全项即时、无延展） */
export function isOverdue(inst: FlowInstance, def: FlowDefinition, now: Date = new Date()): boolean {
  const node = getNode(def, inst.currentNodeId)
  if (!node || node.type === 'end' || inst.status !== '运行中') return false
  if (node.slaHours == null) return false
  const entered = new Date(inst.nodeEnteredAt).getTime()
  if (Number.isNaN(entered)) return false
  const elapsedHours = (now.getTime() - entered) / 3_600_000
  return elapsedHours > node.slaHours
}

// ---------------------------------------------------------------------------
// 实例创建与流转
// ---------------------------------------------------------------------------

export interface StartFlowInput {
  def: FlowDefinition
  title: string
  submitter: string
  form?: FlowInstance['form']
  id?: string
  now?: Date
}

/** 从定义启动一个流程实例 */
export function startFlow(input: StartFlowInput): FlowInstance {
  const now = (input.now ?? new Date()).toISOString()
  const id = input.id ?? `F${Date.now()}${Math.floor(Math.random() * 1000)}`
  const inst: FlowInstance = {
    id,
    defId: input.def.id,
    defCode: input.def.code,
    title: input.title,
    submitter: input.submitter,
    form: input.form ?? {},
    currentNodeId: input.def.startNodeId,
    status: '运行中',
    passedNodeIds: [],
    history: [],
    nodeEnteredAt: now,
    escalated: false,
    addedSigners: [],
    createdAt: now
  }
  return inst
}

/** 分支跳转：branch 节点进入后立即解析并推进到目标节点 */
export function advanceThroughBranch(inst: FlowInstance, def: FlowDefinition, now: Date = new Date()): FlowInstance {
  const node = getNode(def, inst.currentNodeId)
  if (!node || node.type !== 'branch' || inst.status !== '运行中') return inst
  const to = evalBranch(def, node, inst.form)
  if (!to) {
    // 无命中且无 defaultNext：终止（异常出口，防静默挂起）
    return { ...inst, status: '已终止', history: [...inst.history, { nodeId: node.id, nodeName: node.name, approverRole: '系统', action: 'escalate', at: now.toISOString(), note: '条件分支无命中且无默认路径，流程终止' }], finishedAt: now.toISOString() }
  }
  return {
    ...inst,
    passedNodeIds: [...inst.passedNodeIds, node.id],
    currentNodeId: to,
    nodeEnteredAt: now.toISOString(),
    history: [...inst.history, { nodeId: node.id, nodeName: node.name, approverRole: '系统', action: 'escalate', at: now.toISOString(), note: `条件分支命中 → ${to}` }]
  }
}

export interface ApprovalInput {
  approverRole: string
  approverName?: string
  /** 会签时单个签署人的结论 */
  signRole?: string
  now?: Date
}

/** 会签/或签节点：登记一个签署人结论，返回是否整节点通过 */
export function signNode(inst: FlowInstance, def: FlowDefinition, input: ApprovalInput): { inst: FlowInstance; nodePassed: boolean; allPassed: boolean } {
  const node = getNode(def, inst.currentNodeId)
  if (!node || (node.type !== 'sign' && node.type !== 'approve') || inst.status !== '运行中') {
    return { inst, nodePassed: false, allPassed: false }
  }
  const now = (input.now ?? new Date()).toISOString()
  const roles = node.signRoles ?? (node.approverRole ? [node.approverRole] : [])
  // 找到本节点已有的签署记录（同一角色不可重复签）
  const existing = inst.history.find((h) => h.nodeId === node.id && h.action === 'counterSign')
  const sigs = existing?.signatures ? [...existing.signatures] : []
  const targetRole = input.signRole ?? input.approverRole
  if (!sigs.some((s) => s.role === targetRole)) {
    sigs.push({ role: targetRole, name: input.approverName, pass: input.approverRole === targetRole ? true : false, at: now })
  }

  const signMode = node.signMode ?? 'any'
  const allPassed = roles.every((r) => sigs.some((s) => s.role === r && s.pass))
  const anyPassed = sigs.some((s) => s.pass)
  const nodePassed = signMode === 'all' ? allPassed : anyPassed

  const newHistory = [...inst.history.filter((h) => !(h.nodeId === node.id && h.action === 'counterSign')), { nodeId: node.id, nodeName: node.name, approverRole: input.approverRole, approverName: input.approverName, action: 'counterSign' as const, at: now, signatures: sigs }]

  return { inst: { ...inst, history: newHistory }, nodePassed, allPassed }
}

/** 普通审批节点通过/驳回；通过后推进到下一节点（含分支求值） */
export function approveNode(inst: FlowInstance, def: FlowDefinition, input: ApprovalInput & { note?: string }): FlowInstance {
  const node = getNode(def, inst.currentNodeId)
  if (!node || inst.status !== '运行中') return inst
  const now = (input.now ?? new Date()).toISOString()
  let next: FlowInstance = {
    ...inst,
    passedNodeIds: [...inst.passedNodeIds, node.id],
    history: [...inst.history, { nodeId: node.id, nodeName: node.name, approverRole: input.approverRole, approverName: input.approverName, action: 'approve' as const, at: now, note: input.note }]
  }
  const candidates = staticNext(def, node.id)
  if (candidates.length === 0) {
    // end 节点之后的结束：此处 node 是 end 前最后一个审批节点
    next = { ...next, status: '已完成', finishedAt: now }
  } else {
    next = { ...next, currentNodeId: candidates[0], nodeEnteredAt: now }
    // 若推进到分支节点，立即求值继续推进
    next = advanceThroughBranch(next, def, new Date(now))
  }
  return next
}

export function rejectNode(inst: FlowInstance, def: FlowDefinition, input: ApprovalInput & { note?: string }): FlowInstance {
  const node = getNode(def, inst.currentNodeId)
  if (!node || inst.status !== '运行中') return inst
  const now = (input.now ?? new Date()).toISOString()
  return {
    ...inst,
    status: '已驳回',
    finishedAt: now,
    history: [...inst.history, { nodeId: node.id, nodeName: node.name, approverRole: input.approverRole, approverName: input.approverName, action: 'reject' as const, at: now, note: input.note }]
  }
}

/** 加签：在审批节点追加一个签署角色（扩大会签范围） */
export function addSigner(inst: FlowInstance, def: FlowDefinition, role: string, now: Date = new Date()): FlowInstance {
  const node = getNode(def, inst.currentNodeId)
  if (!node || inst.status !== '运行中') return inst
  const at = now.toISOString()
  return {
    ...inst,
    addedSigners: [...(inst.addedSigners ?? []), role],
    history: [...inst.history, { nodeId: node.id, nodeName: node.name, approverRole: role, action: 'addSign' as const, at, note: `加签 ${role}` }]
  }
}

/** 转办：把当前审批转给另一角色 */
export function transferNode(inst: FlowInstance, def: FlowDefinition, toRole: string, note?: string, now: Date = new Date()): FlowInstance {
  const node = getNode(def, inst.currentNodeId)
  if (!node || inst.status !== '运行中') return inst
  const at = now.toISOString()
  return {
    ...inst,
    nodeEnteredAt: at,
    history: [...inst.history, { nodeId: node.id, nodeName: node.name, approverRole: toRole, action: 'transfer' as const, at, note: note ?? `转办至 ${toRole}` }]
  }
}

/** 超时升级：把当前审批升级到上级角色并留痕（触达记录） */
export function escalate(inst: FlowInstance, def: FlowDefinition, now: Date = new Date()): FlowInstance {
  const node = getNode(def, inst.currentNodeId)
  if (!node || inst.status !== '运行中' || inst.escalated) return inst
  const toRole = node.escalateToRole
  if (!toRole) return { ...inst, escalated: true }
  const at = now.toISOString()
  return {
    ...inst,
    escalated: true,
    escalatedToRole: toRole,
    nodeEnteredAt: at,
    history: [...inst.history, { nodeId: node.id, nodeName: node.name, approverRole: toRole, action: 'escalate' as const, at, note: `超时升级 → ${toRole}` }]
  }
}

/** 可执行动作：给定实例与定义，返回当前节点允许的动作集合 */
export function availableActions(inst: FlowInstance, def: FlowDefinition, now: Date = new Date()): string[] {
  if (inst.status !== '运行中') return []
  const node = getNode(def, inst.currentNodeId)
  if (!node) return []
  const acts: string[] = []
  if (node.type === 'approve' || node.type === 'sign') {
    acts.push('通过', '驳回')
    if (node.type === 'sign' || (node.signRoles && node.signRoles.length > 1)) acts.push('会签')
    acts.push('加签', '转办')
  }
  if (isOverdue(inst, def, now) && !inst.escalated && node.escalateToRole) acts.push('超时升级')
  return acts
}
