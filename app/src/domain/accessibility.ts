/**
 * 可访问性引擎（SRS / NFR-017）
 * 键盘可达、文字对比度 ≥4.5:1、表单控件具备可读标签
 * 供审核方在不安装辅助软件的环境下完成取证
 *
 * 取证铁律（NFR-017 真实 DOM 整改）：
 *   1. 判定逻辑与取证评估同源：真实 DOM 由 infra 采集成 DomElementSnapshot，
 *      本文件负责「快照 → 判定输入」映射与通过/不通过求值；
 *      调用方禁止自填「合格样本」，只能传入采集器产出的真实快照。
 *   2. 空样本 fail-closed：未取证一律不判通过，杜绝「恒报 100%」假取证。
 *   3. 对比度取 tokens.css 真实令牌色值；键盘/标签取真实渲染 DOM 的
 *      focus 态 computed style 与真实 label 关联。
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

// —— 真实 DOM 快照（判定唯一输入，由 infra 采集）——

/**
 * 真实渲染元素的最小结构化快照。
 * 所有字段均来自浏览器实测（getAttribute / getComputedStyle / focus 态），
 * 不允许人工填写「true」充当取证结果。
 */
export interface DomElementSnapshot {
  /** 稳定标识：元素 id / data-a11y-id / 采集器生成的 tag#序号 */
  id: string
  tag: string
  /** 真实布局可见（getClientRects + visibility/display），非 CSS 猜测 */
  visible: boolean
  disabled: boolean
  ariaHidden: boolean
  /** tabindex 属性解析值；无属性为 null */
  tabIndex: number | null
  /** 原生标签即可键盘激活（button/a/input/select/textarea/summary） */
  nativeActivatable: boolean
  /** 非原生元素是否声明了键盘激活能力（data-keyboard-activatable / onkeydown） */
  hasKeyHandler: boolean
  /** focus 态真实 computed style */
  focusOutlineStyle: string
  focusOutlineWidth: string
  focusBoxShadow: string
  focusBorderColor: string
  /** 失焦态边框色，用于识别「边框变色」型焦点指示 */
  baseBorderColor: string
  /** 真实 label 关联文本（aria-label / aria-labelledby / labels / 包裹 label） */
  labelText: string
  /**
   * form = 需要可读标签的表单控件；interactive = 可操作控件；
   * container = 仅带 tabindex 的布局容器（组件内部焦点管理锚点）。
   * 按 WCAG 2.1.1，「键盘可操作」只约束可操作 UI 组件，布局容器不纳入判定，
   * 但仍如实计数披露（excludedContainers），避免「收窄口径掩盖缺陷」。
   */
  controlKind: 'form' | 'interactive' | 'container'
}

/** 未取证统一文案（fail-closed，不得判通过） */
export const NO_EVIDENCE_NOTE = '未取证：真实 DOM 样本为空'

/** 焦点指示判定：outline / box-shadow / 边框变色，三者任一可见即算有指示 */
export function focusIndicatorFromSnapshot(s: DomElementSnapshot): boolean {
  const outlineStyle = (s.focusOutlineStyle || '').trim().toLowerCase()
  const outlineWidth = parseFloat(s.focusOutlineWidth || '0') || 0
  const boxShadow = (s.focusBoxShadow || '').trim().toLowerCase()
  const outlineVisible = outlineStyle !== '' && outlineStyle !== 'none' && outlineWidth > 0
  const shadowVisible = boxShadow !== '' && boxShadow !== 'none'
  const focusBorder = (s.focusBorderColor || '').trim().toLowerCase()
  const baseBorder = (s.baseBorderColor || '').trim().toLowerCase()
  const borderChanged = focusBorder !== '' && baseBorder !== '' && focusBorder !== baseBorder
  return outlineVisible || shadowVisible || borderChanged
}

/** 快照 → 键盘可达判定输入（单一权威映射，禁止调用方自造） */
export function snapshotToAccessibleElement(s: DomElementSnapshot): AccessibleElement {
  const tabbable =
    s.visible &&
    !s.disabled &&
    !s.ariaHidden &&
    (s.tabIndex === null ? s.nativeActivatable : s.tabIndex >= 0)
  return {
    id: s.id,
    tabbable,
    keyboardActivatable: s.nativeActivatable || s.hasKeyHandler,
    focusIndicator: focusIndicatorFromSnapshot(s)
  }
}

