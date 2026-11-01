/**
 * MOFENG-RDP 领域层公共类型
 * 依据：SRS V1.4 第 9 章对象模型、ARC-004 受控对象五要素
 * 约束：本层不得依赖 vue / element-plus / pinia / DOM（ARC-001）
 */

export type Level = 'L1' | 'L2' | 'L3' | 'L4'
export type Strength = 'L4' | 'L3' | 'L2' | 'L1'
export type Verdict = 'PASS' | 'CONDITIONAL' | 'FAIL'

export const STRENGTH_LABEL: Record<Strength, string> = {
  L4: 'L4 硬阻断',
  L3: 'L3 条件放行',
  L2: 'L2 预警升级',
  L1: 'L1 仅留痕'
}

/** 审计七元组（附录 B.3 audit_log） */
export interface ActorContext {
  userId: string
  userName: string
  roleCode: string
  roleName: string
  tenantId: string
  projectId?: string
  at?: string
}

export interface Evidence {
  kind: 'field' | 'object' | 'metric' | 'file'
  ref: string
  label: string
  value?: string | number
}

export interface ControlPointResult {
  code: string
  object: string
  timing: string
  criteria: string
  strength: Strength
  disposition: string
  verdict: Verdict
  measured: string
  evidence: Evidence[]
  blocker?: string
}

export interface RuleTrace {
  hitRowNo: number
  hitRowText: string
  tableVersion: string
  snapshotHash: string
  decidedBy: string
  decidedAt: string
}

export type GradingSelfDev = 'FULL' | 'PARAM_ONLY' | 'NONE_HW' | 'NONE_DOC'
export type Asil = 'D' | 'C' | 'B' | 'A' | 'QM'

export interface GradingInput {
  asil: Asil | ''
  cal: 0 | 1 | 2 | 3 | 4 | -1
  selfDev: GradingSelfDev | ''
  newArch: boolean | null
  customerSafety: boolean | null
}

export interface GradingResult {
  level: Level | null
  hitRowNo: number
  basis: string
  controlPoints: string
  trace: RuleTrace
  checks: { code: string; name: string; ok: boolean; note: string }[]
  missing: string[]
}

/** 需求条目（REQ-001~005） */
export interface Requirement {
  id: string
  code: string
  projectId: string
  type: 'SG' | 'FSR' | 'TSR' | 'HSR' | 'SSSR' | 'SEC' | 'TC' | 'VER'
  title: string
  asil: Asil
  cal: number
  status: '草稿' | '评审中' | '已批准' | '已基线化' | '变更中' | '已废弃'
  version: number
  parentId?: string
  baselineId?: string
  owner: string
  verifyMethod: string
  createdAt: string
}

export interface TraceLink {
  id: string
  srcType: 'REQ' | 'TC' | 'VER'
  srcId: string
  dstType: 'REQ' | 'TC' | 'VER'
  dstId: string
  linkType: 'derive' | 'verify' | 'implement'
  baselineId?: string
  status: 0 | 1
}

