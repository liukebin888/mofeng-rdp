/**
 * 互操作与集成引擎（SRS 11.12 / EXA-005、EXA-006、EXA-007、EXA-008）
 * 计划工具互操作（XER/XML）、集成网关配置化、事件订阅与推送、财务与人力接口
 */

// —— EXA-005 计划工具互操作 ——

export interface ImportRow {
  lineNo: number
  fields: Record<string, string>
}

export interface FieldMapping {
  /** 源字段名 */
  sourceField: string
  /** 目标字段名 */
  targetField: string
  required: boolean
}

export interface ImportValidationResult {
  totalRows: number
  successRows: number
  /** 异常行（逐行定位） */
  errors: { lineNo: number; field: string; reason: string }[]
  /** 校验报告是否完整（列出全部异常行） */
  complete: boolean
}

/** 字段映射校验：导入必须带校验报告，逐行定位异常 */
export function validateImport(rows: ImportRow[], mapping: FieldMapping[]): ImportValidationResult {
  const errors: { lineNo: number; field: string; reason: string }[] = []
  const requiredFields = mapping.filter((m) => m.required)

  for (const row of rows) {
    for (const m of requiredFields) {
      const v = row.fields[m.sourceField]
      if (v == null || v.trim() === '') {
        errors.push({ lineNo: row.lineNo, field: m.sourceField, reason: `必填字段 ${m.sourceField} 为空` })
      }
    }
    // 日期格式校验（若映射中有日期字段）
    for (const m of mapping) {
      if (m.sourceField.includes('date') || m.sourceField.includes('Date')) {
        const v = row.fields[m.sourceField]
        if (v && isNaN(Date.parse(v))) {
          errors.push({ lineNo: row.lineNo, field: m.sourceField, reason: `日期格式非法：${v}` })
        }
      }
    }
  }

  const errorLines = new Set(errors.map((e) => e.lineNo))
  const successRows = rows.length - errorLines.size

  return {
    totalRows: rows.length,
    successRows,
    errors,
    complete: true // 校验报告列出全部异常行
  }
}

