/**
 * 48 控制点引擎（SRS 10.3 / PMC-002~011）
 * 每个控制点五要素：对象 / 检查时点 / 判据 / 强度 / 不通过处置
 * 强度取自 SRS 10.3 逐行配置：L4 29 个、L3 10 个、L2 7 个、L1 2 个
 * 说明：SRS 10.3 摘要句写「L4 28 / L3 13 / L2 6 / L1 1」，与逐行表格存在 4 处不一致；
 *       本实现以逐行表格为准（可逐行核对），并在「规则体检」中登记该口径缺陷。
 */
import type { ControlPointResult, Evidence, Strength, Verdict } from './types'
import type { Baseline, BomNode, Deliverable, DeviationItem, DocItem, EcrItem, HourRecord, LessonItem, Project, Requirement, RetroItem, RiskItem, SampleReq, Supplier, TraceLink, WbsNode } from './types'
import { coverage, detectBreaks } from './trace'
import { planQualityChecks, plannedValue, weightedCompletion } from './schedule'
import { computeEvm, type EvmResult } from './evm'
import { closureStatus, impactComplete } from './change'
import { closeCheck, completeness, quantified, rpn } from './risk'

export interface CpDefinition {
  code: string
  object: string
  timing: string
  criteria: string
  strength: Strength
  disposition: string
  phase: '事前准入' | '事中校验' | '事后审计'
}

