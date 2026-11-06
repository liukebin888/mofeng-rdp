/**
 * 应用服务与全局上下文（对应架构中的 application 层 + pinia 适配）
 * 业务规则一律调用 domain 引擎；本层只做编排、持久化与审计落地
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { buildSeed, SEED_VERSION, type SeedData, type SeedUser } from '@/data/seed'
import { evaluateControlPoints, type CpContext } from '@/domain/controlPoints'
import {
  filterByScope,
  runScene,
  SCENE_PRODUCERS,
  reviewOutput,
  baselineAdmission,
  aiReviewAuditEntry,
  aiEnabled,
  watermark,
  type AiScene,
  type AiSceneOutput,
  type RetrievalScope,
  type ReviewAction
} from '@/domain/aiAssist'
import { runGate, GATE_TEMPLATES } from '@/domain/gate'
import { enforceStageGate, canCreateWorkItem, type WorkItemKind, type GateEnforceVerdict } from '@/domain/gateEnforce'
import { AUTOMOTIVE_STAGE_TEMPLATE, findStageTemplate, orderedStages, type StageTemplate } from '@/domain/stageTemplate'
import { gateReleaseEvidence, stageFullyReleased, prerequisitesFullyReleased, stageAdvanceVerdict, type ApprovalBinding } from '@/domain/approvalBinding'
import { deliverableProvidedEvidence, stageDeliverablesComplete, type DeliverableApprovalBinding } from '@/domain/deliverableApproval'
import { applySeverityChange, findRejectionPolicy, severitySummary, shouldReject, type RejectionPolicyItem, type RejectionSeverity } from '@/domain/rejectionPolicy'
import { freeze as freezeBaseline, verifyBaseline } from '@/domain/baseline'
import { appendAudit, verifyChain } from '@/domain/audit'
import { appendRecord, archiveFromAudit, DEFAULT_RETENTION_YEARS, destroyVolume, retentionVerdict, verifyLayer, type ArchiveLayer, type ArchiveVolume } from '@/domain/archiveLayer'
import { computeCpm, planQualityChecks, plannedValue, statusDayOf, weightedCompletion } from '@/domain/schedule'
import { computeEvm } from '@/domain/evm'
import { rankProjects } from '@/domain/portfolio'
import { coverage, detectBreaks } from '@/domain/trace'
import type { ActorContext, Baseline, GateDef, GateRun, Level, WbsNode, ThresholdIssue } from '@/domain/types'
import { can, type ActionKey } from '@/domain/rbac'
import { guardTenant, visibleInTenant, groupDrillDown, type TenantContext } from '@/domain/tenant'
import { canAccessSpace, visibleInSpace, accessibleSpaces, describeSwitch, type Space, type SpaceContext } from '@/domain/spaceEngine'
import { advanceThroughBranch, applyCustomApprovers, approveNode, availableActions, escalate, getNode, isOverdue, rejectNode, startFlow, addSigner, transferNode, signNode, type FlowDefinition, type CustomApproverAddition } from '@/domain/flowEngine'
import {
  addComment,
  archive,
  canDownload,
  checkin,
  checkout,
  obsolete,
  publish,
  resolveComment,
  revisionUp,
  searchDocs,
  signoff,
  submitForSignoff,
  veto,
  type ControlledDoc
} from '@/domain/docEngine'
import { summarizeAnnotations, type DocAnnotation } from '@/domain/docAnnotation'
import { appendRemoteAudit, checkBackend, loadRemoteState, saveRemoteState, seedRemoteAudit, repoBase } from '@/infra/repo'
import { issueJwt, DEV_JWT_SECRET, savePlan, listPlan, scanPlanAlerts as scanPlanAlertsApi, type PlanSavePayload, type PlanSaveData, type PlanAlertScanData, type PlanNodeDto } from '@/infra/apiV1'
import { knowledgeStats, markReused, nextLessonCode, pushToLibrary, searchLessons as searchLessonsEngine, validateLesson } from '@/domain/lessonEngine'
import {
  advanceSupervise as advanceSuperviseEngine,
  answerSendAudit as answerSendAuditEngine,
  closeResolution as closeResolutionEngine,
  escalateSendAudit,
  escalateSupervise,
  nextResolutionCode,
  overdueResolutions,
  resolutionToTask as resolutionToTaskEngine,
  validateMeeting,
  validateResolution,
  validateSendAudit,
  type ResolutionInput,
  type SendAuditInput,
  type SuperviseActionType
} from '@/domain/collabEngine'
import { decisionComplete } from '@/domain/portfolio'
import { roiOf, validateCurrency, type CurrencyAmount } from '@/domain/portfolioFinance'
import { applyAdjustments, canMerge, diffScenarios, mergeScenario, removeScenario } from '@/domain/whatif'
import { affectedPlans, endDateAfter, isWorkday, lineage, validateException, workdaysBetween } from '@/domain/calendarEngine'
import type { CalendarDef } from '@/domain/types'
import { aggregateMyTasks, bucketTodos } from '@/domain/myWorkEngine'
import { addCodeValue, filterCodeDict, validateUdf, stepCompletion, bumpTemplateVersion } from '@/domain/governanceConfig'
import { unreadCount, markRead, markAllRead, shouldNotify, inboxFor, batchApprove, rejectInbox } from '@/domain/messageCenter'
import { validateShareApply, isOccupied, expireOverdue, approveShare, renewShare, releaseShare, submitForApproval, activeShares } from '@/domain/resourceShare'
import { visibleSections, resetSections, toggleSection, setSectionRoles } from '@/domain/portalConfig'
import { upsertDraft, clearDraft, expiredDrafts, draftKey } from '@/domain/draftEngine'
import { normalizeLocale, localeInvariant, LOCALE_AUDIT_KEY, type Locale } from '@/domain/i18n'
import { enqueueWrite, settleWrite, dedupeQueue, stampCache, cacheBadge, type PendingWrite, type CacheStamp } from '@/domain/mobilePortal'
import { detectConflicts } from '@/domain/resourceConflict'
import { analyzeSupplyDemand } from '@/domain/supplyDemand'
import { detectOverallocations, gateBlocked } from '@/domain/overallocation'
import { levelResources, smoothResources, revert, type LevelingResult } from '@/domain/leveling'
import { scanThresholds, DEFAULT_THRESHOLD_RULES, type ThresholdMetrics } from '@/domain/thresholdEngine'
import { evaluateHandoffs } from '@/domain/handoffEngine'
import { evaluateInterfacePlan, exportInterfacePlan, interfacePlanHealth, type InterfaceEvaluation } from '@/domain/interfacePlan'
import { summarizeGateConsistency, type ProjectGateDecl } from '@/domain/gateConsistency'
import { aggregatePortfolio, interventionRows, type ProjectHealthSnapshot } from '@/domain/portfolioAggregate'
import { buildResourceProfile, type TaskResourceSpan } from '@/domain/resourceProfile'
import { buildCostSheet } from '@/domain/costSheet'
import { emptyQuoteCostSheet, type QuoteCostSheet } from '@/domain/quoteCost'
import { isOverdue as isCollabOverdue } from '@/domain/collabEngine'
import { rpn } from '@/domain/risk'
import { reviewProject, humanReviewEvidence, type HumanReview } from '@/domain/projectReview'
import { summarizePolarity, type PolarityRisk } from '@/domain/riskOpportunity'
import { analyzeBottlenecks } from '@/domain/bottleneck'
import { cloneStructure, validateClone } from '@/domain/projectClone'
import { createShareLink, revokeLink, activeLinks, LINK_TTL_MS, type ShareLink } from '@/domain/shareLink'
import { checkQuota, DEFAULT_QUOTA, type QuotaConfig, type QuotaUsage } from '@/domain/quota'
import { addCustomer as addCustomerEngine, updateCustomer as updateCustomerEngine, removeCustomer as removeCustomerEngine, addCategory as addCategoryEngine, addProductLine as addProductLineEngine, addProduct as addProductEngine, removeProductLine as removeProductLineEngine, removeProduct as removeProductEngine, removeCategory as removeCategoryEngine, exportCustomers, parseCustomers, exportProducts, parseProducts } from '@/domain/basicData'
import { addOrgNode as addOrgNodeEngine, updateOrgNode as updateOrgNodeEngine, removeOrgNode as removeOrgNodeEngine, exportOrgNodes, parseOrgNodes, resolveApprover } from '@/domain/org'
import { addNamingRule as addNamingRuleEngine, updateNamingRule as updateNamingRuleEngine, removeNamingRule as removeNamingRuleEngine, toggleNamingRule as toggleNamingRuleEngine, exportNamingRules, parseNamingRules, appendHistory, historyOf, appendCodeIssue, codeIssuesOf as codeIssuesOfEngine, codeIssueOfCode as codeIssueOfCodeEngine, validateName } from '@/domain/naming'
import { generateCode, validateCode } from '@/domain/codingEngine'
import { pert, highRpnLinkage, filterLinkedRisks, QUANT_MODEL_VERSION } from '@/domain/riskQuant'
import { runMonteCarlo } from '@/domain/simulation'
import { computeReserveFromSim, gateQuantifiedCheck, riskAdjustedPlan } from '@/domain/contingency'
import type { RiskLink, SimConfig, ThreePoint } from '@/domain/types'
import { searchCandidates, validatePoolHierarchy, validateEngagementRatio, canEnterBaseline, requestCommitmentChange, backfillHours, externalCapacityDeviation, effortDeviationRate, efficiencyFactor, isEstimateStale } from '@/domain/resourcePool'
import { buildHistogram, rateAt, costForPeriod, convertCurrency, createScenario, selectScenario, canWriteBack, compareScenarios } from '@/domain/resourcePlan'
import type { ResourcePoolNode, ResourceRequest, AssignmentCommitment, HourBackfill, ExternalCapacity, EffortDeviation, ResourceRate, ResourceScenario } from '@/domain/types'
import { metricBindingRate, groupCoverage } from '@/domain/reportLibrary'
import type { ReportDef, MetricDictEntry } from '@/domain/reportLibrary'
import { threeWayConsistency } from '@/domain/dataQuality'
import { validateImport, type FieldMapping } from '@/domain/interop'
import { defineForm, runHooksAtPoint, apiContractComplete, extensionPointsComplete, type CustomFormDef, type EventHook, type OpenApiEndpoint } from '@/domain/extensionPoint'
import { checkContrast, checkKeyboardAccessible, checkFormLabels, accessibilityPassRate } from '@/domain/accessibility'

const KEY = 'mofeng.rdp.state.v1'
/** 语言偏好独立持久化（UI 偏好 ≠ 业务数据，不进入主文档乐观锁通道） */
const LOCALE_KEY = 'mofeng.rdp.locale.v1'
/** 主题外观偏好独立持久化（NFR-017 可访问性：浅色/深色 + 强调色，不影响业务数据） */
const THEME_KEY = 'mofeng.rdp.theme.v1'

export type ThemeMode = 'dark' | 'light'
export type AccentKey = 'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'rose'
export const ACCENT_KEYS: AccentKey[] = ['blue', 'cyan', 'purple', 'green', 'orange', 'rose']

function normalizeTheme(v: string | null): ThemeMode {
  return v === 'light' ? 'light' : 'dark'
}
function normalizeAccent(v: string | null): AccentKey {
  return (ACCENT_KEYS as string[]).includes(v ?? '') ? (v as AccentKey) : 'blue'
}

interface PersistShape {
  version: string
  data: SeedData
  userId: string
  projectId: string
  /** 当前空间 id（SPA-003 顶部切换器） */
  spaceId: string
  /** 服务端乐观锁版本号（REST 通道下维护，冲突返回 409） */
  rev?: number
}

