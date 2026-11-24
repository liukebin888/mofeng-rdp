/**
 * NFR-017 真实 DOM 取证单测
 * 覆盖：快照→判定映射、焦点指示三通道、空样本 fail-closed、
 *       已知违规样本回退验证、infra 采集器（无 DOM / 注入式 fake DOM）。
 */
import { describe, it, expect } from 'vitest'
import {
  NO_EVIDENCE_NOTE,
  focusIndicatorFromSnapshot,
  snapshotToAccessibleElement,
  snapshotToFormControl,
  checkKeyboardAccessible,
  checkFormLabels,
  auditFromSnapshots,
  accessibilityPassRate,
  type DomElementSnapshot,
  type ContrastPair
} from '@/domain/accessibility'
import { collectDomSnapshots, probeAccessibility, DEFAULT_CONTRAST_PAIRS } from '@/infra/accessibilityProbe'

const PAIRS: ContrastPair[] = [{ fg: '#000000', bg: '#ffffff' }]

function snap(overrides: Partial<DomElementSnapshot> = {}): DomElementSnapshot {
  return {
    id: 'e1',
    tag: 'BUTTON',
    visible: true,
    disabled: false,
    ariaHidden: false,
    tabIndex: null,
    nativeActivatable: true,
    hasKeyHandler: false,
    focusOutlineStyle: 'solid',
    focusOutlineWidth: '2px',
    focusBoxShadow: 'none',
    focusBorderColor: 'rgb(0, 0, 0)',
    baseBorderColor: 'rgb(0, 0, 0)',
    labelText: '',
    controlKind: 'interactive',
    ...overrides
  }
}

describe('NFR-017 焦点指示判定（真实 computed style）', () => {
  it('outline 可见 → 有指示', () => {
    expect(focusIndicatorFromSnapshot(snap())).toBe(true)
  })

  it('box-shadow 可见 → 有指示', () => {
    expect(focusIndicatorFromSnapshot(snap({
      focusOutlineStyle: 'none', focusOutlineWidth: '0px', focusBoxShadow: '0 0 0 2px #409eff'
    }))).toBe(true)
  })

  it('焦点态边框变色 → 有指示（Element Plus 输入框口径）', () => {
    expect(focusIndicatorFromSnapshot(snap({
      focusOutlineStyle: 'none', focusOutlineWidth: '0px', focusBoxShadow: 'none',
      baseBorderColor: 'rgb(220, 223, 230)', focusBorderColor: 'rgb(64, 158, 255)'
    }))).toBe(true)
  })

  it('三者皆无 → 无指示', () => {
    expect(focusIndicatorFromSnapshot(snap({
      focusOutlineStyle: 'none', focusOutlineWidth: '0px', focusBoxShadow: 'none',
      baseBorderColor: 'rgb(0, 0, 0)', focusBorderColor: 'rgb(0, 0, 0)'
    }))).toBe(false)
  })

  it('outline-width 为 0 不算指示', () => {
    expect(focusIndicatorFromSnapshot(snap({ focusOutlineWidth: '0px' }))).toBe(false)
  })
})

describe('NFR-017 快照→判定输入映射', () => {
  it('原生 button 无 tabindex → tabbable 且可键盘激活', () => {
    expect(snapshotToAccessibleElement(snap())).toEqual({
      id: 'e1', tabbable: true, keyboardActivatable: true, focusIndicator: true
    })
  })

  it('tabindex=-1 明确不可 Tab 聚焦', () => {
    expect(snapshotToAccessibleElement(snap({ tabIndex: -1 })).tabbable).toBe(false)
  })

  it('自定义 role=button 未声明键盘激活 → 如实判不可激活（不臆造）', () => {
    const s = snap({ tag: 'DIV', nativeActivatable: false, tabIndex: 0, hasKeyHandler: false })
    expect(snapshotToAccessibleElement(s).keyboardActivatable).toBe(false)
  })

  it('disabled / aria-hidden / 不可见 → tabbable false', () => {
    expect(snapshotToAccessibleElement(snap({ disabled: true })).tabbable).toBe(false)
    expect(snapshotToAccessibleElement(snap({ ariaHidden: true })).tabbable).toBe(false)
    expect(snapshotToAccessibleElement(snap({ visible: false })).tabbable).toBe(false)
  })

  it('表单标签取自真实关联文本，placeholder 不算', () => {
    expect(snapshotToFormControl(snap({ controlKind: 'form', labelText: '项目名称' }))).toEqual({
      id: 'e1', hasLabel: true, labelText: '项目名称'
    })
    expect(snapshotToFormControl(snap({ controlKind: 'form', labelText: '  ' })).hasLabel).toBe(false)
  })
})

