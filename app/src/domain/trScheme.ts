/**
 * 技术方案（TR）域引擎
 *
 * 定位：技术方案「提交评审及审批」的单一权威数据源。
 *   - 技术方案以附件形式提交（附件名列表，随流程表单流转）；
 *   - 相关人员（电子/结构/工艺/采购）多人会签，各自给出签审意见；
 *   - 最终由技术负责人（执行总监）批准。
 *
 * 设计约束（ARC-001 同源）：纯函数、零 DOM、零 vue/pinia，可被 vitest 直接调用。
 */

/** 技术方案附件（以附件名记录；平台零文件存储，附件名即凭证） */
export interface TrAttachment {
  id: string
  /** 附件名称（如「转向助力域控制器技术方案 V1.2.docx」） */
  name: string
  /** 附件类型（可选：方案文档 / 计算书 / DFMEA / 图纸 / 其他） */
  kind?: string
  /** 上传人 */
  uploadedBy?: string
  /** 上传时间（ISO） */
  uploadedAt?: string
}

/** 一条签审意见（由会签人给出） */
export interface TrReviewOpinion {
  /** 签署角色（如「电子研发工程师」） */
  role: string
  /** 签署人姓名 */
  name?: string
  /** 结论：通过 / 有条件通过 / 不通过 */
  verdict: '通过' | '有条件通过' | '不通过'
  /** 签审意见正文 */
  opinion: string
  /** 签署时间（ISO） */
  at: string
}

/** 技术方案版本对象（技术方案域唯一权威；与审批流实例 FLOW-PRE-5 绑定） */
export interface TrScheme {
  id: string
  /** 方案名称 */
  name: string
  /** 方案版本（V1.0 / V1.1 …） */
  version: string
  /** 客户（客户主数据，与前期交流申请同源） */
  customer: string
  /** 产品大类 */
  category: string
  /** 所属产品线 */
  productLine: string
  /** 平台（自由文本，可选） */
  platform: string
  /** 目标车型/车系 */
  vehicleModel: string
  /** 预估年销量（台/年） */
  annualVolume: number
  /** 产品生命周期（年） */
  lifecycle: number
  /** 方案说明/摘要 */
  summary: string
  /** 附件列表（技术方案以附件形式提交） */
  attachments: TrAttachment[]
  /** 评审结论（TR 技术评审） */
  trResult: '待评审' | 'TR 通过' | 'TR 有条件通过' | 'TR 不通过'
  /** 签审意见列表（多人会签意见） */
  opinions: TrReviewOpinion[]
  /** 审批状态（与流程实例联动） */
  status: '草稿' | '评审中' | '已批准' | '已驳回'
  /** 绑定审批流实例 id */
  flowInstanceId?: string
  /** 发起人 */
  submitter: string
  createdAt: string
  /** 批准人（技术负责人） */
  approvedBy?: string
  approvedAt?: string
}

/** 附件类型字典 */
export const TR_ATTACHMENT_KINDS = ['方案文档', '计算书', 'DFMEA', '图纸', '试验大纲', '其他'] as const

/** 会签角色（TR 技术评审相关角色，多人并行签审） */
export const TR_REVIEW_ROLES = ['电子研发工程师', '结构研发工程师', '工艺技术工艺师', '采购部'] as const

/** 评审结论字典 */
export const TR_RESULTS = ['待评审', 'TR 通过', 'TR 有条件通过', 'TR 不通过'] as const

/** 生成空白技术方案对象 */
export function newTrScheme(id: string, submitter: string, now = new Date()): TrScheme {
  return {
    id,
    name: '',
    version: 'V1.0',
    customer: '',
    category: '',
    productLine: '',
    platform: '',
    vehicleModel: '',
    annualVolume: 0,
    lifecycle: 0,
    summary: '',
    attachments: [],
    trResult: '待评审',
    opinions: [],
    status: '草稿',
    submitter,
    createdAt: now.toISOString()
  }
}

