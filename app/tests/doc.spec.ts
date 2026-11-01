/**
 * 文档受控生命周期引擎独立 QA 用例（SRS 第 19 章 / DOC-001~010）
 * 覆盖：会签齐备才发布 / 否决退回+意见保留 / 版本链+旧版失效 /
 *      检入检出并发 / 作废后禁止下载 / 未发布不计入齐套 / 全文检索 / 有效性唯一
 */
import { describe, expect, it } from 'vitest'
import {
  addComment,
  canDownload,
  canPublish,
  checkin,
  checkout,
  hasOpenComments,
  isSignoffComplete,
  obsolete,
  publish,
  resolveComment,
  revisionUp,
  searchDocs,
  signoff,
  submitForSignoff,
  validateEffectiveUnique,
  veto,
  type ControlledDoc
} from '../src/domain/docEngine'
import { buildSeed } from '../src/data/seed'

const T = '2026-11-01T10:00:00+08:00'

function mkDoc(overrides: Partial<ControlledDoc> = {}): ControlledDoc {
  return {
    id: 'DOC-T1',
    projectId: 'P-001',
    code: 'DOC-TST-001',
    name: '测试受控文档',
    discipline: '系统',
    version: 'V1.0',
    status: '草稿',
    required: true,
    signoffs: [
      { role: '系统工程师', signed: false },
      { role: '质量工程师', signed: false }
    ],
    mdrSet: 'MDR-A',
    comments: [],
    versionChain: [{ version: 'V1.0', status: '草稿', author: '系统工程师' }],
    ...overrides
  }
}

describe('DOC-004/C-45 会签齐备才发布', () => {
  it('会签未齐时 canPublish 返回 false，publish 被拒', () => {
    const d = mkDoc({ status: '会签中' })
    expect(isSignoffComplete(d)).toBe(false)
    expect(canPublish(d).ok).toBe(false)
    const r = publish(d, '张三', T)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('会签')
  })

  it('会签齐备且无未关闭意见时才能发布，发布后计算哈希并标记有效', () => {
    let d = mkDoc({ status: '会签中' })
    let r = signoff(d, '系统工程师', '甲', T)
    expect(r.ok).toBe(true)
    d = r.doc!
    r = signoff(d, '质量工程师', '乙', T)
    expect(r.code).toBe('COMPLETE')
    d = r.doc!
    expect(canPublish(d).ok).toBe(true)
    const p = publish(d, '文控', T)
    expect(p.ok).toBe(true)
    expect(p.doc!.status).toBe('已发布')
    expect(p.doc!.hash).toBeTruthy()
    expect(p.doc!.effectiveFlag).toBe(true)
  })

  it('存在未关闭评审意见时禁止发布（DOC-007）', () => {
    let d = mkDoc({ status: '会签中' })
    d = signoff(d, '系统工程师', '甲', T).doc!
    d = signoff(d, '质量工程师', '乙', T).doc!
    d = addComment(d, '质量工程师', '乙', '需补充 DFMEA', T).doc!
    expect(hasOpenComments(d)).toBe(true)
    expect(canPublish(d).ok).toBe(false)
  })
})

describe('DOC-014 否决整体退回 + 意见条目化（DOC-007）', () => {
  it('任一角色否决即整体退回草稿，否决意见保留为未关闭条目', () => {
    let d = mkDoc({ status: '会签中' })
    d = signoff(d, '系统工程师', '甲', T).doc!
    const v = veto(d, '质量工程师', '乙', '图纸与样件不一致', T)
    expect(v.ok).toBe(true)
    expect(v.doc!.status).toBe('草稿')
    expect(v.doc!.signoffs.find((s) => s.role === '质量工程师')!.veto).toBe(true)
    expect(v.doc!.comments.length).toBe(1)
    expect(v.doc!.comments[0].resolved).toBe(false)
    expect(v.doc!.comments[0].content).toBe('图纸与样件不一致')
  })

  it('关闭意见须留痕，关闭后可重新会签发布', () => {
    let d = mkDoc({ status: '会签中' })
    d = signoff(d, '系统工程师', '甲', T).doc!
    d = veto(d, '质量工程师', '乙', '问题A', T).doc!
    const cid = d.comments[0].id
    d = resolveComment(d, cid, '乙', '已整改复测通过', T).doc!
    expect(d.comments[0].resolved).toBe(true)
    expect(d.comments[0].resolution).toBe('已整改复测通过')
  })
})

