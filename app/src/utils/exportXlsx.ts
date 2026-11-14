/**
 * Excel（.xlsx）导出工具（基于 SheetJS 社区版，动态按需加载）
 *
 * 定位：把结构化二维数据导出为原生 .xlsx（多 Sheet、带口径元数据行），
 *   满足「导出 Excel 交付物日历」等需要真正 Excel 文件的场景。
 *
 * 与 exportCsv.ts 的关系：
 *   - exportCsv 用于轻量 CSV 快照（零依赖，Excel 可打开）；
 *   - exportXlsx 用于需要多 Sheet / 原生 .xlsx 的正式导出。
 *
 * 性能：xlsx 库体积较大，采用动态 import() 按需加载，只在用户真正点「导出 Excel」
 *   时才拉取，避免污染所在路由/首屏 chunk。
 *
 * 红线：
 *   - 只读导出，零业务数据写入；
 *   - 每个 Sheet 首部带口径元数据行（避免「表头不明」的合规问题，FUN-019）。
 */

/** 单列定义 */
export interface XlsxColumn {
  key: string
  label: string
  /** 列宽（字符数，可选） */
  width?: number
}

/** 单 Sheet 定义 */
export interface XlsxSheet {
  name: string
  /** 口径说明（写入 Sheet 首行，作为元数据） */
  meta: string
  cols: XlsxColumn[]
  rows: Record<string, unknown>[]
}

/**
 * 把多个 Sheet 导出为 .xlsx 并触发浏览器下载（异步，内部动态加载 xlsx）。
 * @param fileName 文件名（不含扩展名，自动追加日期）
 * @param sheets 一个或多个 Sheet
 */
export async function exportXlsx(fileName: string, sheets: XlsxSheet[]): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  for (const sh of sheets) {
    const header = sh.cols.map((c) => c.label)
    const body = sh.rows.map((r) => sh.cols.map((c) => (r[c.key] === null || r[c.key] === undefined ? '' : r[c.key])))
    const aoa = [
      [`# 数据口径:${sh.meta}`],
      [`# 导出时间:${new Date().toISOString()}`],
      [`# 记录数:${sh.rows.length}`],
      [],
      header,
      ...body
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // 列宽
    ws['!cols'] = sh.cols.map((c) => ({ wch: c.width || 14 }))
    XLSX.utils.book_append_sheet(wb, ws, sh.name)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${fileName}-${stamp}.xlsx`)
}