describe('NFR-017 空样本 fail-closed（禁止恒报 100%）', () => {
  it('键盘可达：空样本不通过且标注未取证', () => {
    const r = checkKeyboardAccessible([])
    expect(r.ok).toBe(false)
    expect(r.note).toBe(NO_EVIDENCE_NOTE)
  })

  it('表单标签：空样本不通过且标注未取证', () => {
    const r = checkFormLabels([])
    expect(r.ok).toBe(false)
    expect(r.note).toBe(NO_EVIDENCE_NOTE)
  })

  it('通过率：审计集为空返回 0（原实现返回 100 属假阳性）', () => {
    expect(accessibilityPassRate([]).rate).toBe(0)
  })

  it('未取证时整体审计不通过', () => {
    const { audit, evidence } = auditFromSnapshots(PAIRS, [])
    expect(audit.keyboardCheck.ok).toBe(false)
    expect(audit.labelCheck.ok).toBe(false)
    expect(evidence.evidenceCollected).toBe(false)
    expect(accessibilityPassRate([audit]).rate).toBe(0)
  })
})

describe('NFR-017 auditFromSnapshots（判定与评估同源）', () => {
  it('全合规真实快照 → 通过，中间指标非零', () => {
    const snapshots = [
      snap({ id: 'btn-save' }),
      snap({ id: 'input-name', tag: 'INPUT', controlKind: 'form', labelText: '项目名称' })
    ]
    const { audit, evidence } = auditFromSnapshots(PAIRS, snapshots)
    expect(audit.keyboardCheck.ok).toBe(true)
    expect(audit.labelCheck.ok).toBe(true)
    expect(accessibilityPassRate([audit]).rate).toBe(100)
    expect(evidence.sampledElements).toBe(2)
    expect(evidence.interactiveCount).toBe(2)
    expect(evidence.controlCount).toBe(1)
    expect(evidence.evidenceCollected).toBe(true)
  })

  it('已知违规样本回退验证：缺标签 + 无焦点指示 + 自定义键盘不可激活 均被检出', () => {
    const badLabel = snap({ id: 'input-bad', tag: 'INPUT', controlKind: 'form', labelText: '' })
    const badFocus = snap({
      id: 'btn-bad', focusOutlineStyle: 'none', focusOutlineWidth: '0px',
      focusBoxShadow: 'none', baseBorderColor: 'rgb(0,0,0)', focusBorderColor: 'rgb(0,0,0)'
    })
    const badKeyboard = snap({ id: 'div-bad', tag: 'DIV', nativeActivatable: false, tabIndex: 0, hasKeyHandler: false })
    const { audit, evidence } = auditFromSnapshots(PAIRS, [badLabel, badFocus, badKeyboard])
    expect(audit.keyboardCheck.ok).toBe(false)
    expect(audit.labelCheck.ok).toBe(false)
    expect(evidence.labelViolations).toContain('input-bad')
    expect(evidence.keyboardViolations).toEqual(expect.arrayContaining(['btn-bad', 'div-bad']))
    expect(evidence.focusIndicatorMissing).toBeGreaterThanOrEqual(1)
    expect(accessibilityPassRate([audit]).rate).toBe(0)
  })

  it('已取证但本页无表单控件 → 标签判「不适用」且如实披露 controlCount=0', () => {
    const { audit, evidence } = auditFromSnapshots(PAIRS, [snap({ id: 'btn-only' })])
    expect(audit.labelCheck.ok).toBe(true)
    expect(audit.labelCheck.note).toContain('不适用')
    expect(evidence.controlCount).toBe(0)
    expect(evidence.evidenceCollected).toBe(true)
  })

  it('disabled / aria-hidden 元素不计入可交互样本', () => {
    const { evidence } = auditFromSnapshots(PAIRS, [
      snap({ id: 'ok' }),
      snap({ id: 'off', disabled: true }),
      snap({ id: 'hidden', ariaHidden: true })
    ])
    expect(evidence.interactiveCount).toBe(1)
  })

  it('仅带 tabindex 的布局容器不参与键盘判定，但如实披露排除数（不掩盖口径）', () => {
    const container = snap({
      id: 'tbody-anchor', tag: 'TBODY', controlKind: 'container',
      nativeActivatable: false, tabIndex: -1,
      focusOutlineStyle: 'none', focusOutlineWidth: '0px', focusBoxShadow: 'none',
      focusBorderColor: '', baseBorderColor: ''
    })
    const { audit, evidence } = auditFromSnapshots(PAIRS, [snap({ id: 'btn-ok' }), container])
    expect(audit.keyboardCheck.ok).toBe(true)
    expect(evidence.interactiveCount).toBe(1)
    expect(evidence.sampledElements).toBe(2)
    expect(evidence.excludedContainers).toBe(1)
  })

  it('默认 6 组令牌色值全部达标（与 tokens.css 同源）', () => {
    const { audit } = probeAccessibility(DEFAULT_CONTRAST_PAIRS, { root: null, doc: null })
    // 无 DOM 时键盘/标签 fail-closed，但对比度仍按真实令牌计算
    expect(audit.contrastChecks.length).toBe(6)
    expect(audit.contrastChecks.every((c) => c.ok)).toBe(true)
  })
})

