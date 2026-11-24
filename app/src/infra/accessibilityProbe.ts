/**
 * NFR-017 真实 DOM 取证采集器（infra 层）
 *
 * 职责：把「真实渲染的 DOM」采集成结构化快照 DomElementSnapshot，
 * 判定逻辑一律交给 domain/accessibility.ts（单一权威），本文件不判通过/不通过。
 *
 * 取证口径（全部来自浏览器实测，不允许人工填「合格」）：
 *   - 可见性：getClientRects / offsetParent + computed visibility/display
 *   - 键盘可达：真实 tabindex 属性 + 原生可激活标签 + 显式键盘激活标记
 *   - 焦点指示：focus 态 computed style（outline / box-shadow / 边框变色）
 *   - 可读标签：aria-label / aria-labelledby / HTML labels / 包裹 label（placeholder 不算）
 *
 * 采集过程只读 DOM；focus/blur 仅用于读取焦点样式并立即还原 activeElement，
 * 不触发任何业务写入，不修改元素属性。
 */
import {
  auditFromSnapshots,
  type ContrastPair,
  type DomElementSnapshot,
  type AccessibilityAudit,
  type A11yEvidenceSummary
} from '@/domain/accessibility'

/** 与 tokens.css 真实令牌色值一致（深浅两套主题 3 组文字 × 各自内容背景） */
export const DEFAULT_CONTRAST_PAIRS: ContrastPair[] = [
  { fg: '#e8eefb', bg: '#070c16' }, // 深色 --text-1 / --bg-0
  { fg: '#a9bad4', bg: '#0d1523' }, // 深色 --text-2 / --bg-1
  { fg: '#6f83a3', bg: '#0d1523' }, // 深色 --text-3 / --bg-1
  { fg: '#1b2735', bg: '#f4f6fa' }, // 浅色 --text-1 / --bg-0
  { fg: '#45546a', bg: '#ffffff' }, // 浅色 --text-2 / --bg-1
  { fg: '#5b6b80', bg: '#ffffff' } // 浅色 --text-3 / --bg-1（整改后 ≥4.5:1）
]

const INTERACTIVE_SELECTOR = [
  'button', 'a[href]', 'input', 'select', 'textarea', 'summary',
  '[role="button"]', '[role="link"]', '[role="tab"]', '[role="checkbox"]',
  '[tabindex]'
].join(', ')

const NATIVE_ACTIVATABLE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'])
const FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])
const NON_LABEL_INPUT_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image'])
/** 可操作 ARIA 角色：命中即视为可操作控件；其余仅带 tabindex 的元素归为布局容器 */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'tab', 'checkbox', 'menuitem', 'switch', 'radio',
  'combobox', 'option', 'slider', 'spinbutton'
])

type StyleLike = Pick<
  CSSStyleDeclaration,
  'visibility' | 'display' | 'outlineStyle' | 'outlineWidth' | 'boxShadow' | 'borderColor'
>

const EMPTY_STYLE: StyleLike = {
  visibility: 'visible', display: 'block', outlineStyle: 'none',
  outlineWidth: '0px', boxShadow: 'none', borderColor: ''
}

export interface CollectOptions {
  /** 采集范围，默认 document（限当前已渲染的 DOM，不做离线推测） */
  root?: ParentNode | null
  /** 文档，用于 aria-labelledby 与 activeElement 还原；默认全局 document */
  doc?: Document | null
  /** computed style 读取器，默认 window.getComputedStyle（测试可注入） */
  styleOf?: (el: Element) => StyleLike
  /** 是否做真实 focus 以读取焦点样式，默认 true；关闭后仅取失焦态样式 */
  probeFocus?: boolean
}

function defaultStyleOf(el: Element): StyleLike {
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    return window.getComputedStyle(el) as StyleLike
  }
  return EMPTY_STYLE
}

function isVisibleByLayout(el: Element): boolean {
  const h = el as HTMLElement
  if (typeof h.getClientRects === 'function' && h.getClientRects().length > 0) return true
  return typeof h.offsetParent !== 'undefined' && h.offsetParent !== null
}

