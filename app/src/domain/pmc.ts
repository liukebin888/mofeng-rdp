/**
 * 管控方法论引擎（SRS 第 10 章 / PMC-001/005/008/009/013/014）
 *
 * 与既有引擎的分工（避免重复实现）：
 *   - 48 控制点 → controlPoints.ts（PMC-002/003/004/010/011/021/022）
 *   - 风险四要素/RPN/四策略 → risk.ts（PMC-015/016/017/018）
 *   - 进度/成本偏差 SPI/CPI → evm.ts（PMC-006/007）
 *
 * 本引擎补齐 R1 批次尚未落地的管控方法论：
 *   - PMC-001 十二类管控对象（责任角色 + 度量指标，无归属对象 0 个）
 *   - PMC-005 PDCA 四要素闭环（P/D/C/A 齐备率 100%）
 *   - PMC-008 质量偏差三项指标（一次通过率/缺陷逃逸率/返工工时占比）
 *   - PMC-009 偏差四级 D1~D4 分级（阈值可配）
 *   - PMC-013 纠偏措施登记与验证（闭环率 + 无效纠偏升级）
 *   - PMC-014 超时升级（D2 3工作日→D3、D3 5工作日→D4）
 */

/** 十二类管控对象（PMC-001）：责任角色 + 度量指标，无归属不得进入项目范围 */
export interface ManagedObject {
  /** 对象名（范围/进度/质量/成本/风险/变更/交付物/资源/供应商/合规/安全/知识资产） */
  name: string
  /** 管什么（范围界定） */
  scope: string
  /** 责任角色 */
  ownerRole: string
  /** 度量指标 */
  metrics: string[]
}

export const MANAGED_OBJECTS: ManagedObject[] = [
  { name: '范围', scope: '交付边界、需求条目、范围变更', ownerRole: '项目经理', metrics: ['需求条目数', '范围变更次数', '范围覆盖率'] },
  { name: '进度', scope: 'WBS、里程碑、关键路径、交付节点', ownerRole: '项目经理', metrics: ['SPI', '里程碑达成率', '关键路径偏差天数'] },
  { name: '质量', scope: '评审通过率、缺陷、返工、试验合格', ownerRole: '质量经理', metrics: ['一次通过率', '缺陷逃逸率', '返工工时占比'] },
  { name: '成本', scope: '预算、实际支出、工时成本', ownerRole: '项目经理 + 财务', metrics: ['CPI', '预算执行率', '单位工时成本'] },
  { name: '风险', scope: '技术、供应链、进度、合规风险', ownerRole: '项目经理', metrics: ['RPN 总值', '高 RPN 数量', '风险关闭率'] },
  { name: '变更', scope: 'ECR/ECN、影响评估、闭包', ownerRole: '变更控制委员会', metrics: ['变更周期', '闭包确认率', '变更引发的返工'] },
  { name: '交付物', scope: '图纸、样件、软件版本、证据包、交付单', ownerRole: '交付负责人', metrics: ['齐套率', '受控率', '客户签收及时率'] },
  { name: '资源', scope: '人、设备、试验台、产能', ownerRole: '资源经理', metrics: ['负荷率', '关键角色到位率', '工时真实性'] },
  { name: '供应商', scope: '准入、定点、PPAP、绩效', ownerRole: 'SQE', metrics: ['定点准时率', 'PPAP 一次通过率', '来料合格率'] },
  { name: '合规', scope: '分级、审计、等保、密码、数据', ownerRole: '合规负责人', metrics: ['审计覆盖率', '越权命中数', '密评结论'] },
  { name: '安全', scope: '功能安全、信息安全、漏洞', ownerRole: '功能安全经理', metrics: ['安全链路覆盖率', '漏洞关闭率', '高危漏洞数'] },
  { name: '知识资产', scope: '复盘、经验、模板、规则沉淀', ownerRole: '项目管理办公室', metrics: ['复盘完成率', '经验复用次数', '规则库条目数'] }
]

/**
 * PMC-001 校验：12 类对象各有归属模块、责任角色、度量指标；无归属对象 0 个。
 * 输入为实际项目范围内的对象清单，校验其是否覆盖 12 类且无「无归属」对象。
 */
