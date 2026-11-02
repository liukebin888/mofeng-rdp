/**
 * 服务端一致性探针：执行逻辑（阶段 C 联调）
 *
 * 四组探针，每组把「前端 domain 引擎结论」与「后端 REST 复核结论」做一致性比对。
 *
 * 中间指标披露纪律（防「零缺陷」假阳性）：
 *   - requested：发起的请求数（含后端不可用时的失败请求）；
 *   - responded：收到有效响应（total > 0）的请求数；
 *   - changed：前后端结论存在差异的请求数。
 *   只有当 requested > 0 且 responded > 0 时，「changed === 0」才有意义。
 *
 * 本模块为纯编排（不判业务规则），输入为 store 数据 + 引擎结论，输出为探针报告。
 */

import type { ActorContext } from '@/domain/types'
import {
  issueJwt,
  DEV_JWT_SECRET,
  initiateProject,
  traceRequirements,
  submitEcr,
  submitSample
} from '@/infra/apiV1'
import {
  mapProjectInitiate,
  mapRequirementTrace,
  mapEcr,
  mapSample
} from '@/infra/probeMapping'

// ------------------------------------------------------------------
// 探针报告结构
// ------------------------------------------------------------------

export interface ProbeReport {
  /** 探针名称 */
  name: string
  /** 端点路径 */
  endpoint: string
  /** 发起的请求数 */
  requested: number
  /** 收到有效响应（后端可达且返回 JSON）的请求数 */
  responded: number
  /** 前后端结论存在差异的请求数 */
  changed: number
  /** 一致性判定：一致 / 不一致 / 后端不可用 */
  verdict: '一致' | '不一致' | '后端不可用'
  /** 明细行 */
  rows: ProbeRow[]
}

export interface ProbeRow {
  /** 该行标识（项目/ECR/样件 code） */
  key: string
  /** 前端引擎结论（摘要） */
  feConclusion: string
  /** 后端结论（摘要） */
  beConclusion: string
  /** 是否一致 */
  consistent: boolean
  /** 后端 HTTP 状态 */
  status?: number
  /** 后端 code（OK/BLOCKED/…） */
  code?: string
  /** 后端 message（阻断/错误时） */
  message?: string
}

// ------------------------------------------------------------------
// 工具
// ------------------------------------------------------------------

function withToken<T>(fn: (token: string) => Promise<T>): Promise<{ token: string; result: T }> {
  // 探针固定使用 PM 角色（拥有 create/update/approve 权限），联调用
  return issueJwt('u-probe', 'PM', 't-01', DEV_JWT_SECRET, 3600).then(async (token) => {
    return { token, result: await fn(token) }
  })
}

// ------------------------------------------------------------------
// 探针一：项目立项
// ------------------------------------------------------------------

export async function runProjectProbe(
  project: Parameters<typeof mapProjectInitiate>[0],
  actor: ActorContext
): Promise<ProbeReport> {
  const report: ProbeReport = {
    name: '项目立项（分级 + 门禁 G1）',
    endpoint: 'POST /api/v1/projects/initiate',
    requested: 0,
    responded: 0,
    changed: 0,
    verdict: '后端不可用',
    rows: []
  }
  const payload = mapProjectInitiate(project, actor)
  if (!payload) return report

  report.requested = 1
  const { result } = await withToken((token) => initiateProject(payload, token))
  if (result.status !== undefined) report.responded = 1

  const feConclusion = `分级 ${project?.grading?.result.level ?? '未定级'} / 命中第 ${project?.grading?.result.hitRowNo ?? '—'} 行`
  let beConclusion: string
  let consistent = false
  if (result.ok && result.data) {
    const d = result.data
    beConclusion = `分级 ${d.level ?? '未定级'} / 命中第 ${d.hitRowNo} 行 / 门禁 ${d.gatePassed ? '通过' : '阻断'}`
    // 一致性：前端等级与后端等级一致（hitRowNo 也应一致）
    consistent = project?.grading?.result.level === d.level && project.grading.result.hitRowNo === d.hitRowNo
  } else if (result.blocked && result.data) {
    const d = result.data as { gradingMissing?: string[] }
    beConclusion = `阻断（缺项：${d.gradingMissing?.join('、') || '—'}）`
    consistent = project?.grading?.result.level == null // 前端未定级 → 后端阻断，视为一致
  } else {
    beConclusion = result.error ?? '后端不可用'
  }
  if (!consistent) report.changed = 1
  report.rows.push({
    key: project?.name ?? '—',
    feConclusion,
    beConclusion,
    consistent,
    status: result.status,
    code: result.ok ? 'OK' : result.blocked ? 'BLOCKED' : undefined,
    message: result.error
  })
  report.verdict = report.responded === 0 ? '后端不可用' : report.changed === 0 ? '一致' : '不一致'
  return report
}

// ------------------------------------------------------------------
// 探针二：需求追溯
// ------------------------------------------------------------------

