/**
 * 样件评审模板（评审 + 审批 两段式）领域引擎单测
 *
 * 验收覆盖：两段顺序（审批不得先于结论）、空白模板、itemProgress x/y、
 * gate 四类 blockers、canArchive fail-closed、复评 round+1、templateStats、
 * 配置驱动（改配置即生效）、映射表、同源复用。
 */
import { describe, it, expect } from 'vitest'
import {
  REVIEW_SIGN_ROLES,
  REVIEW_VERDICTS,
  signComplete,
  signProgress,
  reviewDedupKey,
  nextReviewCode
} from '@/domain/sampleReviewEngine'
import {
  SAMPLE_REVIEW_ITEMS,
  SAMPLE_REVIEW_STAGES,
  SAMPLE_REVIEW_CONFIG,
  STAGE_TRANSITIONS,
  STAGE_FROM_FORM_STATUS,
  buildEmptyTemplate,
  itemProgress,
  templateVerdictOf,
  canSubmitForApproval,
  canApprove,
  canArchive,
  reopenForReviewRound,
  templateStats,
  stageFromFormStatus,
  nextTemplateCode,
  templateDedupKey,
  type SampleReviewTemplate,
  type ReviewItem,
  type ReviewItemResult
} from '@/domain/sampleReviewTemplate'

const NOW = '2026-11-24T09:00:00.000Z'

/** 构造一张空白模板（全要素可 patch） */
function makeTemplate(patch: Partial<SampleReviewTemplate> = {}): SampleReviewTemplate {
  return {
    ...buildEmptyTemplate({
      id: 'SRT-T1',
      code: 'RV-SMP-A-01',
      projectId: 'P1',
      sampleOrderId: 'S1',
      submitter: '发起人',
      createdAt: NOW
    }),
    ...patch
  }
}

/** 构造一张「阶段一全部完成、结论已下达」的模板 */
function completedStageOne(patch: Partial<SampleReviewTemplate> = {}): SampleReviewTemplate {
  const tpl = makeTemplate()
  const items: ReviewItem[] = tpl.items.map((i, idx) => ({
    ...i,
    result: (idx === 1 ? '不适用' : '通过') as ReviewItemResult,
    note: `意见-${idx}`
  }))
  return {
    ...tpl,
    items,
    sampleCode: 'SMP-A-01',
    projectName: '项目甲',
    title: 'SMP-A-01 样件评审',
    verdict: '认可',
    verdictBy: '质量工程师',
    verdictAt: NOW,
    signatures: REVIEW_SIGN_ROLES.map((role) => ({ role, name: role, pass: true, at: NOW })),
    ...patch
  }
}