/** 生成一条空白附件 */
export function newTrAttachment(id: string, uploadedBy?: string, now = new Date()): TrAttachment {
  return { id, name: '', kind: '方案文档', uploadedBy, uploadedAt: now.toISOString() }
}

/** 生成一条空白签审意见 */
export function newTrReviewOpinion(role: string, name?: string, now = new Date()): TrReviewOpinion {
  return { role, name, verdict: '通过', opinion: '', at: now.toISOString() }
}

/** 附件必填校验：至少一个非空附件名 */
export function hasValidAttachment(attachments: TrAttachment[]): boolean {
  return attachments.some((a) => (a.name ?? '').trim() !== '')
}

/** 有效附件列表（过滤空名） */
export function validAttachments(attachments: TrAttachment[]): TrAttachment[] {
  return attachments.filter((a) => (a.name ?? '').trim() !== '')
}

/**
 * 提交前校验（fail-closed：未知字段一律要求补齐）。
 * 返回阻断项列表；空数组表示通过。
 */
export interface TrSubmitCheck {
  ok: boolean
  blockers: string[]
}

export function validateTrScheme(scheme: TrScheme): TrSubmitCheck {
  const blockers: string[] = []
  if (!(scheme.name ?? '').trim()) blockers.push('方案名称')
  if (!(scheme.version ?? '').trim()) blockers.push('方案版本')
  if (!(scheme.customer ?? '').trim()) blockers.push('客户')
  if (!(scheme.vehicleModel ?? '').trim()) blockers.push('车型')
  if (!hasValidAttachment(scheme.attachments)) blockers.push('技术方案附件（须以附件形式提交）')
  return { ok: blockers.length === 0, blockers }
}

/**
 * 汇总签审结论（多人会签）：
 *   - 任一人「不通过」→ TR 不通过；
 *   - 否则任一人「有条件通过」→ TR 有条件通过；
 *   - 全部「通过」→ TR 通过。
 */
export function aggregateTrResult(opinions: TrReviewOpinion[]): 'TR 通过' | 'TR 有条件通过' | 'TR 不通过' {
  const effective = opinions.filter((o) => (o.opinion ?? '').trim() !== '' || o.verdict === '不通过')
  if (effective.some((o) => o.verdict === '不通过')) return 'TR 不通过'
  if (effective.some((o) => o.verdict === '有条件通过')) return 'TR 有条件通过'
  return 'TR 通过'
}

/** 签审意见完成度：已给出实质意见（意见正文非空）的角色数 / 会签角色总数 */
export function reviewCompletion(opinions: TrReviewOpinion[]): { signed: number; total: number; rate: number } {
  const signed = opinions.filter((o) => (o.opinion ?? '').trim() !== '').length
  const total = TR_REVIEW_ROLES.length
  return { signed, total, rate: total ? signed / total : 0 }
}

/**
 * 技术负责人批准：方案由「技术负责人（执行总监）」批准后才可视为 TR 通过、可作报价/立项技术输入。
 * 仅当评审结论非「不通过」且签审意见齐备（至少一条实质意见）方可批准。
 */
export interface TrApproveCheck {
  ok: boolean
  reason: string
}

export function canApproveTr(scheme: TrScheme): TrApproveCheck {
  if (scheme.trResult === 'TR 不通过') return { ok: false, reason: 'TR 评审不通过，不可批准' }
  if (scheme.trResult === '待评审') return { ok: false, reason: '尚未完成 TR 技术评审' }
  const { signed } = reviewCompletion(scheme.opinions)
  if (signed === 0) return { ok: false, reason: '无实质签审意见，不可批准' }
  return { ok: true, reason: '' }
}

/** 标记批准 */
export function approveTrScheme(scheme: TrScheme, approver: string, now = new Date()): TrScheme {
  return { ...scheme, status: '已批准', approvedBy: approver, approvedAt: now.toISOString() }
}
