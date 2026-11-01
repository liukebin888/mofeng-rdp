/**
 * 挣值与成本引擎（SRS 11.8 / CST-003/004、PMC-006/007）
 * 四值：PV(BCWS) / EV(BCWP) / AC(ACWP) / BAC
 */
export interface EvmInput {
  pv: number
  ev: number
  ac: number
  bac: number
  etc?: number
}

export interface EvmResult {
  pv: number
  ev: number
  ac: number
  bac: number
  sv: number
  cv: number
  spi: number
  cpi: number
  etc: number
  eac: number
  vac: number
  tcpi: number
  spiZone: 'green' | 'yellow' | 'red'
  cpiZone: 'green' | 'yellow' | 'red'
  eacWarn: 'none' | 'yellow' | 'red'
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeEvm(i: EvmInput): EvmResult {
  const spi = i.pv ? i.ev / i.pv : 0
  const cpi = i.ac ? i.ev / i.ac : 0
  const etc = i.etc ?? (cpi ? (i.bac - i.ev) / cpi : i.bac - i.ev)
  const eac = i.ac + etc
  const vac = i.bac - eac
  const tcpi = i.bac - i.ac !== 0 ? (i.bac - i.ev) / (i.bac - i.ac) : 0
  const spiZone = spi < 0.8 ? 'red' : spi < 0.9 ? 'yellow' : 'green'
  const cpiZone = cpi < 0.9 ? 'red' : cpi < 0.95 ? 'yellow' : 'green'
  const over = i.bac ? (eac - i.bac) / i.bac : 0
  const eacWarn = over > 0.1 ? 'red' : over > 0.05 ? 'yellow' : 'none'
  return {
    pv: r2(i.pv),
    ev: r2(i.ev),
    ac: r2(i.ac),
    bac: r2(i.bac),
    sv: r2(i.ev - i.pv),
    cv: r2(i.ev - i.ac),
    spi: r2(spi),
    cpi: r2(cpi),
    etc: r2(etc),
    eac: r2(eac),
    vac: r2(vac),
    tcpi: r2(tcpi),
    spiZone,
    cpiZone,
    eacWarn
  }
}

/** 成本科目预算校验（C-10：无预算不得开工） */
export function budgetCheck(budgetLines: { subject: string; budget: number; wbsCode?: string }[]) {
  const missing = budgetLines.filter((b) => !b.wbsCode)
  const total = budgetLines.reduce((s, b) => s + b.budget, 0)
  return { ok: missing.length === 0 && total > 0, missingSubject: missing.map((m) => m.subject), total }
}

/** 超支审批判定（C-12：超预算 >10% 须专项审批） */
export function overspend(budget: number, spent: number) {
  const ratio = budget ? spent / budget : 0
  return { ratio: Math.round(ratio * 10000) / 100, needApproval: ratio > 1.1, level: ratio > 1.1 ? 'L3' : 'ok' }
}
