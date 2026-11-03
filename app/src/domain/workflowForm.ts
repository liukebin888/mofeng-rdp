/**
 * 统一工作流单据框架（WF-001「新增/保存/关闭/提交」四按钮 + 单据状态机）
 *
 * 规格（用户硬约束）：
 *   所有工作流（任务、计划、申请、立项等）都必须走同一条「基于模板新增 → 编辑中可保存/关闭
 *   → 提交审批」的解决方案，四个按钮缺一不可。
 *
 * 设计约束（ARC-001 同源）：
 *   本层纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   单据「状态机」与「草稿联动」是唯一权威规则，视图层（WorkflowFormShell）只负责渲染与调用。
 *
 * 状态机（单据视角）：
 *   draft（草稿）──提交──▶ submitted（已提交/审批中）
 *                             ├──完成──▶ completed
 *                             ├──驳回──▶ rejected
 *                             └──终止──▶ terminated
 *   rejected 可再编辑退回 draft，重新提交。
 *
 * 四按钮语义：
 *   new    新增：基于 FlowDefinition（模板）生成一份空白单据，进入 draft 态；
 *          （若该模板已存在草稿则载入续编，避免重复新建）
 *   save   保存：把当前编辑内容写入草稿（draftEngine），可关闭后续编；
 *   close  关闭：退出编辑视图，草稿保留（不提交、不删除）；
 *   submit 提交：跑提交前校验（gate），通过后启动流程实例（startFlow），并清除草稿。
 */

import type { FlowDefinition, FlowInstance } from './flowEngine'
import type { FormDraft } from './types'

/** 单据状态（WF-001 状态机） */
export type WorkflowFormStatus = 'draft' | 'submitted' | 'completed' | 'rejected' | 'terminated'

/** 四按钮动作标识 */
export type WorkflowFormAction = 'new' | 'save' | 'close' | 'submit'

/**
 * 工作流单据（把「模板 + 草稿内容 + 流程实例」串起来的一张单）
 * 这是框架层对上层业务表单的统一抽象，业务字段序列化进 content。
 */
export interface WorkflowForm {
  /** 单据唯一标识（跨端一致：草稿键与流程实例标题均据此锚定） */
  id: string
  /** 关联的流程模板定义 */
  defId: string
  defCode: string
  /** 单据标题（如「立项申请」） */
  title: string
  /** 草稿对象类型（对应 DraftObjectType，用于草稿跨端键） */
  objectType: string
  /** 业务表单内容（JSON 序列化，由业务视图自行组织） */
  content: string
  /** 单据状态 */
  status: WorkflowFormStatus
  /** 提交后绑定的流程实例 id（submitted/completed/rejected/terminated 时有效） */
  flowInstanceId?: string
  /** 提交前校验未通过时的阻断项说明 */
  blockers?: string[]
  createdAt: string
  updatedAt: string
}

/** 新增/编辑一块单据的输入 */
export interface NewWorkflowFormInput {
  def: FlowDefinition
  objectType: string
  /** 业务对象标识（如项目 id），与 userId 一起锚定草稿键 */
  objectId: string
  /** 初始内容（可选，默认空对象） */
  content?: string
  id?: string
  now?: Date
}

/** 生成单据草稿键（与 draftEngine.draftKey 语义一致，便于跨端续编） */
export function workflowFormKey(userId: string, objectType: string, objectId: string): string {
  return `${userId}:${objectType}:${objectId}`
}

/** 新建（或载入已有草稿续编）一块工作流单据 */
export function newWorkflowForm(input: NewWorkflowFormInput): WorkflowForm {
  const now = (input.now ?? new Date()).toISOString()
  return {
    id: input.id ?? `WF-${Date.now()}`,
    defId: input.def.id,
    defCode: input.def.code,
    title: input.def.name,
    objectType: input.objectType,
    content: input.content ?? '{}',
    status: 'draft',
    createdAt: now,
    updatedAt: now
  }
}

/** 保存：更新单据内容与时间戳（不改变状态，草稿态才可保存） */
export function saveWorkflowForm(form: WorkflowForm, content: string, now: Date = new Date()): WorkflowForm {
  return { ...form, content, updatedAt: now.toISOString() }
}

/**
 * 提交前校验：由调用方传入 gate 判定函数（返回阻断项）。
 * 返回通过后应写入 status=submitted 的单据；有阻断则原样返回并附 blockers。
 */
export interface SubmitCheck {
  /** 是否放行提交 */
  ok: boolean
  /** 阻断项说明 */
  blockers: string[]
}

export function validateSubmit(check: SubmitCheck, form: WorkflowForm): WorkflowForm {
  if (check.ok) return { ...form, blockers: [] }
  return { ...form, blockers: check.blockers }
}

/** 提交成功：单据进入已提交态，绑定流程实例 id */
export function markSubmitted(form: WorkflowForm, flowInstanceId: string, now: Date = new Date()): WorkflowForm {
  return { ...form, status: 'submitted', flowInstanceId, blockers: [], updatedAt: now.toISOString() }
}

/** 依据流程实例最终状态，回写单据状态（供审批流走完后同步） */
export function syncStatusFromFlow(form: WorkflowForm, inst: FlowInstance | undefined, now: Date = new Date()): WorkflowForm {
  if (!inst) return form
  const map: Record<FlowInstance['status'], WorkflowFormStatus> = {
    '运行中': 'submitted',
    '已完成': 'completed',
    '已驳回': 'rejected',
    '已终止': 'terminated'
  }
  return { ...form, status: map[inst.status] ?? form.status, updatedAt: now.toISOString() }
}

/** 驳回后重开编辑：回退到草稿态（清空流程实例绑定，重新提交走新实例） */
export function reopenForEdit(form: WorkflowForm, now: Date = new Date()): WorkflowForm {
  return { ...form, status: 'draft', flowInstanceId: undefined, updatedAt: now.toISOString() }
}

/** 判定某动作在当前状态下是否可用（fail-closed：未知动作一律拒绝） */
export function canDo(form: WorkflowForm, action: WorkflowFormAction): boolean {
  switch (action) {
    case 'new': return true
    case 'save': return form.status === 'draft'
    case 'close': return true
    case 'submit': return form.status === 'draft'
    default: return false
  }
}

/** 从草稿列表里取某单据的草稿内容（用于打开时续编）；无则返回 undefined */
export function draftContentFor(
  drafts: FormDraft[],
  userId: string,
  objectType: string,
  objectId: string
): string | undefined {
  const key = workflowFormKey(userId, objectType, objectId)
  return drafts.find((d) => `${d.userId}:${d.objectType}:${d.id}` === key)?.content
}