// —— infra 采集器（注入式 fake DOM，不依赖 jsdom）——

interface FakeOpts {
  tagName?: string
  id?: string
  attrs?: Record<string, string>
  labelsText?: string
  visible?: boolean
  disabled?: boolean
  textContent?: string
  baseStyle?: Record<string, string>
  focusStyle?: Record<string, string>
}

function fakeDom(elements: ReturnType<typeof makeEl>[]) {
  const byId = new Map(elements.map((e) => [e.id, e]))
  const doc: any = {
    activeElement: null,
    getElementById: (id: string) => byId.get(id) ?? null
  }
  const root: any = { querySelectorAll: () => elements }
  const styleOf = (el: any) => ({
    visibility: 'visible', display: 'block', outlineStyle: 'none',
    outlineWidth: '0px', boxShadow: 'none', borderColor: 'rgb(220, 223, 230)',
    ...(el._baseStyle || {}),
    ...(el._focused ? (el._focusStyle || {}) : {})
  })
  return { doc, root, styleOf }
}

function makeEl(opts: FakeOpts = {}) {
  const attrs = new Map(Object.entries(opts.attrs ?? {}))
  const el: any = {
    tagName: opts.tagName ?? 'BUTTON',
    id: opts.id ?? '',
    disabled: opts.disabled ?? false,
    textContent: opts.textContent ?? '',
    _focused: false,
    _baseStyle: opts.baseStyle ?? {},
    _focusStyle: opts.focusStyle ?? {},
    type: '',
    _attrs: attrs,
    getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k) : null),
    hasAttribute: (k: string) => attrs.has(k),
    closest: () => null,
    getClientRects: () => (opts.visible === false ? [] : [{ width: 10 }]),
    get offsetParent() { return opts.visible === false ? null : {} },
    focus() { el._focused = true; fakeDocRef && (fakeDocRef.activeElement = el) },
    blur() { el._focused = false; if (fakeDocRef && fakeDocRef.activeElement === el) fakeDocRef.activeElement = null }
  }
  if (opts.labelsText) {
    el.labels = [{ textContent: opts.labelsText }]
  }
  return el
}

let fakeDocRef: any = null