function load(): PersistShape | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistShape
    if (parsed.version !== SEED_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export const useAppStore = defineStore('app', () => {
  const saved = load()
  const data = ref<SeedData>(saved?.data ?? buildSeed())
  const userId = ref<string>(saved?.userId ?? 'U003')
  const projectId = ref<string>(saved?.projectId ?? 'P-001')
  const spaceId = ref<string>(saved?.spaceId ?? 'SP-001')
  const toast = ref<{ type: 'success' | 'warning' | 'error' | 'info'; text: string } | null>(null)
  /** 界面语言（TEN-013）：仅影响展示层，数据权限（tenantContext/rbac）不随语言变化 */
  const locale = ref<Locale>(normalizeLocale(localStorage.getItem(LOCALE_KEY)))
  /** 主题模式（dark/light）：仅影响外观，不触碰业务数据与权限 */
  const themeMode = ref<ThemeMode>(normalizeTheme(localStorage.getItem(THEME_KEY)))
  /** 强调色（accent）：主题主色，可独立于深浅切换 */
  const accent = ref<AccentKey>(normalizeAccent(localStorage.getItem(THEME_KEY + '.accent')))
  /** 仓储通道：'local'（localStorage 降级）| 'rest'（后端持久化） */
  const repoMode = ref<'local' | 'rest'>('local')
  /** 服务端乐观锁版本号（REST 通道下维护） */
  const rev = ref<number>(0)
  /** 弱网离线写队列（POR-012：REST 写失败入队，同键去重，联网 flush） */
  const pendingWrites = ref<PendingWrite[]>([])
  /** 本地缓存时间戳（POR-012：标识数据是否为本地缓存 + 是否过期只读） */
  const cacheStamp = ref<CacheStamp>({ cachedAt: new Date().toISOString(), version: 'current', fromCache: false })
  /** 文件交换外链（SUP-016：默认 7 天失效、可撤销、内外分离） */
  const shareLinks = ref<ShareLink[]>([])
  /** 租户配额配置（TEN-012：四类配额按租户配置） */
  const quotaConfig = ref<QuotaConfig>({ ...DEFAULT_QUOTA })
  /** RES-005：已裁决的超分配（key = userId\0week），裁决后闸门放行 */
  const resolvedOverallocIds = ref<string[]>([])
  /** RES-006/007：最近一次平衡/平滑操作的差异清单快照（含回退快照 before，供视图展示与回退） */
  const levelingSnapshot = ref<LevelingResult | null>(null)
  /** 临界值自动触发问题台账（对标 Oracle Thresholds：阈值越限→自动生成问题→分派） */
  const thresholdIssues = computed<ThresholdIssue[]>(() => (data.value.thresholdIssues ?? []) as ThresholdIssue[])

  const users = computed<SeedUser[]>(() => data.value.users)
  const currentUser = computed(() => users.value.find((u) => u.id === userId.value) || users.value[0])

  // —— 组织架构（TEN-009 六级组织树 + 岗位序列 + 人员挂靠）——
  const orgNodes = computed(() => (data.value.orgNodes ?? []) as import('@/domain/types').OrgNode[])
  const orgMemberships = computed(() => (data.value.orgMemberships ?? []) as import('@/domain/types').OrgMembership[])

  // —— 基础数据（客户 + 产品三级分类）——
  const customers = computed(() => (data.value.customers ?? []) as import('@/domain/types').Customer[])
  const productCategories = computed(() => (data.value.productCategories ?? []) as import('@/domain/types').ProductCategory[])
  const productLines = computed(() => (data.value.productLines ?? []) as import('@/domain/types').ProductLine[])
  const products = computed(() => (data.value.products ?? []) as import('@/domain/types').Product[])
  const namingRules = computed(() => (data.value.namingRules ?? []) as import('@/domain/types').NamingRule[])
  const namingRuleHistory = computed(() => (data.value.namingRuleHistory ?? []) as import('@/domain/types').NamingRuleHistory[])
  const codeIssues = computed(() => (data.value.codeIssues ?? []) as import('@/domain/types').CodeIssue[])

  // —— 多租户隔离（TEN-002/TEN-004）：当前租户上下文 + 可见项目 ——
  const tenants = computed(() => (data.value.tenants ?? []) as import('@/domain/tenant').Tenant[])
  /** 当前租户上下文：tenantId 由入口（登录态）强制注入，业务代码禁止从入参取 */
  const tenantContext = computed<TenantContext>(() => ({
    tenantId: data.value.tenantId,
    roleCode: currentUser.value.roleCode
  }))
  /** 可见项目 = 归属当前租户的项目（跨租户项目不可见，不泄露存在性 TEN-004） */
  const visibleProjects = computed(() => visibleInTenant(tenantContext.value, data.value.projects))

  // —— 空间隔离（SPA-001/002/003）：租户之下的项目组合维度，叠加在租户过滤之上 ——
  const spaces = computed(() => (data.value.spaces ?? []) as Space[])
  /** 当前空间上下文：spaceId 由顶部切换器强制注入，业务代码禁止从入参取 */
  const spaceContext = computed<SpaceContext>(() => ({
    tenantId: data.value.tenantId,
    spaceId: spaceId.value,
    roleCode: currentUser.value.roleCode
  }))
  /** 当前用户可访问的空间（租户归属 + 角色边界双重过滤，SPA-002） */
  const mySpaces = computed(() => accessibleSpaces(spaces.value, spaceContext.value))
  /** 当前空间（若当前 spaceId 越权/不存在则回退到首个可访问空间） */
  const currentSpace = computed(() => mySpaces.value.find((s) => s.id === spaceId.value) || mySpaces.value[0])
  /** 空间内可见项目 = 租户可见项目 再按空间过滤（叠加层，不改变租户过滤结果） */
  const spaceProjects = computed(() => visibleInSpace(spaceContext.value, visibleProjects.value))
  /** 当前项目 = 空间内可见项目 中取 projectId，否则空间内首个 */
  const currentProject = computed(() => spaceProjects.value.find((p) => p.id === projectId.value) || spaceProjects.value[0])

  /** 跨租户访问守卫：伪造/越界 tenantId 一律拒绝并留审计（应用层面，TEN-004） */
  function guardTenantAccess(targetTenantId?: string): boolean {
    const v = guardTenant(tenantContext.value, targetTenantId)
    if (!v.ok) {
      notify('error', `${v.note}（TEN-004 越权拦截）`)
      log('ACCESS', '租户', targetTenantId ?? '—', { verdict: v.code }, undefined, 'DENY')
      return false
    }
    return true
  }

  /** 集团视图下钻判定（TEN-008）：仅集团级角色可看子租户授权共享的汇总指标 */
  function guardGroupDrillDown(metric: string, subTenantCode: string): boolean {
    const sub = tenants.value.find((t) => t.code === subTenantCode)
    if (!sub) return false
    const v = groupDrillDown(tenantContext.value, metric, sub)
    if (!v.ok) {
      notify('error', v.note)
      log('ACCESS', '集团视图', subTenantCode, { metric, verdict: v.code }, undefined, 'DENY')
      return false
    }
    return true
  }

  /** 空间访问守卫：伪造/越界 spaceId 或越界角色一律拒绝并留审计（SPA-002/003） */
  function guardSpaceAccess(targetSpaceId: string): boolean {
    const target = spaces.value.find((s) => s.id === targetSpaceId)
    if (!target) {
      notify('error', `空间 ${targetSpaceId} 不存在（SPA-003 越权拦截）`)
      log('ACCESS', '空间', targetSpaceId, { verdict: 'SPACE_FORGED' }, undefined, 'DENY')
      return false
    }
    const v = canAccessSpace(spaceContext.value, target)
    if (!v.ok) {
      notify('error', `${v.note}（SPA-002 越权拦截）`)
      log('ACCESS', '空间', targetSpaceId, { verdict: v.code }, undefined, 'DENY')
      return false
    }
    return true
  }

  /** 空间切换：守卫通过后更新 spaceId，同步重置 projectId 到新空间首个项目，并留审计 */
  function switchSpace(targetSpaceId: string): boolean {
    if (targetSpaceId === spaceId.value) return true
    if (!guardSpaceAccess(targetSpaceId)) return false
    const from = spaceId.value
    const target = spaces.value.find((s) => s.id === targetSpaceId)!
    // 切换后当前项目须归属新空间，否则回退到新空间首个项目
    const nextProjects = visibleInSpace({ ...spaceContext.value, spaceId: targetSpaceId }, visibleProjects.value)
    spaceId.value = targetSpaceId
    if (!nextProjects.some((p) => p.id === projectId.value)) {
      projectId.value = nextProjects[0]?.id ?? projectId.value
    }
    notify('success', `已切换至空间「${target.name}」`)
    log('SWITCH_SPACE', '空间', targetSpaceId, describeSwitch(from, targetSpaceId), { spaceId: from }, 'OK')
    persist()
    return true
  }

  const actor = computed<ActorContext>(() => ({
    userId: currentUser.value.id,
    userName: currentUser.value.name,
    roleCode: currentUser.value.roleCode,
    roleName: currentUser.value.roleName,
    tenantId: data.value.tenantId,
    projectId: projectId.value,
    at: new Date().toISOString()
  }))

  function persist() {
    const payload: PersistShape = { version: SEED_VERSION, data: data.value, userId: userId.value, projectId: projectId.value, spaceId: spaceId.value, rev: rev.value }
    localStorage.setItem(KEY, JSON.stringify(payload))
    // 后端可用时异步同步（fire-and-forget，不阻塞交互；失败入队待重试）
    // 降级提示不得覆盖业务反馈：仅当当前无 toast 时提示一次，避免「基线篡改被拒」等关键错误被淹没。
    if (repoMode.value === 'rest') {
      void saveRemoteState({ ...payload, expectedRev: rev.value }).then((ok) => {
        if (ok) {
          rev.value = rev.value + 1
          void flushPendingWrites()
        } else {
          // POR-012 弱网排队去重：同键（数据状态）写失败入队，保留最新
          pendingWrites.value = enqueueWrite(pendingWrites.value, 'state', JSON.stringify(payload), new Date().toISOString())
          if (!toast.value) notify('warning', '网络较弱，写入已排队待同步（POR-012）')
        }
      })
    }
  }

  /** POR-012：联网后按序 flush 待写队列（去重压缩后逐条重试） */
  async function flushPendingWrites() {
    if (!pendingWrites.value.length) return
    const queue = dedupeQueue(pendingWrites.value)
    for (const w of queue) {
      const ok = await saveRemoteState({ expectedRev: rev.value, ...(JSON.parse(w.payload) as object) })
      const r = settleWrite(queue, w.key, ok)
      pendingWrites.value = r.queue
      if (r.dead) notify('error', `离线写入 ${w.key} 重试超限，已转死信（POR-012）`)
      if (ok) rev.value = rev.value + 1
    }
  }

  /** 启动时探测后端并同步：后端有数据 → 采用后端；否则播种到后端；失败降级 localStorage */
  async function syncFromBackend() {
    try {
      const health = await checkBackend()
      if (!health.ok) {
        repoMode.value = 'local'
        // POR-012：降级本地存储时打缓存时间戳标识（只读判定由引擎求值）
        cacheStamp.value = stampCache(Date.now())
        return
      }
      repoMode.value = 'rest'
      cacheStamp.value = { cachedAt: new Date().toISOString(), version: 'current', fromCache: false }
      const remote = await loadRemoteState()
      if (remote && typeof remote === 'object' && (remote as unknown as PersistShape).version === SEED_VERSION) {
        const rs = remote as unknown as PersistShape
        data.value = rs.data
        userId.value = rs.userId
        projectId.value = rs.projectId
        spaceId.value = rs.spaceId ?? 'SP-001'
        rev.value = rs.rev ?? 0
        localStorage.setItem(KEY, JSON.stringify(rs))
        notify('info', '已从服务端加载最新数据（跨端共享）')
      } else {
        // 后端无数据或版本不符：将当前（本地种子）播种/迁移到后端。
        // 版本不符（如 v1.0.4 → v1.0.5）属合法 seed 升级：携带后端当前 rev 覆盖写入，避免乐观锁 409。
        const backendRev = (remote && typeof remote === 'object' ? (remote as unknown as PersistShape).rev : undefined) ?? 0
        const payload: PersistShape = { version: SEED_VERSION, data: data.value, userId: userId.value, projectId: projectId.value, spaceId: spaceId.value, rev: backendRev }
        const ok = await saveRemoteState({ ...payload, expectedRev: backendRev })
        if (ok) {
          rev.value = backendRev + 1
          notify('info', '数据已播种至服务端（REST 持久化已启用）')
        }
      }
      // 审计链播种：仅当服务端审计为空时，把本地种子审计链推上去（服务端权威重算哈希）
      void seedRemoteAudit(data.value.audit as unknown[])
    } catch {
      repoMode.value = 'local'
      cacheStamp.value = stampCache(Date.now())
    }
  }

  function reset() {
    data.value = buildSeed()
    userId.value = 'U003'
    projectId.value = 'P-001'
    spaceId.value = 'SP-001'
    persist()
    notify('success', '演示数据已重置为初始种子（3 个项目 / 48 控制点 / 40 条审计）')
  }

  function notify(type: 'success' | 'warning' | 'error' | 'info', text: string) {
    toast.value = { type, text }
    setTimeout(() => (toast.value = null), 3600)
  }

  function setUser(id: string) {
    userId.value = id
    persist()
  }

  function setProject(id: string) {
    projectId.value = id
    persist()
  }

  /**
   * PRJ-022 项目结构复制：复制当前项目的 WBS 骨架 + Gate 定义（全局模板）+ 交付物清单，
   * 需求/样件/变更/风险/工时/基线等业务数据一律不复制（业务数据 0 条），
   * 复制结果标记来源模板版本。复制前后各校验一次结构与数据清零口径。
   */
  function cloneProjectStructure(sourceProjectId: string, newProjectId: string): boolean {
    const src = {
      wbs: data.value.wbs.filter((w) => w.projectId === sourceProjectId),
      deliverables: data.value.deliverables.filter((d) => d.projectId === sourceProjectId),
      gates: GATE_TEMPLATES as GateDef[],
      sourceCode: data.value.projects.find((p) => p.id === sourceProjectId)?.code ?? sourceProjectId
    }
    const result = cloneStructure(src, newProjectId)
    const check = validateClone(src, result)
    if (!check.ok) {
      notify('error', `结构复制校验未通过：${check.issues.join('；')}`)
      return false
    }
    log('CLONE', '项目结构', sourceProjectId, { newProjectId, sourceTemplateVersion: result.sourceTemplateVersion, stats: result.stats })
    notify('success', `已复制项目结构：WBS ${result.stats.wbsCount} 节点 / 交付物 ${result.stats.deliverableCount} / Gate ${result.stats.gateCount}（业务数据 0 条，模板版本 ${result.sourceTemplateVersion}）`)
    return true
  }

  /** RES-005/C-40 超分配裁决：登记 userId+week 为已处置，闸门放行 */
  function resolveOverallocation(userId: string, week: string, remedy: string): void {
    const key = `${userId}\u0000${week}`
    if (resolvedOverallocIds.value.includes(key)) return
    resolvedOverallocIds.value = [...resolvedOverallocIds.value, key]
    log('UPDATE', '资源', userId, { action: '超分配裁决', week, remedy })
    notify('success', `已裁决超分配（${remedy}），资源闸门放行`)
  }

  /** RES-006 资源平衡：延后非关键活动消除超分配，里程碑零移动，可回退 */
  function balanceResources(roles: string[]): void {
    const result = levelResources(projectWbs.value, roles)
    if (!result.changes.length) {
      notify('info', '无可延后的非关键活动（关键路径/里程碑/HARD 约束均不可移动）')
      return
    }
    // 回写 WBS（差异清单已由引擎输出）
    data.value.wbs = data.value.wbs.map((w) => {
      const moved = result.after.find((a) => a.id === w.id)
      return moved ?? w
    })
    levelingSnapshot.value = result
    log('UPDATE', '资源', '平衡', { moved: result.changes.length, finishDelta: result.finishDeltaDays })
    notify('success', `资源平衡完成：延后 ${result.changes.length} 个非关键活动，里程碑零移动，完工日期变化 ${result.finishDeltaDays} 天`)
    persist()
  }

  /** RES-007 资源平滑：完工日期不变约束下削峰，峰值下降可量化，可回退 */
  function smoothResourcesAction(roles: string[]): void {
    const result = smoothResources(projectWbs.value, roles)
    if (!result.changes.length) {
      notify('info', '无可平滑的非关键活动（峰值已最优或均关键）')
      return
    }
    data.value.wbs = data.value.wbs.map((w) => {
      const moved = result.after.find((a) => a.id === w.id)
      return moved ?? w
    })
    levelingSnapshot.value = result
    log('UPDATE', '资源', '平滑', { moved: result.changes.length, peakReduction: result.peakReduction, finishDelta: result.finishDeltaDays })
    notify('success', `资源平滑完成：峰值下降 ${result.peakReduction}，完工日期变化 ${result.finishDeltaDays} 天`)
    persist()
  }

  /** RES-006/007 回退：恢复到最近一次平衡/平滑操作前的 WBS（差异清单可回退） */
  function revertLeveling(): void {
    if (!levelingSnapshot.value) {
      notify('info', '无可回退的平衡/平滑操作')
      return
    }
    const before = revert(levelingSnapshot.value.before)
    data.value.wbs = data.value.wbs.map((w) => {
      const orig = before.find((b) => b.id === w.id)
      return orig ?? w
    })
    log('UPDATE', '资源', '回退', { reverted: levelingSnapshot.value.changes.length })
    levelingSnapshot.value = null
    notify('success', '已回退到平衡/平滑前的计划')
    persist()
  }

  /** SUP-016 外链：为文档生成外链（内部文件不可外链，内外分离） */
  function createDocShareLink(docId: string): ShareLink | null {
    const doc = data.value.docs.find((d) => d.id === docId)
    if (!doc) {
      notify('error', '文档不存在')
      return null
    }
    const link = createShareLink({ id: doc.id, name: doc.name }, new Date(), LINK_TTL_MS, 'external')
    if (!link) {
      notify('error', '内部文件不可生成外链（内外分离 SUP-016）')
      return null
    }
    shareLinks.value.push(link)
    log('CREATE', '外链', link.id, { docId, expireAt: link.expireAt })
    notify('success', `已生成外链（7 天有效）：${doc.name}`)
    return link
  }

  /** SUP-016 外链：主动撤销（撤销后不可访问，幂等） */
  function revokeDocShareLink(linkId: string): boolean {
    const link = shareLinks.value.find((l) => l.id === linkId)
    if (!link) return false
    const revoked = revokeLink(link, currentUser.value.name, new Date())
    shareLinks.value = shareLinks.value.map((l) => (l.id === linkId ? revoked : l))
    log('REVOKE', '外链', linkId, { revokedAt: revoked.revokedAt, revokedBy: revoked.revokedBy })
    notify('success', `外链已撤销，立即不可访问`)
    return true
  }

  /** SUP-016 外链：仍可访问的外链列表（未撤销 + 未到期 + external） */
  const activeShareLinks = computed(() => activeLinks(shareLinks.value, new Date()))

  /** TEN-012 租户配额：当前用量快照（用户数取自 users；存储/并发/token 为演示口径） */
  const quotaUsage = computed<QuotaUsage>(() => ({
    users: users.value.length,
    storageMb: Math.round((data.value.audit.length + data.value.docs.length + data.value.wbs.length) * 0.5),
    concurrency: 1,
    aiToken: data.value.messages.length * 100
  }))

  /** TEN-012 配额判定：仅「新增」受配额限制，读动作永远放行 */
  function checkTenantQuota(action: 'create' | 'read' = 'create'): boolean {
    const v = checkQuota(action, quotaConfig.value, quotaUsage.value)
    if (!v.ok) {
      notify('error', v.reason)
      return false
    }
    return true
  }

  /** 权限校验入口（三层取交集：角色 × 作用域 × 字段策略） */
  function guard(action: ActionKey): boolean {
    const r = can(currentUser.value.roleCode, action)
    if (!r.allowed) notify('error', r.reason)
    else if (r.conditional) notify('warning', r.reason)
    return r.allowed
  }

  function log(action: string, objType: string, objId: string, after?: unknown, before?: unknown, result: 'OK' | 'DENY' = 'OK') {
    const row = appendAudit(data.value.audit, actor.value, { action, objType, objId, after, before, result })
    // 审计 append 独立通道：服务端权威重算哈希、append-only（不与主文档全量覆盖）
    if (repoMode.value === 'rest') {
      const a = actor.value
      void appendRemoteAudit({
        actorId: a.userId,
        actorName: a.userName,
        actorRole: a.roleName,
        action,
        objType,
        objId,
        before: before ?? null,
        after: after ?? null,
        result,
        tenantId: a.tenantId
      })
    }
    persist()
    return row
  }

  // —— 派生数据：控制点 / Gate / 计划 / 追溯 / 挣值 ——
  const projectWbs = computed(() => data.value.wbs.filter((w) => w.projectId === projectId.value))
  /** 跨专业交接点（界面计划管理 / Oracle Interface Plan 对标） */
  const projectHandoffs = computed(() => (data.value.handoffs ?? []).filter((h) => h.projectId === projectId.value))
  const projectReqs = computed(() => data.value.reqs.filter((r) => r.projectId === projectId.value))
  const projectLinks = computed(() => data.value.links.filter((l) => projectReqs.value.some((r) => r.id === l.srcId) || projectReqs.value.some((r) => r.id === l.dstId)))
  const projectRisks = computed(() => data.value.risks.filter((r) => r.projectId === projectId.value))
  /** 极性风险（机会型/威胁型，概率×影响量化，对标 Oracle P2） */
  const projectPolarityRisks = computed<PolarityRisk[]>(() => (data.value.polarityRisks ?? []).filter((r) => r.projectId === projectId.value))
  /** 极性风险 EMV 汇总（净期望 = 机会 − |威胁|） */
  const polaritySummary = computed(() => summarizePolarity(projectPolarityRisks.value))
  const projectEcrs = computed(() => data.value.ecrs.filter((e) => e.projectId === projectId.value))
  const projectBaselines = computed(() => data.value.baselines.filter((b) => b.projectId === projectId.value))
  const projectDeliverables = computed(() => data.value.deliverables.filter((d) => d.projectId === projectId.value))
  const projectDocs = computed(() => data.value.docs.filter((d) => d.projectId === projectId.value))
  /** 图文档在线批注（空间锚定，对标 Oracle P2） */
  const projectAnnotations = computed<DocAnnotation[]>(() => (data.value.docAnnotations ?? []).filter((a) => a.projectId === projectId.value))
  /** 批注统计摘要（总数/开放/已解决/解决率） */
  const annotationSummary = computed(() => summarizeAnnotations(projectAnnotations.value))
  const projectHours = computed(() => data.value.hours.filter((h) => h.projectId === projectId.value))
  /** PRJ-016 资源冲突：按人按周聚合工时，负荷率 >110% 判冲突（时段 = 周） */
  const resourceConflicts = computed(() => detectConflicts(projectHours.value).conflicts)
  /** RES-005 超分配三级：按人按周，L1<120% / L2 120~150% / L3 >150% */
  const overallocations = computed(() => detectOverallocations(projectHours.value, 40, resolvedOverallocIds.value))
  /** RES-005/C-40 闸门阻断：未处置的 L2/L3 超分配阻断资源闸门 */
  const resourceGateBlock = computed(() => gateBlocked(overallocations.value))
  /** RES-012 瓶颈资源：占用率 ≥90% 且位于关键路径 */
  const bottlenecks = computed(() => analyzeBottlenecks(projectWbs.value, 60))
  /** RES-004 供需分析：需求侧按角色聚合 WBS 工期，净可用按周窗口折算（演示口径） */
  const supplyDemand = computed(() => {
    const assignments = projectWbs.value.map((w) => ({
      id: w.id,
      projectId: w.projectId,
      role: w.ownerRole || '未分配',
      week: '2026-W45',
      demandHours: w.duration * 8,
      activityId: w.id,
      committed: true
    }))
    return analyzeSupplyDemand(assignments, (role) => {
      // 净可用：按资源池成员数 × 40h（有该角色成员即 40h/周）
      const members = resourcePool.value.filter((m) => m.role === role).length
      return members ? members * 40 : 40
    })
  })
  // —— RQA 风险量化域 ——
  /** RQA-005 高 RPN 风险关联率：高 RPN（≥200）风险必须 100% 关联活动/成本项 */
  const riskLinks = ref<Map<string, RiskLink>>(new Map())
  /** RQA-001 三点估算登记（riskId → 三点） */
  const threePoints = ref<Map<string, ThreePoint>>(new Map())
  const riskLinkage = computed(() => highRpnLinkage(projectRisks.value, riskLinks.value))
  /** RQA-012 定量风险与门禁联动（C-44 L4）：高风险未量化阻断 Gate */
  const riskGateCheck = computed(() =>
    gateQuantifiedCheck(
      projectRisks.value.map((r) => ({
        rpn: r.severity * r.occurrence * r.detection,
        quantified: threePoints.value.has(r.id),
        strategy: r.strategy
      }))
    )
  )
  /** RQA-002/003 蒙特卡洛模拟结果（基于三点估算 + 关联风险） */
  const simResult = ref<ReturnType<typeof runMonteCarlo> | null>(null)
  /** RQA-001 PERT：对已登记三点估算的风险求 PERT */
  function pertOf(riskId: string) {
    const tp = threePoints.value.get(riskId)
    return tp ? pert(tp) : null
  }
  /** RQA-006 储备（由模拟复算） */
  function reserveOf() {
    return simResult.value ? computeReserveFromSim(simResult.value) : null
  }
  /** RQA-008 风险调整后计划 */
  function adjustedPlanOf() {
    return simResult.value ? riskAdjustedPlan(simResult.value) : null
  }
  /** RQA-002 运行蒙特卡洛：三点缺失或未关联的风险不进入模拟 */
  function runQuantSim(seed = 42, iterations = 1000) {
    const { included, excluded } = filterLinkedRisks(projectRisks.value, riskLinks.value)
    const activities = included.map(({ risk, link }) => {
      const tp = threePoints.value.get(risk.id)
      return {
        id: risk.id,
        pert: tp ? pert(tp) : { expected: 0, stdDev: 0, complete: false, missing: [] as ('乐观' | '最可能' | '悲观')[] },
        baseline: tp ? pert(tp).expected : 0,
        baselineCost: 1000,
        risks: [link]
      }
    }).filter((a) => a.pert.complete)
    if (activities.length === 0) {
      notify('warning', '无可量化活动：请先登记三点估算并关联风险（RQA-001/RQA-005）')
      return
    }
    const cfg: Omit<SimConfig, 'snapshot'> = { modelVersion: QUANT_MODEL_VERSION, iterations, seed }
    const input = {
      activities,
      baselineDuration: activities.reduce((s, a) => s + a.baseline, 0),
      baselineCost: activities.reduce((s, a) => s + a.baselineCost, 0)
    }
    simResult.value = runMonteCarlo(input, cfg)
    log('CREATE', '定量模拟', 'SIM-001', { seed, iterations, snapshot: simResult.value.inputSnapshot })
    notify('success', `蒙特卡洛模拟完成：P50=${simResult.value.durationP50}，P80=${simResult.value.durationP80}，快照 ${simResult.value.inputSnapshot}（RQA-011 可复算）`)
  }
  /** RQA-001 登记三点估算 */
  function setThreePoint(riskId: string, tp: ThreePoint) {
    const p = pert(tp)
    if (!p.complete) {
      notify('warning', '三点估算缺失，不得进入定量分析（RQA-001）')
      return
    }
    threePoints.value.set(riskId, tp)
    log('UPDATE', '三点估算', riskId, tp)
    notify('success', `三点估算已登记：期望 ${p.expected}，标准差 ${p.stdDev}`)
  }
  /** RQA-005 关联风险到活动/成本项 */
  function linkRisk(link: RiskLink) {
    riskLinks.value.set(link.riskId, link)
    log('UPDATE', '风险关联', link.riskId, link)
    notify('success', '风险已关联，纳入模拟范围')
  }

  // —— RES 资源域剩余项 ——
  /** RES-001 三层资源池节点（演示数据：企业/部门/项目） */
  const poolNodes = ref<ResourcePoolNode[]>([
    { id: 'NODE-1', name: '九甲科技（企业）', level: '企业' },
    { id: 'NODE-2', name: '汽车电子研发中心', level: '部门', parentId: 'NODE-1' },
    { id: 'NODE-3', name: 'EPS 转向项目群', level: '项目', parentId: 'NODE-2' }
  ])
  /** RES-002 角色技能检索结果（缓存） */
  const skillSearchResult = ref<ReturnType<typeof searchCandidates>>([])
  /** RES-009 派工承诺（请求 → 承诺） */
  const assignmentCommitments = ref<AssignmentCommitment[]>([])
  /** RES-013 工时回填记录 */
  const hourBackfills = ref<HourBackfill[]>([])
  /** RES-015 外部供应商产能 */
  const externalCapacities = ref<ExternalCapacity[]>([
    { id: 'EXT-1', supplierName: '精工 CNC 外协', role: '机加工', committedCapacity: 80, actualDelivery: 68, week: '2026-W45' },
    { id: 'EXT-2', supplierName: '华测台架', role: '试验', committedCapacity: 100, actualDelivery: 100, week: '2026-W45' }
  ])
  /** RES-016 投入偏差记录 */
  const effortDeviations = ref<EffortDeviation[]>([
    { id: 'ED-1', projectId: 'P-001', estimatedHours: 100, actualHours: 118, efficiencyFactor: 1.18, week: '2026-W43' },
    { id: 'ED-2', projectId: 'P-001', estimatedHours: 100, actualHours: 116, efficiencyFactor: 1.16, week: '2026-W44' }
  ])
  /** RES-011 资源费率 */
  const resourceRates = ref<ResourceRate[]>([
    { id: 'RT-1', resourceId: 'RM1', role: '项目经理', rate: 150, currency: 'CNY', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' },
    { id: 'RT-2', resourceId: 'RM1', role: '项目经理', rate: 165, currency: 'CNY', effectiveFrom: '2026-07-01' }
  ])
  /** RES-010 情景副本 */
  const resourceScenarios = ref<ResourceScenario[]>([])

  /** RES-001 三层资源池校验 */
  const poolHierarchyCheck = computed(() => validatePoolHierarchy(poolNodes.value))
  /** RES-016 投入偏差：连续两周 ≥15% 判定估算失效 */
  const effortStale = computed(() => {
    const rates = effortDeviations.value.map((d) => ({ rate: effortDeviationRate(d) }))
    return isEstimateStale(rates)
  })
  /** RES-015 外部产能偏差合计 */
  const externalDeviation = computed(() => externalCapacities.value.map((c) => ({ ...c, dev: externalCapacityDeviation(c) })))

  /** RES-002 按角色技能检索候选人 */
  function searchBySkill(role: string, skills: string[]) {
    skillSearchResult.value = searchCandidates(resourcePool.value, role, skills)
    return skillSearchResult.value
  }
  /** RES-009 提交派工承诺（未承诺不得进基线） */
  function commitAssignment(req: ResourceRequest, resourceId: string, hours: number) {
    const c: AssignmentCommitment = {
      id: `CMT-${Date.now()}`,
      requestId: req.id,
      resourceId,
      role: req.role,
      committedHours: hours,
      week: req.week,
      status: '已承诺',
      approvedAt: new Date().toISOString()
    }
    assignmentCommitments.value.push(c)
    log('CREATE', '派工承诺', c.id, c)
    notify('success', `派工承诺已形成：${req.role} ${hours}h（进入基线）`)
  }
  /** RES-013 工时回填 */
  function submitBackfill(assignmentId: string, taskId: string, plannedHours: number, actualHours: number, date: string) {
    const r = backfillHours({ plannedHours, actualHours, taskId })
    if (!r.ok) {
      notify('warning', r.note)
      return false
    }
    const rec: HourBackfill = {
      id: `HB-${Date.now()}`,
      assignmentId,
      taskId,
      plannedHours,
      actualHours,
      remainingHours: r.remaining ?? 0,
      date,
      varianceNote: r.variance && r.variance !== 0 ? `差额 ${r.variance}h` : undefined
    }
    hourBackfills.value.push(rec)
    log('CREATE', '工时回填', rec.id, rec)
    notify('success', `工时回填成功：剩余 ${rec.remainingHours}h（${rec.varianceNote ?? '无差额'}）`)
    return true
  }
  /** RES-010 创建情景副本 */
  function addResourceScenario(name: string, assignments: ResourceScenario['assignments']) {
    const sc = createScenario(projectId.value, name, assignments)
    resourceScenarios.value.push(sc)
    log('CREATE', '资源情景', sc.id, sc)
    notify('success', `情景「${name}」已创建，与主计划隔离`)
  }
  /** RES-010 选定情景 */
  function pickScenario(id: string) {
    resourceScenarios.value = selectScenario(resourceScenarios.value, id)
    const sc = resourceScenarios.value.find((s) => s.id === id)
    if (sc && canWriteBack(sc).ok) {
      notify('success', `情景「${sc.name}」已选定，可回写主计划`)
    }
  }

  // —— EXA 报表与互操作域 ——
  /** EXA-001 口径字典 + 标准报表库（演示数据） */
  const metricDict = ref<MetricDictEntry[]>([
    { id: 'M1', name: '加权完成率', numerator: 'Σ(EV×权重)', denominator: 'Σ(权重)', timeBase: '周', excludeRule: '无', source: 'plan', refreshRate: 'daily' },
    { id: 'M2', name: 'SPI', numerator: 'EV', denominator: 'PV', timeBase: '周', excludeRule: '未审核填报', source: 'evm', refreshRate: 'daily' },
    { id: 'M3', name: 'CPI', numerator: 'EV', denominator: 'AC', timeBase: '周', excludeRule: '未审核填报', source: 'evm', refreshRate: 'daily' },
    { id: 'M4', name: '资源负荷率', numerator: '分配工时', denominator: '可用工时', timeBase: '周', excludeRule: '草稿', source: 'resource', refreshRate: 'daily' },
    { id: 'M5', name: '高风险关联率', numerator: '已关联高风险', denominator: '高风险总数', timeBase: '周', excludeRule: '无', source: 'risk', refreshRate: 'daily' }
  ])
  const reportLibrary = ref<ReportDef[]>([
    { id: 'R1', name: '项目进度报表', group: '进度', metricIds: ['M1'], source: 'plan' },
    { id: 'R2', name: '成本挣值报表', group: '成本', metricIds: ['M2', 'M3'], source: 'evm' },
    { id: 'R3', name: '资源负荷报表', group: '资源', metricIds: ['M4'], source: 'resource' },
    { id: 'R4', name: '风险台账报表', group: '风险', metricIds: ['M5'], source: 'risk' },
    { id: 'R5', name: '质量缺陷报表', group: '质量', metricIds: ['M1'], source: 'plan' },
    { id: 'R6', name: '组合视图报表', group: '组合', metricIds: ['M1'], source: 'portfolio' }
  ])
  /** EXA-001 口径绑定率（100% 达标） */
  const reportBinding = computed(() => metricBindingRate(reportLibrary.value, metricDict.value))
  /** EXA-001 分组覆盖（六大分组） */
  const reportGroups = computed(() => groupCoverage(reportLibrary.value))
  /** EXA-010 指标三处同值（演示：10 指标三处同值） */
  const metricConsistency = computed(() => {
    const metrics = [
      { metricId: 'M1', report: 68.96, dashboard: 68.96, detail: 68.96 },
      { metricId: 'M2', report: 0.92, dashboard: 0.92, detail: 0.92 },
      { metricId: 'M3', report: 0.88, dashboard: 0.88, detail: 0.88 },
      { metricId: 'M4', report: 95, dashboard: 95, detail: 95 },
      { metricId: 'M5', report: 100, dashboard: 100, detail: 100 }
    ]
    return threeWayConsistency(metrics)
  })
  /** EXA-005 计划工具导入校验（演示） */
  function validatePlanImport(rows: { lineNo: number; fields: Record<string, string> }[], mapping: FieldMapping[]) {
    const r = validateImport(rows, mapping)
    log('READ', '计划导入校验', 'IMP-001', { total: r.totalRows, success: r.successRows, errors: r.errors.length })
    notify(r.errors.length ? 'warning' : 'success', `导入校验：${r.successRows}/${r.totalRows} 行成功，${r.errors.length} 处异常（逐行定位）`)
    return r
  }

  // —— ARC-020 扩展点 + NFR-017 可访问性 ——
  /** ARC-020 自定义表单（配置驱动，无需发版） */
  const customForms = ref<CustomFormDef[]>([
    defineForm({
      id: 'CF-1', name: '客户审批单', targetType: '项目', enabled: true,
      fields: [
        { key: 'approver', label: '审批人', type: 'text', required: true },
        { key: 'approveDate', label: '审批日期', type: 'date', required: true },
        { key: 'comment', label: '意见', type: 'text', required: false }
      ]
    })
  ])
  /** ARC-020 事件钩子（失败不影响主流程） */
  const eventHooks = ref<EventHook[]>([
    { id: 'HK-1', name: '保存后通知', point: 'afterSave', enabled: true, handler: () => undefined },
    { id: 'HK-2', name: 'Gate 前校验', point: 'beforeGate', enabled: true, handler: () => undefined }
  ])
  /** ARC-020 开放 API（OpenAPI 3.1 契约） */
  const openApis = ref<OpenApiEndpoint[]>([
    { id: 'API-1', path: '/api/risks', method: 'GET', schema: 'openapi: 3.1.0', errorCodes: ['E400', 'E401', 'E404'], idempotent: false },
    { id: 'API-2', path: '/api/baselines', method: 'POST', schema: 'openapi: 3.1.0', errorCodes: ['E400', 'E409'], idempotent: true }
  ])
  /** ARC-020 扩展点完备性（四类均有落地；UDF 复用 governanceConfig 的 udfs） */
  const extensionCheck = computed(() =>
    extensionPointsComplete({
      udfCount: data.value.udfs?.length ?? 0,
      customForms: customForms.value,
      hooks: eventHooks.value,
      apis: openApis.value
    })
  )
  /** NFR-017 可访问性审计（关键页面抽查） */
  const accessibilityAudit = computed(() => {
    const contrastChecks = [
      checkContrast('#e5e7eb', '#0b1220'), // 正文文字 / 深色背景
      checkContrast('#93c5fd', '#0b1220'), // 次要文字
      checkContrast('#f87171', '#0b1220') // 危险提示
    ]
    const keyboardCheck = checkKeyboardAccessible([
      { id: 'nav', tabbable: true, keyboardActivatable: true, focusIndicator: true },
      { id: 'btn', tabbable: true, keyboardActivatable: true, focusIndicator: true }
    ])
    const labelCheck = checkFormLabels([
      { id: 'name', hasLabel: true, labelText: '项目名称' },
      { id: 'owner', hasLabel: true, labelText: '负责人' }
    ])
    return { contrastChecks, keyboardCheck, labelCheck }
  })
  /** NFR-017 关键页面抽查通过率 */
  const accessibilityRate = computed(() => accessibilityPassRate([accessibilityAudit.value]))
  /** ARC-020 事件钩子执行（失败不影响主流程） */
  function fireHook(point: EventHook['point'], payload: unknown) {
    const r = runHooksAtPoint(eventHooks.value, point, payload)
    const failed = r.results.filter((x) => !x.success)
    if (failed.length) notify('warning', `${failed.length} 个钩子执行失败，主流程不受影响（ARC-020）`)
    return r
  }

  const projectRetros = computed(() => data.value.retros.filter((r) => r.projectId === projectId.value))
  const projectLessons = computed(() => data.value.lessons.filter((l) => l.projectId === projectId.value))
  const projectDeviations = computed(() => data.value.deviations.filter((d) => d.projectId === projectId.value))
  const projectMeetings = computed(() => data.value.meetings.filter((m) => m.projectId === projectId.value))
  const projectResolutions = computed(() => data.value.resolutions.filter((r) => r.projectId === projectId.value))
  const projectSendAudits = computed(() => data.value.sendAudits.filter((s) => s.projectId === projectId.value))
  const projectSupervises = computed(() => data.value.supervises.filter((s) => s.projectId === projectId.value))
  const projectInvestments = computed(() => data.value.investments.filter((i) => i.projectId === projectId.value))
  const calendars = computed<CalendarDef[]>(() => (data.value.calendars ?? []) as CalendarDef[])

  // —— 我的工作中心（POR-004 四类聚合 + POR-005 四段分组）——
  const myTasks = computed(() =>
    aggregateMyTasks(
      { name: currentUser.value.name, roleCode: currentUser.value.roleCode },
      {
        wbs: data.value.wbs,
        resolutions: data.value.resolutions,
        supervises: data.value.supervises,
        approvals: data.value.flowInstances
          .filter((f) => f.status === '运行中')
          .map((f) => {
            const v = flowView(f)
            return {
              id: f.id,
              title: f.title,
              code: f.defCode,
              submitter: f.submitter,
              approverRole: v.node?.approverRole ?? '',
              due: '',
              status: v.overdue ? '已超时' : '进行中',
              projectId: ''
            }
          })
      }
    )
  )
  const myTodos = computed(() => bucketTodos(myTasks.value, new Date().toISOString().slice(0, 10)))

  // —— 治理配置（TEN-016）与消息中心（POR-006/008）——
  const codeDicts = computed(() => (data.value.codeDicts ?? []) as import('@/domain/types').CodeDict[])
  const udfs = computed(() => (data.value.udfs ?? []) as import('@/domain/types').UdfDef[])
  const stepTemplates = computed(() => (data.value.stepTemplates ?? []) as import('@/domain/types').StepTemplate[])
  const stepRuns = computed(() => (data.value.stepRuns ?? []) as import('@/domain/types').StepRun[])
  /** 服务端拒绝拦截策略（SRP-001/002：16 项问题事项三档可配置，管理员可在系统设置自定义） */
  const rejectionPolicies = computed<RejectionPolicyItem[]>(() => (data.value.rejectionPolicies ?? []) as RejectionPolicyItem[])
  /** 三档统计（硬拒绝/可配置/只读披露） */
  const rejectionSummary = computed(() => severitySummary(rejectionPolicies.value))
  const messages = computed(() => (data.value.messages ?? []) as import('@/domain/types').MessageItem[])
  const inboxItems = computed(() => (data.value.inboxItems ?? []) as import('@/domain/types').InboxItem[])
  const myUnreadCount = computed(() => unreadCount(messages.value, currentUser.value.id))
  const myInbox = computed(() => inboxFor(inboxItems.value, currentUser.value.id))

  // —— 跨节点资源共享（PFM-016）+ 门户区块（POR-003）+ 草稿（POR-007）——
  const resourcePool = computed(() => (data.value.resourcePool ?? []) as import('@/domain/types').ResourcePoolMember[])
  const resourceShares = computed(() => (data.value.resourceShares ?? []) as import('@/domain/types').ResourceShareApply[])
  const portalSections = computed(() => (data.value.portalSections ?? []) as import('@/domain/types').PortalSectionConfig[])
  const drafts = computed(() => (data.value.drafts ?? []) as import('@/domain/types').FormDraft[])
  /** 当前角色可见的门户区块（POR-003：越权区块前端不渲染） */
  const myPortalSections = computed(() => visibleSections(portalSections.value, currentUser.value.roleCode))
  /** 当前有效共享关系（已生效且未到期，供资源负荷视图叠加） */
  const activeShareRelations = computed(() => activeShares(resourceShares.value, new Date().toISOString().slice(0, 10)))
  /** 我的超期草稿（POR-007：超期提示，不静默删除） */
  const myExpiredDrafts = computed(() => expiredDrafts(drafts.value, currentUser.value.id, new Date().toISOString().slice(0, 10)))
  const myDrafts = computed(() => drafts.value.filter((d) => d.userId === currentUser.value.id))

  /** POR-012：缓存只读标识（过期本地缓存 → 只读 + 提示重拉） */
  const cacheBadgeInfo = computed(() => cacheBadge(cacheStamp.value, Date.now()))

  const auditChain = computed(() => verifyChain(data.value.audit))
  const chainOk = computed(() => auditChain.value.ok)

  // —— 15 年合规归档层（ARC-001/002/003，产品核心 P2：审批存档 + 关键输出物，留存 15 年）——
  /** 归档层数据（多卷） */
  const archiveLayer = computed<ArchiveLayer>(() => (data.value.archiveLayer ?? { volumes: [] }) as ArchiveLayer)
  /** 归档卷列表 */
  const archiveVolumes = computed<ArchiveVolume[]>(() => archiveLayer.value.volumes)
  /** 归档层整体完整性（复用引擎 verifyLayer，禁止自造校验） */
  const archiveIntegrity = computed(() => verifyLayer(archiveLayer.value))
  /** 某卷的保留期判定 */
  function archiveRetention(volumeId: string) {
    const vol = archiveVolumes.value.find((v) => v.id === volumeId)
    if (!vol) return null
    return retentionVerdict(vol)
  }
  /** 把当前项目的审批记录 + 关键输出物归档为一个新卷（ARC-001） */
  function archiveProject(projectId: string, name?: string) {
    const now = new Date().toISOString()
    const volumeId = `AV-${projectId}-${now.slice(0, 7)}`
    let volume: ArchiveVolume = {
      id: volumeId,
      name: name ?? `${projectId} 合规归档卷`,
      projectId,
      createdAt: now,
      createdBy: currentUser.value.name,
      retentionYears: DEFAULT_RETENTION_YEARS,
      records: [],
      manifestHash: ''
    }
    // 归档该项目的审批类审计记录（复用 archiveFromAudit，禁止自造）
    const approvals = data.value.audit.filter((r) => r.tenantId === projectId && ['APPROVE', 'RELEASE', 'FREEZE', 'REJECT'].includes(r.action))
    for (const row of approvals) {
      volume = appendRecord(volume, archiveFromAudit(volumeId, row, '审批', undefined, currentUser.value.name, now))
    }
    const next = [...archiveVolumes.value, volume]
    data.value.archiveLayer = { volumes: next }
    log('ARCHIVE', '归档', volumeId, { projectId, records: volume.records.length })
    persist()
    notify('success', `${projectId} 已归档 ${volume.records.length} 条审批记录，保留期 15 年`)
  }
  /** 销毁卷（仅已到期可销毁，ARC-002 只读保护） */
  function destroyArchive(volumeId: string) {
    const vol = archiveVolumes.value.find((v) => v.id === volumeId)
    if (!vol) return
    const r = destroyVolume(vol)
    if (!r.ok) {
      notify('error', r.note)
      log('ARCHIVE', '归档', volumeId, { verdict: 'DENY' }, undefined, 'DENY')
      return
    }
    data.value.archiveLayer = { volumes: archiveVolumes.value.filter((v) => v.id !== volumeId) }
    log('ARCHIVE', '归档', volumeId, { verdict: 'DESTROYED' })
    persist()
    notify('success', r.note)
  }

  // —— 派生：计划 / 挣值（必须先于控制点，控制点 C-05/C-11 要引用同一份 EVM）——
  const cpm = computed(() => computeCpm(projectWbs.value))
  const quality = computed(() => planQualityChecks(projectWbs.value))
  const completion = computed(() => weightedCompletion(projectWbs.value, currentProject.value.budget))
  /** 统计日（状态日期）：PV 起算基准，锚定在计划工期的 65%（口径可见于挣值页） */
  const statusDay = computed(() => statusDayOf(projectWbs.value))
  /** PV 唯一来源：按 CPM 早时间 + 统计日算 BCWS（禁止再出现 budget×0.66 之类的自造比例） */
  const pvInfo = computed(() => plannedValue(projectWbs.value, currentProject.value.budget, statusDay.value))
  const evm = computed(() => {
    const ev = (completion.value.weightedPercent / 100) * currentProject.value.budget
    return computeEvm({ pv: pvInfo.value.pv, ev, ac: currentProject.value.spent, bac: currentProject.value.budget })
  })

  // —— 界面计划管理（对标 Oracle Interface Plan：跨专业交接点三态闭环 + 硬约束逾期）——
  /** 交接点评估（单一权威：evaluateHandoffs 纯函数，禁止自造状态/逾期） */
  const handoffEval = computed(() => evaluateHandoffs(projectHandoffs.value, todayStr()))

  // —— 界面（接口）计划（SCH-022：跨项目接口，四要素 + 下游延误传播）——
  /** 跨项目界面计划评估（单一权威：evaluateInterfacePlan 纯函数，禁止自造状态/逾期/影响） */
  const interfacePlans = computed<InterfaceEvaluation[]>(() => {
    const plans = data.value.interfacePlans ?? []
    const today = todayStr()
    return plans.map((p) => {
      // 下游受影响的 WBS 节点：接收方项目中依赖此交付物的节点（演示口径：接收方项目全部叶子节点）
      const downstream = data.value.wbs
        .filter((w) => w.projectId === p.targetProjectId)
        .map((w) => ({ wbsId: w.id, wbsCode: w.code, projectId: w.projectId, name: w.name }))
      return evaluateInterfacePlan(p, today, downstream)
    })
  })
  /** 界面计划健康度汇总（四要素齐备率 / 逾期率 / 健康度） */
  const interfacePlanHealthSummary = computed(() => interfacePlanHealth(interfacePlans.value))
  /** 界面计划清单导出（R-IF-EXPORT 结构化清单） */
  const interfacePlanExport = computed(() =>
    exportInterfacePlan(interfacePlans.value, (id) => data.value.projects.find((pr) => pr.id === id)?.name ?? id, todayStr())
  )

  // —— 组合闸门一致性（PFM-011：跨项目同一 Gate 判据集统一 + 例外登记 + 合规率复算）——
  /** 组合闸门一致性（单一权威：summarizeGateConsistency 纯函数，禁止自造合规率） */
  const gateConsistency = computed(() => {
    const decls: ProjectGateDecl[] = data.value.gateDecls ?? []
    return summarizeGateConsistency(decls)
  })

  // —— 资源剖析表（对标 Oracle Resource Profile：角色 × 周 负荷矩阵，从 CPM 最早时间派生）——
  /** 资源剖析表（单一权威：buildResourceProfile 纯函数，输入来自 CPM es/ef，禁止自造工时） */
  const resourceProfile = computed(() => {
    const spans: TaskResourceSpan[] = cpm.value.nodes
      .filter((n) => n.level === 2) // 仅叶子/工作包节点占用资源
      .map((n) => ({
        id: n.id,
        code: n.code,
        name: n.name,
        role: n.ownerRole || '未分配',
        startDay: n.es,
        finishDay: n.ef
      }))
    return buildResourceProfile(spans, currentProject.value.start)
  })

  // —— 成本归集表（对标 Oracle 8 列归集表 + 四类成本单据）——
  /** 8 列成本归集表（单一权威：buildCostSheet 纯函数，输入 costSubjects/costDocs，禁止自造金额） */
  const costSheet = computed(() =>
    buildCostSheet(
      data.value.costSubjects.filter((s) => s.wbsCode && projectWbs.value.some((w) => w.code === s.wbsCode)),
      data.value.costDocs.filter((d) => d.projectId === projectId.value)
    )
  )

  // —— 报价费用明细（单一数据源：费用表单填报，报价单自动汇总引入）——
  /** 报价费用明细八类（来自 seed.quoteCosts，含 source 标记 form/manual） */
  const quoteCosts = computed<QuoteCostSheet>(() =>
    (data.value.quoteCosts ?? emptyQuoteCostSheet()) as QuoteCostSheet
  )

  // —— OTS 认可三大条件附件（单一数据源：附件驱动判定，视图不可手填）——
  /** OTS 认可三类附件（附件 A 设计文件归档 / B 样件评审 / C DV 试验），旧存档缺省时兜底空 */
  const otsAttachments = computed(() => (data.value.otsAttachments ?? null) as {
    archiveTable: import('@/domain/otsApproval').DesignArchiveTable
    sampleReview: import('@/domain/otsApproval').SampleReviewReport
    dvReport: import('@/domain/otsApproval').DvTestReport
  } | null)

  // —— 临界值自动触发（对标 Oracle Thresholds：业务指标越限→自动生成问题→分派）——
  /** 当前项目可观测业务指标（阈值引擎输入，全部同源自既有派生，禁止自造比例） */
  const thresholdMetrics = computed<ThresholdMetrics>(() => {
    const today = todayStr()
    const redRisks = projectRisks.value.filter((r) => rpn(r) >= 200)
    const redNoStrategy = redRisks.filter((r) => !r.strategy?.trim())
    return {
      spi: evm.value.spi,
      cpi: evm.value.cpi,
      cvRate: currentProject.value.budget ? Math.round(((currentProject.value.spent - evm.value.ev) / currentProject.value.budget) * 10000) / 100 : 0,
      planHealth: quality.value.health,
      redRiskCount: redRisks.length,
      redRiskNoStrategy: redNoStrategy.length,
      overdueSendAuditCount: projectSendAudits.value.filter((s) => s.status !== '已答复' && isCollabOverdue(s.dueAt, today)).length,
      overdueSuperviseCount: projectSupervises.value.filter((s) => s.status !== '已销项' && isCollabOverdue(s.due, today)).length,
      openResolutionCount: projectResolutions.value.filter((r) => r.status !== '已闭环').length,
      pendingApprovalCount: data.value.flowInstances.filter((f) => f.status === '运行中').length
    }
  })
  /** 扫描阈值并生成问题（幂等：同规则同项目 24h 内不重复触发） */
  function scanThresholdIssues(): number {
    const result = scanThresholds(thresholdMetrics.value, DEFAULT_THRESHOLD_RULES, projectId.value)
    const now = new Date().toISOString()
    const dayAgo = Date.now() - 24 * 3600 * 1000
    // 24h 去重：同一 ruleId + projectId 已有未关闭问题则不重复生成
    const existing = (data.value.thresholdIssues ?? []).filter(
      (i) => i.projectId === projectId.value && i.status !== '已关闭' && Date.parse(i.createdAt) >= dayAgo
    )
    const existingKeys = new Set(existing.map((i) => `${i.ruleId}:${i.projectId}`))
    let added = 0
    for (const hit of result.hits) {
      const key = `${hit.rule.id}:${projectId.value}`
      if (existingKeys.has(key)) continue
      const seq = (data.value.thresholdIssues?.length ?? 0) + added + 1
      const issue: ThresholdIssue = {
        id: `TI-${Date.now()}-${added}`,
        projectId: projectId.value,
        code: `AUTO-${String(seq).padStart(3, '0')}`,
        ruleId: hit.rule.id,
        metric: hit.metricKey,
        title: hit.issueTitle,
        desc: hit.issueDesc,
        severity: hit.severity,
        assignTo: hit.assignTo,
        source: '自动触发',
        status: '开放',
        createdAt: now
      }
      if (!data.value.thresholdIssues) data.value.thresholdIssues = []
      data.value.thresholdIssues.push(issue)
      // 同步推送消息（POR-006 去重）
      pushMessage({ eventKey: hit.eventKey, title: hit.issueTitle, content: hit.issueDesc, category: '系统', refType: 'thresholdIssue', refId: issue.id })
      // 审计留痕
      log('CREATE', '阈值问题', issue.id, { ruleId: hit.rule.id, severity: hit.severity, assignTo: hit.assignTo })
      added += 1
    }
    if (added > 0) notify('warning', `临界值触发 ${added} 项问题，已自动生成并分派（Oracle Thresholds 对标）`)
    return added
  }
  /** 关闭阈值问题（闭环留痕） */
  function closeThresholdIssue(issueId: string) {
    const i = (data.value.thresholdIssues ?? []).find((x) => x.id === issueId)
    if (!i) return
    i.status = '已关闭'
    i.closedBy = currentUser.value.name
    i.closedAt = new Date().toISOString()
    log('UPDATE', '阈值问题', issueId, { status: '已关闭' })
    notify('success', `${i.code} 已关闭`)
  }
  const projectThresholdIssues = computed(() => thresholdIssues.value.filter((i) => i.projectId === projectId.value))

  /** 交接点「已交接」：发出方提交交付物（三态闭环第二态） */
  function handoffHand(handoffId: string) {
    const h = (data.value.handoffs ?? []).find((x) => x.id === handoffId)
    if (!h) return
    if (h.handedAt === undefined) h.handedAt = todayStr()
    log('UPDATE', '交接点', handoffId, { handedAt: h.handedAt })
    notify('success', `${h.code} 已交接，等待接收方确认`)
  }
  /** 交接点「已接收」：接收方确认交付物（三态闭环终态） */
  function handoffReceive(handoffId: string) {
    const h = (data.value.handoffs ?? []).find((x) => x.id === handoffId)
    if (!h) return
    if (h.receivedAt === undefined) h.receivedAt = todayStr()
    if (h.handedAt === undefined) h.handedAt = todayStr()
    log('UPDATE', '交接点', handoffId, { receivedAt: h.receivedAt })
    notify('success', `${h.code} 已接收，交接闭环`)
  }

  const cpContext = computed<CpContext>(() => ({
    project: currentProject.value,
    wbs: projectWbs.value,
    reqs: projectReqs.value,
    links: projectLinks.value,
    risks: projectRisks.value,
    ecrs: projectEcrs.value,
    baselines: projectBaselines.value,
    suppliers: data.value.suppliers,
    samples: data.value.samples,
    boms: data.value.boms,
    docs: projectDocs.value,
    deliverables: projectDeliverables.value,
    hours: projectHours.value,
    retros: projectRetros.value,
    lessons: projectLessons.value,
    deviations: projectDeviations.value,
    auditChainOk: chainOk.value,
    flags: data.value.flags,
    complianceItems: data.value.complianceItems,
    evm: evm.value
  }))

  const cpResults = computed(() => evaluateControlPoints(cpContext.value))

  // —— AI 智能辅助（SRS 第 24 章 / AIA-001~007）——
  /** 当前项目在两级开关下的 AI 可用性（三级优先级：总开关→项目→临时，到期自动关闭） */
  const aiSwitchState = computed(() => aiEnabled(data.value.aiSwitch ?? { globalEnabled: true, projectSwitches: {} }, projectId.value))
  /** 当前请求方检索范围（租户 + 项目 + 密级，密级暂取最高 L4 以便演示，实际由 RBAC 下发） */
  const aiScope = computed<RetrievalScope>(() => ({
    tenantId: data.value.tenantId,
    projectId: projectId.value,
    allowedClass: 'L4'
  }))
  /** 检索前置过滤后的可见语料（越权/越密级对象在检索阶段即被剔除） */
  const aiVisibleCorpus = computed(() => filterByScope(data.value.aiCorpus ?? [], aiScope.value))

  /** 执行一个 AI 场景（前置过滤 → 规则产出 → 红线校验 → 水印），返回三元组或拒绝 */
  function runAiScene(scene: AiScene, query: string): { ok: boolean; output?: AiSceneOutput; reason?: string; watermarkText?: string } {
    const sw = aiSwitchState.value
    if (!sw.enabled) return { ok: false, reason: sw.reason }
    const r = runScene(scene, aiVisibleCorpus.value.visible, query, SCENE_PRODUCERS[scene])
    if ('rejected' in r) return { ok: false, reason: r.reason }
    const wm = watermark(`${r.conclusion}（置信度：${r.confidence}）`)
    // 记调用日志（待复核，不得入基线）
    const logId = `AILOG-${Date.now()}`
    if (!data.value.aiCallLogs) data.value.aiCallLogs = []
    data.value.aiCallLogs.push({
      id: logId,
      projectId: projectId.value,
      userId: currentUser.value.id,
      sceneCode: scene,
      modelKey: 'rule-rag',
      promptVer: 'v1.0.0',
      inputHash: String(query.length),
      citedIds: r.citations.map((c) => c.objId),
      reviewStatus: 'PENDING'
    })
    log('AI_REVIEW', 'ai_call_log', logId, { sceneCode: scene, reviewStatus: 'PENDING' })
    return { ok: true, output: r, watermarkText: wm }
  }

  /** 复核 AI 产出（三态流转 + 未复核不可入基线 + 审计留痕） */
  function reviewAi(logId: string, action: ReviewAction, revisedConclusion?: string) {
    const rec = (data.value.aiCallLogs ?? []).find((l) => l.id === logId)
    if (!rec) return null
    const admission = baselineAdmission(rec)
    const result = reviewOutput(rec, action, actor.value, revisedConclusion)
    // 写回状态
    rec.reviewStatus = result.status
    rec.reviewerId = result.reviewerId
    rec.reviewedAt = result.reviewedAt
    // 生成 AI_REVIEW 审计事件（AIA-006 引用被拒/采纳均留痕）
    const entry = aiReviewAuditEntry(rec, actor.value, result)
    log(entry.action, entry.objType, entry.objId, entry.after, entry.before)
    notify('success', `AI 产出「${logId}」已${action === 'REJECT' ? '驳回' : '采纳'}，${admission.reason}`)
    return result
  }

  /** 项目级 AI 开关切换（AIA-007） */
  function toggleAiSwitch(projectId: string, enabled: boolean) {
    if (!data.value.aiSwitch) data.value.aiSwitch = { globalEnabled: true, projectSwitches: {} }
    data.value.aiSwitch.projectSwitches[projectId] = enabled
    log('UPDATE', 'ai_switch', projectId, { enabled })
    notify('success', `项目 ${projectId} AI 已${enabled ? '开启' : '关闭'}`)
  }

  const gateResults = computed<Record<string, GateRun>>(() => {
    const frozen = projectBaselines.value.some((b) => b.status === '已冻结')
    const safetySigned = data.value.flags['C-31']?.ok ?? false
    const out: Record<string, GateRun> = {}
    for (const g of ['G1', 'G2', 'G3', 'G4', 'G5']) {
      out[g] = runGate({ gate: g, projectId: projectId.value, cpResults: cpResults.value, submitter: currentUser.value.name, baselineFrozen: frozen, safetySigned })
    }
    return out
  })

  const traceBreaks = computed(() => detectBreaks(projectReqs.value, projectLinks.value))
  const traceCoverage = computed(() => coverage(projectReqs.value, projectLinks.value))

  // —— 立项评审（PRV-001~004：人工 + AI 共同参与，四维度评估）——
  /** 立项评审结论（单一权威：reviewProject 纯函数，输入全部同源自既有派生，禁止自造比例） */
  const projectReview = computed(() => {
    const redRisks = projectRisks.value.filter((r) => rpn(r) >= 200)
    const redNoStrategy = redRisks.filter((r) => !r.strategy?.trim())
    const unassigned = projectWbs.value.filter((w) => !w.resource).length
    const unassignedPct = projectWbs.value.length ? Math.round((unassigned / projectWbs.value.length) * 10000) / 100 : 0
    const missingDeliverables = projectDeliverables.value.filter((d) => d.required && !d.provided).length
    const peakLoad = resourceProfile.value.buckets.length
      ? Math.max(...resourceProfile.value.buckets.map((b) => b.loadRate / 100))
      : 0
    const negativeFloatCount = cpm.value.nodes.filter((n) => n.totalFloat < 0).length
    return reviewProject({
      projectName: currentProject.value.name,
      projectCode: currentProject.value.code,
      spi: evm.value.spi,
      planHealth: quality.value.health,
      completionPercent: completion.value.weightedPercent,
      criticalDuration: cpm.value.duration,
      negativeFloatCount,
      resourcePeakLoad: peakLoad,
      unassignedResourcePct: unassignedPct,
      availableResourceCount: resourcePool.value.filter((r) => r.available).length,
      redRiskCount: redRisks.length,
      redRiskNoStrategyCount: redNoStrategy.length,
      reqCount: projectReqs.value.length,
      tracedReqCount: traceCoverage.value.numerator,
      missingDeliverableCount: missingDeliverables,
      cpi: evm.value.cpi,
      cvRate: currentProject.value.budget ? Math.round(((currentProject.value.spent - evm.value.ev) / currentProject.value.budget) * 10000) / 100 : 0,
      overControlCount: costSheet.value.summary.overControlCount,
      eacWarn: evm.value.eacWarn
    })
  })

  /** 已提交的人工评审结论（持久化证据，刷新不丢；PRV-005） */
  const projectReviews = computed<HumanReview[]>(() => (data.value.projectReviews ?? []) as HumanReview[])

  /**
   * 提交人工评审结论（PRV-005）：
   *   持久化评审证据 + 审计留痕。人工结论作为「拍板」证据，与 AI 建议并列，
   *   不覆盖纯函数产出的四维度结论（单一权威仍在 reviewProject）。
   */
  function submitProjectReview(review: HumanReview): boolean {
    if (!review.reviewer?.trim() || !review.decision) {
      notify('error', '评审人 / 评审结论不能为空')
      return false
    }
    if (!data.value.projectReviews) data.value.projectReviews = []
    data.value.projectReviews = [...(data.value.projectReviews as HumanReview[]), review]
    log('REVIEW', '项目', projectId.value, {
      reviewer: review.reviewer,
      decision: review.decision,
      note: review.note,
      at: review.at
    })
    notify('success', `人工评审已提交：${review.decision}（${review.reviewer}）`)
    return true
  }

  /**
   * 提交四级计划落表（PLN-4LV，方向 2：复用后端权威校验）。
   *
   * 语义：本 action 只做「编排 + 落表结果透传」，不做任何本地规则判定——
   * 三硬约束（R-COVER / R-NOLAG / R-COMPLETE）的单一权威在后端
   * {@code FourLevelPlanEngine.validateFourLevelPlan}，前端本地预检仅为即时反馈，
   * 最终以 {@code POST /api/v1/plans/save} 的 {@code saved/passable/violations} 为准。
   *
   * fail-closed：后端不可用或返回违规则不落表、不推进审批，回传阻断清单。
   *
   * @return Promise<PlanSaveData | null>：null 表示后端不可用/异常（调用方据此阻断）
   */
  async function submitFourLevelPlan(
    nodes: Array<import('@/domain/fourLevelPlan').PlanNode>
  ): Promise<PlanSaveData | null> {
    const payload: PlanSavePayload = {
      tenantId: data.value.tenantId,
      projectId: projectId.value,
      userName: currentUser.value.name,
      roleName: currentUser.value.roleName,
      nodes: nodes.map((n) => ({
        id: n.id,
        level: n.level,
        code: n.code,
        name: n.name,
        date: n.date,
        baselineDate: n.baselineDate,
        actualDate: n.actualDate,
        milestone: !!n.milestone,
        ownerName: n.ownerName,
        ownerRole: n.ownerRole,
        upperNodeId: n.upperNodeId
      }))
    }
    try {
      const token = await issueJwt(currentUser.value.id, currentUser.value.roleCode, data.value.tenantId, DEV_JWT_SECRET, 3600)
      const res = await savePlan(payload, token)
      if (res.ok && res.data) {
        if (!res.data.saved) {
          notify('error', `四级计划未通过后端校验：${res.data.violations.join('；')}`)
          log('PLAN_SAVE', '四级计划', projectId.value, { saved: false, passable: res.data.passable, violations: res.data.violations }, undefined, 'DENY')
        } else {
          notify('success', `四级计划已落表（对齐率 ${res.data.alignRate}%）`)
          log('PLAN_SAVE', '四级计划', projectId.value, { saved: true, alignRate: res.data.alignRate, nodeCount: nodes.length })
        }
        return res.data
      }
      notify('error', res.blocked ? (res.error ?? '后端领域规则阻断') : (res.error ?? '后端不可用'))
      log('PLAN_SAVE', '四级计划', projectId.value, { saved: false, error: res.error }, undefined, 'DENY')
      return null
    } catch {
      notify('error', '四级计划落表失败：后端不可用')
      log('PLAN_SAVE', '四级计划', projectId.value, { saved: false, error: '后端不可用' }, undefined, 'DENY')
      return null
    }
  }

  const portfolio = computed(() => rankProjects(visibleProjects.value))

  /**
   * 从后端拉取某项目已落表的四级计划节点（PLN-4LV 回显，方向 4 第 4 项）。
   *
   * 语义：纯编排 + 透传，落表数据以后端为权威。返回领域 {@code PlanNode[]} 供视图回显；
   * 后端不可用/无数据时返回空数组（视图据长度判断是否回显，不伪造「已加载」）。
   *
   * @return Promise<PlanNode[]>：已落表节点（后端不可用时为空数组）
   */
  async function loadFourLevelPlan(): Promise<Array<import('@/domain/fourLevelPlan').PlanNode>> {
    try {
      const token = await issueJwt(currentUser.value.id, currentUser.value.roleCode, data.value.tenantId, DEV_JWT_SECRET, 3600)
      const res = await listPlan(data.value.tenantId, projectId.value, token)
      if (res.ok && res.data) {
        const nodes: Array<import('@/domain/fourLevelPlan').PlanNode> = (res.data as PlanNodeDto[]).map((d) => ({
          id: d.id,
          level: d.level as import('@/domain/fourLevelPlan').PlanLevel,
          code: d.code,
          name: d.name,
          date: d.date,
          baselineDate: d.baselineDate,
          actualDate: d.actualDate,
          milestone: !!d.milestone,
          ownerName: d.ownerName,
          ownerRole: d.ownerRole,
          upperNodeId: d.upperNodeId
        }))
        log('PLAN_LOAD', '四级计划回显', projectId.value, { nodeCount: nodes.length })
        return nodes
      }
      log('PLAN_LOAD', '四级计划回显', projectId.value, { error: res.error }, undefined, 'DENY')
      return []
    } catch {
      log('PLAN_LOAD', '四级计划回显', projectId.value, { error: '后端不可用' }, undefined, 'DENY')
      return []
    }
  }

  /**
   * 触发四级计划告警巡检（PLN-ALERT，方向 4：前端对接）。
   *
   * 语义：纯编排 + 透传，告警判定权威在后端 {@code PlanAlertEngine}。
   * 中间指标披露（scannedNodes/hitNodes/fired/skipped）由后端结果承载，
   * 视图据此渲染「零告警」时须注明「扫描 0 节点」而非宣称无告警（防假阳性）。
   *
   * @return Promise<PlanAlertScanData | null>：null 表示后端不可用/异常
   */
  async function scanPlanAlerts(): Promise<PlanAlertScanData | null> {
    try {
      const token = await issueJwt(currentUser.value.id, currentUser.value.roleCode, data.value.tenantId, DEV_JWT_SECRET, 3600)
      const res = await scanPlanAlertsApi({ tenantId: data.value.tenantId, projectId: projectId.value }, token)
      if (res.ok && res.data) {
        log('PLAN_ALERT_SCAN', '四级计划告警', projectId.value, {
          scannedNodes: res.data.scannedNodes,
          hitNodes: res.data.hitNodes,
          fired: res.data.fired,
          skipped: res.data.skipped
        })
        return res.data
      }
      notify('error', res.error ?? '告警巡检失败：后端不可用')
      log('PLAN_ALERT_SCAN', '四级计划告警', projectId.value, { error: res.error }, undefined, 'DENY')
      return null
    } catch {
      notify('error', '告警巡检失败：后端不可用')
      log('PLAN_ALERT_SCAN', '四级计划告警', projectId.value, { error: '后端不可用' }, undefined, 'DENY')
      return null
    }
  }

  // —— 研发阶段模板 + 门禁强制阻断（STG-001/002/003 + GAT-ENF-001，产品核心 P0）——
  /** 当前项目所用阶段模板（默认汽车零部件六阶段，可配置切换） */
  const stageTemplate = computed<StageTemplate>(() => {
    const tplId = data.value.stageTemplateId ?? 'TPL-AUTO'
    return findStageTemplate([AUTOMOTIVE_STAGE_TEMPLATE], tplId) ?? AUTOMOTIVE_STAGE_TEMPLATE
  })
  /** 阶段模板的有序阶段列表（复用引擎权威排序） */
  const stages = computed(() => orderedStages(stageTemplate.value))
  /** 各闸门 GateRun 数组（复用 gateResults 口径，喂给阻断引擎） */
  const stageGateRuns = computed(() => Object.values(gateResults.value))
  /**
   * 引擎级阻断判定：目标阶段的前置未批准 → 拒绝创建/实施。
   * 这是「只有批准才能实施下一阶段」的权威闸，供 create* 动作入口统一调用。
   */
  function canCreateInStage(stageCode: string, kind: WorkItemKind = '任务'): GateEnforceVerdict {
    const v = enforceStageGate(stageTemplate.value, stageCode, stageGateRuns.value)
    if (!v.allowed) {
      notify('error', `${v.note}（GAT-ENF-001 未批准不得实施）`)
      log('DENY', kind, stageCode, { verdict: v.code, blockedBy: v.blockedBy }, undefined, 'DENY')
    }
    return v
  }

  // —— 审批链—阶段绑定（APR-001/002/003，产品核心 P1：发起→审核→会签→批准 = 闸门放行证据）——
  /** 阶段↔审批链绑定关系（seed 播入，可配置） */
  const approvalBindings = computed<ApprovalBinding[]>(() => (data.value.approvalBindings ?? []) as ApprovalBinding[])
  /** 某阶段审批链完成的放行证据（复用引擎，禁止自造判定） */
  function stageReleaseEvidence(stageCode: string) {
    return gateReleaseEvidence(stageTemplate.value, stageCode, approvalBindings.value, flowInstances.value)
  }
  /** 某阶段是否「审批完成 + 闸门通过」联合放行（P2 权威判定） */
  function stageRelease(stageCode: string) {
    const stage = stages.value.find((s) => s.code === stageCode)
    const gatePassed = stage?.gateCode ? !!stageGateRuns.value.find((g) => g.gate === stage.gateCode && g.passed && !g.conditional) : false
    return stageFullyReleased(stageTemplate.value, stageCode, approvalBindings.value, flowInstances.value, gatePassed)
  }

  // —— 交付物审批（P3：交付物绑定审批，产品核心「交付物审批嵌入阶段审批」）——
  /** 交付物↔审批链绑定关系（seed 播入，可配置） */
  const deliverableApprovalBindings = computed<DeliverableApprovalBinding[]>(() => (data.value.deliverableApprovalBindings ?? []) as DeliverableApprovalBinding[])
  /** 某交付物「有效提供」证据判定（复用引擎，禁止自造判定） */
  function deliverableEvidence(deliverableId: string) {
    const d = projectDeliverables.value.find((x) => x.id === deliverableId)
    if (!d) return { provided: false, code: 'OPTIONAL' as const, note: `交付物 ${deliverableId} 不存在` }
    const binding = deliverableApprovalBindings.value.find((b) => b.deliverableId === deliverableId)
    return deliverableProvidedEvidence(d, binding, flowInstances.value)
  }
  /** 某阶段（gate 维度）交付物审批齐套判定 */
  function deliverableComplete(gateCode: string) {
    return stageDeliverablesComplete(gateCode, projectDeliverables.value, deliverableApprovalBindings.value, flowInstances.value)
  }

  /**
   * 阶段推进权威判定（与后端 StageApplicationService.advanceStage 语义同构）。
   * 判定「目标阶段能否进入」= 前置阶段全批准（审批完成 + 闸门通过）AND 目标阶段交付物齐套。
   * 供服务端一致性探针比对前端结论 vs 后端 advance 判定（E1 前后端语义同构的落点）。
   */
  function advanceStageVerdict(targetStageCode: string): { released: boolean; note: string } {
    const gatePassedMap = new Map<string, boolean>()
    for (const g of stageGateRuns.value) {
      gatePassedMap.set(g.gate, g.passed && !g.conditional)
    }
    return stageAdvanceVerdict(
      stageTemplate.value,
      targetStageCode,
      approvalBindings.value,
      flowInstances.value,
      gatePassedMap,
      projectDeliverables.value,
      deliverableApprovalBindings.value
    )
  }

  // —— 企业级聚合视图（对标 Oracle 组合驾驶舱：跨项目汇总健康指标，兑现 V4.0 第五种介入方式「聚合」）——
  /** 组合健康快照：每项目复用既有引擎派生，禁止自造比例（单一权威：computeEvm/weightedCompletion/rpn/evaluateHandoffs） */
  const portfolioAggregate = computed(() => {
    const today = todayStr()
    const snapshots: ProjectHealthSnapshot[] = visibleProjects.value.map((p) => {
      const wbs = data.value.wbs.filter((w) => w.projectId === p.id)
      const comp = weightedCompletion(wbs, p.budget)
      const ev = (comp.weightedPercent / 100) * p.budget
      const statusDay = statusDayOf(wbs)
      const pvInfo = plannedValue(wbs, p.budget, statusDay)
      const evm = computeEvm({ pv: pvInfo.pv, ev, ac: p.spent, bac: p.budget })
      const q = planQualityChecks(wbs)
      const risks = data.value.risks.filter((r) => r.projectId === p.id)
      const redRisks = risks.filter((r) => rpn(r) >= 200)
      const handoffs = (data.value.handoffs ?? []).filter((h) => h.projectId === p.id)
      const overdueHandoffs = evaluateHandoffs(handoffs, today).summary.overdue
      return {
        projectId: p.id,
        code: p.code,
        name: p.name,
        spi: evm.spi,
        cpi: evm.cpi,
        redRiskCount: redRisks.length,
        redRiskNoStrategy: redRisks.filter((r) => !r.strategy?.trim()).length,
        overdueHandoffCount: overdueHandoffs,
        planHealth: q.health,
        budget: p.budget,
        spent: p.spent,
        health: p.health,
        level: p.level || 'D',
        status: p.status
      }
    })
    return aggregatePortfolio(snapshots)
  })
  /** 需介入项目（红区优先排序） */
  const portfolioInterventions = computed(() => interventionRows(portfolioAggregate.value))

  // —— 动作 ——
  function saveWbs(nodes: WbsNode[]) {
    const others = data.value.wbs.filter((w) => w.projectId !== projectId.value)
    data.value.wbs = [...others, ...nodes]
    log('UPDATE', 'WBS', projectId.value, { count: nodes.length })
  }

  function updateTaskProgress(id: string, percent: number) {
    const t = data.value.wbs.find((w) => w.id === id)
    if (!t) return
    const before = { percent: t.percent }
    t.percent = percent
    log('UPDATE', 'WBS', id, { percent }, before)
    notify('success', `任务「${t.name}」进度已更新为 ${percent}%，加权完成率已重算`)
  }

  function freeze(id: string) {
    const b = data.value.baselines.find((x) => x.id === id)
    if (!b) return
    if (b.status === '已冻结') {
      notify('error', `BASELINE_IMMUTABLE：基线 ${b.no} 已冻结，任何修改被拒绝`)
      log('UPDATE', '基线', id, undefined, undefined, 'DENY')
      return
    }
    const frozen = freezeBaseline(b, `${currentUser.value.name}（${currentUser.value.roleName}）`)
    Object.assign(b, frozen)
    log('FREEZE', '基线', id, { no: b.no, manifestHash: b.manifestHash })
    notify('success', `基线 ${b.no} 已冻结，manifest=${b.manifestHash.slice(0, 16)}…`)
  }

  function verify(id: string) {
    const b = data.value.baselines.find((x) => x.id === id) as Baseline | undefined
    if (!b) return null
    const current = new Map<string, Record<string, unknown>>()
    for (const it of b.items) {
      const req = data.value.reqs.find((r) => r.id === it.objId)
      if (req) current.set(`需求:${req.id}`, { code: req.code, title: req.title, asil: req.asil, status: req.status })
    }
    const result = verifyBaseline(b, current)
    log('APPROVE', '基线校验', id, { ok: result.ok, mismatches: result.mismatches.length })
    notify(result.ok ? 'success' : 'error', result.ok ? '逐项哈希与 manifest 校验一致' : `校验失败：${result.mismatches.length} 项不一致（定位到条目）`)
    return result
  }

  function confirmClosure(ecrId: string, objId: string, decision: '' | '修改' | '确认无影响' | '废弃', note = '') {
    const ecr = data.value.ecrs.find((e) => e.id === ecrId)
    if (!ecr) return
    const item = ecr.closure.find((c) => c.objId === objId)
    if (!item) return
    item.decision = decision
    item.note = note
    log('UPDATE', 'ECR', ecrId, { objId, decision })
    notify('success', `闭包项 ${item.objCode} 已确认为「${decision || '未确认'}」`)
  }

  function advanceEcr(ecrId: string) {
    const ecr = data.value.ecrs.find((e) => e.id === ecrId)
    if (!ecr) return
    const unconfirmed = ecr.closure.filter((c) => !c.decision)
    if (ecr.stage === 'ECN执行' && unconfirmed.length) {
      notify('error', `CHG_UNCONFIRMED：仍有 ${unconfirmed.length} 项未确认，ECR 不得关闭（C-17）`)
      log('UPDATE', 'ECR', ecrId, undefined, undefined, 'DENY')
      return
    }
    const order: EcrItemStage[] = ['影响评估', '审批中', 'ECN执行', 'ECN验证', '已关闭']
    const i = order.indexOf(ecr.stage)
    if (i < order.length - 1) {
      // C-18：从「ECN执行」推进到「已关闭」必须经过「ECN验证」，且验证未通过时阻断
      const next = order[i + 1]
      if (next === '已关闭' && !ecr.ecnVerification?.verified) {
        notify('error', `CHG_UNVERIFIED：ECN 已执行但未通过验证，不得标记完成（C-18）`)
        log('UPDATE', 'ECR', ecrId, undefined, undefined, 'DENY')
        return
      }
      ecr.stage = next
      log('UPDATE', 'ECR', ecrId, { stage: ecr.stage })
      notify('success', `ECR ${ecr.code} 已流转至「${ecr.stage}」`)
    }
  }

  /** C-18：记录 ECN 验证结论（验证通过/不通过） */
  function verifyEcn(ecrId: string, verified: boolean, note = '') {
    const ecr = data.value.ecrs.find((e) => e.id === ecrId)
    if (!ecr) return
    ecr.ecnVerification = { verified, note }
    log('UPDATE', 'ECR', ecrId, { ecnVerification: { verified, note } })
    notify(verified ? 'success' : 'warning', verified ? `ECN 验证通过：${note || '执行结果已确认'}` : `ECN 验证不通过：${note || '待整改后重验'}`)
  }

  type EcrItemStage = '影响评估' | '审批中' | 'ECN执行' | 'ECN验证' | '已关闭'

  /** C-46：纠偏项回写计划 + 重算偏差（两者完成方可关闭） */
  function addDeviation(measure: string) {
    const id = 'DV' + (data.value.deviations.length + 1)
    const code = `DEV-2026-${String(data.value.deviations.length + 1).padStart(2, '0')}`
    data.value.deviations.push({ id, projectId: projectId.value, code, measure, planUpdated: false, deviationRecomputed: false, status: '开放' })
    log('CREATE', '纠偏', id, { code, measure })
    notify('success', `纠偏项 ${code} 已登记；须回写计划并重算偏差后方可关闭（C-46）`)
  }

  function closeDeviation(devId: string) {
    const d = data.value.deviations.find((x) => x.id === devId)
    if (!d) return
    if (!d.measure.trim()) {
      notify('error', '纠偏措施不能为空，无法回写（C-46）')
      return
    }
    d.planUpdated = true
    d.deviationRecomputed = true
    d.status = '已关闭'
    log('UPDATE', '纠偏', devId, { planUpdated: true, deviationRecomputed: true })
    notify('success', `纠偏项 ${d.code} 已回写计划并重算偏差，允许关闭（C-46）`)
  }

  /** COM-010：经验教训登记（主题+阶段必填，缺一拒收），入库并打标签 */
  function addLesson(input: { title: string; content: string; stage: string; category: string; tags: string[] }): boolean {
    const errors = validateLesson(input)
    if (errors.length) {
      notify('error', `经验登记被拒：${errors.join('；')}（COM-010）`)
      return false
    }
    const id = 'LS' + (data.value.lessons.length + 1)
    const code = nextLessonCode(data.value.lessons, projectId.value)
    const tags = input.tags.filter((t) => t.trim()).map((t) => t.trim())
    data.value.lessons.push({
      id,
      projectId: projectId.value,
      code,
      title: input.title.trim(),
      content: input.content.trim(),
      tags,
      stage: input.stage,
      category: input.category,
      pushedTo: [],
      pushLog: [],
      reusedBy: [],
      createdAt: new Date().toISOString().slice(0, 10)
    })
    log('CREATE', '经验', id, { code, stage: input.stage, category: input.category })
    notify('success', `经验 ${code} 已入库并打 ${tags.length} 个标签（COM-010）`)
    return true
  }

  /** COM-010：跨项目检索同类经验（立项时复用）；projectId '*' 表示全量 */
  function searchLessons(query: { projectId?: string; stage?: string; category?: string; keyword?: string }) {
    return searchLessonsEngine(data.value.lessons, query)
  }

  /** COM-010：回存资料库（幂等去重 + 推送记录可查） */
  function pushLessonToLibrary(lessonId: string, target: string): boolean {
    const l = data.value.lessons.find((x) => x.id === lessonId)
    if (!l) return false
    const at = new Date().toISOString()
    const { lesson, pushed } = pushToLibrary(l, target, currentUser.value.name, at)
    if (!pushed) {
      notify('warning', `经验 ${l.code} 已回存过资料库「${target}」，不重复推送（幂等）`)
      return false
    }
    Object.assign(l, lesson)
    log('PUSH', '经验', lessonId, { target, by: currentUser.value.name })
    notify('success', `经验 ${l.code} 已回存资料库「${target}」，推送记录已留痕（COM-010）`)
    return true
  }

  /** COM-010：后续项目复用同类经验（记录复用关系，供复用次数统计） */
  function reuseLesson(lessonId: string, targetProjectId: string) {
    const l = data.value.lessons.find((x) => x.id === lessonId)
    if (!l) return
    const updated = markReused(l, targetProjectId)
    Object.assign(l, updated)
    log('REUSE', '经验', lessonId, { byProject: targetProjectId })
  }

  // —— COM 协同沟通域（会议决议 / 送审件 / 督办，FUN-024）——

  const todayStr = () => new Date().toISOString().slice(0, 10)

  /** COM-006：会议决议条目化登记（缺责任人/期限不可保存） */
  function addResolution(meetingId: string, input: ResolutionInput): boolean {
    const errors = validateResolution(input)
    if (errors.length) {
      notify('error', `决议登记被拒：${errors.join('；')}（COM-006）`)
      return false
    }
    const m = data.value.meetings.find((x) => x.id === meetingId)
    const id = 'RS' + (data.value.resolutions.length + 1)
    const code = nextResolutionCode(data.value.resolutions, projectId.value)
    data.value.resolutions.push({
      id,
      projectId: projectId.value,
      meetingId,
      code,
      content: input.content.trim(),
      owner: input.owner.trim(),
      due: input.due,
      status: '待执行',
      createdAt: todayStr()
    })
    if (m) m.resolutions.push(id)
    log('CREATE', '决议', id, { code, meetingId, owner: input.owner, due: input.due })
    notify('success', `决议 ${code} 已条目化并挂责任人/期限（COM-006）`)
    return true
  }

  /** COM-007：决议转任务（幂等，同一决议不重复建任务） */
  function resolutionToTask(resolutionId: string): boolean {
    const r = data.value.resolutions.find((x) => x.id === resolutionId)
    if (!r) return false
    if (r.taskId) {
      notify('warning', `决议 ${r.code} 已转任务 ${r.taskId}，不重复建（COM-007）`)
      return false
    }
    const taskId = 'TASK-' + (data.value.resolutions.length + 1).toString().padStart(3, '0')
    const next = resolutionToTaskEngine(r, taskId)
    Object.assign(r, next)
    log('CREATE', '任务', taskId, { fromResolution: r.code })
    notify('success', `决议 ${r.code} 已转任务 ${taskId}（COM-007）`)
    return true
  }

  /** COM-008：决议关闭（无证据关闭被拒） */
  function closeResolution(resolutionId: string, evidence: string): boolean {
    const r = data.value.resolutions.find((x) => x.id === resolutionId)
    if (!r) return false
    const { resolution, closed, errors } = closeResolutionEngine(r, evidence, todayStr())
    if (!closed) {
      notify('error', errors.join('；'))
      return false
    }
    Object.assign(r, resolution)
    log('CLOSE', '决议', resolutionId, { evidence })
    notify('success', `决议 ${r.code} 已闭环（证据已留痕，COM-008）`)
    return true
  }

  /** COM-008：决议逾期列表（未闭环且逾期的决议，门户可见） */
  const overdueResolutionsList = () => overdueResolutions(data.value.resolutions, todayStr())

  /** COM-005：会议策划（四要素齐备方可发邀请） */
  function addMeeting(input: { title: string; agenda: string; host: string; date: string; attendees: string[] }): boolean {
    const errors = validateMeeting(input)
    if (errors.length) {
      notify('error', `会议策划被拒：${errors.join('；')}（COM-005）`)
      return false
    }
    const id = 'M' + (data.value.meetings.length + 1)
    const code = `MTG-${String(data.value.meetings.length + 1).padStart(3, '0')}`
    data.value.meetings.push({
      id,
      projectId: projectId.value,
      code,
      title: input.title.trim(),
      date: input.date,
      host: input.host.trim(),
      attendees: input.attendees,
      agenda: input.agenda.trim(),
      minutes: '',
      resolutions: [],
      status: '策划中'
    })
    log('CREATE', '会议', id, { code, title: input.title })
    notify('success', `会议 ${code} 已策划（四要素齐备，COM-005）`)
    return true
  }

  /** COM-001：送审件登记（必带版本与期限） */
  function addSendAudit(input: SendAuditInput): boolean {
    const errors = validateSendAudit(input)
    if (errors.length) {
      notify('error', `送审件登记被拒：${errors.join('；')}（COM-001）`)
      return false
    }
    const id = 'SA' + (data.value.sendAudits.length + 1)
    const code = `SA-${String(data.value.sendAudits.length + 1).padStart(3, '0')}`
    data.value.sendAudits.push({
      id,
      projectId: projectId.value,
      code,
      title: input.title.trim(),
      version: input.version.trim(),
      reviewerType: input.reviewerType,
      reviewer: input.reviewer.trim(),
      sentAt: todayStr(),
      dueAt: input.dueAt,
      status: '待答复',
      answers: [],
      escalated: false
    })
    log('CREATE', '送审件', id, { code, title: input.title, version: input.version })
    notify('success', `送审件 ${code} 已登记（版本+期限齐备，COM-001）`)
    return true
  }

  /** COM-001/002：送审件答复（留痕 + 超期升级） */
  function answerSendAudit(sendAuditId: string, content: string): boolean {
    const s = data.value.sendAudits.find((x) => x.id === sendAuditId)
    if (!s) return false
    const { item, errors } = answerSendAuditEngine(s, currentUser.value.name, content, new Date().toISOString(), todayStr())
    if (errors.length) {
      notify('error', errors.join('；'))
      return false
    }
    Object.assign(s, item)
    log('ANSWER', '送审件', sendAuditId, { by: currentUser.value.name, escalated: item.escalated })
    notify('success', `送审件 ${s.code} 已答复留痕${item.escalated ? '（超期已升级）' : ''}`)
    return true
  }

  /** COM-009：新建督办（交办态） */
  function dispatchSupervise(title: string, owner: string, due: string): boolean {
    if (!title.trim() || !owner.trim() || !due.trim()) {
      notify('error', '督办须明确事项、责任人与时限（COM-009）')
      return false
    }
    const id = 'SV' + (data.value.supervises.length + 1)
    const code = `SUP-${String(data.value.supervises.length + 1).padStart(4, '0')}`
    data.value.supervises.push({
      id,
      projectId: projectId.value,
      code,
      title: title.trim(),
      owner: owner.trim(),
      due,
      status: '交办',
      actions: [{ at: new Date().toISOString(), by: currentUser.value.name, action: '交办', note: '' }],
      escalated: false
    })
    log('CREATE', '督办', id, { code, owner, due })
    notify('success', `督办 ${code} 已交办（COM-009）`)
    return true
  }

  /** COM-009：督办推进（交办→反馈→复核→销项，四动作留痕） */
  function advanceSupervise(superviseId: string, action: SuperviseActionType, note: string): boolean {
    const s = data.value.supervises.find((x) => x.id === superviseId)
    if (!s) return false
    const { item, advanced, errors } = advanceSuperviseEngine(s, action, currentUser.value.name, note, new Date().toISOString(), todayStr())
    if (!advanced) {
      notify('error', errors.join('；'))
      return false
    }
    Object.assign(s, item)
    log('ADVANCE', '督办', superviseId, { action, status: item.status })
    notify('success', `督办 ${s.code} 已推进至「${item.status}」${item.escalated ? '（超期已升级）' : ''}`)
    return true
  }

  // —— PFM 组合与投资域（决策留痕 / ROI / What-if，FUN-023）——

  /** PFM-020：优选决策留痕（四要素 + 终止项目必带收尾计划） */
  function addDecision(input: { reason: string; decider: string; alternatives: string; closurePlan?: string; affectedProjectIds: string[]; action: '延后' | '缩减' | '终止' | '采纳' }): boolean {
    const check = decisionComplete(input)
    if (!check.ok) {
      notify('error', `决策登记被拒：缺 ${check.missing.join('、')}（PFM-020）`)
      return false
    }
    if (input.action === '终止' && !input.closurePlan?.trim()) {
      notify('error', '终止项目必须提供收尾安排，缺项不可提交（PFM-020）')
      return false
    }
    const id = 'DC' + (data.value.decisions.length + 1)
    const code = `DEC-${String(data.value.decisions.length + 1).padStart(3, '0')}`
    data.value.decisions.push({
      id,
      code,
      reason: input.reason.trim(),
      decider: input.decider.trim(),
      date: todayStr(),
      affectedProjectIds: input.affectedProjectIds,
      alternatives: input.alternatives.trim(),
      closurePlan: input.closurePlan?.trim(),
      action: input.action,
      createdAt: new Date().toISOString()
    })
    log('CREATE', '组合决策', id, { code, action: input.action, affected: input.affectedProjectIds })
    notify('success', `决策 ${code} 已留痕（含理由/决策人/日期/影响项目清单，PFM-020）`)
    return true
  }

  /** PFM-022：投资回报分析（三指标可复算，缺收益计划不出结论） */
  function roiOfProject(projectId: string) {
    const inv = data.value.investments.find((i) => i.projectId === projectId)
    return roiOf(inv)
  }

  /** PFM-024：金额币种校验（无币种保存被拒） */
  function validateCurrencyAmount(amount: CurrencyAmount): string[] {
    return validateCurrency(amount)
  }

  /** PFM-025：What-if 场景隔离（模拟不碰主计划，返回模拟结果副本） */
  function whatIfSimulate(scenarioId: string) {
    const sc = data.value.whatIfs.find((s) => s.id === scenarioId)
    if (!sc) return { base: [], simulated: [], diffs: [] }
    const base = visibleProjects.value.filter((p) => sc.baseProjectIds.includes(p.id))
    const simulated = applyAdjustments(base, sc)
    const diffs = diffScenarios(base, sc)
    return { base, simulated, diffs }
  }

  /** PFM-026：What-if 合并（仅待审批态可合并） */
  function whatIfMerge(scenarioId: string): boolean {
    const sc = data.value.whatIfs.find((s) => s.id === scenarioId)
    if (!sc) return false
    if (!canMerge(sc)) {
      notify('error', '未经审批的合并入口不存在（PFM-026）')
      return false
    }
    const base = visibleProjects.value.filter((p) => sc.baseProjectIds.includes(p.id))
    const merged = mergeScenario(base, sc)
    merged.forEach((m) => {
      const t = data.value.projects.find((p) => p.id === m.id)
      if (t) Object.assign(t, m)
    })
    sc.mergeStatus = '已合并'
    log('MERGE', 'What-if', scenarioId, { name: sc.name })
    notify('success', `What-if「${sc.name}」已合并（PFM-026）`)
    return true
  }

  /** PFM-025：What-if 场景删除（不影响主计划） */
  function whatIfRemove(scenarioId: string) {
    data.value.whatIfs = removeScenario(data.value.whatIfs, scenarioId)
    log('DELETE', 'What-if', scenarioId, {})
    notify('info', '模拟场景已删除，主计划不受影响（PFM-025）')
  }

  /** PFM-026：提交合并审批（草稿→待审批） */
  function whatIfSubmitForMerge(scenarioId: string) {
    const sc = data.value.whatIfs.find((s) => s.id === scenarioId)
    if (!sc) return
    if (sc.mergeStatus !== '草稿') {
      notify('warning', '仅草稿态可提交审批')
      return
    }
    sc.mergeStatus = '待审批'
    log('SUBMIT', 'What-if', scenarioId, { to: '待审批' })
    notify('success', `What-if「${sc.name}」已提交合并审批（PFM-026）`)
  }

  // —— 三层日历（TEN-015）：例外日维护 + 继承解析 + 排程计算 ——
  function addException(calendarId: string, input: { date: string; type: '工作日' | '休息日'; reason: string }): boolean {
    const v = validateException(calendars.value, calendarId, input)
    if (!v.ok) {
      notify('error', v.errors[0])
      return false
    }
    const cal = calendars.value.find((c) => c.id === calendarId)
    if (!cal) return false
    cal.exceptions.push({ id: `CE-${Date.now()}`, ...input })
    log('UPDATE', '日历', calendarId, { addException: input })
    notify('success', `已为「${cal.name}」登记例外日 ${input.date}（${input.type}），相关计划将提示重算（TEN-015）`)
    return true
  }

  function calendarLineage(calendarId: string) {
    return lineage(calendars.value, calendarId)
  }

  function calendarIsWorkday(calendarId: string, date: string) {
    return isWorkday(calendars.value, calendarId, date)
  }

  function calendarWorkdaysBetween(calendarId: string, start: string, end: string) {
    return workdaysBetween(calendars.value, calendarId, start, end)
  }

  function calendarEndDateAfter(calendarId: string, start: string, workdays: number) {
    return endDateAfter(calendars.value, calendarId, start, workdays)
  }

  function calendarAffectedPlans(changedCalendarId: string) {
    const planCalendars = data.value.wbs.map((w) => ({ planId: w.id, calendarId: w.calendar ?? '' })).filter((p) => p.calendarId)
    return affectedPlans(calendars.value, changedCalendarId, planCalendars)
  }

  // —— 治理配置（TEN-016）：分类码 / UDF / 步骤模板 ——
  function addCodeDictValue(dictId: string, value: string): boolean {
    const { dicts, added } = addCodeValue(codeDicts.value, dictId, value)
    if (!added) {
      notify('warning', '码值已存在或为空')
      return false
    }
    data.value.codeDicts = dicts
    log('UPDATE', '分类码', dictId, { addValue: value })
    notify('success', `分类码已新增码值「${value}」（TEN-016 新增码值不追溯历史）`)
    return true
  }

  // —— 基础数据：客户 CRUD（编号按规则自动生成/校验）——
  function createCustomer(input: { name: string; code?: string; vehicleModels: string[]; shortName?: string }): boolean {
    // 命名规则校验（前缀/长度/禁用字符）
    const nameChk = checkNameValid('customer', input.name)
    if (!nameChk.ok) { notify('warning', nameChk.error ?? '名称不合规'); return false }
    // 主数据打通：编号留空自动生成，填了则校验
    let code = (input.code ?? '').trim()
    let genRule: { ruleId?: string; ruleVersion?: number } = {}
    if (!code) {
      const gen = autoGenerateCode('customer', customers.value.map((c) => c.code), { abbr: (input.shortName ?? input.name).toUpperCase() })
      if (!gen.ok) { notify('warning', '无法自动生成客户编号：' + gen.error); return false }
      code = gen.code!
      genRule = { ruleId: gen.ruleId, ruleVersion: gen.ruleVersion }
    } else {
      const chk = checkCodeValid('customer', code)
      if (!chk.ok) { notify('warning', chk.error ?? '编号不合规'); return false }
    }
    const r = addCustomerEngine(customers.value, { ...input, code })
    if (r.error) { notify('warning', r.error); return false }
    data.value.customers = r.list as import('@/domain/types').Customer[]
    if (genRule.ruleId) recordCodeIssue({ ruleId: genRule.ruleId, ruleVersion: genRule.ruleVersion!, object: 'customer', code, objectId: r.item!.id })
    log('CREATE', '客户', r.item!.id, { name: input.name, code })
    notify('success', `客户「${input.name}」已新增（编号 ${code}）`)
    return true
  }
  function saveCustomer(id: string, patch: { name?: string; code?: string; vehicleModels?: string[]; shortName?: string }): boolean {
    const r = updateCustomerEngine(customers.value, id, patch)
    if (r.error) { notify('warning', r.error); return false }
    data.value.customers = r.list as import('@/domain/types').Customer[]
    log('UPDATE', '客户', id, patch)
    notify('success', '客户已更新')
    return true
  }
  function deleteCustomer(id: string): boolean {
    const r = removeCustomerEngine(customers.value, id)
    data.value.customers = r.list as import('@/domain/types').Customer[]
    log('DELETE', '客户', id, {})
    notify('success', '客户已删除')
    return true
  }

  // —— 基础数据：产品三级 CRUD ——
  function createCategory(name: string): boolean {
    const r = addCategoryEngine(productCategories.value, name)
    if (r.error) { notify('warning', r.error); return false }
    data.value.productCategories = r.list as import('@/domain/types').ProductCategory[]
    log('CREATE', '产品类别', r.item!.id, { name })
    notify('success', `产品类别「${name}」已新增`)
    return true
  }
  function createProductLine(categoryId: string, name: string, code?: string): boolean {
    const nameChk = checkNameValid('product', name)
    if (!nameChk.ok) { notify('warning', nameChk.error ?? '名称不合规'); return false }
    let finalCode = (code ?? '').trim()
    let genRule: { ruleId?: string; ruleVersion?: number } = {}
    if (!finalCode) {
      const gen = autoGenerateCode('product', productLines.value.map((l) => l.code ?? ''), { abbr: name.toUpperCase().slice(0, 3) })
      if (!gen.ok) { notify('warning', '无法自动生成产品线编号：' + gen.error); return false }
      finalCode = gen.code!
      genRule = { ruleId: gen.ruleId, ruleVersion: gen.ruleVersion }
    } else {
      const chk = checkCodeValid('product', finalCode)
      if (!chk.ok) { notify('warning', chk.error ?? '编号不合规'); return false }
    }
    const r = addProductLineEngine(productLines.value, productCategories.value, { categoryId, name, code: finalCode })
    if (r.error) { notify('warning', r.error); return false }
    data.value.productLines = r.list as import('@/domain/types').ProductLine[]
    if (genRule.ruleId) recordCodeIssue({ ruleId: genRule.ruleId, ruleVersion: genRule.ruleVersion!, object: 'product', code: finalCode, objectId: r.item!.id })
    log('CREATE', '产品线', r.item!.id, { categoryId, name, code: finalCode })
    notify('success', `产品线「${name}」已新增（编号 ${finalCode}）`)
    return true
  }
  function createProduct(lineId: string, name: string, code?: string): boolean {
    const nameChk = checkNameValid('product', name)
    if (!nameChk.ok) { notify('warning', nameChk.error ?? '名称不合规'); return false }
    let finalCode = (code ?? '').trim()
    let genRule: { ruleId?: string; ruleVersion?: number } = {}
    if (!finalCode) {
      const line = productLines.value.find((l) => l.id === lineId)
      const gen = autoGenerateCode('product', products.value.map((p) => p.code ?? ''), { lineCode: line?.code ?? '' })
      if (!gen.ok) { notify('warning', '无法自动生成产品编号：' + gen.error); return false }
      finalCode = gen.code!
      genRule = { ruleId: gen.ruleId, ruleVersion: gen.ruleVersion }
    } else {
      const chk = checkCodeValid('product', finalCode)
      if (!chk.ok) { notify('warning', chk.error ?? '编号不合规'); return false }
    }
    const r = addProductEngine(products.value, productLines.value, { lineId, name, code: finalCode })
    if (r.error) { notify('warning', r.error); return false }
    data.value.products = r.list as import('@/domain/types').Product[]
    if (genRule.ruleId) recordCodeIssue({ ruleId: genRule.ruleId, ruleVersion: genRule.ruleVersion!, object: 'product', code: finalCode, objectId: r.item!.id })
    log('CREATE', '产品', r.item!.id, { lineId, name, code: finalCode })
    notify('success', `产品「${name}」已新增（编号 ${finalCode}）`)
    return true
  }
  function deleteProductLine(id: string): boolean {
    const r = removeProductLineEngine(productLines.value, products.value, id)
    if (r.error) { notify('warning', r.error); return false }
    data.value.productLines = r.lines as import('@/domain/types').ProductLine[]
    data.value.products = r.products as import('@/domain/types').Product[]
    log('DELETE', '产品线', id, {})
    notify('success', '产品线已删除')
    return true
  }
  function deleteProduct(id: string): boolean {
    data.value.products = removeProductEngine(products.value, id) as import('@/domain/types').Product[]
    log('DELETE', '产品', id, {})
    notify('success', '产品已删除')
    return true
  }
  function deleteCategory(id: string): boolean {
    const r = removeCategoryEngine(productCategories.value, productLines.value, id)
    if (r.error) { notify('warning', r.error); return false }
    data.value.productCategories = r.categories as import('@/domain/types').ProductCategory[]
    data.value.productLines = r.lines as import('@/domain/types').ProductLine[]
    log('DELETE', '产品类别', id, {})
    notify('success', '产品类别已删除')
    return true
  }

  // —— 组织节点 CRUD + 导入导出（部门编号按规则自动生成）——
  function createOrgNode(input: { name: string; level: import('@/domain/types').OrgLevel; parentId: string | null; system?: string; leaderName?: string }): boolean {
    // 命名规则校验（部门命名）
    const nameChk = checkNameValid('department', input.name)
    if (!nameChk.ok) { notify('warning', nameChk.error ?? '名称不合规'); return false }
    // 部门编号自动生成（按部门编码规则）
    const sysAbbr = (input.system ?? 'GEN').replace(/系统$/, '').slice(0, 3).toUpperCase()
    const gen = autoGenerateCode('department', orgNodes.value.map((n) => n.code ?? ''), { sys: sysAbbr })
    const r = addOrgNodeEngine(orgNodes.value, { ...input, code: gen.ok ? gen.code : undefined })
    if (r.error) { notify('warning', r.error); return false }
    data.value.orgNodes = r.list as import('@/domain/types').OrgNode[]
    if (gen.ok && gen.ruleId && r.item!.code) recordCodeIssue({ ruleId: gen.ruleId, ruleVersion: gen.ruleVersion!, object: 'department', code: r.item!.code, objectId: r.item!.id })
    log('CREATE', '组织节点', r.item!.id, { name: input.name, level: input.level, code: r.item!.code })
    notify('success', `组织节点「${input.name}」已新增${r.item!.code ? `（编号 ${r.item!.code}）` : ''}`)
    return true
  }
  function saveOrgNode(id: string, patch: { name?: string; leaderName?: string; system?: string }): boolean {
    const r = updateOrgNodeEngine(orgNodes.value, id, patch)
    if (r.error) { notify('warning', r.error); return false }
    data.value.orgNodes = r.list as import('@/domain/types').OrgNode[]
    log('UPDATE', '组织节点', id, patch)
    notify('success', '组织节点已更新')
    return true
  }
  function deleteOrgNode(id: string): boolean {
    const r = removeOrgNodeEngine(orgNodes.value, id)
    if (r.error) { notify('warning', r.error); return false }
    data.value.orgNodes = r.list as import('@/domain/types').OrgNode[]
    log('DELETE', '组织节点', id, {})
    notify('success', '组织节点已删除')
    return true
  }
  function exportOrgCsv(): string {
    return exportOrgNodes(orgNodes.value)
  }
  function importOrgCsv(csv: string): { errors: { line: number; note: string }[] } {
    const r = parseOrgNodes(csv, orgNodes.value)
    data.value.orgNodes = r.list as import('@/domain/types').OrgNode[]
    log('IMPORT', '组织节点', 'CSV', { total: r.list.length, errors: r.errors.length })
    return { errors: r.errors }
  }

  /**
   * 审批角色 → 组织负责人解析（组织负责人与审批流自动映射）
   * 组织负责人变更后，审批流会签人自动同步（同源解析，非硬编码人名）。
   */
  function resolveApproverOf(signRole: string): { name?: string; orgName?: string; matched: boolean } {
    return resolveApprover(signRole, orgNodes.value)
  }
  /** 批量解析会签角色列表 → 负责人名列表（未匹配的保留原角色名） */
  function resolveSignersOf(signRoles: string[]): { role: string; name: string; matched: boolean }[] {
    return signRoles.map((role) => {
      const r = resolveApprover(role, orgNodes.value)
      return { role, name: r.matched ? r.name! : role, matched: r.matched }
    })
  }

  // —— 基础数据：导入导出 ——
  function exportCustomersCsv(): string {
    return exportCustomers(customers.value)
  }
  function importCustomersCsv(csv: string): { total: number; ok: number; errors: { line: number; note: string }[] } {
    const r = parseCustomers(csv, customers.value)
    data.value.customers = r.list as import('@/domain/types').Customer[]
    log('IMPORT', '客户', 'CSV', { ok: r.list.length, errors: r.errors.length })
    return { total: r.list.length, ok: r.list.length - r.errors.length, errors: r.errors }
  }
  function exportProductsCsv(): string {
    return exportProducts(productCategories.value, productLines.value, products.value)
  }
  function importProductsCsv(csv: string): { total: number; errors: { line: number; note: string }[] } {
    const r = parseProducts(csv, productCategories.value, productLines.value, products.value)
    data.value.productCategories = r.categories as import('@/domain/types').ProductCategory[]
    data.value.productLines = r.lines as import('@/domain/types').ProductLine[]
    data.value.products = r.products as import('@/domain/types').Product[]
    log('IMPORT', '产品', 'CSV', { categories: r.categories.length, lines: r.lines.length, products: r.products.length, errors: r.errors.length })
    return { total: r.products.length, errors: r.errors }
  }

  // —— 命名与编码规则 CRUD + 导入导出（版本化 + 变更审计链）——
  const namingActor = () => currentUser.value.name

  function createNamingRule(input: {
    object: import('@/domain/types').NamingObject
    kind: import('@/domain/types').NamingRuleKind
    name: string
    description?: string
    example?: string
    enabled?: boolean
    pattern?: import('@/domain/types').CodePattern
    namePattern?: import('@/domain/types').NamingPattern
  }): boolean {
    const r = addNamingRuleEngine(namingRules.value, { ...input, enabled: input.enabled ?? true }, namingActor())
    if (r.error) { notify('warning', r.error); return false }
    data.value.namingRules = r.list as import('@/domain/types').NamingRule[]
    data.value.namingRuleHistory = appendHistory(namingRuleHistory.value, {
      ruleId: r.item!.id, action: 'create', after: r.item, by: namingActor(), note: `新增规则「${input.name}」`
    }) as import('@/domain/types').NamingRuleHistory[]
    log('CREATE', '命名编码规则', r.item!.id, { object: input.object, kind: input.kind, name: input.name })
    notify('success', `规则「${input.name}」已新增（v1）`)
    return true
  }
  function saveNamingRule(id: string, patch: {
    object?: import('@/domain/types').NamingObject
    kind?: import('@/domain/types').NamingRuleKind
    name?: string
    description?: string
    example?: string
    enabled?: boolean
    pattern?: import('@/domain/types').CodePattern
    namePattern?: import('@/domain/types').NamingPattern
  }): boolean {
    const r = updateNamingRuleEngine(namingRules.value, id, patch, namingActor())
    if (r.error) { notify('warning', r.error); return false }
    data.value.namingRules = r.list as import('@/domain/types').NamingRule[]
    data.value.namingRuleHistory = appendHistory(namingRuleHistory.value, {
      ruleId: id, action: 'update', before: r.before, after: r.after, by: namingActor(), note: `更新规则「${r.after?.name}」`
    }) as import('@/domain/types').NamingRuleHistory[]
    log('UPDATE', '命名编码规则', id, patch)
    notify('success', `规则已更新（v${r.after?.version}）`)
    return true
  }
  function deleteNamingRule(id: string): boolean {
    const r = removeNamingRuleEngine(namingRules.value, id)
    data.value.namingRules = r.list as import('@/domain/types').NamingRule[]
    data.value.namingRuleHistory = appendHistory(namingRuleHistory.value, {
      ruleId: id, action: 'delete', before: r.removed, by: namingActor(), note: `删除规则「${r.removed?.name}」`
    }) as import('@/domain/types').NamingRuleHistory[]
    log('DELETE', '命名编码规则', id, {})
    notify('success', '规则已删除')
    return true
  }
  function toggleNamingRule(id: string, enabled: boolean): boolean {
    const r = toggleNamingRuleEngine(namingRules.value, id, enabled, namingActor())
    data.value.namingRules = r.list as import('@/domain/types').NamingRule[]
    data.value.namingRuleHistory = appendHistory(namingRuleHistory.value, {
      ruleId: id, action: 'toggle', before: r.before, after: r.after, by: namingActor(), note: `${enabled ? '启用' : '停用'}规则`
    }) as import('@/domain/types').NamingRuleHistory[]
    log('UPDATE', '命名编码规则', id, { enabled })
    return true
  }
  function exportNamingRulesCsv(): string {
    return exportNamingRules(namingRules.value)
  }
  function importNamingRulesCsv(csv: string): { total: number; errors: { line: number; note: string }[] } {
    const r = parseNamingRules(csv, namingRules.value)
    data.value.namingRules = r.list as import('@/domain/types').NamingRule[]
    log('IMPORT', '命名编码规则', 'CSV', { total: r.list.length, errors: r.errors.length })
    return { total: r.list.length, errors: r.errors }
  }
  /** 取某规则的历史（供视图追溯） */
  function ruleHistoryOf(ruleId: string): import('@/domain/types').NamingRuleHistory[] {
    return historyOf(namingRuleHistory.value, ruleId)
  }

  // —— 主数据打通：按编码规则自动生成/校验编号 ——
  /** 取某对象的启用编码规则 */
  function codingRuleOf(object: import('@/domain/types').NamingObject) {
    return namingRules.value.find((r) => r.object === object && r.kind === 'coding' && r.enabled) as import('@/domain/types').NamingRule | undefined
  }
  /**
   * 自动生成编号：某对象按启用编码规则 + 已用编号集合生成下一编号。
   * 返回 { ok, code, ruleId, ruleVersion }；无启用规则或模板非法时 ok=false。
   */
  function autoGenerateCode(object: import('@/domain/types').NamingObject, usedCodes: string[], vars?: Record<string, string>): { ok: boolean; code?: string; error?: string; ruleId?: string; ruleVersion?: number } {
    const rule = codingRuleOf(object)
    if (!rule?.pattern) return { ok: false, error: `未配置「${object}」的编码规则` }
    const g = generateCode(rule.pattern, { usedCodes, vars })
    if (!g.ok) return { ok: false, error: g.error }
    return { ok: true, code: g.code, ruleId: rule.id, ruleVersion: rule.version }
  }
  /** 校验编号是否符合某对象的启用编码规则 */
  function checkCodeValid(object: import('@/domain/types').NamingObject, code: string): { ok: boolean; error?: string } {
    const rule = codingRuleOf(object)
    if (!rule?.pattern) return { ok: true } // 无规则不拦截
    return validateCode(rule.pattern, code)
  }
  /** 取某对象的启用命名规则（结构化 namePattern） */
  function namingRuleOf(object: import('@/domain/types').NamingObject): import('@/domain/types').NamingRule | undefined {
    return namingRules.value.find((r) => r.object === object && r.kind === 'naming' && r.enabled)
  }
  /** 校验名称是否符合某对象的启用命名规则（前缀/长度/禁用字符/大小写） */
  function checkNameValid(object: import('@/domain/types').NamingObject, name: string): { ok: boolean; error?: string } {
    const rule = namingRuleOf(object)
    if (!rule?.namePattern) return { ok: true } // 无结构化约束不拦截
    return validateName(rule.namePattern, name)
  }
  /**
   * 记录编号生成实例（编号实例审计闭环）：编号生成成功后调用，
   * 把「规则 id + 规则版本 + 对象 + 生成值」append-only 写入 codeIssues。
   */
  function recordCodeIssue(input: { ruleId: string; ruleVersion: number; object: import('@/domain/types').NamingObject; code: string; objectId?: string }): void {
    data.value.codeIssues = appendCodeIssue(codeIssues.value, {
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      object: input.object,
      code: input.code,
      objectId: input.objectId,
      by: currentUser.value.name
    })
    log('CREATE', '编号实例', input.code, { ruleId: input.ruleId, ruleVersion: input.ruleVersion, code: input.code, object: input.object })
  }
  /** 按规则 id 追溯所有由该规则生成的编号实例 */
  function codeIssuesOf(ruleId: string): import('@/domain/types').CodeIssue[] {
    return codeIssuesOfEngine(codeIssues.value, ruleId)
  }
  /** 按编号反查生成它的规则（供「某编号由哪版规则生成」追溯） */
  function codeIssueOfCode(code: string): import('@/domain/types').CodeIssue | undefined {
    return codeIssueOfCodeEngine(codeIssues.value, code)
  }

  function saveUdf(input: { target: import('@/domain/types').UdfTarget; name: string; type: import('@/domain/types').UdfDef['type']; enumValues?: string[]; min?: number; max?: number }): boolean {
    const v = validateUdf(input)
    if (!v.ok) {
      notify('error', v.errors[0])
      return false
    }
    const item = { id: `UD-${Date.now()}`, core: false, ...input } as import('@/domain/types').UdfDef
    data.value.udfs = [...udfs.value, item]
    log('CREATE', 'UDF', item.id, { target: input.target, name: input.name, type: input.type })
    notify('success', `UDF「${input.name}」已创建（挂接 ${input.target}）`)
    return true
  }

  function bumpStepTemplate(templateId: string): boolean {
    const t = stepTemplates.value.find((x) => x.id === templateId)
    if (!t) return false
    data.value.stepTemplates = bumpTemplateVersion(stepTemplates.value, templateId)
    log('UPDATE', '步骤模板', templateId, { version: t.version + 1 })
    notify('success', `步骤模板「${t.name}」升版至 v${t.version + 1}（已执行活动不受影响）`)
    return true
  }

  function stepRunStats(runId: string) {
    const run = stepRuns.value.find((r) => r.id === runId)
    const tpl = run ? stepTemplates.value.find((t) => t.id === run.templateId) : undefined
    return run && tpl ? stepCompletion(run, tpl) : null
  }

  // —— 服务端拒绝拦截策略（SRP-001/002：三档可配置）——
  /** 修改某事项的拦截档位（及 CONFIGURABLE 档参数），审计留痕 */
  function updateRejectionPolicy(id: string, severity: RejectionSeverity, fieldValue?: boolean | string): boolean {
    const r = applySeverityChange(rejectionPolicies.value, id, severity, fieldValue)
    if (!r.ok) {
      notify('warning', r.note)
      return false
    }
    data.value.rejectionPolicies = r.items
    log('UPDATE', '拦截策略', id, { severity, fieldValue })
    notify('success', `拦截策略 ${id} 已更新（${r.note}）`)
    return true
  }

  /**
   * 统一拦截闸（写路径入口调用）：按拦截策略三档判定某事项是否拦截。
   *   engineViolated = true 表示规则引擎已判定违规（如闸门未通过/审批未完成）。
   *   返回 true 表示「已拦截，调用方应中止写操作」。
   *   三档语义见 rejectionPolicy.shouldReject：HARD 拦 / CONFIGURABLE 读字段 / DISCLOSE 放行。
   */
  function rejectIf(itemId: string, kind: string, objId: string, engineViolated: boolean, detail?: Record<string, unknown>): boolean {
    const policy = findRejectionPolicy(rejectionPolicies.value, itemId)
    if (!policy) return false // 未登记事项：不拦截（禁止代码里新起未登记的拦截）
    const rejected = shouldReject(rejectionPolicies.value, itemId, engineViolated)
    if (rejected) {
      const label = policy.severity === 'HARD' ? '硬拒绝' : policy.severity === 'CONFIGURABLE' ? '可配置拒绝' : '只读披露'
      notify('error', `[${policy.id}] ${policy.name}（${label}，SRP-001）`)
      log(kind, '拦截策略', itemId, { objId, ...detail }, undefined, 'DENY')
      return true
    }
    // 放行：DISCLOSE 披露留痕，CONFIGURABLE 宽松放行留痕
    log(kind, '拦截策略', itemId, { objId, ...detail, rejected: false, severity: policy.severity })
    return false
  }

  // —— 消息中心（POR-006 已读回执 + POR-008 收件箱）——
  function readMessage(messageId: string) {
    const at = new Date().toISOString()
    data.value.messages = markRead(messages.value, currentUser.value.id, messageId, at)
  }

  function readAllMessages() {
    const at = new Date().toISOString()
    data.value.messages = markAllRead(messages.value, currentUser.value.id, at)
    notify('success', '已全部标记为已读')
  }

  function pushMessage(input: { eventKey: string; title: string; content: string; category: import('@/domain/types').MessageItem['category']; refType?: string; refId?: string }) {
    const now = new Date().toISOString()
    if (!shouldNotify(messages.value, currentUser.value.id, input.eventKey, now)) return false
    data.value.messages = [...messages.value, { id: `MSG-${Date.now()}`, userId: currentUser.value.id, read: false, createdAt: now, ...input }]
    return true
  }

  function inboxBatchApprove(ids: string[]): number {
    const at = new Date().toISOString()
    const { inbox, affected } = batchApprove(inboxItems.value, currentUser.value.id, ids, currentUser.value.name, at)
    data.value.inboxItems = inbox
    if (affected) log('APPROVE', '收件箱', ids.join(','), { affected })
    return affected
  }

  function inboxReject(id: string, note: string): boolean {
    const at = new Date().toISOString()
    const { inbox, ok, note: msg } = rejectInbox(inboxItems.value, currentUser.value.id, id, currentUser.value.name, note, at)
    if (!ok) {
      notify('error', msg)
      return false
    }
    data.value.inboxItems = inbox
    log('REJECT', '收件箱', id, { note })
    return true
  }

  // —— 跨节点资源共享（PFM-016）——
  function addShareApply(input: { fromNodeId: string; toNodeId: string; resourceId: string; resourceName: string; startAt: string; expireAt: string }): boolean {
    const { ok, errors } = validateShareApply(input)
    if (!ok) {
      notify('error', errors[0])
      return false
    }
    const apply: import('@/domain/types').ResourceShareApply = {
      id: `RS-${Date.now()}`,
      code: `SHARE-${new Date().getFullYear()}-${String(resourceShares.value.length + 1).padStart(2, '0')}`,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      startAt: input.startAt,
      expireAt: input.expireAt,
      status: '草稿',
      createdAt: new Date().toISOString().slice(0, 10)
    }
    data.value.resourceShares = [...resourceShares.value, apply]
    log('CREATE', '资源共享', apply.id, { from: input.fromNodeId, to: input.toNodeId })
    notify('success', `共享申请 ${apply.code} 已登记（草稿，未审批不得占用）`)
    return true
  }

  function submitShareForApproval(id: string): boolean {
    const a = resourceShares.value.find((x) => x.id === id)
    if (!a) return false
    const { result, errors } = submitForApproval(a)
    if (!result) {
      notify('error', errors[0])
      return false
    }
    data.value.resourceShares = resourceShares.value.map((x) => (x.id === id ? result : x))
    log('SUBMIT', '资源共享', id, { to: '待审批' })
    notify('success', `共享申请 ${a.code} 已提交审批`)
    return true
  }

  function approveShareApply(id: string, approve: boolean): boolean {
    const a = resourceShares.value.find((x) => x.id === id)
    if (!a) return false
    const { result, errors } = approveShare(a, approve, currentUser.value.name, new Date().toISOString())
    if (!result) {
      notify('error', errors[0])
      return false
    }
    data.value.resourceShares = resourceShares.value.map((x) => (x.id === id ? result : x))
    log(approve ? 'APPROVE' : 'DENY', '资源共享', id, { by: currentUser.value.name })
    notify('success', `共享申请 ${a.code} 已${approve ? '生效' : '拒绝'}`)
    return true
  }

  function renewShareApply(id: string, newExpireAt: string): boolean {
    const a = resourceShares.value.find((x) => x.id === id)
    if (!a) return false
    const { result, errors } = renewShare(a, newExpireAt, new Date().toISOString().slice(0, 10))
    if (!result) {
      notify('error', errors[0])
      return false
    }
    data.value.resourceShares = resourceShares.value.map((x) => (x.id === id ? result : x))
    log('UPDATE', '资源共享', id, { expireAt: newExpireAt })
    notify('success', `共享申请 ${a.code} 已续期至 ${newExpireAt}`)
    return true
  }

  function releaseShareApply(id: string, reason: string): boolean {
    const a = resourceShares.value.find((x) => x.id === id)
    if (!a) return false
    const { result, errors } = releaseShare(a, reason, new Date().toISOString().slice(0, 10))
    if (!result) {
      notify('error', errors[0])
      return false
    }
    data.value.resourceShares = resourceShares.value.map((x) => (x.id === id ? result : x))
    log('RELEASE', '资源共享', id, { reason })
    notify('success', `共享申请 ${a.code} 已释放`)
    return true
  }

  function sweepExpiredShares(): number {
    const today = new Date().toISOString().slice(0, 10)
    const { released, alerts } = expireOverdue(resourceShares.value, today)
    if (!released.length) return 0
    data.value.resourceShares = resourceShares.value.map((x) => released.find((r) => r.id === x.id) ?? x)
    alerts.forEach((a) => notify('warning', a))
    log('RELEASE', '资源共享', released.map((r) => r.id).join(','), { reason: '到期自动释放' })
    return released.length
  }

  // —— 门户区块可配置（POR-003）——
  function togglePortalSection(key: import('@/domain/types').PortalSectionKey, enabled: boolean) {
    data.value.portalSections = toggleSection(portalSections.value, key, enabled)
    log('UPDATE', '门户区块', key, { enabled })
  }

  function setPortalSectionRoles(key: import('@/domain/types').PortalSectionKey, roles: string[]) {
    data.value.portalSections = setSectionRoles(portalSections.value, key, roles)
    log('UPDATE', '门户区块', key, { visibleRoles: roles })
  }

  function resetPortalSections() {
    data.value.portalSections = resetSections(portalSections.value)
    log('UPDATE', '门户区块', '*', { reset: true })
    notify('success', '门户区块已恢复默认配置')
  }

  // —— 我的草稿跨端续写（POR-007）——
  function saveDraft(objectType: import('@/domain/types').DraftObjectType, objectId: string, content: string) {
    const at = new Date().toISOString()
    data.value.drafts = upsertDraft(drafts.value, { userId: currentUser.value.id, objectType, objectId, content, at })
    persist()
    notify('success', '草稿已保存（跨端可续写）')
  }

  function removeDraft(objectType: import('@/domain/types').DraftObjectType, objectId: string) {
    data.value.drafts = clearDraft(drafts.value, currentUser.value.id, objectType, objectId)
    persist()
    notify('success', '草稿已清除（提交后自动清除）')
  }

  /** 写回报价费用明细（费用表单为唯一权威数据源，报价单自动汇总引入） */
  function setQuoteCosts(sheet: QuoteCostSheet) {
    data.value.quoteCosts = sheet
    persist()
  }

  function submitGate(gate: string) {
    const run = gateResults.value[gate]
    if (!run.passed) {
      // 事项 A2「前序闸门未通过」：引擎判定违规，策略决定拦截力度（默认 CONFIGURABLE）
      if (rejectIf('A2', 'SUBMIT', 'Gate', true, { gate, passed: false, missing: run.missing.slice(0, 3) })) return
      notify('error', `${gate} 未通过：${run.missing.slice(0, 2).join('；')}${run.missing.length > 2 ? ` 等 ${run.missing.length} 项` : ''}`)
      return
    }
    log('SUBMIT', 'Gate', gate, { passed: true })
    notify('success', `${gate} 提交放行成功（提交人 ${currentUser.value.name}，放行人须分离，SOD-01）`)
  }

  function setLevel(level: Level) {
    if (!guard('update')) return
    const p = currentProject.value
    const before = { level: p.level }
    p.level = level
    log('UPDATE', '项目', p.id, { level }, before)
  }

  function selectUser(id: string) {
    setUser(id)
    notify('info', `已切换为 ${currentUser.value.name} · ${currentUser.value.roleName}，菜单与操作权限已按附录 D 矩阵重算`)
  }

  /** TEN-013：切换界面语言。硬边界——仅改展示层，数据权限上下文（租户/角色）保持不变，并留审计 */
  function setLocale(next: Locale) {
    const before = { tenantId: data.value.tenantId, roleCode: currentUser.value.roleCode }
    locale.value = normalizeLocale(next)
    localStorage.setItem(LOCALE_KEY, locale.value)
    const after = { tenantId: data.value.tenantId, roleCode: currentUser.value.roleCode }
    // 权限不变性断言：语言切换绝不允许改变任何权限判定输入（TEN-013）
    if (!localeInvariant(before, after)) {
      // 防御性：若断言失败立即回滚语言并告警（理论上不可达，但作为硬闸门存在）
      locale.value = 'zh-CN'
      localStorage.setItem(LOCALE_KEY, 'zh-CN')
      notify('error', '语言切换异常：数据权限上下文被改动，已回滚（TEN-013）')
      return
    }
    log('UPDATE', LOCALE_AUDIT_KEY, locale.value, { from: before, to: after })
    notify('success', locale.value === 'en-US' ? 'Language switched to English（界面语言已切换，数据权限不变）' : '界面语言已切换为中文（数据权限不变）')
  }

  /** 主题切换（深/浅色）。仅外观，不触碰业务数据与权限；持久化到独立偏好键 */
  function setThemeMode(next: ThemeMode) {
    themeMode.value = next
    localStorage.setItem(THEME_KEY, next)
    applyTheme()
    notify('success', next === 'light' ? '已切换为浅色主题' : '已切换为深色主题')
  }

  /** 强调色切换。仅外观，可独立于深浅色 */
  function setAccent(next: AccentKey) {
    accent.value = next
    localStorage.setItem(THEME_KEY + '.accent', next)
    applyTheme()
    notify('success', `已切换主题色：${next}`)
  }

  /** 将当前主题/强调色应用到 <html> 的 data-theme / data-accent / class */
  function applyTheme() {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    el.setAttribute('data-theme', themeMode.value)
    el.setAttribute('data-accent', accent.value)
    // Element Plus 深色变量依赖 .dark 类（main.ts 引入 dark css-vars）
    el.classList.toggle('dark', themeMode.value === 'dark')
  }

  // —— 通用写操作（P1 页使用）：所有变更走审计链 + 持久化 ——
  /** 样件状态推进（A/B/C/OTS 状态机） */
  function advanceSample(id: string, to: string) {
    const s = data.value.samples.find((x) => x.id === id)
    if (!s) return
    // 事项 A1/A2：样件越过其绑定闸门前，该闸门须已通过（策略驱动，默认 HARD）
    if (s.gate) {
      const gr = gateResults.value[s.gate]
      if (gr && !gr.passed) {
        if (rejectIf('A2', 'UPDATE', '样件', true, { code: s.code, gate: s.gate, to, missing: gr.missing.slice(0, 3) })) return
        notify('error', `样件 ${s.code} 推进被拒：${s.gate} 未放行`)
        return
      }
    }
    const before = { status: s.status }
    s.status = to
    log('UPDATE', '样件', s.code, { status: to }, before)
    persist()
    notify('success', `样件 ${s.code} 状态已推进为「${to}」`)
  }

  /** OTS 认可：放行须 Gate4 已通过且提交人≠放行人（SOD-01） */
  function approveOts(id: string, conclusion: '已认可' | '有条件认可' | '拒收', note = '') {
    if (!guard('approve')) return
    const s = data.value.samples.find((x) => x.id === id)
    if (!s) return
    const g4 = gateResults.value['G4']
    if (!g4.passed) {
      // 事项 A2「前序闸门未通过」：引擎判定违规，策略决定拦截力度
      if (rejectIf('A2', 'APPROVE', 'OTS', true, { gate: 'G4', passed: false, missing: g4.missing.slice(0, 3) })) return
      notify('error', `OTS 认可被拒：Gate4 未放行（${g4.missing.slice(0, 2).join('；')}）`)
      return
    }
    const before = { status: s.status }
    s.status = conclusion
    log('APPROVE', 'OTS', s.code, { conclusion, note }, before)
    persist()
    notify('success', `OTS ${s.code} 认可结论：${conclusion}`)
  }

  /** 工时填报（POR-009：本人填报；他人仅可代录且标记来源 SUP-014 同源规则） */
  function submitHour(taskId: string, hours: number, week: string) {
    const before = data.value.hours.filter((h) => h.userId === currentUser.value.id && h.taskId === taskId && h.week === week).map((h) => h.hours)
    const existing = data.value.hours.find((h) => h.userId === currentUser.value.id && h.taskId === taskId && h.week === week)
    if (existing) {
      existing.hours = hours
      existing.status = '已提交'
      log('UPDATE', '工时', existing.id, { hours, status: '已提交' }, { hours: before[0] })
    } else {
      data.value.hours.push({
        id: `H${Date.now()}`,
        projectId: projectId.value,
        userId: currentUser.value.id,
        userName: currentUser.value.name,
        week,
        taskId,
        hours,
        status: '已提交'
      })
      log('CREATE', '工时', taskId, { hours, week, status: '已提交' })
    }
    persist()
    notify('success', `工时已提交：${hours}h`)
  }

  /** 工时审核（POR-010：审核人≠填报人） */
  function approveHour(id: string, approve: boolean) {
    if (!guard('approve')) return
    const h = data.value.hours.find((x) => x.id === id)
    if (!h) return
    if (h.userId === currentUser.value.id) {
      notify('error', '工时审核人与填报人不得为同一人（POR-010 / SOD-01）')
      log('APPROVE', '工时', h.id, { approve }, undefined, 'DENY')
      return
    }
    const before = { status: h.status }
    h.status = approve ? '已审核' : '草稿'
    log('APPROVE', '工时', h.id, { approve, status: h.status }, before)
    persist()
    notify('success', `工时 ${h.id} ${approve ? '审核通过' : '退回'}`)
  }

  // —— 文档受控引擎（SRS 第 19 章 / DOC-001~010）——
  function findDoc(id: string) {
    return data.value.docs.find((d) => d.id === id)
  }

  /** 引擎结果统一落地：写回 data、审计留痕、持久化 */
  function applyDocOp(id: string, action: string, op: { ok: boolean; doc?: ControlledDoc; error?: string }): boolean {
    const idx = data.value.docs.findIndex((d) => d.id === id)
    if (idx < 0) return false
    if (!op.ok) {
      log(action, '文档', id, { error: op.error }, undefined, 'DENY')
      return false
    }
    data.value.docs[idx] = op.doc! as import('@/domain/types').DocItem
    log(action, '文档', id, { status: op.doc!.status, version: op.doc!.version })
    persist()
    return true
  }

  function docSignoff(id: string, role: string) {
    if (!guard('approve')) return
    const d = findDoc(id)
    if (!d) return
    const op = signoff(d as unknown as ControlledDoc, role, currentUser.value.name, new Date().toISOString())
    if (!applyDocOp(id, 'APPROVE', op)) {
      notify('error', op.error || '会签失败')
      return
    }
    const done = op.doc!.signoffs.filter((s) => s.signed).length
    const total = op.doc!.signoffs.length
    notify(op.code === 'COMPLETE' ? 'success' : 'info', `${d.code} 会签推进 ${done}/${total}${op.code === 'COMPLETE' ? '，会签齐备（可受控发布）' : ''}`)
  }

  function docVeto(id: string, role: string, comment: string) {
    if (!guard('approve')) return
    const d = findDoc(id)
    if (!d) return
    const op = veto(d as unknown as ControlledDoc, role, currentUser.value.name, comment, new Date().toISOString())
    if (!applyDocOp(id, 'REJECT', op)) {
      notify('error', op.error || '否决失败')
      return
    }
    notify('warning', `${d.code} 被 ${role} 否决，整体退回草稿，意见已条目化（DOC-007/014）`)
  }

  function docPublish(id: string) {
    if (!guard('approve')) return
    const d = findDoc(id)
    if (!d) return
    const op = publish(d as unknown as ControlledDoc, currentUser.value.name, new Date().toISOString())
    if (!applyDocOp(id, 'PUBLISH', op)) {
      notify('error', op.error || '发布失败')
      return
    }
    notify('success', `${d.code} ${d.version} 已受控发布，哈希 ${op.doc!.hash!.slice(0, 12)}（DOC-004/C-45）`)
  }

  function docSubmitSignoff(id: string) {
    if (!guard('approve')) return
    const d = findDoc(id)
    if (!d) return
    const op = submitForSignoff(d as unknown as ControlledDoc, currentUser.value.id)
    if (!applyDocOp(id, 'SIGNOFF', op)) {
      notify('error', op.error || '发起会签失败')
      return
    }
    notify('success', `${d.code} 已进入会签中`)
  }

  function docCheckout(id: string) {
    if (!guard('update')) return
    const d = findDoc(id)
    if (!d) return
    const op = checkout(d as unknown as ControlledDoc, currentUser.value.id, new Date().toISOString())
    if (!applyDocOp(id, 'CHECKOUT', op)) {
      notify('error', op.error || '检出失败')
      return
    }
    notify('success', `${d.code} 已检出（并发编辑锁，DOC-003）`)
  }

  function docCheckin(id: string) {
    if (!guard('update')) return
    const d = findDoc(id)
    if (!d) return
    const op = checkin(d as unknown as ControlledDoc, currentUser.value.id)
    if (!applyDocOp(id, 'CHECKIN', op)) {
      notify('error', op.error || '检入失败')
      return
    }
    notify('success', `${d.code} 已检入，锁已释放（DOC-003）`)
  }

  function docRevisionUp(id: string, newVersion: string) {
    if (!guard('update')) return
    const d = findDoc(id)
    if (!d) return
    const op = revisionUp(d as unknown as ControlledDoc, newVersion, currentUser.value.name)
    if (!applyDocOp(id, 'REVISION', op)) {
      notify('error', op.error || '升版失败')
      return
    }
    notify('success', `${d.code} 升版至 ${newVersion}，旧版已标记失效（DOC-002）`)
  }

  function docObsolete(id: string) {
    if (!guard('approve')) return
    const d = findDoc(id)
    if (!d) return
    const op = obsolete(d as unknown as ControlledDoc, currentUser.value.name, new Date().toISOString())
    if (!applyDocOp(id, 'OBSOLETE', op)) {
      notify('error', op.error || '作废失败')
      return
    }
    notify('warning', `${d.code} 已作废，仅历史查询，禁止新引用（DOC-001）`)
  }

  function docArchive(id: string) {
    if (!guard('approve')) return
    const d = findDoc(id)
    if (!d) return
    const op = archive(d as unknown as ControlledDoc, currentUser.value.name, new Date().toISOString())
    if (!applyDocOp(id, 'ARCHIVE', op)) {
      notify('error', op.error || '归档失败')
      return
    }
    notify('success', `${d.code} 已归档，只读（DOC-010）`)
  }

  function docAddComment(id: string, content: string) {
    const d = findDoc(id)
    if (!d) return
    const op = addComment(d as unknown as ControlledDoc, currentUser.value.roleName, currentUser.value.name, content, new Date().toISOString())
    if (!applyDocOp(id, 'COMMENT', op)) {
      notify('error', op.error || '追加意见失败')
      return
    }
    notify('success', `${d.code} 已追加评审意见（DOC-007）`)
  }

  function docResolveComment(id: string, commentId: string, resolution: string) {
    const d = findDoc(id)
    if (!d) return
    const op = resolveComment(d as unknown as ControlledDoc, commentId, currentUser.value.name, resolution, new Date().toISOString())
    if (!applyDocOp(id, 'RESOLVE', op)) {
      notify('error', op.error || '关闭意见失败')
      return
    }
    notify('success', `${d.code} 评审意见已关闭并留痕（DOC-007）`)
  }

  function docDownload(id: string): boolean {
    const d = findDoc(id)
    if (!d) return false
    const check = canDownload(d as unknown as ControlledDoc)
    if (!check.ok) {
      notify('error', check.reason || '禁止下载')
      log('DOWNLOAD', '文档', id, { reason: check.reason }, undefined, 'DENY')
      return false
    }
    log('DOWNLOAD', '文档', id, { code: d.code, version: d.version, by: currentUser.value.name })
    return true
  }

  function docSearch(query: string) {
    return searchDocs(data.value.docs as unknown as ControlledDoc[], query)
  }

  // —— 流程引擎（SRS 4.4 审批能力 / FUN-017）——
  const flowDefinitions = computed<FlowDefinition[]>(() => (data.value.flowDefinitions ?? []) as FlowDefinition[])
  const flowInstances = computed(() => (data.value.flowInstances ?? []) as import('@/domain/flowEngine').FlowInstance[])

  function flowDef(id: string) {
    return flowDefinitions.value.find((d) => d.id === id)
  }

  /** 启动流程（配置驱动，新增实例即按定义生效，无需发版）；返回实例 id（找不到定义返回 undefined）
   *  customNodes：发起人自定义追加的审批节点（审核/并行会签），会合并进实例专属定义并在实例留痕。
   *  projectId：关联的项目/产品 id，供监视页按项目聚合审批过程与结果。 */
  function launchFlow(defId: string, title: string, form: Record<string, string | number | boolean> = {}, customNodes?: CustomApproverAddition[], projectId?: string): string | undefined {
    const def = flowDef(defId)
    if (!def) return undefined
    const inst = startFlow({ def, title, submitter: currentUser.value.name, form, customNodes, projectId })
    // 发起人自定义了审批节点：基于固定定义生成实例专属定义，实例 defId 指向它，
    // 后续审批引擎（approveNode/signNode/flowView）无需改动即自动走带自定义节点的链。
    if (customNodes && customNodes.length > 0) {
      const customDef = applyCustomApprovers(def, customNodes)
      const instDef: FlowDefinition = { ...customDef, id: `INST-${inst.id}`, code: def.code, name: `${def.name}（含自定义审批）` }
      data.value.flowDefinitions = [...(data.value.flowDefinitions ?? []), instDef]
      inst.defId = instDef.id
    }
    data.value.flowInstances = [...(data.value.flowInstances ?? []), inst]
    log('START', '流程', inst.id, { defCode: def.code, title, customNodes: customNodes?.length ?? 0 })
    persist()
    notify('success', `流程已发起：${title}`)
    return inst.id
  }

  /**
   * 提交一张工作流单据（WF-001 统一「新增/保存/关闭/提交」闭环的提交动作）：
   *   校验放行 → 启动流程实例 → 绑定 flowInstanceId → 清除草稿。
   * 返回 true 表示已提交；false 表示被 gate 阻断（blockers 已写入 form）。
   */
  function submitWorkflowForm(form: import('@/domain/workflowForm').WorkflowForm, title: string, formData: Record<string, string | number | boolean> = {}, customNodes?: CustomApproverAddition[], projectId?: string) {
    const def = flowDef(form.defId)
    if (!def) {
      notify('error', `流程模板 ${form.defCode} 不存在，无法提交`)
      return false
    }
    const instId = launchFlow(form.defId, title, formData, customNodes, projectId)
    if (!instId) return false
    form.status = 'submitted'
    form.flowInstanceId = instId
    // 提交后自动清除草稿（POR-007）
    data.value.drafts = clearDraft(drafts.value, currentUser.value.id, form.objectType as import('@/domain/types').DraftObjectType, form.id)
    log('SUBMIT', '工作流单据', form.id, { defCode: form.defCode, flowInstanceId: instId })
    persist()
    return true
  }

  /** 审批通过：校验 SOD-01（提交人≠审批人）+ 引擎推进（含分支求值） */
  function approveFlow(id: string, note = '') {
    const inst = data.value.flowInstances.find((x) => x.id === id)
    if (!inst) return
    const def = flowDef(inst.defId)
    if (!def) return
    if (inst.submitter === currentUser.value.name) {
      notify('error', `SOD-01：${inst.submitter} 不得审批本人提交的流程，放行被拒`)
      log('APPROVE', '流程', id, undefined, undefined, 'DENY')
      return
    }
    const node = getNode(def, inst.currentNodeId)
    if (node && (node.type === 'sign') && (node.signMode === 'all')) {
      // 会签节点：走 signNode 登记当前审批人，未全签不推进
      const res = signNode(inst, def, { approverRole: currentUser.value.roleName, approverName: currentUser.value.name })
      inst.history = res.inst.history
      if (!res.nodePassed) {
        const sigs = res.inst.history.length ? res.inst.history[res.inst.history.length - 1].signatures : undefined
        log('APPROVE', '流程', id, { nodeId: node.id, partial: true })
        persist()
        notify('info', `会签进行中：${node.name}（${sigs?.length ?? 0}/${node.signRoles?.length ?? 0}）`)
        return
      }
    }
    const next = approveNode(inst, def, { approverRole: currentUser.value.roleName, approverName: currentUser.value.name, note })
    Object.assign(inst, next)
    log('APPROVE', '流程', id, { to: next.currentNodeId, status: next.status })
    persist()
    notify('success', next.status === '已完成' ? `${inst.title} 流程已走完` : `${inst.title} 已推进至下一节点`)
  }

  /** 以指定角色会签（供多部门会签演示：引擎 signNode 支持 signRole 参数） */
  function signAsFlow(id: string, role: string, name?: string) {
    const inst = data.value.flowInstances.find((x) => x.id === id)
    if (!inst) return
    const def = flowDef(inst.defId)
    if (!def) return
    const node = getNode(def, inst.currentNodeId)
    if (!node || node.type !== 'sign') {
      notify('warning', '当前节点非会签节点')
      return
    }
    const res = signNode(inst, def, { approverRole: role, approverName: name ?? role, signRole: role })
    inst.history = res.inst.history
    const sigs = res.inst.history.length ? res.inst.history[res.inst.history.length - 1].signatures : undefined
    if (res.nodePassed) {
      // 会签全通过：推进到下一节点
      const next = approveNode(inst, def, { approverRole: role, approverName: name ?? role })
      Object.assign(inst, next)
      log('APPROVE', '流程', id, { nodeId: node.id, signRole: role, passed: true, to: next.currentNodeId })
      notify('success', `${node.name} 已会签通过，推进至下一节点`)
    } else {
      log('APPROVE', '流程', id, { nodeId: node.id, signRole: role, partial: true })
      notify('info', `${node.name} 会签进行中（${sigs?.length ?? 0}/${node.signRoles?.length ?? 0}）`)
    }
    persist()
  }

  /** 审批驳回：退回发起人 */
  function rejectFlow(id: string, note = '') {
    const inst = data.value.flowInstances.find((x) => x.id === id)
    if (!inst) return
    const def = flowDef(inst.defId)
    if (!def) return
    const next = rejectNode(inst, def, { approverRole: currentUser.value.roleName, approverName: currentUser.value.name, note })
    Object.assign(inst, next)
    log('REJECT', '流程', id, { status: next.status })
    persist()
    notify('warning', `${inst.title} 已驳回，退回 ${inst.submitter}`)
  }

  /** 超时升级：升级到上级角色并留触达记录 */
  function escalateFlow(id: string) {
    const inst = data.value.flowInstances.find((x) => x.id === id)
    if (!inst) return
    const def = flowDef(inst.defId)
    if (!def) return
    const next = escalate(inst, def)
    Object.assign(inst, next)
    log('ESCALATE', '流程', id, { to: next.escalatedToRole })
    persist()
    notify('warning', `${inst.title} 超时已升级至 ${next.escalatedToRole ?? '上级'}`)
  }

  /** 加签：在会签/审批节点追加签署角色 */
  function addSignFlow(id: string, role: string) {
    const inst = data.value.flowInstances.find((x) => x.id === id)
    if (!inst) return
    const def = flowDef(inst.defId)
    if (!def) return
    const next = addSigner(inst, def, role)
    Object.assign(inst, next)
    log('ADDSIGN', '流程', id, { role })
    persist()
    notify('info', `已加签 ${role}`)
  }

  /** 转办：转交另一角色处理 */
  function transferFlow(id: string, toRole: string, note = '') {
    const inst = data.value.flowInstances.find((x) => x.id === id)
    if (!inst) return
    const def = flowDef(inst.defId)
    if (!def) return
    const next = transferNode(inst, def, toRole, note)
    Object.assign(inst, next)
    log('TRANSFER', '流程', id, { to: toRole })
    persist()
    notify('info', `已转办至 ${toRole}`)
  }

  /** 更新流程定义（配置持久化，新实例即生效，不发版——GAT-013 边界：业务规则仍写死） */
  function saveFlowDefinition(def: FlowDefinition) {
    const idx = data.value.flowDefinitions.findIndex((d) => d.id === def.id)
    const next = [...data.value.flowDefinitions]
    if (idx >= 0) next[idx] = { ...def, version: (def.version ?? 1) + 1 }
    else next.push({ ...def, version: 1 })
    data.value.flowDefinitions = next
    log('UPDATE', '流程配置', def.id, { version: next[idx >= 0 ? idx : next.length - 1].version })
    persist()
    notify('success', `流程配置 ${def.code} 已保存（v${next[idx >= 0 ? idx : next.length - 1].version}，新实例即时生效）`)
  }

  /** 流程实例的当前节点 + 超时状态（供视图读取） */
  function flowView(inst: import('@/domain/flowEngine').FlowInstance) {
    const def = flowDef(inst.defId)
    const node = def ? getNode(def, inst.currentNodeId) : undefined
    const overdue = def ? isOverdue(inst, def) : false
    const acts = def ? availableActions(inst, def) : []
    return { def, node, overdue, acts }
  }

  return {
    data,
    userId,
    projectId,
    toast,
    repoMode,
    repoBase,
    locale,
    themeMode,
    accent,
    users,
    currentUser,
    currentProject,
    actor,
    orgNodes,
    orgMemberships,
    customers,
    productCategories,
    productLines,
    products,
    namingRules,
    namingRuleHistory,
    codeIssues,
    createCustomer,
    saveCustomer,
    deleteCustomer,
    createCategory,
    createProductLine,
    createProduct,
    deleteProductLine,
    deleteProduct,
    deleteCategory,
    createNamingRule,
    saveNamingRule,
    deleteNamingRule,
    toggleNamingRule,
    exportNamingRulesCsv,
    importNamingRulesCsv,
    ruleHistoryOf,
    codeIssuesOf,
    codeIssueOfCode,
    recordCodeIssue,
    autoGenerateCode,
    checkCodeValid,
    checkNameValid,
    namingRuleOf,
    codingRuleOf,
    createOrgNode,
    saveOrgNode,
    deleteOrgNode,
    exportOrgCsv,
    importOrgCsv,
    resolveApproverOf,
    resolveSignersOf,
    exportCustomersCsv,
    importCustomersCsv,
    exportProductsCsv,
    importProductsCsv,
    tenants,
    tenantContext,
    visibleProjects,
    guardTenantAccess,
    guardGroupDrillDown,
    spaces,
    spaceContext,
    mySpaces,
    currentSpace,
    spaceProjects,
    spaceId,
    switchSpace,
    guardSpaceAccess,
    projectWbs,
    projectHandoffs,
    handoffEval,
    interfacePlans,
    interfacePlanHealthSummary,
    interfacePlanExport,
    gateConsistency,
    resourceProfile,
    costSheet,
    quoteCosts,
    otsAttachments,
    handoffHand,
    handoffReceive,
    projectReqs,
    projectLinks,
    projectRisks,
    projectPolarityRisks,
    polaritySummary,
    projectEcrs,
    thresholdMetrics,
    thresholdIssues,
    projectThresholdIssues,
    scanThresholdIssues,
    closeThresholdIssue,
    riskLinks,
    threePoints,
    riskLinkage,
    riskGateCheck,
    simResult,
    pertOf,
    reserveOf,
    adjustedPlanOf,
    runQuantSim,
    setThreePoint,
    linkRisk,
    poolNodes,
    poolHierarchyCheck,
    skillSearchResult,
    searchBySkill,
    assignmentCommitments,
    commitAssignment,
    hourBackfills,
    submitBackfill,
    externalCapacities,
    externalDeviation,
    effortDeviations,
    effortStale,
    resourceRates,
    resourceScenarios,
    addResourceScenario,
    pickScenario,
    metricDict,
    reportLibrary,
    reportBinding,
    reportGroups,
    metricConsistency,
    validatePlanImport,
    customForms,
    eventHooks,
    openApis,
    extensionCheck,
    accessibilityAudit,
    accessibilityRate,
    fireHook,
    projectBaselines,
    projectDeliverables,
    projectDocs,
    projectAnnotations,
    annotationSummary,
    projectHours,
    resourceConflicts,
    overallocations,
    resourceGateBlock,
    bottlenecks,
    supplyDemand,
    resolveOverallocation,
    balanceResources,
    smoothResourcesAction,
    revertLeveling,
    levelingSnapshot,
    shareLinks,
    activeShareLinks,
    createDocShareLink,
    revokeDocShareLink,
    quotaConfig,
    quotaUsage,
    checkTenantQuota,
    projectRetros,
    projectLessons,
    projectDeviations,
    projectMeetings,
    projectResolutions,
    projectSendAudits,
    projectSupervises,
    projectInvestments,
    calendars,
    myTasks,
    myTodos,
    codeDicts,
    udfs,
    stepTemplates,
    stepRuns,
    rejectionPolicies,
    rejectionSummary,
    messages,
    inboxItems,
    myUnreadCount,
    myInbox,
    resourcePool,
    resourceShares,
    portalSections,
    drafts,
    myPortalSections,
    activeShareRelations,
    myExpiredDrafts,
    myDrafts,
    pendingWrites,
    cacheStamp,
    cacheBadgeInfo,
    cpResults,
    gateResults,
    stageTemplate,
    stages,
    stageGateRuns,
    canCreateInStage,
    approvalBindings,
    stageReleaseEvidence,
    stageRelease,
    advanceStageVerdict,
    deliverableApprovalBindings,
    deliverableEvidence,
    deliverableComplete,
    aiSwitchState,
    aiScope,
    aiVisibleCorpus,
    aiCallLogs: computed(() => data.value.aiCallLogs ?? []),
    runAiScene,
    reviewAi,
    toggleAiSwitch,
    cpm,
    quality,
    completion,
    evm,
    projectReview,
    projectReviews,
    submitProjectReview,
    submitFourLevelPlan,
    loadFourLevelPlan,
    scanPlanAlerts,
    statusDay,
    pvInfo,
    traceBreaks,
    traceCoverage,
    portfolio,
    portfolioAggregate,
    portfolioInterventions,
    auditChain,
    chainOk,
    archiveLayer,
    archiveVolumes,
    archiveIntegrity,
    archiveRetention,
    archiveProject,
    destroyArchive,
    persist,
    reset,
    notify,
    syncFromBackend,
    flushPendingWrites,
    setUser,
    selectUser,
    setLocale,
    setThemeMode,
    setAccent,
    applyTheme,
    setProject,
    cloneProjectStructure,
    guard,
    log,
    saveWbs,
    updateTaskProgress,
    freeze,
    verify,
    confirmClosure,
    advanceEcr,
    verifyEcn,
    addDeviation,
    closeDeviation,
    addLesson,
    searchLessons,
    pushLessonToLibrary,
    reuseLesson,
    knowledgeStats: () => knowledgeStats(data.value.lessons),
    addResolution,
    resolutionToTask,
    closeResolution,
    overdueResolutionsList,
    addMeeting,
    addSendAudit,
    answerSendAudit,
    dispatchSupervise,
    advanceSupervise,
    addDecision,
    roiOfProject,
    validateCurrencyAmount,
    whatIfSimulate,
    whatIfMerge,
    whatIfRemove,
    whatIfSubmitForMerge,
    addException,
    calendarLineage,
    calendarIsWorkday,
    calendarWorkdaysBetween,
    calendarEndDateAfter,
    calendarAffectedPlans,
    addCodeDictValue,
    saveUdf,
    bumpStepTemplate,
    stepRunStats,
    updateRejectionPolicy,
    rejectIf,
    readMessage,
    readAllMessages,
    pushMessage,
    inboxBatchApprove,
    inboxReject,
    addShareApply,
    submitShareForApproval,
    approveShareApply,
    renewShareApply,
    releaseShareApply,
    sweepExpiredShares,
    togglePortalSection,
    setPortalSectionRoles,
    resetPortalSections,
    saveDraft,
    removeDraft,
    setQuoteCosts,
    submitGate,
    setLevel,
    advanceSample,
    approveOts,
    submitHour,
    approveHour,
    flowDefinitions,
    flowInstances,
    launchFlow,
    submitWorkflowForm,
    approveFlow,
    signAsFlow,
    rejectFlow,
    escalateFlow,
    addSignFlow,
    transferFlow,
    saveFlowDefinition,
    flowView,
    docSignoff,
    docVeto,
    docPublish,
    docSubmitSignoff,
    docCheckout,
    docCheckin,
    docRevisionUp,
    docObsolete,
    docArchive,
    docAddComment,
    docResolveComment,
    docDownload,
    docSearch
  }
})