export function validateManagedObjects(
  claimed: Array<{ name: string; ownerRole: string; metrics: string[] }>
): { ok: boolean; missing: string[]; orphan: string[] } {
  const claimedNames = new Set(claimed.map((c) => c.name))
  const missing = MANAGED_OBJECTS.filter((o) => !claimedNames.has(o.name)).map((o) => o.name)
  const orphan = claimed.filter((c) => !c.ownerRole || c.metrics.length === 0).map((c) => c.name)
  return { ok: missing.length === 0 && orphan.length === 0, missing, orphan }
}

/** PDCA 四要素（PMC-005）：策划 P / 执行 D / 检查 C / 改进 A */
export type PdcaPhase = 'P' | 'D' | 'C' | 'A'

export const PDCA_PHASES: PdcaPhase[] = ['P', 'D', 'C', 'A']

export const PDCA_LABEL: Record<PdcaPhase, string> = {
  P: '策划',
  D: '执行',
  C: '检查',
  A: '改进'
}

/** PDCA 闭环记录（PMC-005：四要素齐备率 100%） */
export interface PdcaRecord {
  id: string
  controlPointCode: string
  /** 策划：确定对象/控制点/判据阈值/责任人与时点 */
  plan?: string
  /** 执行：按流程产生对象与证据 */
  do?: string
  /** 检查：到时点校验，输出三态结论 */
  check?: string
  /** 改进：复盘根因，修订规则/模板/阈值 */
  act?: string
}

/**
 * PMC-005 校验 PDCA 四要素齐备率。
 * 四要素（P/D/C/A）任一缺失即不达标。
 */
export function checkPdcaCompleteness(
  records: PdcaRecord[]
): { ok: boolean; incomplete: string[]; rate: number } {
  const incomplete = records.filter((r) => !r.plan || !r.do || !r.check || !r.act).map((r) => r.id)
  const rate = records.length === 0 ? 0 : Math.round(((records.length - incomplete.length) / records.length) * 10000) / 100
  return { ok: incomplete.length === 0, incomplete, rate }
}

/** 质量三项指标输入（PMC-008） */
export interface QualityMetricsInput {
  /** 评审总数 */
  totalReviews: number
  /** 首次提交即合格的评审数（一次通过率） */
  firstPassReviews: number
  /** 本阶段缺陷总数 */
  totalDefects: number
  /** 逃逸到下游/客户侧的缺陷数（缺陷逃逸率） */
  escapedDefects: number
  /** 返工投入工时 */
  reworkHours: number
  /** 总工时 */
  totalHours: number
}

export interface QualityMetrics {
  /** 一次通过率（%） */
  firstPassRate: number
  /** 缺陷逃逸率（%），阈值 ≤5% */
  defectEscapeRate: number
  /** 返工工时占比（%） */
  reworkRatio: number
  /** 越界项（生成改进项） */
  violations: string[]
}

export const DEFECT_ESCAPE_THRESHOLD = 5 // 缺陷逃逸率 ≤5%

/**
 * PMC-008 质量偏差三项指标计算，越界自动生成改进项。
 * 一次通过率 = 首次合格 / 评审总数；缺陷逃逸率 = 逃逸 / 总缺陷；返工占比 = 返工工时 / 总工时。
 */
export function computeQualityMetrics(input: QualityMetricsInput): QualityMetrics {
  const firstPassRate =
    input.totalReviews === 0 ? 100 : Math.round((input.firstPassReviews / input.totalReviews) * 10000) / 100
  const defectEscapeRate =
    input.totalDefects === 0 ? 0 : Math.round((input.escapedDefects / input.totalDefects) * 10000) / 100
  const reworkRatio =
    input.totalHours === 0 ? 0 : Math.round((input.reworkHours / input.totalHours) * 10000) / 100

  const violations: string[] = []
  if (defectEscapeRate > DEFECT_ESCAPE_THRESHOLD) violations.push(`缺陷逃逸率 ${defectEscapeRate}% 超阈值 5%`)
  if (firstPassRate < 75) violations.push(`一次通过率 ${firstPassRate}% 低于 75%`)
  if (reworkRatio > 20) violations.push(`返工工时占比 ${reworkRatio}% 超 20%`)

  return { firstPassRate, defectEscapeRate, reworkRatio, violations }
}

/** 偏差四级（PMC-009 / 10.7） */
export type DeviationLevel = 'D1' | 'D2' | 'D3' | 'D4'

