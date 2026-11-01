/**
 * 项目分级引擎（L1~L4）
 * 依据：SRS 附录 C「分级判定真值表」14 行（含第 13 行 CAL≥3 无自研软件 → L2、第 14 行兜底），CLS-001~007
 * 铁律：判定只允许查表，命中即返回；不得在代码中另写等价的布尔表达式（CLS-002 验收）
 */
import { hashOf } from './hash'
import type { ActorContext, GradingInput, GradingResult, Level } from './types'

export const GRADING_TABLE_VERSION = 'APX-C-2026.11'

export interface GradingRow {
  no: number
  text: string
  level: Level
  control: string
  match: (i: NormalizedInput) => boolean
}

interface NormalizedInput {
  asil: 'D' | 'C' | 'B' | 'A' | 'QM'
  cal: 0 | 1 | 2 | 3 | 4
  selfDev: 'FULL' | 'PARAM_ONLY' | 'NONE_HW' | 'NONE_DOC'
  newArch: boolean
  customerSafety: boolean
}

const hasSoftware = (i: NormalizedInput) => i.selfDev === 'FULL' || i.selfDev === 'PARAM_ONLY'

export const GRADING_ROWS: GradingRow[] = [
  {
    no: 1,
    text: 'ASIL D/C/B，其余任意 → L1（完整安全链路 + 独立安全评估 + 禁止裁剪）',
    level: 'L1',
    control: '完整安全链路 + 独立安全评估 + 禁止裁剪',
    match: (i) => i.asil === 'D' || i.asil === 'C' || i.asil === 'B'
  },
  {
    no: 2,
    text: 'ASIL A，CAL 3/4，自研软件 → L1（信息安全驱动）',
    level: 'L1',
    control: 'CAL≥3 即触发最高管控，软件特征不影响升级',
    match: (i) => i.asil === 'A' && (i.cal === 3 || i.cal === 4) && hasSoftware(i)
  },
  {
    no: 3,
    text: 'ASIL QM，CAL 3/4，自研软件 → L1（信息安全驱动，ASIL 为空不影响）',
    level: 'L1',
    control: 'CAL≥3 即触发最高管控',
    match: (i) => i.asil === 'QM' && (i.cal === 3 || i.cal === 4) && hasSoftware(i)
  },
  {
    no: 4,
    text: 'ASIL A，CAL 1/2，自研软件 → L2（核心 SWE 强制 + 裁剪需风险补偿）',
    level: 'L2',
    control: '核心 SWE 强制，安全要求追溯评审',
    match: (i) => i.asil === 'A' && (i.cal === 1 || i.cal === 2) && hasSoftware(i)
  },
  {
    no: 5,
    text: 'ASIL QM，CAL 1/2，自研软件 → L2（信息安全中等级别）',
    level: 'L2',
    control: '核心 SWE 强制',
    match: (i) => i.asil === 'QM' && (i.cal === 1 || i.cal === 2) && hasSoftware(i)
  },
  {
    no: 6,
    text: 'ASIL A，CAL 0，自研软件 → L2（有 ASIL A 即不低于 L2）',
    level: 'L2',
    control: '有 ASIL A 即不低于 L2',
    match: (i) => i.asil === 'A' && i.cal === 0 && hasSoftware(i)
  },
  {
    no: 7,
    text: 'ASIL QM，CAL 0，自研软件，新架构/算法 → L2（新架构引入不确定性，抬升一级）',
    level: 'L2',
    control: '核心 SWE 强制',
    match: (i) => i.asil === 'QM' && i.cal === 0 && hasSoftware(i) && i.newArch
  },
  {
    no: 8,
    text: 'ASIL QM，CAL 0，仅参数配置，非新架构，无客户强制 → L3（版本仅台账，ASPICE 大部分裁剪）',
    level: 'L3',
    control: '不允许新增安全要求',
    match: (i) => i.asil === 'QM' && i.cal === 0 && i.selfDev === 'PARAM_ONLY' && !i.newArch && !i.customerSafety
  },
  {
    no: 9,
    text: 'ASIL QM，CAL 0，仅参数配置，非新架构，客户强制要求 → L2（客户要求优先于内部判定）',
    level: 'L2',
    control: '按 L2 管控',
    match: (i) => i.asil === 'QM' && i.cal === 0 && i.selfDev === 'PARAM_ONLY' && !i.newArch && i.customerSafety
  },
  {
    no: 10,
    text: 'ASIL QM，CAL 0，无自研软件（纯硬件），非新架构 → L4（样件交付台账记录）',
    level: 'L4',
    control: '无软件 ASPICE 管控',
    match: (i) => i.asil === 'QM' && i.cal === 0 && i.selfDev === 'NONE_HW' && !i.newArch && !i.customerSafety
  },
  {
    no: 11,
    text: 'ASIL QM，CAL 0，无自研软件（纯文档/参数变更），非新架构 → L4',
    level: 'L4',
    control: '样件交付台账记录',
    match: (i) => i.asil === 'QM' && i.cal === 0 && i.selfDev === 'NONE_DOC' && !i.newArch && !i.customerSafety
  },
  {
    no: 12,
    text: '客户强制要求（安全相关），其余任意 → L1（客户安全要求自动升级，需评审确认）',
    level: 'L1',
    control: '按 L1 管控',
    match: (i) => i.customerSafety
  },
  {
    no: 13,
    text: 'ASIL QM，CAL 3/4，无自研软件（纯硬件/纯文档），任意架构 → L2（否定性裁定：CAL≥3 一律不低于 L2）',
    level: 'L2',
    control: '核心 SWE 强制；CAL=4 且涉及对外通信接口时升 L1',
    match: (i) => i.asil === 'QM' && (i.cal === 3 || i.cal === 4) && (i.selfDev === 'NONE_HW' || i.selfDev === 'NONE_DOC')
  },
  {
    no: 14,
    text: '其余组合 → L3（兜底：须经分级评审确认，不得默认 L4 或报错阻断）',
    level: 'L3',
    control: '按 ASPICE 裁剪，保留追溯',
    match: () => true
  }
]