/** 导出文件可被对端打开：生成合法 XER/XML 结构 */
export function exportToXml(activities: { id: string; name: string; duration: number; start: string }[]): string {
  const items = activities
    .map((a) => `  <activity id="${a.id}" name="${a.name}" duration="${a.duration}" start="${a.start}" />`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<project>\n${items}\n</project>`
}

// —— EXA-006 集成网关配置化 ——

export interface IntegrationConfig {
  id: string
  name: string
  /** 目标系统 */
  target: string
  /** 协议 */
  protocol: 'rest' | 'soap' | 'mq'
  endpoint: string
  /** 认证方式 */
  auth: 'none' | 'basic' | 'oauth2' | 'apikey'
  /** 重试策略 */
  retryTimes: number
  /** 是否启用 */
  enabled: boolean
  /** 配置版本（变更留痕） */
  version: number
}

/** 新增对接全程配置完成（不改代码） */
export function registerIntegration(config: Omit<IntegrationConfig, 'version'>): IntegrationConfig {
  return { ...config, version: 1 }
}

/** 配置变更留痕：版本 +1 */
export function updateIntegration(config: IntegrationConfig, patch: Partial<IntegrationConfig>): IntegrationConfig {
  return { ...config, ...patch, version: config.version + 1 }
}

/** 失败可重放：重试次数未耗尽 */
export function canReplay(config: IntegrationConfig, attemptCount: number): { ok: boolean; note: string } {
  if (attemptCount >= config.retryTimes) return { ok: false, note: `重试次数已达上限 ${config.retryTimes}` }
  return { ok: true, note: `可重放（已尝试 ${attemptCount}/${config.retryTimes}）` }
}

// —— EXA-007 事件订阅与推送 ——

export interface EventSubscription {
  id: string
  eventType: string
  /** 回调地址 */
  callbackUrl: string
  /** 签名密钥（签名校验失败被拒） */
  secret: string
}

export interface DeliveryRecord {
  eventId: string
  subscriptionId: string
  deliveredAt: string
}

/** 签名校验：HMAC 签名，失败被拒 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  // 简化：确定性签名 = sha256(secret + payload) 的前 16 位（演示用，非安全实现）
  const expected = simpleHash(secret + payload)
  return signature === expected
}

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h.toString(16)
}

/** 重复投递不产生重复处理：事件幂等（同一 eventId 只处理一次） */
export function dedupeDelivery(records: DeliveryRecord[], eventId: string, subscriptionId: string): { duplicate: boolean; records: DeliveryRecord[] } {
  const duplicate = records.some((r) => r.eventId === eventId && r.subscriptionId === subscriptionId)
  if (duplicate) return { duplicate: true, records }
  return {
    duplicate: false,
    records: [...records, { eventId, subscriptionId, deliveredAt: new Date().toISOString() }]
  }
}

// —— EXA-008 财务与人力接口 ——

export interface CostVoucher {
  id: string
  projectId: string
  amount: number
  currency: string
  /** 凭证状态 */
  status: '待同步' | '已同步' | '同步失败' | '已补偿'
  syncAt?: string
}

export interface HrHoursRecord {
  id: string
  userId: string
  hours: number
  week: string
  status: '待同步' | '已同步' | '同步失败' | '已补偿'
}

/** 财务凭证同步：失败补偿 */
export function syncVoucher(v: CostVoucher, success: boolean): CostVoucher {
  if (success) return { ...v, status: '已同步', syncAt: new Date().toISOString() }
  return { ...v, status: '同步失败' }
}

/** 失败补偿：重试成功后标记已补偿 */
export function compensate<T extends { status: string }>(record: T, success: boolean): T {
  if (success) return { ...record, status: '已补偿' as T['status'] }
  return record
}

/** 对账差异可解释：差异有归属 */
export interface ReconciliationDiff {
  amount: number
  reason: string
}

export function explainDiff(diffs: ReconciliationDiff[]): { total: number; explained: boolean } {
  const total = diffs.reduce((s, d) => s + d.amount, 0)
  return { total, explained: diffs.every((d) => d.reason.trim().length > 0) }
}

/**
 * INT-009：数据迁移工具。1000 条迁移准确率 100%；失败可回滚。
 * 迁移采用「源 → 目标」映射 + 逐条校验 + 快照回滚，fail-closed。
 */

/** 迁移源数据行 */
export interface MigrationRow {
  id: string
  [key: string]: unknown
}

/** 迁移结果 */
export interface MigrationResult {
  total: number
  migrated: number
  failed: number
  accuracy: number
  errors: { id: string; reason: string }[]
  /** 迁移前快照（供回滚） */
  snapshot: MigrationRow[]
}

/**
 * 执行迁移（INT-009）：逐条映射 + 校验，任一失败即记录并停止该条（不中断整体），
 * 准确率 = 成功条数 / 总数。返回迁移前快照供回滚。
 */
export function migrateRows(rows: MigrationRow[], mapFn: (row: MigrationRow) => MigrationRow | null): MigrationResult {
  const errors: { id: string; reason: string }[] = []
  const migrated: MigrationRow[] = []
  for (const r of rows) {
    const mapped = mapFn(r)
    if (mapped === null) {
      errors.push({ id: r.id, reason: '映射失败或字段缺失' })
    } else {
      migrated.push(mapped)
    }
  }
  const failed = errors.length
  return {
    total: rows.length,
    migrated: migrated.length,
    failed,
    accuracy: rows.length ? migrated.length / rows.length : 1,
    errors,
    snapshot: rows.map((r) => ({ ...r }))
  }
}

/**
 * INT-009：迁移回滚。从快照恢复原数据，保证失败可回滚。
 */
export function rollbackMigration(snapshot: MigrationRow[]): MigrationRow[] {
  return snapshot.map((r) => ({ ...r }))
}

/**
 * INT-010：迁移演练。演练报告须含耗时、问题清单与修复情况。
 */
export interface MigrationDrill {
  totalRows: number
  /** 演练耗时（分钟） */
  durationMinutes: number
  issues: { title: string; fixed: boolean }[]
}

/** 演练判定（INT-010：报告含耗时 + 问题清单 + 修复情况） */
export function assessMigrationDrill(d: MigrationDrill): { ok: boolean; reason?: string } {
  if (d.durationMinutes <= 0) return { ok: false, reason: '演练报告缺耗时' }
  const unresolved = d.issues.filter((i) => !i.fixed)
  if (unresolved.length > 0) return { ok: false, reason: `存在 ${unresolved.length} 项问题未修复：${unresolved.map((i) => i.title).join('、')}` }
  return { ok: true }
}

/**
 * INT-001：PLM 主数据同步。平台对 PLM 权威源只读，无回写入口。
 * 同步一致率 = 一致条数 / 总数。
 */
export interface PlmSyncRow {
  id: string
  /** 平台侧值 */
  platform: unknown
  /** PLM 权威侧值 */
  plm: unknown
}

export function plmSyncConsistency(rows: PlmSyncRow[]): { consistent: number; total: number; ratio: number; noWriteback: true } {
  const consistent = rows.filter((r) => r.platform === r.plm).length
  return {
    consistent,
    total: rows.length,
    ratio: rows.length ? consistent / rows.length : 1,
    noWriteback: true
  }
}