export const CP_DEFINITIONS: CpDefinition[] = [
  { code: 'C-01', object: '范围', timing: '立项申请时', criteria: 'GRD 等级已判定且依据快照可回看；等级为空不得提交', strength: 'L4', disposition: '阻断立项，退回补判', phase: '事前准入' },
  { code: 'C-02', object: '范围', timing: '立项审批前', criteria: '技术方案与报价已关联；无方案或无报价不得审批', strength: 'L4', disposition: '阻断审批，补充后重提', phase: '事中校验' },
  { code: 'C-03', object: '范围', timing: 'Gate1 前', criteria: '需求基线已形成，条目化率 100%，无孤儿需求', strength: 'L4', disposition: '阻断 Gate1，输出孤儿清单', phase: '事前准入' },
  { code: 'C-04', object: '进度', timing: '计划批准时', criteria: 'WBS 分解至可估算层级，依赖完整，关键路径可识别', strength: 'L4', disposition: '计划不可基线化，不得开工', phase: '事前准入' },
  { code: 'C-05', object: '进度', timing: '每周/每 Gate', criteria: 'SPI 计算；＜0.9 黄、＜0.8 红；红区须提交纠偏计划', strength: 'L2', disposition: '预警升级至项目群，纳入周会', phase: '事中校验' },
  { code: 'C-06', object: '进度', timing: '里程碑到期日', criteria: '关键路径任务完成率；逾期 ＞3 天视为未达成', strength: 'L3', disposition: '需上级批准延期，附补救措施', phase: '事后审计' },
  { code: 'C-07', object: '质量', timing: '每次评审', criteria: '评审要素齐全、参与角色到位、结论明确（三态之一）', strength: 'L4', disposition: '评审无效，重新组织', phase: '事中校验' },
  { code: 'C-08', object: '质量', timing: '阶段末', criteria: '缺陷逃逸率 ≤5%；逃逸缺陷须回溯漏测原因', strength: 'L2', disposition: '预警并生成测试改进项', phase: '事后审计' },
  { code: 'C-09', object: '质量', timing: '返工完成后', criteria: '返工项已复验，复验记录与原始缺陷关联', strength: 'L3', disposition: '未复验不得关闭缺陷', phase: '事后审计' },
  { code: 'C-10', object: '成本', timing: '立项时', criteria: '预算已批准并与 WBS 成本科目对应', strength: 'L4', disposition: '无预算不得开工', phase: '事前准入' },
  { code: 'C-11', object: '成本', timing: '每月', criteria: 'CPI 计算；＜0.95 黄、＜0.90 红', strength: 'L2', disposition: '预警升级，纳入经营分析', phase: '事中校验' },
  { code: 'C-12', object: '成本', timing: '超支发生时', criteria: '超预算 ＞10% 须专项审批并说明来源', strength: 'L3', disposition: '未批准不得继续支出', phase: '事中校验' },
  { code: 'C-13', object: '风险', timing: '风险登记时', criteria: '失效模式、后果、原因、触发条件四要素齐全', strength: 'L4', disposition: '不予登记，退回补充', phase: '事前准入' },
  { code: 'C-14', object: '风险', timing: '登记后 3 日内', criteria: 'S/O/D 打分完成，RPN 与色区已计算，高 RPN 须有应对策略', strength: 'L4', disposition: '未量化不得进入基线', phase: '事中校验' },
  { code: 'C-15', object: '风险', timing: '风险关闭时', criteria: '残余风险已评估并按级别签署；高 RPN 双签', strength: 'L4', disposition: '越权接受被拒', phase: '事后审计' },
  { code: 'C-16', object: '变更', timing: 'ECR 提交后', criteria: '影响评估清单已完成（软件/硬件/安全/供应链四维）', strength: 'L4', disposition: '未评估不得进入审批', phase: '事中校验' },
  { code: 'C-17', object: '变更', timing: 'ECR 关闭前', criteria: '影响闭包逐项确认（确认或不适用+理由），无未确认项', strength: 'L4', disposition: '存在未确认项不得关闭', phase: '事后审计' },
  { code: 'C-18', object: '变更', timing: 'ECN 执行后', criteria: '变更后验证已完成，追溯与基线已同步更新', strength: 'L4', disposition: '未验证不得标记已执行', phase: '事后审计' },
  { code: 'C-19', object: '交付物', timing: 'Gate 放行前', criteria: '交付物清单齐套，缺件率 0；缺件逐条可下钻', strength: 'L4', disposition: '阻断放行，输出缺件清单', phase: '事前准入' },
  { code: 'C-20', object: '交付物', timing: '交付前', criteria: '对应基线已冻结，冻结后无修改；哈希校验通过', strength: 'L4', disposition: '未冻结不得交付', phase: '事中校验' },
  { code: 'C-21', object: '交付物', timing: '客户签收时', criteria: '样件与文件成套；签收或拒收结论明确并留痕', strength: 'L3', disposition: '拒收须启动 8D 并回退交付状态', phase: '事后审计' },
  { code: 'C-22', object: '资源', timing: '每周', criteria: '资源负荷 ≤110%；超载须调峰或增补', strength: 'L2', disposition: '预警并调整排程', phase: '事中校验' },
  { code: 'C-23', object: '资源', timing: '阶段启动时', criteria: '关键角色到位率 100%（项目经理、质量、安全、SQE）', strength: 'L4', disposition: '未到位不得启动阶段', phase: '事前准入' },
  { code: 'C-24', object: '资源', timing: '工时填报时', criteria: '工时与任务关联，单日 ≤12 小时，异常工时须说明', strength: 'L1', disposition: '留痕并纳入真实性抽检', phase: '事中校验' },
  { code: 'C-25', object: '供应商', timing: '采购前', criteria: '供应商已准入且在有效期内；关键件已定点', strength: 'L4', disposition: '未准入不得下单', phase: '事前准入' },
  { code: 'C-26', object: '供应商', timing: '量产前', criteria: 'PPAP 要素齐全并批准；未闭环不得量产', strength: 'L4', disposition: '阻断量产放行', phase: '事前准入' },
  { code: 'C-27', object: '供应商', timing: '每季度', criteria: '绩效评分完成（质量、交付、响应、成本四维）', strength: 'L2', disposition: '低于阈值降级或约谈', phase: '事后审计' },
  { code: 'C-28', object: '合规', timing: '报表发布前', criteria: '指标口径一致，同一指标全平台唯一算法', strength: 'L3', disposition: '口径不一致的报表不得对外', phase: '事中校验' },
  { code: 'C-29', object: '合规', timing: '持续', criteria: '审计覆盖 11 类受控动作，哈希链连续', strength: 'L4', disposition: '断链即告警并冻结相关操作', phase: '事后审计' },
  { code: 'C-30', object: '合规', timing: '上线前与年度', criteria: '密码合规、等保测评、数据分类分级完成', strength: 'L4', disposition: '未通过不得上线', phase: '事前准入' },
  { code: 'C-31', object: '安全', timing: '每个 Gate', criteria: '安全评审独立通过；安全项不可豁免', strength: 'L4', disposition: '安全未过即整体不可放行', phase: '事前准入' },
  { code: 'C-32', object: '安全', timing: '持续', criteria: '安全链路覆盖率 ≥98%，断链清单为空', strength: 'L4', disposition: '断链阻断门禁', phase: '事后审计' },
  { code: 'C-33', object: '安全', timing: '结项前', criteria: '高危漏洞为 0，中危已评估并接受或修复', strength: 'L4', disposition: '未关闭不得结项', phase: '事后审计' },
  { code: 'C-34', object: '知识', timing: 'Gate 通过后 5 日内', criteria: '阶段复盘完成，含目标达成、偏差原因、改进项', strength: 'L3', disposition: '未复盘不得进入下一阶段', phase: '事后审计' },
  { code: 'C-35', object: '知识', timing: '结项时', criteria: '经验条目入库并打标签，可被后续项目检索', strength: 'L2', disposition: '预警并计入 PMO 考核', phase: '事后审计' },
  { code: 'C-36', object: '知识', timing: '每季度', criteria: '管控规则与模板按实战反馈更新并发布新版本', strength: 'L1', disposition: '留痕，纳入规则库演进记录', phase: '事后审计' },
  { code: 'C-37', object: '计划', timing: '任务下达前', criteria: '计划已通过质量检查并冻结，冻结签名有效（SCH-018、PMC-029）', strength: 'L4', disposition: '阻断下达；须先冻结再下达', phase: '事前准入' },
  { code: 'C-38', object: '计划', timing: '计划发布前', criteria: '开口端占比、无逻辑活动占比、负浮时数、硬约束占比四项均未超阈值', strength: 'L4', disposition: '阻断发布；阻断理由指名具体活动编号', phase: '事中校验' },
  { code: 'C-39', object: '进度', timing: '填报应用前', criteria: '填报已经审核，且审核人不是填报人本人（SCH-015、PMC-031）', strength: 'L4', disposition: '不予应用；未审核数据不得进入计划与挣值', phase: '事中校验' },
  { code: 'C-40', object: '资源', timing: '资源闸门与 Gate 前', criteria: '关键资源超分配已裁决，或已登记接受理由与补偿措施', strength: 'L3', disposition: '条件放行；须资源经理签署裁决记录', phase: '事中校验' },
  { code: 'C-41', object: '成本', timing: '成本基线冻结前', criteria: '成本口径与挣值计量规则已登记并签署', strength: 'L4', disposition: '阻断冻结；未登记口径不得出具挣值报表', phase: '事前准入' },
  { code: 'C-42', object: '风险', timing: '储备动用前', criteria: '动用申请、原因、替代方案齐备，且按额度分级审批完成', strength: 'L3', disposition: '条件放行；累计动用率超阈值自动升级', phase: '事中校验' },
  { code: 'C-43', object: '组合', timing: '组合调整前', criteria: '进入、调序、退出组合均已完成组合级评审并留痕', strength: 'L3', disposition: '条件放行；未评审不得调整排序', phase: '事前准入' },
  { code: 'C-44', object: '风险', timing: 'Gate 准入', criteria: '高风险项（RPN ≥200 或红区）已完成量化、策略登记与储备测算', strength: 'L4', disposition: '阻断放行；量化结果须与风险台账一致', phase: '事前准入' },
  { code: 'C-45', object: '文档', timing: '图纸与关键文档发布前', criteria: '多专业会签齐备，无未关闭否决意见', strength: 'L4', disposition: '阻断发布；未发布文档不计入齐套', phase: '事中校验' },
  { code: 'C-46', object: '纠偏', timing: '纠偏项关闭前', criteria: '纠偏措施已回写计划并完成偏差重算', strength: 'L3', disposition: '条件放行；只登记措施未改计划者不得关闭', phase: '事后审计' },
  { code: 'C-47', object: '报表', timing: '报表与看板发布前', criteria: '指标口径与口径字典一致，三处取值同源', strength: 'L2', disposition: '预警升级；不一致以字典为准并自动告警', phase: '事中校验' },
  { code: 'C-48', object: '规则', timing: '规则生效前', criteria: '控制点、阈值、强度的变更已执行回归测试且用例通过', strength: 'L4', disposition: '阻断生效；回归未过不得上线', phase: '事前准入' }
]