/** 快照 → 表单标签判定输入 */
export function snapshotToFormControl(s: DomElementSnapshot): FormControl {
  const text = (s.labelText || '').trim()
  return { id: s.id, hasLabel: text.length > 0, labelText: text }
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
  // 空样本 = 未取证，一律不通过（禁止「无样本即全过」假阳性）
  if (elements.length === 0) return { ok: false, violations: [], note: NO_EVIDENCE_NOTE }
  const violations = elements.filter((e) => !e.tabbable || !e.keyboardActivatable || !e.focusIndicator)
  return {
    ok: violations.length === 0,
    violations,
    note: violations.length === 0
      ? `真实 DOM 取证 ${elements.length} 个交互元素键盘可达`
      : `真实 DOM 取证 ${violations.length}/${elements.length} 个交互元素不达标`
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
  // 空样本 = 未取证，一律不通过
  if (controls.length === 0) return { ok: false, violations: [], note: NO_EVIDENCE_NOTE }
  const violations = controls.filter((c) => !c.hasLabel || !c.labelText?.trim())
  return {
    ok: violations.length === 0,
    violations,
    note: violations.length === 0
      ? `真实 DOM 取证 ${controls.length} 个表单控件具备可读标签`
      : `真实 DOM 取证 ${violations.length}/${controls.length} 个控件缺标签`
  }
}

// —— 综合取证报告 ——

export interface AccessibilityAudit {
  contrastChecks: { ok: boolean; ratio: number; note: string }[]
  keyboardCheck: { ok: boolean; note: string; violations?: AccessibleElement[] }
  labelCheck: { ok: boolean; note: string; violations?: FormControl[] }
  evidence?: A11yEvidenceSummary
}

/** 单次取证的中间指标（防假阳性：必须披露取样数、total>0 数、违规明细） */
export interface A11yEvidenceSummary {
  sampledElements: number
  interactiveCount: number
  controlCount: number
  keyboardViolations: string[]
  labelViolations: string[]
  focusIndicatorMissing: number
  /** 仅带 tabindex 的布局容器数（不纳入键盘判定，但如实披露） */
  excludedContainers: number
  evidenceCollected: boolean
}

export interface ContrastPair { fg: string; bg: string }

/**
 * 从真实 DOM 快照生成完整审计结果（判定 + 评估同源，唯一权威入口）。
 * 未取证（无可见交互元素）时 keyboardCheck 判不通过；
 * 已取证但本页确实没有表单控件时 labelCheck 判「不适用」并如实披露 controlCount=0。
 */
export function auditFromSnapshots(
  pairs: ContrastPair[],
  snapshots: DomElementSnapshot[]
): { audit: AccessibilityAudit; evidence: A11yEvidenceSummary } {
  // 仅带 tabindex 的布局容器不参与键盘可达判定（WCAG 2.1.1 只约束可操作控件），
  // 但保留在 sampledElements 与 excludedContainers 中如实披露
  const live = snapshots.filter(
    (s) => s.visible && !s.disabled && !s.ariaHidden && s.controlKind !== 'container'
  )
  const controls = live.filter((s) => s.controlKind === 'form')
  const contrastChecks = pairs.map((p) => checkContrast(p.fg, p.bg))
  const keyboardCheck = checkKeyboardAccessible(live.map(snapshotToAccessibleElement))
  const labelCheck = controls.length
    ? checkFormLabels(controls.map(snapshotToFormControl))
    : live.length === 0
      ? { ok: false, violations: [] as FormControl[], note: NO_EVIDENCE_NOTE }
      : { ok: true, violations: [] as FormControl[], note: '本页无表单控件（不适用）' }
  const evidence: A11yEvidenceSummary = {
    sampledElements: snapshots.length,
    interactiveCount: live.length,
    controlCount: controls.length,
    keyboardViolations: keyboardCheck.violations.map((v) => v.id),
    labelViolations: labelCheck.violations.map((v) => v.id),
    focusIndicatorMissing: keyboardCheck.violations.filter((v) => !v.focusIndicator).length,
    excludedContainers: snapshots.filter((s) => s.controlKind === 'container').length,
    evidenceCollected: live.length > 0
  }
  return {
    audit: { contrastChecks, keyboardCheck, labelCheck, evidence },
    evidence
  }
}

/** 关键页面抽查通过率（空审计集返回 0，不返回 100 假阳性） */
export function accessibilityPassRate(audits: AccessibilityAudit[]): { passed: number; total: number; rate: number } {
  const passed = audits.filter(
    (a) => a.contrastChecks.every((c) => c.ok) && a.keyboardCheck.ok && a.labelCheck.ok
  ).length
  return {
    passed,
    total: audits.length,
    rate: audits.length === 0 ? 0 : Math.round((passed / audits.length) * 100)
  }
}
