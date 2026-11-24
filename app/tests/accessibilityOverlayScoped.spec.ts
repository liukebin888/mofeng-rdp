/**
 * NFR-017 限定容器（el-dialog / el-drawer）取证单测
 *
 * 覆盖 collectIn 所复用的同源入口 probeAccessibility(pairs, { root })：
 *   1. root 限定采集：只采容器内元素，不把全页控件混入快照；
 *   2. 判定与 domain 同源：probeAccessibility 的 audit/evidence 等于同快照 auditFromSnapshots；
 *   3. 已知违规样本回退验证：容器内注入「无标签 input + 无焦点指示 role=button div」
 *      必须被检出，移除注入 DOM 后必须恢复；
 *   4. 选择器未命中（root=null）空样本 fail-closed，不伪装成全页取证。
 *
 * 采用注入式 fake DOM（不依赖 jsdom），与 accessibilityRealDom.spec.ts 同款手法。
 */
import { describe, it, expect } from 'vitest'
import {
  auditFromSnapshots,
  type ContrastPair,
  type DomElementSnapshot
} from '@/domain/accessibility'
import { collectDomSnapshots, probeAccessibility } from '@/infra/accessibilityProbe'

const PAIRS: ContrastPair[] = [{ fg: '#000000', bg: '#ffffff' }]

interface ElOpts {
  tag: string
  id: string
  attrs?: Record<string, string>
  labelsText?: string
  focusStyle?: Record<string, string>
}

function makeEl(opts: ElOpts) {
  const attrs = new Map(Object.entries(opts.attrs ?? {}))
  const el: any = {
    tagName: opts.tag,
    id: opts.id,
    disabled: false,
    textContent: '',
    type: '',
    _focused: false,
    _focusStyle: opts.focusStyle ?? {},
    getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k) : null),
    hasAttribute: (k: string) => attrs.has(k),
    closest: () => null,
    getClientRects: () => [{ width: 10 }],
    get offsetParent() { return {} },
    focus() { el._focused = true; if (refDoc) refDoc.activeElement = el },
    blur() { el._focused = false; if (refDoc && refDoc.activeElement === el) refDoc.activeElement = null }
  }
  if (opts.labelsText) el.labels = [{ textContent: opts.labelsText }]
  return el
}

let refDoc: any = null

/** fake 容器：querySelectorAll 只返回传入的元素，模拟 document.querySelector(sel) 命中的 overlay */
function fakeRoot(elements: any[]) {
  return { querySelectorAll: () => elements }
}

function styleOf(el: any) {
  return {
    visibility: 'visible',
    display: 'block',
    outlineStyle: 'none',
    outlineWidth: '0px',
    boxShadow: 'none',
    borderColor: 'rgb(220, 223, 230)',
    ...(el._focused ? el._focusStyle : {})
  }
}

function fakeDoc(): any {
  return { activeElement: null, getElementById: () => null }
}

/** 合规按钮：focus 态有 outline 指示 */
function okButton(id = 'ovl-btn-ok') {
  return makeEl({
    tag: 'BUTTON',
    id,
    focusStyle: { outlineStyle: 'solid', outlineWidth: '2px' }
  })
}