describe('SAMPLE_REVIEW_CONFIG 用户定案权威值', () => {
  it('评审项 7 项且配置化，阶段链两段顺序（先结论后审批）', () => {
    expect(SAMPLE_REVIEW_ITEMS).toHaveLength(7)
    expect(SAMPLE_REVIEW_ITEMS.map((i) => i.label)).toEqual([
      '外观', '尺寸', '关键性能', '检验记录符合性', '资料齐套性', '风险与整改建议', '8D 闭环状态'
    ])
    expect(SAMPLE_REVIEW_ITEMS.every((i) => i.required)).toBe(true)
    expect(SAMPLE_REVIEW_STAGES.map((s) => s.id)).toEqual(['评审', '审批', '归档'])
    expect(SAMPLE_REVIEW_STAGES.map((s) => s.order)).toEqual([1, 2, 3])
    expect(SAMPLE_REVIEW_STAGES[0].order).toBeLessThan(SAMPLE_REVIEW_STAGES[1].order)
  })

  it('同源复用：角色集 / 结论三态 / 审批两态 / 审批角色 / 复评行为 / KPI 标签', () => {
    expect(SAMPLE_REVIEW_CONFIG.signRoles).toBe(REVIEW_SIGN_ROLES)
    expect(SAMPLE_REVIEW_CONFIG.verdicts).toBe(REVIEW_VERDICTS)
    expect(SAMPLE_REVIEW_CONFIG.verdicts).toEqual(['认可', '有条件认可', '拒收'])
    expect(SAMPLE_REVIEW_CONFIG.approvals).toEqual(['批准', '驳回'])
    expect(SAMPLE_REVIEW_CONFIG.itemDefs).toBe(SAMPLE_REVIEW_ITEMS)
    expect(SAMPLE_REVIEW_CONFIG.approverRole).toBe('研发副总')
    expect(SAMPLE_REVIEW_CONFIG.rejectBehavior).toBe('reReviewRound')
    // 裁决 1：KPI 4 个 label 保持既有原值（设计稿 Q11「待总监批准→待审批」作废）
    // v0.3 §3.1：键名统一 total/reviewing/pending/closed，与 templateStats 返回一致，不再沿用 open
    expect(SAMPLE_REVIEW_CONFIG.kpiLabels).toEqual({
      total: '评审单', reviewing: '进行中', pending: '待总监批准', closed: '已闭环'
    })
    expect(Object.keys(SAMPLE_REVIEW_CONFIG.kpiLabels).sort()).toEqual(
      ['total', 'reviewing', 'pending', 'closed'].sort()
    )
    expect(SAMPLE_REVIEW_CONFIG.aiWatermark).toBe('供参考·不替代人工放行/确认')
  })

  it('P2 项本期仅留配置位、不实现', () => {
    expect(SAMPLE_REVIEW_CONFIG.p2).toEqual({
      eightDBranch: false, slaDelegation: false, exportPrint: false, aiAssist: false
    })
  })

  it('nextTemplateCode / templateDedupKey 为同源复用（不复制不改写）', () => {
    expect(nextTemplateCode(['RV-SMP-A-01'], 'SMP-A')).toBe(nextReviewCode(['RV-SMP-A-01'], 'SMP-A'))
    expect(nextTemplateCode([], 'SMP-A')).toBe('RV-SMP-A-01')
    expect(templateDedupKey('P1', 'SMP-A-01')).toBe(reviewDedupKey('P1', 'SMP-A-01'))
    expect(templateDedupKey('P1', ' SMP-A-01 ')).toBe(reviewDedupKey('P1', 'SMP-A-01'))
  })
})

describe('buildEmptyTemplate 全空白', () => {
  it('新增不带入任何历史数据', () => {
    const t = makeTemplate()
    expect(t.stage).toBe('评审')
    expect(t.formStatus).toBe('draft')
    expect(t.sampleCode).toBe('')
    expect(t.projectName).toBe('')
    expect(t.title).toBe('')
    expect(t.verdict).toBe('')
    expect(t.approval).toBe('')
    expect(t.approvalNote).toBe('')
    expect(t.signatures).toEqual([])
    expect(t.inspectionConclusion).toBe('')
    expect(t.round).toBe(1)
    expect(t.items).toHaveLength(SAMPLE_REVIEW_ITEMS.length)
    expect(t.items.every((i) => i.result === '' && i.note === '')).toBe(true)
    expect(t.flowInstanceId).toBeUndefined()
  })

  it('配置驱动：改 SAMPLE_REVIEW_ITEMS 一行，buildEmptyTemplate 随之变化', () => {
    const extra = { key: 'extra', label: '临时评审项', required: true }
    SAMPLE_REVIEW_ITEMS.push(extra)
    try {
      const t = makeTemplate()
      expect(t.items).toHaveLength(8)
      expect(t.items[7].label).toBe('临时评审项')
      expect(itemProgress(t.items).total).toBe(8)
    } finally {
      SAMPLE_REVIEW_ITEMS.pop()
    }
    expect(makeTemplate().items).toHaveLength(7)
  })
})