describe('NFR-017 infra 真实 DOM 采集器', () => {
  it('无 DOM 环境返回空快照（不伪造样本）', () => {
    expect(collectDomSnapshots({ root: null, doc: null })).toEqual([])
    expect(collectDomSnapshots()).toEqual([])
  })

  it('真实快照字段取自元素属性与 computed style，且焦点态可还原 activeElement', () => {
    const btn = makeEl({
      id: 'btn-save', tagName: 'BUTTON',
      focusStyle: { outlineStyle: 'solid', outlineWidth: '2px' }
    })
    const input = makeEl({
      id: 'input-name', tagName: 'INPUT', attrs: { 'aria-label': '项目名称' },
      focusStyle: { borderColor: 'rgb(64, 158, 255)' }
    })
    const div = makeEl({
      id: 'div-role', tagName: 'DIV', attrs: { role: 'button', tabindex: '0' }
    })
    const bad = makeEl({ id: 'input-bad', tagName: 'INPUT' })
    const { doc, root, styleOf } = fakeDom([btn, input, div, bad])
    fakeDocRef = doc
    const before = doc.activeElement
    const snapshots = collectDomSnapshots({ root, doc, styleOf, probeFocus: true })
    fakeDocRef = null

    expect(snapshots.length).toBe(4)
    expect(snapshots[0]).toMatchObject({ id: 'btn-save', tag: 'BUTTON', nativeActivatable: true })
    expect(snapshots[0].focusOutlineStyle).toBe('solid')
    expect(snapshots[0].controlKind).toBe('interactive')
    expect(snapshots[1].labelText).toBe('项目名称')
    expect(snapshots[1].controlKind).toBe('form')
    expect(snapshots[1].focusBorderColor).toBe('rgb(64, 158, 255)')
    expect(snapshots[1].baseBorderColor).toBe('rgb(220, 223, 230)')
    expect(snapshots[2].nativeActivatable).toBe(false)
    expect(snapshots[2].tabIndex).toBe(0)
    expect(snapshots[3].labelText).toBe('')
    expect(doc.activeElement).toBe(before)
  })

  it('probeAccessibility 与 domain 判定同源：能检出 fake DOM 里的真实违规', () => {
    const btn = makeEl({ id: 'btn-ok', tagName: 'BUTTON', focusStyle: { outlineStyle: 'solid', outlineWidth: '2px' } })
    const badLabel = makeEl({ id: 'input-bad', tagName: 'INPUT' })
    const { doc, root, styleOf } = fakeDom([btn, badLabel])
    fakeDocRef = doc
    const { audit, evidence } = probeAccessibility(PAIRS, { root, doc, styleOf })
    fakeDocRef = null
    expect(evidence.sampledElements).toBe(2)
    expect(evidence.controlCount).toBe(1)
    expect(evidence.labelViolations).toContain('input-bad')
    expect(audit.labelCheck.ok).toBe(false)
    expect(audit.contrastChecks.length).toBe(1)
  })

  it('无原生标签 / 无可交互 role 的 tabindex 锚点归为 container（不误判为控件）', () => {
    const btn = makeEl({ id: 'ok', tagName: 'BUTTON', focusStyle: { outlineStyle: 'solid', outlineWidth: '2px' } })
    const anchor = makeEl({ id: 'anchor', tagName: 'DIV', attrs: { tabindex: '-1' } })
    const { doc, root, styleOf } = fakeDom([btn, anchor])
    fakeDocRef = doc
    const snapshots = collectDomSnapshots({ root, doc, styleOf })
    fakeDocRef = null
    expect(snapshots.find((s) => s.id === 'anchor')?.controlKind).toBe('container')
    expect(snapshots.find((s) => s.id === 'ok')?.controlKind).toBe('interactive')
    const { evidence } = auditFromSnapshots(PAIRS, snapshots)
    expect(evidence.interactiveCount).toBe(1)
    expect(evidence.excludedContainers).toBe(1)
  })

  it('aria-hidden / hidden 元素如实标注，不计入判定', () => {
    const visible = makeEl({ id: 'ok', tagName: 'BUTTON', focusStyle: { outlineStyle: 'solid', outlineWidth: '2px' } })
    const hidden = makeEl({ id: 'hidden', tagName: 'BUTTON', attrs: { 'aria-hidden': 'true' } })
    const { doc, root, styleOf } = fakeDom([visible, hidden])
    fakeDocRef = doc
    const snapshots = collectDomSnapshots({ root, doc, styleOf })
    fakeDocRef = null
    expect(snapshots.find((s) => s.id === 'hidden')?.ariaHidden).toBe(true)
    const { evidence } = auditFromSnapshots(PAIRS, snapshots)
    expect(evidence.interactiveCount).toBe(1)
  })
})