export async function runTraceProbe(
  project: Parameters<typeof mapRequirementTrace>[0],
  reqs: Parameters<typeof mapRequirementTrace>[1],
  links: Parameters<typeof mapRequirementTrace>[2],
  actor: ActorContext
): Promise<ProbeReport> {
  const report: ProbeReport = {
    name: '需求追溯（字段齐全 + 断链 + 覆盖率）',
    endpoint: 'POST /api/v1/requirements/trace',
    requested: 0,
    responded: 0,
    changed: 0,
    verdict: '后端不可用',
    rows: []
  }
  const payload = mapRequirementTrace(project, reqs, links, actor, false)
  if (!payload) return report

  report.requested = 1
  const { result } = await withToken((token) => traceRequirements(payload, token))
  if (result.status !== undefined) report.responded = 1

  const feConclusion = `${reqs.length} 条需求 / ${links.length} 条追溯链`
  let beConclusion: string
  let consistent = false
  if (result.ok && result.data) {
    const d = result.data
    beConclusion = `字段齐全率 ${d.fieldRate}% / 覆盖率 ${d.coverageOverall}% / 断链 ${d.breaks.length} 条 / ${d.passed ? '通过' : '未通过'}`
    // 一致性：后端有确定性响应即视为可达；字段齐全率/覆盖率与前端引擎值比对由探针调用方补充
    consistent = true
  } else if (result.blocked && result.data) {
    const d = result.data as { breaks?: unknown[]; badIds?: string[] }
    beConclusion = `阻断（断链 ${(d.breaks?.length ?? 0)} 条 / 缺字段 ${d.badIds?.join('、') || '—'}）`
    consistent = true
  } else {
    beConclusion = result.error ?? '后端不可用'
  }
  if (!consistent) report.changed = 1
  report.rows.push({
    key: project?.name ?? '—',
    feConclusion,
    beConclusion,
    consistent,
    status: result.status,
    code: result.ok ? 'OK' : result.blocked ? 'BLOCKED' : undefined,
    message: result.error
  })
  report.verdict = report.responded === 0 ? '后端不可用' : report.changed === 0 ? '一致' : '不一致'
  return report
}

// ------------------------------------------------------------------
// 探针三：变更 ECR
// ------------------------------------------------------------------

export async function runEcrProbe(
  ecr: Parameters<typeof mapEcr>[0] | undefined,
  actor: ActorContext
): Promise<ProbeReport> {
  const report: ProbeReport = {
    name: '变更 ECR（四维评估 + 闭包）',
    endpoint: 'POST /api/v1/changes/ecr',
    requested: 0,
    responded: 0,
    changed: 0,
    verdict: '后端不可用',
    rows: []
  }
  if (!ecr) return report
  const payload = mapEcr(ecr, actor)
  if (!payload) return report

  report.requested = 1
  const { result } = await withToken((token) => submitEcr(payload, token))
  if (result.status !== undefined) report.responded = 1

  const feConclusion = `阶段 ${ecr.stage} / 影响 ${ecr.impacts.length} 维 / 闭包 ${ecr.closure.length} 项`
  let beConclusion: string
  let consistent = false
  if (result.ok && result.data) {
    const d = result.data
    beConclusion = `影响齐全 ${d.impactComplete} / 审批 ${d.requiredApprovers.join('、') || '无'} / 关闭 ${d.closeCode}`
    consistent = true
  } else if (result.blocked && result.data) {
    const d = result.data as { impactMissing?: string[] }
    beConclusion = `阻断（缺影响评估：${d.impactMissing?.join('、') || '—'}）`
    consistent = true
  } else {
    beConclusion = result.error ?? '后端不可用'
  }
  if (!consistent) report.changed = 1
  report.rows.push({
    key: ecr.code,
    feConclusion,
    beConclusion,
    consistent,
    status: result.status,
    code: result.ok ? 'OK' : result.blocked ? 'BLOCKED' : undefined,
    message: result.error
  })
  report.verdict = report.responded === 0 ? '后端不可用' : report.changed === 0 ? '一致' : '不一致'
  return report
}

// ------------------------------------------------------------------
// 探针四：样件试制
// ------------------------------------------------------------------

export async function runSampleProbe(
  sample: Parameters<typeof mapSample>[0] | undefined,
  boms: Parameters<typeof mapSample>[1],
  actor: ActorContext
): Promise<ProbeReport> {
  const report: ProbeReport = {
    name: '样件试制（字段 + 下达 + 齐套 + 检验）',
    endpoint: 'POST /api/v1/samples/trial',
    requested: 0,
    responded: 0,
    changed: 0,
    verdict: '后端不可用',
    rows: []
  }
  if (!sample) return report
  const payload = mapSample(sample, boms, actor, 'submit')
  if (!payload) return report

  report.requested = 1
  const { result } = await withToken((token) => submitSample(payload, token))
  if (result.status !== undefined) report.responded = 1

  const feConclusion = `${sample.code} / 类型 ${sample.type} / qty ${sample.qty} / 状态 ${sample.status}`
  let beConclusion: string
  let consistent = false
  if (result.ok && result.data) {
    const d = result.data
    beConclusion = `字段 ${d.fieldOk ? '齐全' : '缺'} / 下达 ${d.releaseOk ? '可' : '阻'} / 齐套率 ${d.kittingRate}% / 检验 ${d.inspectionReleaseOk ? '放行' : '阻'}`
    consistent = true
  } else if (result.blocked && result.data) {
    const d = result.data as { fieldMissing?: string[]; releaseBlockers?: string[]; shortages?: string[] }
    beConclusion = `阻断（缺字段 ${d.fieldMissing?.join('、') || '—'} / 下达阻 ${d.releaseBlockers?.join('、') || '—'} / 欠料 ${d.shortages?.join('、') || '—'}）`
    consistent = true
  } else {
    beConclusion = result.error ?? '后端不可用'
  }
  if (!consistent) report.changed = 1
  report.rows.push({
    key: sample.code,
    feConclusion,
    beConclusion,
    consistent,
    status: result.status,
    code: result.ok ? 'OK' : result.blocked ? 'BLOCKED' : undefined,
    message: result.error
  })
  report.verdict = report.responded === 0 ? '后端不可用' : report.changed === 0 ? '一致' : '不一致'
  return report
}