describe('itemProgress 完成度 x/y', () => {
  it('空清单 0/7，missing 列出全部项名', () => {
    const p = itemProgress(makeTemplate().items)
    expect(p.done).toBe(0)
    expect(p.total).toBe(7)
    expect(p.missing).toEqual(SAMPLE_REVIEW_ITEMS.map((i) => i.label))
  })

  it('部分完成 3/7，不适用计入完成', () => {
    const items = makeTemplate().items.map((i, idx) => ({
      ...i,
      result: (idx === 0 ? '通过' : idx === 1 ? '不适用' : idx === 2 ? '不通过' : '') as ReviewItemResult
    }))
    const p = itemProgress(items)
    expect(p.done).toBe(3)
    expect(p.total).toBe(7)
    expect(p.missing).toHaveLength(4)
  })

  it('全完成 7/7', () => {
    const p = itemProgress(completedStageOne().items)
    expect(p.done).toBe(7)
    expect(p.total).toBe(7)
    expect(p.missing).toEqual([])
  })
})

describe('两段顺序：审批不得先于结论', () => {
  it('合法流转表：评审→审批→归档 / 驳回退回评审 / 归档终态', () => {
    expect(STAGE_TRANSITIONS['评审']).toEqual(['审批'])
    expect(STAGE_TRANSITIONS['审批']).toEqual(['归档', '评审'])
    expect(STAGE_TRANSITIONS['归档']).toEqual([])
  })

  it('空白模板审批栏置灰、不可审批、不可提交、next=null', () => {
    const v = templateVerdictOf(makeTemplate())
    expect(v.stage).toBe('评审')
    expect(v.editable.items).toBe(true)
    expect(v.editable.verdict).toBe(true)
    expect(v.editable.approval).toBe(false)
    expect(v.canApprove).toBe(false)
    expect(v.canSubmitForApproval).toBe(false)
    expect(v.next).toBeNull()
    expect(v.blockers.length).toBeGreaterThan(0)
  })

  it('stage=审批但 verdict 为空 → canApprove=false（回退验证：顺序铁律）', () => {
    const t = makeTemplate({ stage: '审批', formStatus: 'submitted' })
    const v = templateVerdictOf(t)
    expect(v.canApprove).toBe(false)
    expect(canApprove(t).reason).toContain('审批不得先于结论')
    expect(v.editable.items).toBe(false)
    expect(v.editable.approval).toBe(true)
  })

  it('阶段一结论已成 → 可提交审批；落到阶段二后审批栏才开放', () => {
    const ready = completedStageOne()
    expect(templateVerdictOf(ready).canSubmitForApproval).toBe(true)
    expect(templateVerdictOf(ready).next).toBe('审批')
    const submitted: SampleReviewTemplate = { ...ready, stage: '审批', formStatus: 'submitted', approval: '批准' }
    const v2 = templateVerdictOf(submitted)
    expect(v2.canApprove).toBe(true)
    expect(v2.editable.items).toBe(false)
    expect(v2.editable.verdict).toBe(false)
    expect(v2.editable.approval).toBe(true)
  })
})

