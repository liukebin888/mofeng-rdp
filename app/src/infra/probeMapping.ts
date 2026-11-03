/**
 * 基础设施层：前端 store 数据 → 后端 /api/v1 四端点请求体映射（阶段 C 联调探针）
 *
 * 职责：把前端 domain 引擎的输入（store 里的受控对象）序列化为后端 DTO，
 * 供「服务端一致性探针」调用后端复核，并比对前端引擎结论 vs 后端响应。
 *
 * 纪律：
 *   - 本模块只做「数据形状映射」，不判定任何业务规则（ARC-001 分层纪律）；
 *   - 输入为纯数据（store getter 返回的数组/对象），输出为 apiV1 的 Payload；
 *   - 不 import domain 内部引擎函数，只 import 纯类型（type-only）。
 *
 * 与 src/infra/apiV1.ts 的分工：apiV1 负责「网络 + 三态解包」，本模块负责「形状映射」。
 */

import type { Project, Requirement, TraceLink, EcrItem, SampleReq, BomNode, ActorContext } from '@/domain/types'
import type { StageTemplate } from '@/domain/stageTemplate'
import type { ApprovalBinding } from '@/domain/approvalBinding'
import type { FlowInstance } from '@/domain/flowEngine'
import type {
  ProjectInitiatePayload,
  RequirementTracePayload,
  ChangePayload,
  SamplePayload,
  StagePayload,
  TraceLinkDto,
  ImpactDto,
  ClosureDto,
  BomNodeDto
} from '@/infra/apiV1'

// ------------------------------------------------------------------
// 端点一：项目立项
// ------------------------------------------------------------------

/** 把前端 project.grading.input + actor 映射为后端 ProjectInitiatePayload。 */
export function mapProjectInitiate(
  project: Project | undefined,
  actor: ActorContext
): ProjectInitiatePayload | null {
  if (!project || !project.grading?.input) return null
  const input = project.grading.input
  return {
    projectId: project.id,
    tenantId: project.tenantId ?? actor.tenantId,
    projectName: project.name,
    orgId: 'org-1', // 种子数据无 orgId 字段，联调固定占位（五要素校验需要）
    asil: input.asil || undefined,
    cal: input.cal < 0 ? null : input.cal,
    selfDev: input.selfDev || undefined,
    newArch: input.newArch ?? null,
    customerSafety: input.customerSafety ?? null,
    userName: actor.userName,
    roleName: actor.roleName
  }
}

// ------------------------------------------------------------------
// 端点二：需求追溯
// ------------------------------------------------------------------

/** 把前端 reqs/links 映射为后端 RequirementTracePayload。 */
export function mapRequirementTrace(
  project: Project | undefined,
  reqs: Requirement[],
  links: TraceLink[],
  actor: ActorContext,
  buildBaseline: boolean
): RequirementTracePayload | null {
  if (!project) return null
  const requirements: Record<string, Record<string, unknown>> = {}
  for (const r of reqs) {
    requirements[r.code] = {
      code: r.code,
      title: r.title,
      type: r.type,
      asil: r.asil,
      cal: r.cal,
      owner: r.owner,
      verifyMethod: r.verifyMethod
    }
  }
  const linkDtos: TraceLinkDto[] = links.map((l) => ({
    id: l.id,
    srcType: l.srcType,
    srcId: l.srcId,
    dstType: l.dstType,
    dstId: l.dstId,
    linkType: l.linkType,
    baselineId: l.baselineId,
    status: l.status
  }))
  return {
    tenantId: project.tenantId ?? actor.tenantId,
    projectId: project.id,
    orgId: 'org-1',
    userName: actor.userName,
    roleName: actor.roleName,
    requirements,
    links: linkDtos,
    buildBaseline
  }
}

// ------------------------------------------------------------------
// 端点三：变更 ECR
// ------------------------------------------------------------------