export interface WbsNode {
  id: string
  projectId: string
  code: string
  name: string
  parentId?: string
  level: number
  deliverable: string
  ownerRole: string
  duration: number
  planStart: number
  planFinish: number
  actualStart?: number
  actualFinish?: number
  percent: number
  weight: number
  isMilestone?: boolean
  gate?: string
  deps: { predId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[]
  constraint?: 'HARD' | 'SOFT' | ''
  calendar?: string
  resource?: string
  cost?: number
  actualCost?: number
}

export interface GateDef {
  code: string
  name: string
  stage: string
  slaHours: number
  items: { code: string; name: string; required: boolean; safety?: boolean; cp?: string }[]
}

export interface GateRun {
  gate: string
  projectId: string
  passed: boolean
  conditional: boolean
  missing: string[]
  safetyBlocked: boolean
  results: { code: string; name: string; ok: boolean; cp?: string; note: string }[]
  submittedBy?: string
  releasedBy?: string
}

export interface Baseline {
  id: string
  projectId: string
  no: string
  type: string
  status: '组建中' | '已冻结' | '已被替代'
  items: { objType: string; objId: string; objVersion: number; rowHash: string; snapshot: Record<string, unknown> }[]
  manifestHash: string
  frozenAt?: string
  frozenBy?: string
}

export interface AuditRow {
  seq: number
  occurredAt: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  objType: string
  objId: string
  before?: unknown
  after?: unknown
  result: 'OK' | 'DENY'
  tenantId: string
  prevHash: string
  rowHash: string
}

export interface RiskItem {
  id: string
  projectId: string
  code: string
  title: string
  failureMode: string
  cause: string
  consequence: string
  trigger: string
  severity: number
  occurrence: number
  detection: number
  strategy: string
  owner: string
  status: '开放' | '缓解中' | '已关闭'
  residual?: number
  /** 关闭时的签署人（C-15：高 RPN≥200 需双签） */
  signatures?: string[]
}

export interface EcrItem {
  id: string
  projectId: string
  code: string
  title: string
  sourceObjType: string
  sourceObjId: string
  stage: '影响评估' | '审批中' | 'ECN执行' | 'ECN验证' | '已关闭'
  impacts: { dim: string; assessed: boolean; note: string }[]
  closure: { objType: string; objId: string; objCode: string; decision: '' | '修改' | '确认无影响' | '废弃'; note: string }[]
  highRisk: boolean
  /** C-18：ECN 已执行后是否通过验证（验证结论：验证通过/验证不通过），未验证不得关闭 */
  ecnVerification?: { verified: boolean; note: string }
}

export interface Supplier {
  id: string
  code: string
  name: string
  type: string
  qualified: boolean
  qualifyExpire: string
  nominated: boolean
  ppapStatus: '未提交' | '审核中' | '已批准' | '拒收'
  ppapElements: number
  riskLevel: '低' | '中' | '高'
  sqe: string
}

export interface SampleReq {
  id: string
  projectId: string
  code: string
  type: 'A' | 'B' | 'C' | 'OTS'
  qty: number
  needDate: string
  gate: string
  status: string
  ebomVersion: string
}

export interface BomNode {
  id: string
  projectId: string
  materialCode: string
  name: string
  parentMaterialCode?: string
  qty: number
  version: string
  frozen: boolean
  supplierCode?: string
  stock: number
  incoming: number
}

export interface DocSignoff {
  role: string
  signed: boolean
  veto?: boolean
  signedAt?: string
  signedBy?: string
  vetoComment?: string
  vetoedAt?: string
}

export interface DocComment {
  id: string
  role: string
  author: string
  content: string
  createdAt: string
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: string
  resolution?: string
}

export interface DocVersionNode {
  version: string
  status: '有效' | '已失效' | '已作废' | '草稿'
  publishedAt?: string
  hash?: string
  author: string
  remark?: string
}

export interface DocItem {
  id: string
  projectId: string
  code: string
  name: string
  discipline: string
  version: string
  status: '草稿' | '会签中' | '已发布' | '已作废'
  required: boolean
  signoffs: DocSignoff[]
  mdrSet: string
  comments: DocComment[]
  versionChain: DocVersionNode[]
  checkoutBy?: string
  checkoutAt?: string
  effectiveFlag?: boolean
  hash?: string
  archivedAt?: string
  retentionDue?: string
}

export interface Deliverable {
  id: string
  projectId: string
  code: string
  name: string
  category: string
  required: boolean
  provided: boolean
  gate: string
}

export interface Project {
  id: string
  code: string
  name: string
  customer: string
  productLine: string
  platform: string
  owner: string
  start: string
  end: string
  status: '策划中' | '进行中' | '已归档'
  level: Level | null
  grading?: { input: GradingInput; result: GradingResult }
  budget: number
  spent: number
  strategic: number
  financial: number
  technology: number
  health: '绿' | '黄' | '红' | '灰'
  resourceRatio: number
  planFrozen: boolean
  /** 租户归属（TEN-004 数据强隔离：缺省视为集团租户 T-1001） */
  tenantId?: string
}

export interface HourRecord {
  id: string
  projectId: string
  userId: string
  userName: string
  week: string
  taskId: string
  hours: number
  status: '草稿' | '已提交' | '已审核'
}

export interface RoleDef {
  code: string
  name: string
  scope: string
  actions: Record<'view' | 'create' | 'update' | 'delete' | 'approve' | 'export', '●' | '○' | '—'>
  limits: string
}

/** C-34：阶段复盘记录（目标达成 / 偏差原因 / 改进项，三要素齐全才判完成） */
export interface RetroItem {
  id: string
  projectId: string
  stage: string
  goalMet: string
  deviationReason: string
  improvement: string
}

/** 经验条目推送记录（COM-010：回存资料库留痕，推送记录可查） */
export interface LessonPushRecord {
  at: string
  target: string // 资料库目录 / 空间标识
  by: string
}

/** C-35 / COM-010：经验库条目（入库并打标签，可被后续项目跨项目检索复用） */
export interface LessonItem {
  id: string
  projectId: string
  code: string
  title: string
  content: string
  tags: string[] // 自由标签（如 硬件/EMC/ASIL-B）
  stage: string // 阶段标签（COM-010：登记必带阶段标签）
  category: string // 问题类型标签（COM-010：登记必带主题，可按问题类型检索）
  sourceRetroId?: string // 来源复盘记录（可追溯）
  pushedTo: string[] // 已回存资料库的目标标识（幂等：去重）
  pushLog: LessonPushRecord[] // 推送记录（COM-010：推送记录可查）
  reusedBy: string[] // 复用该经验的项目 id（复用统计）
  createdAt: string
}

/** C-46：纠偏项（措施回写计划 + 偏差重算，两者完成方可关闭） */
export interface DeviationItem {
  id: string
  projectId: string
  code: string
  measure: string
  planUpdated: boolean
  deviationRecomputed: boolean
  status: '开放' | '已关闭'
}

// —— COM 协同沟通域（FUN-024 项目门户与协同沟通，COM-001~009）——

/** 会议决议条目（COM-006：决议必为条目结构；COM-007：转任务；COM-008：逾期升级与关闭判定） */
export interface ResolutionItem {
  id: string
  projectId: string
  meetingId: string
  code: string
  content: string
  owner: string // 责任人（COM-006：缺责任人不可保存）
  due: string // 期限（COM-006：缺期限不可保存）
  status: '待执行' | '执行中' | '已闭环'
  taskId?: string // 转任务后的任务 id（COM-007：同一决议不重复建任务）
  evidence?: string // 关闭证据（COM-008：无证据关闭被拒）
  createdAt: string
}

/** 会议（COM-005 策划四要素 + COM-006 记录与决议条目化 + COM-012 与 Gate 关联） */
export interface MeetingItem {
  id: string
  projectId: string
  code: string
  title: string
  date: string
  stage?: string // 关联阶段（COM-005）
  gateId?: string // 关联 Gate（COM-012）
  host: string // 主持人
  attendees: string[] // 参会人
  agenda: string // 议题
  minutes: string // 纪要
  resolutions: string[] // 决议条目 id（条目化，不裸存文本）
  status: '策划中' | '已召开' | '已归档'
}

/** 送审件（COM-001 登记与流转 + COM-002 超时升级；送审与答复留痕） */
export interface SendAuditItem {
  id: string
  projectId: string
  code: string
  title: string
  version: string // COM-001：必带版本
  reviewerType: '客户' | '内部' | '供应商'
  reviewer: string // 送审对象
  sentAt: string
  dueAt: string // 答复期限
  status: '待答复' | '已答复' | '已超期'
  answers: { at: string; by: string; content: string }[] // 往返记录（COM-001：全程留痕）
  escalated: boolean // COM-002：超时升级
}

/** 督办事项（COM-009：交办→反馈→复核→销项 四态闭环，超期自动升级） */
export interface SuperviseItem {
  id: string
  projectId: string
  code: string
  title: string
  owner: string
  due: string
  status: '交办' | '反馈' | '复核' | '已销项'
  actions: { at: string; by: string; action: '交办' | '反馈' | '复核' | '销项'; note: string }[] // 四动作留痕
  escalated: boolean
}

// —— PFM 组合与投资域（FUN-023，PFM-020/022/024/025/026）——

/** 项目收益计划（PFM-022：缺收益计划不出结论只提示；现金流单位万元，含币种） */
export interface ProjectInvestment {
  id: string
  projectId: string
  currency: string // PFM-024：金额无币种保存被拒
  /** 各年净现金流（第 0 年为投入，取负值），单位万元 */
  cashflows: number[]
  /** 折现率来源（PFM-022：折现率只读并带下发来源） */
  discountRateSource: string
  createdAt: string
}

/** 优选决策记录（PFM-020：理由/决策人/日期/影响项目清单，终止项目必有收尾计划） */
export interface DecisionRecord {
  id: string
  code: string
  reason: string // 取舍理由
  decider: string // 决策人
  date: string
  affectedProjectIds: string[] // 影响项目清单
  alternatives: string // 备选方案
  closurePlan?: string // 被终止项目收尾安排（终止项目必填）
  action: '延后' | '缩减' | '终止' | '采纳'
  createdAt: string
}

/** What-if 模拟场景（PFM-025 隔离 + PFM-026 差异对比与合并审批） */
export interface WhatIfScenario {
  id: string
  name: string
  baseProjectIds: string[] // 基准项目（主计划）
  /** 模拟调整：项目 → 预算/资源变更（只影响模拟，不碰主计划） */
  adjustments: { projectId: string; budget?: number; resourceRatio?: number; status?: string }[]
  createdAt: string
  /** 差异快照（PFM-026 四类差异：预算/资源/进度/状态） */
  diffs?: { projectId: string; field: string; base: number | string; simulated: number | string }[]
  /** 合并审批状态（PFM-026：未经审批的合并入口不存在） */
  mergeStatus: '草稿' | '待审批' | '已合并'
}

/** 三层日历（TEN-015）：企业 / 项目 / 资源，下层继承上层，可定义例外工作日与休息日 */
export type CalendarLevel = '企业' | '项目' | '资源'

export interface CalendarException {
  id: string
  date: string // ISO 日期 YYYY-MM-DD
  type: '工作日' | '休息日' // 例外类型（相对继承层的覆盖）
  reason: string
}

export interface CalendarDef {
  id: string
  level: CalendarLevel
  name: string
  /** 继承链：资源日历 → 项目日历 → 企业日历（越靠前越细，优先级越高） */
  parentId?: string
  /** 标准工作制：每周工作日（1=周一 … 7=周日） */
  workdays: number[]
  /** 默认每日可用工时 */
  hoursPerDay: number
  /** 例外日（覆盖继承的工作制） */
  exceptions: CalendarException[]
  /** 归属（企业级挂租户、项目级挂项目、资源级挂资源） */
  scopeId?: string
}

// —— 治理配置域（TEN-016 分类码 / UDF / 步骤模板）——

/** 分类码（TEN-016：三类分类码可配可筛，新增码值不追溯历史） */
export type CodeDictDomain = '项目' | '活动' | '资源'

export interface CodeDict {
  id: string
  domain: CodeDictDomain
  name: string // 分类码名（如 产品线、专业、平台）
  values: string[] // 码值列表
  version: string
}

/** 六类 UDF 挂接对象（TEN-016：项目 / WBS / 活动 / 资源 / 分配 / 费用） */
export type UdfTarget = '项目' | 'WBS' | '活动' | '资源' | '分配' | '费用'

export interface UdfDef {
  id: string
  target: UdfTarget
  name: string
  type: '文本' | '数字' | '枚举' | '日期' | '布尔'
  required: boolean
  /** 枚举取值范围（type=枚举 时生效）；数字可设 min/max */
  enumValues?: string[]
  min?: number
  max?: number
  /** 是否参与核心规则（仅扩展展示/筛选，不参与分级门禁追溯） */
  core: boolean
}

/** 步骤模板（TEN-016：活动内可勾选检查步骤，模板版本化，已执行活动不受新版本影响） */
export interface StepTemplate {
  id: string
  name: string
  version: number
  steps: { id: string; name: string; required: boolean }[]
}

/** 步骤执行实例（挂活动，统计步骤完成度） */
export interface StepRun {
  id: string
  templateId: string
  activityId: string
  /** 勾选完成的步骤 id */
  doneStepIds: string[]
  templateVersion: number // 执行时锁定的模板版本
}

// —— 工作中心消息与收件箱（POR-006 已读回执 + POR-008 收件箱）——

/** 消息（POR-006：未读/已读回执/同一事件 24h 去重） */
export interface MessageItem {
  id: string
  userId: string // 接收人
  eventKey: string // 事件去重键（同一事件 24h 不重复打扰）
  title: string
  content: string
  category: '送审' | '决议' | '督办' | '审批' | '系统'
  read: boolean
  readAt?: string
  createdAt: string
  /** 关联对象（供跳转） */
  refType?: string
  refId?: string
}

/** 收件箱条目（POR-008：送审件 / 联系单 / 决议转任务 三类来件） */
export type InboxKind = '送审件' | '联系单' | '决议'

export interface InboxItem {
  id: string
  kind: InboxKind
  userId: string // 收件人（答复/审批人）
  title: string
  from: string // 发起方
  sentAt: string
  dueAt: string // 答复期限
  status: '待处理' | '已答复' | '已退回' | '已超期'
  /** 批量审批逐条留痕 */
  actions: { at: string; by: string; action: '答复' | '退回' | '审批'; note: string }[]
}

// —— 跨节点资源共享（PFM-016：未审批不得占用、到期自动释放、共享关系可见）——

/** 资源池成员（PFM-016 共享关系的宿主；原 PoolView 硬编码假数据收编为受控实体） */
export interface ResourcePoolMember {
  id: string
  name: string
  role: string
  skills: string[]
  /** 归属节点（EPS 节点 id，跨节点共享的边界） */
  nodeId: string
  available: boolean
}

/** 共享申请状态机（PFM-016）：草稿 → 待审批 → 已生效 / 已拒绝；生效后按期限，到期未续期自动释放 */
export type ShareApplyStatus = '草稿' | '待审批' | '已生效' | '已拒绝' | '已释放'

export interface ResourceShareApply {
  id: string
  code: string
  /** 来源节点（借出方） */
  fromNodeId: string
  /** 目标节点（借用方） */
  toNodeId: string
  resourceId: string // 关联 ResourcePoolMember
  resourceName: string
  /** 占用开始 / 到期（ISO 日期） */
  startAt: string
  expireAt: string
  status: ShareApplyStatus
  /** 审批留痕 */
  approvedBy?: string
  approvedAt?: string
  /** 释放记录（到期自动 / 手动提前） */
  releasedAt?: string
  releaseReason?: string
  createdAt: string
}

// —— 门户区块可配置（POR-003：不同角色看到不同门户、越权不渲染、可恢复默认）——

export type PortalSectionKey = 'overview' | 'progress' | 'risk' | 'delivery' | 'meeting' | 'sendAudit' | 'announce'

export interface PortalSectionConfig {
  key: PortalSectionKey
  title: string
  /** 可见角色（roleCode 列表；空表示所有角色可见） */
  visibleRoles: string[]
  /** 排序权重（越小越靠前） */
  order: number
  /** 是否启用（关闭即前端不渲染 + 数据不聚合） */
  enabled: boolean
}

// —— 我的草稿跨端续写（POR-007：跨端内容一致、超期提示不静默删除、提交后清除）——

export type DraftObjectType = '变更单' | '纠偏' | '送审件' | '经验' | '决议' | '工时单'

export interface FormDraft {
  id: string
  userId: string
  objectType: DraftObjectType
  /** 业务对象草稿内容（JSON 序列化） */
  content: string
  updatedAt: string
  /** 草稿创建时间（用于超期判定） */
  createdAt: string
}

// —— 资源域（RES-003~016：供需曲线 + 超分配三级 + 平衡/平滑 + 瓶颈）——

/** 资源请假/非项目工时登记（RES-003：请假登记后净可用工时同步变化） */
export interface LeaveRecord {
  id: string
  /** 资源 id（关联 ResourcePoolMember） */
  resourceId: string
  /** 请假类型：年假/病假/事假/非项目投入（培训/复用） */
  type: '年假' | '病假' | '事假' | '非项目投入'
  /** 请假日期（ISO YYYY-MM-DD） */
  date: string
  /** 占用工时 */
  hours: number
  reason?: string
}

/** 资源派工/分配（RES-004 需求侧：某角色某周被分配到某活动的工时需求） */
export interface ResourceAssignment {
  id: string
  projectId: string
  /** 资源 id 或角色 code（需求侧按角色聚合时用角色） */
  role: string
  /** 周（'2026-W43'） */
  week: string
  /** 需求工时 */
  demandHours: number
  /** 关联活动 id */
  activityId: string
  /** 派工承诺状态（RES-009：未承诺不得进基线） */
  committed: boolean
}

/** 资源费率（RES-011：费率生效期切换、历史不变、多币种折算） */
export interface ResourceRate {
  id: string
  resourceId: string
  role: string
  /** 单价 */
  rate: number
  /** 币种 */
  currency: string
  /** 生效开始日（ISO） */
  effectiveFrom: string
  /** 生效结束日（空表示至今） */
  effectiveTo?: string
}

// —— RQA 风险量化域 ——

/** 三点估算输入（RQA-001）：乐观/最可能/悲观 */
export interface ThreePoint {
  optimistic: number
  mostLikely: number
  pessimistic: number
}

/** 三点估算结果（PERT）：期望 = (O+4M+P)/6，标准差 = (P−O)/6 */
export interface PertResult {
  expected: number
  stdDev: number
  /** 三点是否齐全（缺失任一点不得进入定量分析） */
  complete: boolean
  missing: ('乐观' | '最可能' | '悲观')[]
}

/** 风险关联活动或成本项（RQA-005：未关联即在模拟中排除） */
export interface RiskLink {
  riskId: string
  activityId?: string
  costItemId?: string
  /** 关联的工期影响（天，可正可负） */
  durationImpact: number
  /** 关联的成本影响（金额，可正可负） */
  costImpact: number
  /** 发生概率 0~1 */
  probability: number
}

/** 蒙特卡洛模拟配置（RQA-002） */
export interface SimConfig {
  modelVersion: string
  iterations: number
  /** 随机种子（可复现） */
  seed: number
  /** 输入快照哈希 */
  snapshot: string
}

/** 蒙特卡洛模拟结果（RQA-002/003） */
export interface SimResult {
  config: SimConfig
  /** 工期分位数（P50/P80/P90） */
  durationP50: number
  durationP80: number
  durationP90: number
  /** 成本分位数 */
  costP50: number
  costP80: number
  costP90: number
  /** 超预算概率 */
  overBudgetProb: number
  /** 输入快照 */
  inputSnapshot: string
}

/** 关键性指数（RQA-004：所有活动关键性指数合计为 1） */
export interface CriticalityIndex {
  activityId: string
  index: number
}

/** 敏感性分析结果（RQA-004） */
export interface SensitivityResult {
  activityId: string
  /** 工期敏感度（该活动工期 +1σ 对总工期的影响） */
  sensitivity: number
  rank: number
}

/** 应急储备项（RQA-006） */
export interface ContingencyReserve {
  id: string
  projectId: string
  type: '工期储备' | '应急储备'
  /** 储备额度（天数或金额） */
  amount: number
  /** 来源（模拟结果复算） */
  source: string
}

/** 储备动用记录（RQA-007 / C-42 L3） */
export interface ReserveDrawdown {
  id: string
  reserveId: string
  projectId: string
  amount: number
  reason: string
  alternative: string
  /** 申请状态 */
  status: '待审批' | '已批准' | '已拒绝'
  /** 审批层级（分级审批阈值） */
  level: 'L1' | 'L2' | 'L3'
  approver?: string
}

/** 风险触发器（RQA-009） */
export interface RiskTrigger {
  id: string
  riskId: string
  metric: string
  operator: '>' | '>=' | '<' | '<=' | '=='
  threshold: number
  hit: boolean
}

/** 风险相关性（RQA-010：多项风险叠加不能简单相加） */
export interface RiskCorrelation {
  riskA: string
  riskB: string
  /** 相关系数 −1~1 */
  coefficient: number
  /** 共同原因 */
  commonCause: string
}

// —— 资源域剩余（RES-001/002/008/009/010/013/014/015/016）——

/** 企业资源池节点（RES-001：三层资源池） */
export interface ResourcePoolNode {
  id: string
  name: string
  level: '企业' | '部门' | '项目'
  parentId?: string
}

/** 资源兼任投入比例（RES-001：兼任投入比例合计 ≤100%） */
export interface ResourceEngagement {
  resourceId: string
  nodeId: string
  /** 投入比例 0~1 */
  ratio: number
}

/** 角色-技能矩阵（RES-002） */
export interface RoleSkillMatrix {
  role: string
  skills: string[]
}

/** 资源请求与派工（RES-009） */
export interface ResourceRequest {
  id: string
  projectId: string
  role: string
  /** 请求工时 */
  demandHours: number
  week: string
  /** 派工模式：'池内派工' | '外部申请' */
  mode: '池内派工' | '外部申请'
}

/** 派工承诺（RES-009：承诺一旦形成即进入基线，变更须重新审批） */
export interface AssignmentCommitment {
  id: string
  requestId: string
  resourceId: string
  role: string
  committedHours: number
  week: string
  status: '已承诺' | '变更待审批'
  approvedAt?: string
  /** 变更请求时保留原承诺以便留痕 */
  changeReason?: string
}

/** 资源情景副本（RES-010：情景与主计划严格隔离） */
export interface ResourceScenario {
  id: string
  name: string
  /** 复制自哪个主计划快照 */
  sourcePlanId: string
  /** 情景下的分配调整 */
  assignments: { activityId: string; resourceId: string; hours: number }[]
  status: '草稿' | '已选定'
}

/** 工时回填（RES-013：三值互不覆盖，实际回填后剩余=计划−实际） */
export interface HourBackfill {
  id: string
  assignmentId: string
  taskId: string
  /** 计划工时 */
  plannedHours: number
  /** 实际工时 */
  actualHours: number
  /** 剩余工时 */
  remainingHours: number
  /** 回填日期 */
  date: string
  /** 差额说明（计划−实际，差额须说明） */
  varianceNote?: string
}

/** 跨项目资源冲突裁决（RES-014） */
export interface ConflictAdjudication {
  id: string
  conflictId: string
  /** 裁决结果 */
  decision: '调峰' | '增补' | '外协' | '例外登记'
  reason: string
  adjudicator: string
  adjudicatedAt: string
}

/** 外部与供应商产能（RES-015） */
export interface ExternalCapacity {
  id: string
  supplierName: string
  role: string
  /** 产能承诺（工时） */
  committedCapacity: number
  /** 实际交付（工时） */
  actualDelivery: number
  week: string
}

/** 投入偏差与效率系数（RES-016） */
export interface EffortDeviation {
  id: string
  projectId: string
  /** 估算工时 */
  estimatedHours: number
  /** 实际投入工时 */
  actualHours: number
  /** 效率系数（回写后估算工时同步变化） */
  efficiencyFactor: number
  week: string
}

/** 组织层级（TEN-009：六级组织，比 SRS 的 4 级更细，覆盖集团→公司→中心→部门→科室→小组） */
export type OrgLevel = 'group' | 'company' | 'center' | 'department' | 'section' | 'team'

/** 组织节点（parentId 自关联成树；每个层级对应固定负责人岗位） */
export interface OrgNode {
  id: string
  name: string
  level: OrgLevel
  parentId: string | null
  /** 负责人岗位（该层级负责人，如集团=总裁、公司=总经理、中心=执行总监…） */
  leaderTitle?: string
  /** 负责人姓名（挂靠到人员） */
  leaderName?: string
  /** 所属系统（研发系统 / 制造系统 / 职能系统 / 集团…） */
  system?: string
  /** 排序 */
  order: number
}

/** 岗位序列（技术管理岗 / 技术岗 / 项目管理岗 / 软件岗） */
export type PostTrack = 'tech-mgmt' | 'tech' | 'project' | 'software'

/** 岗位序列定义 */
export interface PostTrackDef {
  track: PostTrack
  name: string
  /** 序列内岗位等级（从高到低） */
  levels: string[]
}

/** 人员挂靠（一人可挂多个组织 + 多个岗位，权限取并集） */
export interface OrgMembership {
  userId: string
  userName: string
  orgId: string
  /** 岗位序列 */
  track: PostTrack
  /** 岗位等级（如 首席总工/总工/主任工程师/主管工程师） */
  postLevel: string
  /** 是否主职（一人可跨组织兼职，主职唯一） */
  primary: boolean
  /** 在职状态（离职后组织关系失效，历史保留） */
  active: boolean
}

/** 客户（车厂）主数据：名称 + 编号 + 车型列表 */
export interface Customer {
  id: string
  /** 客户名称（车厂） */
  name: string
  /** 客户编号 */
  code: string
  /** 车型列表 */
  vehicleModels: string[]
  /** 简称 */
  shortName?: string
}

/** 产品类别（一级：智能交互 / 智能控制 / 智能座舱 / 智能驾驶 / 动力能源 / 底盘控制 / 车载电器） */
export interface ProductCategory {
  id: string
  name: string
  /** 排序 */
  order: number
}

/** 产品线（二级，挂在产品类别下） */
export interface ProductLine {
  id: string
  categoryId: string
  name: string
  /** 产品线代码（如 ECC） */
  code?: string
  order?: number
}

/** 产品（三级，挂在产品线下） */
export interface Product {
  id: string
  lineId: string
  name: string
  code?: string
  order?: number
}

/** 命名与编码规则对象类型（客户 / 产品 / 文档 / 部门 / 人员） */
export type NamingObject = 'customer' | 'product' | 'document' | 'department' | 'person'

/** 命名与编码规则类别（命名规则 / 编码规则） */
export type NamingRuleKind = 'naming' | 'coding'

/** 命名与编码规则（TEN-017：各对象的命名规范与编码规范，可增删改 + 导入导出） */
export interface NamingRule {
  id: string
  /** 对象类型 */
  object: NamingObject
  /** 规则类别：命名规则 / 编码规则 */
  kind: NamingRuleKind
  /** 规则名称（同一对象类别下唯一） */
  name: string
  /** 规则描述（格式、分段、长度约束、禁用字符等） */
  description?: string
  /** 示例（合法示例） */
  example?: string
  /** 是否启用 */
  enabled: boolean
}