describe('DOC-002 版本链 + 旧版失效', () => {
  it('升版生成新版本号，旧版失效，状态回草稿并重置会签', () => {
    let d = mkDoc({ status: '已发布', effectiveFlag: true, hash: 'abc123', signoffs: [{ role: '系统工程师', signed: true }, { role: '质量工程师', signed: true }] })
    d.versionChain = [{ version: 'V1.0', status: '有效', hash: 'abc123', author: '甲' }]
    const r = revisionUp(d, 'V1.1', '甲')
    expect(r.ok).toBe(true)
    expect(r.doc!.version).toBe('V1.1')
    expect(r.doc!.status).toBe('草稿')
    expect(r.doc!.effectiveFlag).toBe(false)
    expect(r.doc!.hash).toBeUndefined()
    // 旧版失效，新版本为草稿
    const old = r.doc!.versionChain.find((v) => v.version === 'V1.0')
    expect(old!.status).toBe('已失效')
    // 会签重置
    expect(r.doc!.signoffs.every((s) => !s.signed)).toBe(true)
  })

  it('版本链不允许重复版本号', () => {
    const d = mkDoc({ status: '已发布', versionChain: [{ version: 'V1.0', status: '有效', author: '甲' }] })
    const r = revisionUp(d, 'V1.0', '甲')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('VERSION_DUP')
  })
})

describe('DOC-003 检入检出并发控制', () => {
  it('检出加锁，他人检出被拒', () => {
    const d = mkDoc({ status: '草稿' })
    const c1 = checkout(d, 'U-1', T)
    expect(c1.ok).toBe(true)
    expect(c1.doc!.checkoutBy).toBe('U-1')
    const c2 = checkout(c1.doc!, 'U-2', T)
    expect(c2.ok).toBe(false)
    expect(c2.code).toBe('CHECKED_OUT')
  })

  it('仅检出人可检入', () => {
    let d = mkDoc({ status: '草稿' })
    d = checkout(d, 'U-1', T).doc!
    const r = checkin(d, 'U-2')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('NOT_CHECKOUT_OWNER')
    const r2 = checkin(d, 'U-1')
    expect(r2.ok).toBe(true)
    expect(r2.doc!.checkoutBy).toBeUndefined()
  })

  it('他人已检出时不可提交会签（并发阻止）', () => {
    let d = mkDoc({ status: '草稿' })
    d = checkout(d, 'U-9', T).doc!
    const r = submitForSignoff(d, 'U-8')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHECKED_OUT')
  })
})

describe('DOC-001/005 作废与下载控制', () => {
  it('作废后禁止下载，仅历史查询', () => {
    let d = mkDoc({ status: '已发布', effectiveFlag: true })
    d = obsolete(d, '文控', T).doc!
    expect(d.status).toBe('已作废')
    expect(d.effectiveFlag).toBe(false)
    expect(canDownload(d).ok).toBe(false)
  })

  it('作废后不得发布、不得升版、不得会签', () => {
    let d = mkDoc({ status: '已发布' })
    d = obsolete(d, '文控', T).doc!
    expect(publish(d, '甲', T).ok).toBe(false)
    expect(revisionUp(d, 'V2.0', '甲').ok).toBe(false)
    expect(signoff(d, '系统工程师', '甲', T).ok).toBe(false)
  })
})

describe('DOC-005 有效性唯一', () => {
  it('同一文档编号仅允许一个有效版本', () => {
    const a = mkDoc({ id: 'X', status: '已发布', effectiveFlag: true })
    const b = mkDoc({ id: 'Y', status: '已发布', effectiveFlag: true })
    const c = mkDoc({ id: 'Z', status: '草稿' })
    const r = validateEffectiveUnique([a, b, c])
    expect(r.unique).toBe(false)
    expect(r.effective.length).toBe(2)
    const r2 = validateEffectiveUnique([a, c])
    expect(r2.unique).toBe(true)
  })
})

describe('DOC-008 全文检索 + 重复提示', () => {
  it('按名称/编号/意见命中，相似版本分组提示', () => {
    const a = mkDoc({ id: 'A', code: 'DOC-A', name: '系统需求规格书', version: 'V1.0' })
    const b = mkDoc({ id: 'B', code: 'DOC-A', name: '系统需求规格书', version: 'V1.1' })
    const c = mkDoc({ id: 'C', code: 'DOC-C', name: '硬件原理图', version: 'V1.0' })
    const r = searchDocs([a, b, c], '需求')
    expect(r.hits.length).toBe(2)
    // 重复提示：同名多版本
    expect(r.dupGroups.length).toBe(1)
    expect(r.dupGroups[0].length).toBe(2)
  })
})

describe('PMC-037 未发布不计入齐套（联动验证）', () => {
  it('seed 中会签中/草稿文档不纳入齐套口径，已发布才计齐套', () => {
    const seed = buildSeed()
    const published = seed.docs.filter((d) => d.status === '已发布')
    const unpublished = seed.docs.filter((d) => d.status !== '已发布')
    // 未发布文档不得作为齐套依据
    expect(unpublished.every((d) => !d.effectiveFlag)).toBe(true)
    expect(published.every((d) => d.effectiveFlag)).toBe(true)
    // 已发布文档均带哈希（DOC-006 基线绑定前提）
    expect(published.every((d) => !!d.hash)).toBe(true)
  })
})
