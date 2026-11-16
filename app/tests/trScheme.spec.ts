import { describe, it, expect } from 'vitest'
import {
  newTrScheme,
  newTrAttachment,
  newTrReviewOpinion,
  hasValidAttachment,
  validAttachments,
  validateTrScheme,
  aggregateTrResult,
  reviewCompletion,
  canApproveTr,
  approveTrScheme,
  TR_REVIEW_ROLES
} from '@/domain/trScheme'

describe('技术方案（TR）域引擎', () => {
  it('newTrScheme 返回空白方案，状态草稿、结论待评审', () => {
    const s = newTrScheme('TR-1', '周立群')
    expect(s.name).toBe('')
    expect(s.version).toBe('V1.0')
    expect(s.status).toBe('草稿')
    expect(s.trResult).toBe('待评审')
    expect(s.attachments).toEqual([])
    expect(s.opinions).toEqual([])
    expect(s.submitter).toBe('周立群')
  })

  it('hasValidAttachment 仅当存在非空附件名才为真', () => {
    expect(hasValidAttachment([])).toBe(false)
    expect(hasValidAttachment([newTrAttachment('a')])).toBe(false)
    const att = newTrAttachment('a'); att.name = '   '
    expect(hasValidAttachment([att])).toBe(false)
    const ok = newTrAttachment('b'); ok.name = '方案.docx'
    expect(hasValidAttachment([ok])).toBe(true)
  })

  it('validAttachments 过滤空名附件', () => {
    const a = newTrAttachment('a'); a.name = '方案.docx'
    const b = newTrAttachment('b'); b.name = ''
    expect(validAttachments([a, b])).toHaveLength(1)
    expect(validAttachments([a, b])[0].id).toBe('a')
  })

  it('validateTrScheme 缺方案名称/版本/客户/车型/附件时给出对应阻断项', () => {
    const s = newTrScheme('TR-1', '周立群')
    s.version = '' // 显式清空版本
    const r1 = validateTrScheme(s)
    expect(r1.ok).toBe(false)
    expect(r1.blockers).toContain('方案名称')
    expect(r1.blockers).toContain('方案版本')
    expect(r1.blockers).toContain('客户')
    expect(r1.blockers).toContain('车型')
    expect(r1.blockers).toContain('技术方案附件（须以附件形式提交）')

    s.name = '转向方案'
    s.version = 'V1.2'
    s.customer = '某整车厂'
    s.vehicleModel = '某 SUV'
    const att = newTrAttachment('a'); att.name = '方案.docx'
    s.attachments = [att]
    expect(validateTrScheme(s).ok).toBe(true)
  })

  it('aggregateTrResult 按最严结论汇总（不通过 > 有条件通过 > 通过）', () => {
    const pass = newTrReviewOpinion('电子研发工程师'); pass.opinion = '无异议'
    const cond = newTrReviewOpinion('结构研发工程师'); cond.verdict = '有条件通过'; cond.opinion = '需补充计算书'
    const fail = newTrReviewOpinion('工艺技术工艺师'); fail.verdict = '不通过'; fail.opinion = '工艺不可行'

    expect(aggregateTrResult([pass])).toBe('TR 通过')
    expect(aggregateTrResult([pass, cond])).toBe('TR 有条件通过')
    expect(aggregateTrResult([pass, cond, fail])).toBe('TR 不通过')
  })

  it('reviewCompletion 统计已给实质意见的角色数与完成率', () => {
    const o1 = newTrReviewOpinion('电子研发工程师'); o1.opinion = '同意'
    const o2 = newTrReviewOpinion('结构研发工程师'); o2.opinion = ''
    const r = reviewCompletion([o1, o2])
    expect(r.signed).toBe(1)
    expect(r.total).toBe(TR_REVIEW_ROLES.length)
    expect(r.rate).toBeCloseTo(1 / TR_REVIEW_ROLES.length)
  })

  it('canApproveTr 待评审/不通过/无签审意见均不可批准', () => {
    const s = newTrScheme('TR-1', '周立群')
    expect(canApproveTr(s).ok).toBe(false) // 待评审

    s.trResult = 'TR 不通过'
    expect(canApproveTr(s).ok).toBe(false)

    s.trResult = 'TR 通过'
    expect(canApproveTr(s).ok).toBe(false) // 无实质签审意见

    const op = newTrReviewOpinion('电子研发工程师'); op.opinion = '同意'
    s.opinions = [op]
    expect(canApproveTr(s).ok).toBe(true)
  })

  it('approveTrScheme 标记已批准并留痕批准人', () => {
    const s = newTrScheme('TR-1', '周立群')
    s.trResult = 'TR 通过'
    const op = newTrReviewOpinion('电子研发工程师'); op.opinion = '同意'
    s.opinions = [op]
    const approved = approveTrScheme(s, '执行总监-赵启明')
    expect(approved.status).toBe('已批准')
    expect(approved.approvedBy).toBe('执行总监-赵启明')
    expect(approved.approvedAt).toBeTruthy()
  })
})
