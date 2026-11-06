/** CSV 导出：带口径元数据行，避免「表头不明」的合规问题（FUN-019） */
export function exportCsv(fileName: string, rows: Record<string, unknown>[], cols: { key: string; label: string }[]) {
  const meta = [`# 导出时间,${new Date().toISOString()}`, `# 数据口径,分析层快照（只读，不回写事务数据）`, `# 记录数,${rows.length}`]
  const header = cols.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(','))
  const csv = '\uFEFF' + [...meta, header, ...body].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