function labelTextFor(el: Element, doc: Document | null): string {
  const aria = (el.getAttribute('aria-label') || '').trim()
  if (aria) return aria
  const labelledBy = (el.getAttribute('aria-labelledby') || '').trim()
  if (labelledBy && doc && typeof doc.getElementById === 'function') {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => (doc.getElementById(id)?.textContent || '').trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }
  const labels = (el as HTMLInputElement).labels
  if (labels && labels.length) {
    const text = Array.from(labels)
      .map((l) => (l.textContent || '').trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }
  const wrap = typeof el.closest === 'function' ? el.closest('label') : null
  if (wrap) {
    const text = (wrap.textContent || '').trim()
    if (text) return text
  }
  // placeholder 不属于可读标签（WCAG），如实留空
  return ''
}

function readFocusStyle(
  el: Element,
  base: StyleLike,
  styleOf: (el: Element) => StyleLike,
  doc: Document | null,
  enabled: boolean
): Pick<DomElementSnapshot, 'focusOutlineStyle' | 'focusOutlineWidth' | 'focusBoxShadow' | 'focusBorderColor' | 'baseBorderColor'> {
  const baseBorderColor = base.borderColor || ''
  if (!enabled || !doc) {
    return {
      focusOutlineStyle: base.outlineStyle || 'none',
      focusOutlineWidth: base.outlineWidth || '0px',
      focusBoxShadow: base.boxShadow || 'none',
      focusBorderColor: baseBorderColor,
      baseBorderColor
    }
  }
  const h = el as HTMLElement
  const prev = doc.activeElement as HTMLElement | null
  let focused = false
  try {
    if (typeof h.focus === 'function') {
      h.focus({ preventScroll: true })
      focused = true
    }
  } catch {
    focused = false
  }
  const s = styleOf(el)
  const result = {
    focusOutlineStyle: s.outlineStyle || 'none',
    focusOutlineWidth: s.outlineWidth || '0px',
    focusBoxShadow: s.boxShadow || 'none',
    focusBorderColor: s.borderColor || '',
    baseBorderColor
  }
  if (focused) {
    try {
      if (prev && prev !== h && typeof prev.focus === 'function') prev.focus({ preventScroll: true })
      else if (typeof h.blur === 'function') h.blur()
    } catch {
      /* 还原失败不影响取证结果，如实返回样式 */
    }
  }
  return result
}

/**
 * 采集真实 DOM 快照。无 DOM 环境（SSR / vitest node）返回空数组，
 * 由 domain 的 fail-closed 判「未取证」，绝不生成伪造样本。
 */
export function collectDomSnapshots(options: CollectOptions = {}): DomElementSnapshot[] {
  const gDoc = typeof document !== 'undefined' ? document : null
  const doc = options.doc === undefined ? gDoc : options.doc
  const root = options.root === undefined ? doc : options.root
  if (!root || typeof root.querySelectorAll !== 'function') return []
  const styleOf = options.styleOf ?? defaultStyleOf
  const probeFocus = options.probeFocus !== false
  const nodes = Array.from(root.querySelectorAll(INTERACTIVE_SELECTOR)) as Element[]
  const snapshots: DomElementSnapshot[] = []
  nodes.forEach((el, i) => {
    const tag = (el.tagName || '').toUpperCase()
    const base = styleOf(el)
    const visible =
      base.visibility !== 'hidden' && base.display !== 'none' && isVisibleByLayout(el)
    const disabled =
      (el as HTMLButtonElement).disabled === true ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.hasAttribute('disabled')
    const ariaHidden = el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')
    const ti = el.getAttribute('tabindex')
    const parsed = ti === null ? null : Number.parseInt(ti, 10)
    const tabIndex = parsed === null || !Number.isFinite(parsed) ? null : parsed
    const inputType = ((el as HTMLInputElement).type || '').toLowerCase()
    const isForm = FORM_TAGS.has(tag) && !(tag === 'INPUT' && NON_LABEL_INPUT_TYPES.has(inputType))
    const role = (el.getAttribute('role') || '').toLowerCase()
    const hasKeyHandler = el.hasAttribute('data-keyboard-activatable') || el.hasAttribute('onkeydown')
    const isNativeControl = NATIVE_ACTIVATABLE.has(tag) && !(tag === 'A' && !el.hasAttribute('href'))
    const controlKind: DomElementSnapshot['controlKind'] = isForm
      ? 'form'
      : (isNativeControl || INTERACTIVE_ROLES.has(role) || hasKeyHandler)
        ? 'interactive'
        : 'container'
    // 布局容器不做 focus 探测：既避免误判，也不对非控件产生焦点副作用
    const focus = readFocusStyle(el, base, styleOf, doc, probeFocus && visible && !disabled && controlKind !== 'container')
    snapshots.push({
      id: el.id || el.getAttribute('data-a11y-id') || `${tag.toLowerCase()}#${i}`,
      tag,
      visible,
      disabled,
      ariaHidden,
      tabIndex,
      nativeActivatable: isNativeControl,
      hasKeyHandler,
      ...focus,
      labelText: labelTextFor(el, doc),
      controlKind
    })
  })
  return snapshots
}

/** 一步取证：采集 + 同源判定（页面与脚本共用此入口，避免两套口径） */
export function probeAccessibility(
  pairs: ContrastPair[] = DEFAULT_CONTRAST_PAIRS,
  options: CollectOptions = {}
): { audit: AccessibilityAudit; evidence: A11yEvidenceSummary; snapshots: DomElementSnapshot[] } {
  const snapshots = collectDomSnapshots(options)
  const { audit, evidence } = auditFromSnapshots(pairs, snapshots)
  return { audit, evidence, snapshots }
}