describe('NFR-017 限定容器取证（collectIn 同源入口）', () => {
  it('root 限定：只采容器内元素，不采全页（overlay 与 document 样本隔离）', () => {
    const btn = okButton()
    const pageBad = makeEl({ tag: 'INPUT', id: 'page-no-label' })
    const pageRoot = fakeRoot([btn, pageBad])
    const overlayRoot = fakeRoot([btn])
    const doc = fakeDoc()
    refDoc = doc
    const all = collectDomSnapshots({ root: pageRoot as any, doc, styleOf })
    const scoped = collectDomSnapshots({ root: overlayRoot as any, doc, styleOf })
    refDoc = null

    expect(all.length).toBe(2)
    expect(scoped.length).toBe(1)
    expect(scoped[0].id).toBe('ovl-btn-ok')
    expect(scoped.map((s: DomElementSnapshot) => s.id)).not.toContain('page-no-label')
  })

  it('判定与 domain 同源：probeAccessibility 结果等于同快照 auditFromSnapshots', () => {
    const btn = okButton()
    const badLabel = makeEl({ tag: 'INPUT', id: 'A11Y-OVL-MUT-NO-LABEL' })
    const elements = [btn, badLabel]
    const root = fakeRoot(elements)
    const doc = fakeDoc()
    refDoc = doc
    const { audit, evidence, snapshots } = probeAccessibility(PAIRS, { root: root as any, doc, styleOf })
    refDoc = null
    const direct = auditFromSnapshots(PAIRS, snapshots)

    expect(audit).toEqual(direct.audit)
    expect(evidence).toEqual(direct.evidence)
    expect(evidence.sampledElements).toBe(2)
    expect(evidence.controlCount).toBe(1)
    expect(evidence.labelViolations).toContain('A11Y-OVL-MUT-NO-LABEL')
    expect(audit.labelCheck.ok).toBe(false)
  })

  it('已知违规样本回退验证：注入 overlay 内 → 必须检出 → 移除后恢复', () => {
    const btn = okButton()
    const badLabel = makeEl({ tag: 'INPUT', id: 'A11Y-OVL-MUT-NO-LABEL' })
    const badFocus = makeEl({
      tag: 'DIV',
      id: 'A11Y-OVL-MUT-NO-FOCUS',
      attrs: { role: 'button', tabindex: '0' }
    })
    const elements: any[] = [btn]
    const root = fakeRoot(elements)
    const doc = fakeDoc()
    refDoc = doc

    const before = probeAccessibility(PAIRS, { root: root as any, doc, styleOf })
    expect(before.evidence.sampledElements).toBe(1)
    expect(before.audit.keyboardCheck.ok).toBe(true)
    expect(before.audit.labelCheck.violations ?? []).toEqual([])

    // 注入两个已知违规控件（id 与真实 overlay 变异脚本前缀一致）
    elements.push(badLabel, badFocus)
    const during = probeAccessibility(PAIRS, { root: root as any, doc, styleOf })
    expect(during.evidence.sampledElements).toBe(3)
    expect(during.audit.labelCheck.violations?.some((v) => v.id === 'A11Y-OVL-MUT-NO-LABEL')).toBe(true)
    expect(during.audit.keyboardCheck.violations?.some((v) => v.id === 'A11Y-OVL-MUT-NO-FOCUS')).toBe(true)
    expect(during.evidence.labelViolations).toContain('A11Y-OVL-MUT-NO-LABEL')
    expect(during.evidence.keyboardViolations).toContain('A11Y-OVL-MUT-NO-FOCUS')
    expect(during.evidence.focusIndicatorMissing).toBeGreaterThanOrEqual(1)

    // 移除注入 DOM（回退）
    elements.splice(1, 2)
    const after = probeAccessibility(PAIRS, { root: root as any, doc, styleOf })
    expect(after.evidence.sampledElements).toBe(before.evidence.sampledElements)
    expect(after.evidence.labelViolations).toEqual([])
    expect(after.evidence.keyboardViolations).toEqual([])
    expect(after.audit.keyboardCheck.ok).toBe(true)
    refDoc = null
  })

  it('选择器未命中（root=null）→ 空样本 fail-closed，不伪装成全页取证', () => {
    const doc = fakeDoc()
    refDoc = doc
    const { audit, evidence, snapshots } = probeAccessibility(PAIRS, { root: null, doc })
    refDoc = null

    expect(snapshots).toEqual([])
    expect(evidence.evidenceCollected).toBe(false)
    expect(evidence.interactiveCount).toBe(0)
    expect(audit.keyboardCheck.ok).toBe(false)
    expect(audit.labelCheck.ok).toBe(false)
    // 对比度仍按真实令牌 pair 计算，不受 DOM 缺失影响
    expect(audit.contrastChecks.length).toBe(1)
  })
})