function normalize(input: GradingInput): { value: NormalizedInput | null; missing: string[] } {
  const missing: string[] = []
  if (!input.asil) missing.push('ASIL 等级')
  if (input.cal === -1 || input.cal === undefined || input.cal === null) missing.push('CAL 信息安全等级')
  if (!input.selfDev) missing.push('自研软件属性')
  if (input.newArch === null || input.newArch === undefined) missing.push('新架构/算法')
  if (input.customerSafety === null || input.customerSafety === undefined) missing.push('客户强制要求（安全相关）')
  if (missing.length) return { value: null, missing }
  return {
    value: {
      asil: input.asil as NormalizedInput['asil'],
      cal: input.cal as NormalizedInput['cal'],
      selfDev: input.selfDev as NormalizedInput['selfDev'],
      newArch: !!input.newArch,
      customerSafety: !!input.customerSafety
    },
    missing
  }
}

/** 六条裁定规则（校验层，不参与定级；用于发现口径冲突与越级） */
function validate(input: NormalizedInput, level: Level, parentLevel?: Level) {
  const checks: GradingResult['checks'] = []
  checks.push({
    code: 'CLS-002',
    name: '客户要求优先',
    ok: !input.customerSafety || level === 'L1' || level === 'L2',
    note: input.customerSafety ? `客户安全强制要求，判定 ${level}（不得低于 L2；安全相关取 L1）` : '无客户强制要求'
  })
  checks.push({
    code: 'CLS-003',
    name: '无自研软件不得高于 L3',
    ok: !(input.selfDev.startsWith('NONE') && (level === 'L1' || level === 'L2')),
    note: input.selfDev.startsWith('NONE')
      ? level === 'L4'
        ? '纯硬件/纯文档，落 L4，符合'
        : `无自研软件但判定 ${level}，仅在客户安全强制时可接受，须评审确认`
      : '含自研软件，规则不适用'
  })
  checks.push({
    code: 'CLS-004',
    name: 'CAL≥3 不低于 L2',
    ok: !(input.cal >= 3 && (level === 'L3' || level === 'L4')),
    note: input.cal >= 3 ? `CAL=${input.cal}，判定 ${level}` : 'CAL<3'
  })
  checks.push({
    code: 'CLS-005',
    name: '分解不降级',
    ok: !parentLevel || rank(level) <= rank(parentLevel),
    note: parentLevel ? `父项目 ${parentLevel} → 子项目 ${level}（数字越小管控越严）` : '顶层项目，不适用'
  })
  checks.push({
    code: 'CLS-006',
    name: '存量项目不自动降级',
    ok: true,
    note: '沿用历史等级，除非客户书面变更或安全等级变化'
  })
  checks.push({
    code: 'CLS-007',
    name: '缺项按最严',
    ok: true,
    note: '五项输入齐备方可判定；缺任一项判「未定级」并阻断 Gate1'
  })
  return checks
}

function rank(level: Level): number {
  return Number(level.slice(1))
}

export function grade(input: GradingInput, actor: ActorContext, parentLevel?: Level): GradingResult {
  const { value, missing } = normalize(input)
  const traceBase = {
    hitRowNo: 0,
    tableVersion: GRADING_TABLE_VERSION,
    decidedBy: `${actor.userName}（${actor.roleName}）`,
    decidedAt: actor.at || new Date().toISOString()
  }
  if (!value) {
    return {
      level: null,
      hitRowNo: -1,
      basis: '输入项不完整，按最严禁要求判「未定级」，阻断 Gate1（CLS-001/CLS-007）',
      controlPoints: '补齐五项输入后重新判定',
      trace: { ...traceBase, hitRowText: '未命中（缺项）', snapshotHash: hashOf(input) },
      checks: [],
      missing
    }
  }
  const hit = GRADING_ROWS.find((r) => r.match(value))!
  const checks = validate(value, hit.level, parentLevel)
  return {
    level: hit.level,
    hitRowNo: hit.no,
    basis: hit.text,
    controlPoints: hit.control,
    trace: { ...traceBase, hitRowNo: hit.no, hitRowText: hit.text, snapshotHash: hashOf({ input, row: hit.no }) },
    checks,
    missing: []
  }
}

export const LEVEL_DESC: Record<Level, string> = {
  L1: '最高管控：完整安全链路、独立安全评估、禁止裁剪',
  L2: '较高管控：核心 SWE 强制、裁剪需风险补偿',
  L3: '标准管控：按 ASPICE 裁剪、保留追溯',
  L4: '基础管控：样件交付台账记录'
}
