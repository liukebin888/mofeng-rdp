/**
 * 可访问性引擎（SRS / NFR-017）
 * 键盘可达、文字对比度 ≥4.5:1、表单控件具备可读标签
 * 供审核方在不安装辅助软件的环境下完成取证
 */

// —— 文字对比度 ——

/** WCAG 对比度：相对亮度计算 */
function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export interface Color {
  r: number
  g: number
  b: number
}

/** 十六进制转 RGB */
export function hexToRgb(hex: string): Color {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  }
}

/** 对比度 = (L1 + 0.05) / (L2 + 0.05) */
export function contrastRatio(fg: Color, bg: Color): number {
  const l1 = luminance(fg.r, fg.g, fg.b)
  const l2 = luminance(bg.r, bg.g, bg.b)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

/** WCAG 最小对比度阈值 */
export const WCAG_AA_MIN = 4.5

/** 对比度检查：文字对比度不低于 4.5:1 */
export function checkContrast(fg: string, bg: string): { ok: boolean; ratio: number; note: string } {
  const ratio = contrastRatio(hexToRgb(fg), hexToRgb(bg))
  return {
    ok: ratio >= WCAG_AA_MIN,
    ratio,
    note: ratio >= WCAG_AA_MIN ? `对比度 ${ratio}:1 达标` : `对比度 ${ratio}:1 低于 4.5:1`
  }
}

// —— 键盘可达 ——

export interface AccessibleElement {
  id: string
  /** 是否可通过 Tab 键聚焦 */
  tabbable: boolean
  /** 是否可通过 Enter/Space 激活 */
  keyboardActivatable: boolean
  /** 是否有可见焦点指示 */
  focusIndicator: boolean
}

/** 键盘可达校验：所有可交互元素须 tabbable + 可键盘激活 + 焦点可见 */
export function checkKeyboardAccessible(elements: AccessibleElement[]): { ok: boolean; violations: AccessibleElement[]; note: string } {
  const violations = elements.filter((e) => !e.tabbable || !e.keyboardActivatable || !e.focusIndicator)
  return {
    ok: violations.length === 0,
    violations,
    note: violations.length === 0 ? '所有交互元素键盘可达' : `${violations.length} 个元素键盘不可达`
  }
}

// —— 表单控件可读标签 ——

export interface FormControl {
  id: string
  /** 是否有关联 label（或 aria-label） */
  hasLabel: boolean
  labelText?: string
}

/** 表单控件可读标签校验 */
export function checkFormLabels(controls: FormControl[]): { ok: boolean; violations: FormControl[]; note: string } {
  const violations = controls.filter((c) => !c.hasLabel || !c.labelText?.trim())
  return {
    ok: violations.length === 0,
    violations,
    note: violations.length === 0 ? '所有表单控件具备可读标签' : `${violations.length} 个控件缺标签`
  }
}

// —— 综合取证报告 ——

export interface AccessibilityAudit {
  contrastChecks: { ok: boolean; ratio: number; note: string }[]
  keyboardCheck: { ok: boolean; note: string }
  labelCheck: { ok: boolean; note: string }
}

/** 关键页面抽查通过率 */
export function accessibilityPassRate(audits: AccessibilityAudit[]): { passed: number; total: number; rate: number } {
  const passed = audits.filter(
    (a) => a.contrastChecks.every((c) => c.ok) && a.keyboardCheck.ok && a.labelCheck.ok
  ).length
  return {
    passed,
    total: audits.length,
    rate: audits.length === 0 ? 100 : Math.round((passed / audits.length) * 100)
  }
}