export const DEVIATION_LEVELS: DeviationLevel[] = ['D1', 'D2', 'D3', 'D4']

export interface DeviationGradeInput {
  /** 是否影响客户交付承诺或安全合规 */
  affectsCommitmentOrSafety: boolean
  /** 是否影响里程碑或 Gate 放行 */
  affectsMilestoneOrGate: boolean
  /** 是否影响本阶段内部计划 */
  affectsStagePlan: boolean
}

/**
 * PMC-009 偏差四级判定（D1 轻微 → D4 重大）。
 * D4 影响客户交付承诺或安全合规；D3 影响里程碑或 Gate；D2 影响阶段内部计划；D1 轻微。
 */
export function gradeDeviation(input: DeviationGradeInput): DeviationLevel {
  if (input.affectsCommitmentOrSafety) return 'D4'
  if (input.affectsMilestoneOrGate) return 'D3'
  if (input.affectsStagePlan) return 'D2'
  return 'D1'
}

export const DEVIATION_LABEL: Record<DeviationLevel, string> = {
  D1: '轻微（自行纠正，周会通报）',
  D2: '一般（提交纠偏措施）',
  D3: '严重（项目级专项纠偏，上级审批资源）',
  D4: '重大（启动应急，客户沟通）'
}

/** 超时升级时限（PMC-014）：D2 3 工作日、D3 5 工作日 */
export const ESCALATION_DEADLINE_DAYS: Record<'D2' | 'D3', number> = { D2: 3, D3: 5 }

/** 纠偏措施（PMC-013）：措施/责任人/期限/预期效果 */
export interface CorrectiveAction {
  id: string
  level: DeviationLevel
  /** 纠偏措施 */
  measure: string
  owner: string
  /** 期限（ISO 日期） */
  due: string
  /** 预期效果 */
  expectedEffect: string
  status: '开放' | '已闭环'
  /** 到期验证：指标是否回到阈值内 */
  verified?: boolean
  verifiedAt?: string
}

/**
 * PMC-013 纠偏登记校验：措施/责任人/期限/预期效果四字段齐全。
 */
export function validateCorrectiveAction(
  action: Partial<CorrectiveAction>
): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!action.measure?.trim()) missing.push('措施')
  if (!action.owner?.trim()) missing.push('责任人')
  if (!action.due) missing.push('期限')
  if (!action.expectedEffect?.trim()) missing.push('预期效果')
  return { ok: missing.length === 0, missing }
}

/**
 * PMC-013 纠偏闭环率 + 无效纠偏升级。
 * 到期验证：指标回到阈值内才算闭环；未回到则升级并重新分析根因。
 */
export function correctiveClosureRate(actions: CorrectiveAction[]): {
  rate: number
  closed: number
  total: number
  invalidOpen: string[]
} {
  const total = actions.length
  const closed = actions.filter((a) => a.status === '已闭环' && a.verified).length
  const invalidOpen = actions
    .filter((a) => a.status === '已闭环' && !a.verified)
    .map((a) => a.id)
  const rate = total === 0 ? 0 : Math.round((closed / total) * 10000) / 100
  return { rate, closed, total, invalidOpen }
}

export const CORRECTIVE_CLOSURE_THRESHOLD = 80 // 纠偏闭环率 ≥80%

/**
 * PMC-014 超时升级：未闭环偏差按工作日自动升级。
 * D2 超过 3 工作日 → D3；D3 超过 5 工作日 → D4。
 */
export function escalateOverdue(
  action: { level: DeviationLevel; status: string; due: string; now: string }
): { level: DeviationLevel; escalated: boolean } {
  if (action.status === '已闭环') return { level: action.level, escalated: false }
  const dueMs = new Date(action.due).getTime()
  const nowMs = new Date(action.now).getTime()
  const elapsedDays = Math.floor((nowMs - dueMs) / (1000 * 60 * 60 * 24))
  if (action.level === 'D2' && elapsedDays > ESCALATION_DEADLINE_DAYS.D2) {
    return { level: 'D3', escalated: true }
  }
  if (action.level === 'D3' && elapsedDays > ESCALATION_DEADLINE_DAYS.D3) {
    return { level: 'D4', escalated: true }
  }
  return { level: action.level, escalated: false }
}