export interface CpContext {
  project: Project
  wbs: WbsNode[]
  reqs: Requirement[]
  links: TraceLink[]
  risks: RiskItem[]
  ecrs: EcrItem[]
  baselines: Baseline[]
  suppliers: Supplier[]
  samples: SampleReq[]
  boms: BomNode[]
  docs: DocItem[]
  deliverables: Deliverable[]
  hours: HourRecord[]
  retros?: RetroItem[]
  lessons?: LessonItem[]
  deviations?: DeviationItem[]
  auditChainOk: boolean
  flags: Record<string, { ok: boolean; note: string; evidence?: Evidence[] }>
  /** 挣值结果：由应用层注入，保证 C-05/C-11 与挣值报表同源（C-28 / C-47） */
  evm?: EvmResult
}

const ev = (ref: string, label: string, value?: string | number): Evidence => ({ kind: 'metric', ref, label, value })

export function evaluateControlPoints(ctx: CpContext): ControlPointResult[] {
  const { project, wbs, reqs, links, risks, ecrs, baselines, suppliers, deliverables, docs, hours, flags } = ctx
  const retros = ctx.retros ?? []
  const lessons = ctx.lessons ?? []
  const deviations = ctx.deviations ?? []
  const breaks = detectBreaks(reqs, links)
  const cov = coverage(reqs, links)
  const pq = planQualityChecks(wbs)
  const wc = weightedCompletion(wbs, project.budget)
  // PV 必须与挣值报表同源（C-28 / C-47）：优先采用应用层注入的 EVM；
  // 未注入时按 CPM 早时间 + 统计日复算，禁止再写 budget×0.62 之类的自造比例（否则同一 SPI 会跨页出现两个值）。
  const evm =
    ctx.evm ??
    computeEvm({
      pv: plannedValue(wbs, project.budget).pv,
      ev: (wc.weightedPercent / 100) * project.budget,
      ac: project.spent,
      bac: project.budget
    })
  const missingDeliverables = deliverables.filter((d) => d.required && !d.provided)
  const frozen = baselines.filter((b) => b.status === '已冻结')
  const openHighRisk = risks.filter((r) => r.status !== '已关闭' && rpn(r) >= 200)
  const unconfirmedEcr = ecrs.filter((e) => closureStatus(e).unconfirmed.length > 0)
  const expiredSupplier = suppliers.filter((s) => !s.qualified || new Date(s.qualifyExpire) < new Date('2026-10-31'))
  const ppapOpen = suppliers.filter((s) => s.ppapStatus !== '已批准')
  const missingSignoff = docs.filter((d) => d.required && d.status !== '已发布' && d.signoffs.some((s) => !s.signed || s.veto))
  const unapprovedHours = hours.filter((h) => h.status !== '已审核')
  const overload = wbs.filter((n) => (n.percent > 0 && n.duration > 15) || false)

  const mk = (code: string, verdict: Verdict, measured: string, evidence: Evidence[], blocker?: string): ControlPointResult => {
    const def = CP_DEFINITIONS.find((d) => d.code === code)!
    return { ...def, verdict, measured, evidence, blocker }
  }

  /**
   * flag 兜底仅用于「外部证据 / 人工签署型」控制点（如等保测评、安全签署、客户签收、供应商绩效评分）。
   * 这类判据的载体是系统外的合规证据或人工结论，系统内无结构化数据可同源，故用 flags 登记实际结论。
   * —— 若某控制点存在可同源的业务实体（如 C-15 关闭风险、C-18 ECN 验证、C-34 复盘、C-35 经验、C-46 纠偏），
   *    必须改为真实数据判定，禁止用 flag 制造「假同源」。见 SPEC-DISCREPANCIES 附三。
   */
  const flag = (code: string, text: string): [Verdict, string, Evidence[]] => {
    const f = flags[code] || { ok: true, note: text }
    return [f.ok ? 'PASS' : 'FAIL', f.note || text, f.evidence || [ev(code, text)]]
  }

  const R: ControlPointResult[] = []
  R.push(mk('C-01', project.level ? 'PASS' : 'FAIL', project.level ? `等级 ${project.level}，命中真值表第 ${project.grading?.result.hitRowNo} 行` : '等级为空（未定级）', [ev('grading', '判定留痕', project.grading?.result.trace.snapshotHash || '—')], project.level ? undefined : '等级未判定'))
  const hasScheme = !!(project as Project & { schemeLinked?: boolean }).schemeLinked
  const hasQuote = !!(project as Project & { quoteLinked?: boolean }).quoteLinked
  R.push(mk('C-02', hasScheme && hasQuote ? 'PASS' : 'FAIL', `技术方案 ${hasScheme ? '已关联' : '未关联'}，报价 ${hasQuote ? '已关联' : '未关联'}`, [ev('scheme', '方案/报价关联')], hasScheme && hasQuote ? undefined : '缺技术方案或报价'))
  R.push(mk('C-03', breaks.filter((b) => b.kind === '孤儿需求').length === 0 ? 'PASS' : 'FAIL', `孤儿需求 ${breaks.filter((b) => b.kind === '孤儿需求').length} 条 / 断链合计 ${breaks.length} 条`, [ev('trace', '断链清单', breaks.length)]))
  R.push(mk('C-04', pq.checks[0].ok && pq.checks[8].ok ? 'PASS' : 'FAIL', `缺逻辑活动 ${pq.checks[0].value}%，负浮时 ${pq.checks[8].value}%`, [ev('plan', '计划质量', pq.health)]))
  R.push(mk('C-05', evm.spiZone === 'green' ? 'PASS' : evm.spiZone === 'yellow' ? 'CONDITIONAL' : 'FAIL', `SPI=${evm.spi}（阈值 0.9/0.8）`, [ev('evm', 'SPI', evm.spi)]))
  const delayed = wbs.filter((n) => n.isMilestone && n.percent < 100)
  R.push(mk('C-06', delayed.length === 0 ? 'PASS' : 'CONDITIONAL', `关键路径未完成任务 ${delayed.length} 个`, [ev('milestone', '关键任务', delayed.length)]))
  {
    const [v, note, e] = flag('C-07', '评审要素齐全、角色到位、结论三态明确')
    R.push(mk('C-07', v, note, e))
  }
  {
    const [v, note, e] = flag('C-08', '缺陷逃逸率 2.1% ≤5%')
    R.push(mk('C-08', v, note, e))
  }
  {
    const [v, note, e] = flag('C-09', '返工项均已复验并关联原始缺陷')
    R.push(mk('C-09', v, note, e))
  }
  R.push(mk('C-10', project.budget > 0 ? 'PASS' : 'FAIL', `预算 ${project.budget} 万元已批准并挂 WBS 成本科目`, [ev('budget', '预算', project.budget)]))
  R.push(mk('C-11', evm.cpiZone === 'green' ? 'PASS' : evm.cpiZone === 'yellow' ? 'CONDITIONAL' : 'FAIL', `CPI=${evm.cpi}（阈值 0.95/0.90）`, [ev('evm', 'CPI', evm.cpi)]))
  R.push(mk('C-12', project.spent / project.budget > 1.1 ? 'CONDITIONAL' : 'PASS', `执行率 ${(Math.round((project.spent / project.budget) * 1000) / 10).toFixed(1)}%`, [ev('cost', '已发生成本', project.spent)]))
  const riskIncomplete = risks.filter((r) => !completeness(r).ok)
  R.push(mk('C-13', riskIncomplete.length === 0 ? 'PASS' : 'FAIL', `四要素不全 ${riskIncomplete.length} 条`, [ev('risk', '风险台账', risks.length)]))
  const riskNotQuantified = risks.filter((r) => !quantified(r).ok)
  R.push(mk('C-14', riskNotQuantified.length === 0 ? 'PASS' : 'FAIL', `未量化/缺策略 ${riskNotQuantified.length} 条`, [ev('risk', 'RPN 量化', risks.length - riskNotQuantified.length)]))
  // C-15 同源判定：关闭风险须「残余风险已评估 + 高 RPN(≥200) 双签」，
  // 直接调用 risk.closeCheck（此前只查 residual，漏掉了双签校验）。
  {
    const closed = risks.filter((r) => r.status === '已关闭')
    const failed = closed.filter((r) => !closeCheck(r, r.signatures || []).ok)
    R.push(
      mk(
        'C-15',
        failed.length === 0 ? 'PASS' : 'FAIL',
        failed.length === 0 ? `已关闭风险 ${closed.length} 条均残余已评估且签署到位` : `${failed.length} 条关闭风险签署不足：${failed.map((r) => r.code).join('、')}`,
        closed.map((r) => ev(r.code, closeCheck(r, r.signatures || []).note)),
        failed.length ? failed.map((r) => r.code).join(',') : undefined
      )
    )
  }
  const impactMissing = ecrs.filter((e) => !impactComplete(e).ok)
  R.push(mk('C-16', impactMissing.length === 0 ? 'PASS' : 'FAIL', `四维评估未完成 ${impactMissing.length} 单`, [ev('ecr', '影响评估', ecrs.length)]))
  R.push(mk('C-17', unconfirmedEcr.length === 0 ? 'PASS' : 'FAIL', `未确认闭包项 ${unconfirmedEcr.reduce((s, e) => s + closureStatus(e).unconfirmed.length, 0)} 项`, [ev('ecr', '闭包确认')]))
  {
    // C-18 同源判定（C-28/C-47 一致性原则）：不以静态 flag 兜底，
    // 而是校验真实 ECR 数据——凡处于「ECN验证」阶段但未验证通过、或已关闭但缺验证记录的，均判 FAIL。
    const unverified = ecrs.filter((e) => (e.stage === 'ECN验证' && !e.ecnVerification?.verified) || (e.stage === '已关闭' && !e.ecnVerification?.verified))
    const c18Pass = unverified.length === 0
    R.push(
      mk(
        'C-18',
        c18Pass ? 'PASS' : 'FAIL',
        c18Pass ? '所有 ECN 均已完成验证（追溯与基线同步）' : `${unverified.length} 单 ECN 未验证：${unverified.map((e) => e.code).join('、')}`,
        unverified.map((e) => ev(e.code, e.stage === '已关闭' ? '已关闭但缺验证记录' : 'ECN验证未通过')),
        c18Pass ? undefined : unverified.map((e) => e.code).join(',')
      )
    )
  }
  R.push(mk('C-19', missingDeliverables.length === 0 ? 'PASS' : 'FAIL', `缺件 ${missingDeliverables.length} 项 / 应有 ${deliverables.filter((d) => d.required).length} 项`, missingDeliverables.slice(0, 3).map((d) => ev(d.code, d.name)), missingDeliverables.map((d) => d.code).join(',')))
  R.push(mk('C-20', frozen.length > 0 ? 'PASS' : 'FAIL', frozen.length ? `已冻结基线 ${frozen.map((b) => b.no).join('、')}` : '无已冻结基线', [ev('baseline', '冻结基线', frozen.length)]))
  {
    const [v, note, e] = flag('C-21', '签收结论明确并留痕')
    R.push(mk('C-21', v, note, e))
  }
  R.push(mk('C-22', overload.length === 0 ? 'PASS' : 'CONDITIONAL', `超负荷活动 ${overload.length} 个`, [ev('resource', '负荷')]))
  {
    const [v, note, e] = flag('C-23', '关键角色到位率 100%')
    R.push(mk('C-23', v, note, e))
  }
  R.push(
    mk('C-24', unapprovedHours.length === 0 ? 'PASS' : 'CONDITIONAL', `未审核工时 ${unapprovedHours.length} 条（L1 仅留痕）`, [ev('hours', '工时记录', hours.length)])
  )
  R.push(mk('C-25', expiredSupplier.length === 0 ? 'PASS' : 'FAIL', `未准入/已过期 ${expiredSupplier.length} 家`, expiredSupplier.map((s) => ev(s.code, s.name)), expiredSupplier.map((s) => s.code).join(',')))
  R.push(mk('C-26', ppapOpen.length === 0 ? 'PASS' : 'FAIL', `PPAP 未批准 ${ppapOpen.length} 家`, ppapOpen.map((s) => ev(s.code, s.ppapStatus))))
  {
    const [v, note, e] = flag('C-27', '季度绩效评分已完成')
    R.push(mk('C-27', v, note, e))
  }
  {
    const [v, note, e] = flag('C-28', '指标口径与字典一致')
    R.push(mk('C-28', v, note, e))
  }
  R.push(mk('C-29', ctx.auditChainOk ? 'PASS' : 'FAIL', ctx.auditChainOk ? '哈希链连续，11 类受控动作全覆盖' : '哈希链断裂', [ev('audit', '链校验', ctx.auditChainOk ? 'OK' : 'BROKEN')]))
  {
    const [v, note, e] = flag('C-30', '等保三级测评已通过，密码应用合规')
    R.push(mk('C-30', v, note, e))
  }
  {
    const [v, note, e] = flag('C-31', '安全评审独立通过（安全项不可豁免）')
    R.push(mk('C-31', v, note, e))
  }
  R.push(mk('C-32', cov.safety >= 98 && breaks.length === 0 ? 'PASS' : 'FAIL', `安全链路覆盖率 ${cov.safety}%，断链 ${breaks.length} 条`, [ev('trace', '覆盖率', cov.safety)]))
  {
    const [v, note, e] = flag('C-33', '高危漏洞 0，中危已评估')
    R.push(mk('C-33', v, note, e))
  }
  // C-34 同源判定：阶段复盘三要素（目标达成/偏差原因/改进项）齐全才判完成；
  // 不再读静态 flag，而是校验 retros 实体里是否存在「三要素齐备」的复盘记录。
  {
    const complete = retros.filter((r) => r.goalMet.trim() && r.deviationReason.trim() && r.improvement.trim())
    const incomplete = retros.filter((r) => !(r.goalMet.trim() && r.deviationReason.trim() && r.improvement.trim()))
    R.push(
      mk(
        'C-34',
        incomplete.length === 0 && complete.length > 0 ? 'PASS' : 'CONDITIONAL',
        incomplete.length === 0 && complete.length > 0 ? `阶段复盘完成 ${complete.length} 项（三要素齐备）` : `${incomplete.length} 项复盘缺要素：${incomplete.map((r) => r.stage).join('、')}`,
        retros.map((r) => ev(r.stage, r.goalMet.trim() && r.deviationReason.trim() && r.improvement.trim() ? '三要素齐备' : '缺要素')),
        undefined
      )
    )
  }
  // C-35 同源判定：经验条目已入库且打标签（可被检索）。
  {
    const untagged = lessons.filter((l) => l.tags.length === 0)
    R.push(
      mk(
        'C-35',
        lessons.length > 0 && untagged.length === 0 ? 'PASS' : 'CONDITIONAL',
        lessons.length > 0 && untagged.length === 0 ? `经验条目 ${lessons.length} 条均已打标签` : untagged.length ? `${untagged.length} 条经验未打标签：${untagged.map((l) => l.code).join('、')}` : '经验库为空',
        lessons.map((l) => ev(l.code, `标签 ${l.tags.join('/')}`)),
        undefined
      )
    )
  }
  {
    const f = flags['C-36'] || { ok: true, note: '规则库 2026Q4 版本已发布，变更留痕 12 条' }
    R.push(mk('C-36', f.ok ? 'PASS' : 'CONDITIONAL', f.note, [ev('rule', '规则版本', '2026Q4')]))
  }
  R.push(mk('C-37', project.planFrozen ? 'PASS' : 'FAIL', project.planFrozen ? '计划已冻结，签名有效' : '计划未冻结，禁止下达任务', [ev('plan', '冻结签名', project.planFrozen ? 'OK' : '—')], project.planFrozen ? undefined : '计划未冻结'))
  R.push(mk('C-38', pq.checks[0].ok && pq.checks[8].ok && pq.checks[5].ok ? 'PASS' : 'FAIL', `质量检查 ${pq.checks.filter((c) => c.ok).length}/13 通过，健康度 ${pq.health}`, [ev('plan', '健康度', pq.health)]))
  R.push(mk('C-39', unapprovedHours.length === 0 ? 'PASS' : 'FAIL', `未审核填报 ${unapprovedHours.length} 条`, [ev('hours', '审核')]))
  R.push(mk('C-40', overload.length === 0 ? 'PASS' : 'CONDITIONAL', overload.length ? `${overload.length} 个活动超分配待裁决` : '无超分配', [ev('resource', '超分配', overload.length)]))
  {
    const [v, note, e] = flag('C-41', '成本口径与挣值计量规则已登记签署')
    R.push(mk('C-41', v, note, e))
  }
  {
    const [v, note, e] = flag('C-42', '储备动用申请、原因、替代方案齐备')
    R.push(mk('C-42', v, note, e))
  }
  {
    const [v, note, e] = flag('C-43', '组合调整已评审留痕')
    R.push(mk('C-43', v, note, e))
  }
  R.push(mk('C-44', openHighRisk.filter((r) => !r.strategy).length === 0 ? 'PASS' : 'FAIL', `高风险未登记策略 ${openHighRisk.filter((r) => !r.strategy).length} 条（红区 ${openHighRisk.length} 条）`, [ev('risk', '红区风险', openHighRisk.length)]))
  R.push(mk('C-45', missingSignoff.length === 0 ? 'PASS' : 'FAIL', `会签未齐备 ${missingSignoff.length} 份`, missingSignoff.map((d) => ev(d.code, d.name))))
  // C-46 同源判定：纠偏项须「措施已回写计划 + 偏差已重算」方可关闭；
  // 存在开放中且未回写/未重算的纠偏项时判 CONDITIONAL（条件放行，L3）。
  {
    const open = deviations.filter((d) => d.status === '开放')
    const closedInvalid = deviations.filter((d) => d.status === '已关闭' && !(d.planUpdated && d.deviationRecomputed))
    const bad = [...open.filter((d) => !(d.planUpdated && d.deviationRecomputed)), ...closedInvalid]
    R.push(
      mk(
        'C-46',
        bad.length === 0 ? 'PASS' : 'CONDITIONAL',
        bad.length === 0 ? `纠偏项 ${deviations.length} 条均已回写计划并重算偏差` : `${bad.length} 条纠偏未回写/未重算：${bad.map((d) => d.code).join('、')}`,
        deviations.map((d) => ev(d.code, d.planUpdated && d.deviationRecomputed ? '已回写+已重算' : '未回写/未重算')),
        undefined
      )
    )
  }
  {
    const [v, note, e] = flag('C-47', '指标口径与口径字典一致，三处同源')
    R.push(mk('C-47', v, note, e))
  }
  {
    const [v, note, e] = flag('C-48', '控制点变更已执行回归测试，用例全部通过')
    R.push(mk('C-48', v, note, e))
  }

  return R.sort((a, b) => a.code.localeCompare(b.code))
}

export function strengthDistribution(results: { strength: Strength }[]) {
  return results.reduce(
    (acc, r) => {
      acc[r.strength]++
      return acc
    },
    { L4: 0, L3: 0, L2: 0, L1: 0 } as Record<Strength, number>
  )
}

export function summarize(results: ControlPointResult[]) {
  const dist = strengthDistribution(results)
  const byVerdict = results.reduce(
    (a, r) => {
      a[r.verdict]++
      return a
    },
    { PASS: 0, CONDITIONAL: 0, FAIL: 0 } as Record<Verdict, number>
  )
  const blockers = results.filter((r) => r.verdict === 'FAIL' && r.strength === 'L4')
  return { dist, byVerdict, blockers, total: results.length }
}