describe('canSubmitForApproval gate 四类 blockers（回退验证）', () => {
  it('① 评审项清单未完成', () => {
    const t = completedStageOne({ items: makeTemplate().items })
    const c = canSubmitForApproval(t)
    expect(c.ok).toBe(false)
    expect(c.blockers.join('；')).toContain('评审项清单未完成（0/7）')
  })

  it('② 汇总结论未下达', () => {
    const c = canSubmitForApproval(completedStageOne({ verdict: '' }))
    expect(c.ok).toBe(false)
    expect(c.blockers).toContain('汇总结论未下达（评审结论为空）')
  })

  it('③ 必填字段 / 会签未全通过', () => {
    const c = canSubmitForApproval(completedStageOne({
      sampleCode: '', title: '', signatures: []
    }))
    expect(c.ok).toBe(false)
    const joined = c.blockers.join('；')
    expect(joined).toContain('样件编号未填写')
    expect(joined).toContain('评审标题未填写')
    expect(joined).toContain('评审小组会签未全通过')
  })

  it('④ Q5 fail-closed：结论=拒收 未关联 8D 阻断提交', () => {
    const c = canSubmitForApproval(completedStageOne({ verdict: '拒收' }))
    expect(c.ok).toBe(false)
    expect(c.blockers.join('；')).toContain('须先关联 8D 报告')
  })

  it('④ Q5 fail-closed：检验不合格 未关联 8D 阻断提交', () => {
    const c = canSubmitForApproval(completedStageOne({ inspectionConclusion: '不合格' }))
    expect(c.ok).toBe(false)
    expect(c.blockers.join('；')).toContain('须先关联 8D 报告')
    // 关联 8D 后放行
    expect(canSubmitForApproval(completedStageOne({ inspectionConclusion: '不合格', eightDId: '8D-009' })).ok).toBe(true)
  })

  it('⑤ 非阶段一 / 非草稿态提交一律拦截', () => {
    const c = canSubmitForApproval(completedStageOne({ stage: '审批' }))
    expect(c.ok).toBe(false)
    expect(c.blockers.join('；')).toContain('不可提交审批')
  })

  it('全要素齐全 → ok=true、blockers 为空；templateVerdictOf blockers 同源', () => {
    const ready = completedStageOne()
    const c = canSubmitForApproval(ready)
    expect(c).toEqual({ ok: true, blockers: [] })
    expect(templateVerdictOf(ready).blockers).toEqual([])
  })
})

describe('canApprove / canArchive fail-closed', () => {
  it('驳回须填审批意见', () => {
    const t = completedStageOne({ stage: '审批', formStatus: 'submitted', approval: '驳回', approvalNote: '' })
    expect(canApprove(t).ok).toBe(false)
    expect(canApprove(t).reason).toContain('驳回须填写审批意见')
    expect(canApprove({ ...t, approvalNote: '需补充尺寸复验' }).ok).toBe(true)
  })

  it('canArchive 缺一不可（阶段 / 状态 / 人工批准 / 结论 / 8D）', () => {
    const archived = completedStageOne({
      stage: '归档', formStatus: 'completed', approval: '批准',
      approver: '研发副总', approvedAt: NOW, closedAt: NOW
    })
    expect(canArchive(archived)).toEqual({ ok: true, missing: [], reason: undefined })

    const notApproved = { ...archived, approval: '' as const }
    expect(canArchive(notApproved).ok).toBe(false)
    expect(canArchive(notApproved).missing).toContain('审批结果非人工批准')

    const wrongStage = { ...archived, stage: '审批' as const }
    expect(canArchive(wrongStage).ok).toBe(false)

    const noVerdict = { ...archived, verdict: '' as const }
    expect(canArchive(noVerdict).ok).toBe(false)

    const need8d = { ...archived, verdict: '拒收' as const, eightDId: undefined }
    expect(canArchive(need8d).ok).toBe(false)
    expect(canArchive(need8d).missing).toContain('8D 报告未关联')
  })

  it('终态 templateVerdictOf 全只读', () => {
    const archived = completedStageOne({
      stage: '归档', formStatus: 'completed', approval: '批准', closedAt: NOW
    })
    const v = templateVerdictOf(archived)
    expect(v.editable).toEqual({ base: false, items: false, verdict: false, approval: false })
    expect(v.canArchive).toBe(true)
    expect(v.canSubmitForApproval).toBe(false)
    expect(v.next).toBeNull()
  })
})