/** 把前端单个 EcrItem 映射为后端 ChangePayload。 */
export function mapEcr(ecr: EcrItem, actor: ActorContext): ChangePayload | null {
  const impacts: ImpactDto[] = ecr.impacts.map((i) => ({
    dim: i.dim,
    assessed: i.assessed,
    note: i.note
  }))
  const closure: ClosureDto[] = ecr.closure.map((c) => ({
    objType: c.objType,
    objId: c.objId,
    objCode: c.objCode,
    decision: c.decision,
    note: c.note
  }))
  return {
    tenantId: actor.tenantId,
    projectId: ecr.projectId,
    ecrId: ecr.id,
    orgId: 'org-1',
    userName: actor.userName,
    roleName: actor.roleName,
    code: ecr.code,
    title: ecr.title,
    highRisk: ecr.highRisk,
    stage: ecr.stage,
    impacts,
    closure,
    ecnVerified: ecr.ecnVerification ? ecr.ecnVerification.verified : null
  }
}

// ------------------------------------------------------------------
// 端点四：样件试制
// ------------------------------------------------------------------

/** 把前端单个 SampleReq + 其 BOM 映射为后端 SamplePayload。 */
export function mapSample(
  sample: SampleReq,
  boms: BomNode[],
  actor: ActorContext,
  event: string
): SamplePayload | null {
  // 该样件对应的 BOM（种子数据里 BOM 都挂在 P-001，按 projectId 关联）
  const bomDtos: BomNodeDto[] = boms
    .filter((b) => b.projectId === sample.projectId)
    .map((b) => ({
      materialCode: b.materialCode,
      name: b.name,
      parentMaterialCode: b.parentMaterialCode,
      qty: b.qty,
      stock: b.stock,
      incoming: b.incoming
    }))
  return {
    tenantId: actor.tenantId,
    projectId: sample.projectId,
    orderId: sample.id,
    orgId: 'org-1',
    userName: actor.userName,
    roleName: actor.roleName,
    code: sample.code,
    type: sample.type,
    qty: sample.qty,
    needDate: sample.needDate,
    ebomVersion: sample.ebomVersion,
    ebomFrozen: true,
    kitBlocked: false,
    toolingReady: true,
    bom: bomDtos,
    status: sample.status,
    event,
    conclusion: '合格',
    nonconformityIds: []
  }
}

// ------------------------------------------------------------------
// 端点五：研发阶段管控
// ------------------------------------------------------------------

/**
 * 把前端阶段模板 + 审批绑定 + 审批实例 + 闸门通过状态映射为后端 StagePayload。
 * 阶段推进探针：用「目标阶段 S2」发起推进，比对前端 stageRelease 结论 vs 后端 advance 判定。
 */
export function mapStageAdvance(
  tpl: StageTemplate,
  targetStageCode: string,
  bindings: ApprovalBinding[],
  instances: FlowInstance[],
  gatePassed: Array<{ gate: string; passed: boolean }>,
  actor: ActorContext
): StagePayload | null {
  if (!tpl) return null
  return {
    tenantId: actor.tenantId,
    projectId: actor.projectId ?? '',
    orgId: 'org-1',
    userName: actor.userName,
    roleName: actor.roleName,
    op: 'advance',
    templateId: tpl.id,
    targetStageCode,
    bindings: bindings.map((b) => ({ stageCode: b.stageCode, defId: b.defId, label: b.label })),
    instances: instances.map((i) => ({
      id: i.id,
      defId: i.defId,
      defCode: i.defCode,
      title: i.title,
      submitter: i.submitter,
      form: i.form,
      currentNodeId: i.currentNodeId,
      status: i.status,
      passedNodeIds: i.passedNodeIds,
      nodeEnteredAt: i.nodeEnteredAt,
      escalated: i.escalated,
      escalatedToRole: i.escalatedToRole,
      addedSigners: i.addedSigners,
      createdAt: i.createdAt,
      finishedAt: i.finishedAt
    })),
    gatePassed: gatePassed.map((g) => ({ gate: g.gate, passed: g.passed }))
  }
}