describe('reopenForReviewRound 驳回退回阶段一复评（round+1）', () => {
  it('round+1，清空结论/审批栏/会签/清单，保留 8D 与历史锚点', () => {
    const before = completedStageOne({
      stage: '审批', formStatus: 'submitted', approval: '驳回', approvalNote: '需整改',
      approver: '研发副总', approvedAt: NOW, eightDId: '8D-007',
      flowInstanceId: 'F-1', workflowFormId: 'WF-1', round: 1
    })
    const after = reopenForReviewRound(before, '2026-11-24T10:00:00.000Z')
    expect(after.round).toBe(2)
    expect(after.stage).toBe('评审')
    expect(after.formStatus).toBe('draft')
    expect(after.verdict).toBe('')
    expect(after.approval).toBe('')
    expect(after.approvalNote).toBe('')
    expect(after.signatures).toEqual([])
    expect(after.items.every((i) => i.result === '' && i.note === '')).toBe(true)
    expect(after.inspectionConclusion).toBe('')
    expect(after.flowInstanceId).toBeUndefined()
    expect(after.eightDId).toBe('8D-007') // 8D 关联保留
    expect(after.id).toBe(before.id)
    expect(after.code).toBe(before.code)
    expect(after.createdAt).toBe(before.createdAt)
    expect(after.updatedAt).toBe('2026-11-24T10:00:00.000Z')
    // 原对象不被修改（纯函数）
    expect(before.round).toBe(1)
    expect(before.verdict).toBe('认可')
  })
})

describe('templateStats KPI 引擎求值（v0.3 §5 Q11 口径）', () => {
  it('total / reviewing(非归档) / pending(审批) / closed(归档) + byStage + 去重样件数', () => {
    const rows = [
      completedStageOne(),
      completedStageOne({ id: 'SRT-2', stage: '审批', formStatus: 'submitted' }),
      completedStageOne({ id: 'SRT-3', stage: '归档', formStatus: 'completed', approval: '批准' })
    ]
    const s = templateStats(rows)
    expect(s.total).toBe(3)
    expect(s.byStage).toEqual({ 评审: 1, 审批: 1, 归档: 1 })
    // 进行中 = stage !== '归档' = 3 - 1 = 2（评审 1 + 审批 1）
    expect(s.reviewing).toBe(2)
    // 待总监批准 = stage === '审批'
    expect(s.pending).toBe(1)
    // 已闭环 = stage === '归档'
    expect(s.closed).toBe(1)
    // v0.3：不得再暴露 old open 键
    expect('open' in s).toBe(false)
    expect(s.uniqueSamples).toBe(1) // 三张单据同项目同样件，去重后 1
    expect(templateStats([])).toEqual({
      total: 0, reviewing: 0, pending: 0, closed: 0,
      byStage: { 评审: 0, 审批: 0, 归档: 0 }, uniqueSamples: 0
    })
  })

  it('键名与 SAMPLE_REVIEW_CONFIG.kpiLabels 完全对齐（配置驱动，视图不硬编码）', () => {
    const s = templateStats([])
    const labelKeys = Object.keys(SAMPLE_REVIEW_CONFIG.kpiLabels) as Array<keyof typeof s>
    for (const k of labelKeys) {
      expect(typeof s[k]).toBe('number')
    }
  })
})

describe('stageFromFormStatus 显式映射表', () => {
  it('draft→评审 / submitted→审批 / completed→归档 / rejected→评审 / terminated→评审', () => {
    expect(STAGE_FROM_FORM_STATUS).toEqual({
      draft: '评审', submitted: '审批', completed: '归档', rejected: '评审', terminated: '评审'
    })
    expect(stageFromFormStatus('draft')).toBe('评审')
    expect(stageFromFormStatus('submitted')).toBe('审批')
    expect(stageFromFormStatus('completed', '批准')).toBe('归档')
    expect(stageFromFormStatus('rejected', '驳回')).toBe('评审')
    expect(stageFromFormStatus('terminated')).toBe('评审')
  })

  it('fail-closed：completed 但非人工批准不得归档', () => {
    expect(stageFromFormStatus('completed', '')).toBe('审批')
    expect(stageFromFormStatus('completed', '驳回')).toBe('审批')
  })
})

describe('同源工具函数一致性（不复制、不改写）', () => {
  it('signComplete / signProgress 与冻结引擎口径一致', () => {
    const sigs = completedStageOne().signatures
    expect(signComplete(sigs)).toBe(true)
    expect(signProgress(sigs)).toEqual({ passed: 3, total: 3, missing: [] })
    expect(templateVerdictOf(completedStageOne()).sign).toEqual(signProgress(sigs))
  })
})
