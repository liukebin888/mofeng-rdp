/**
 * 资源剖析表引擎（Oracle Resource Profile 对标）
 * 依据：SRS 11.7（RES-008 资源直方图与负荷曲线）深化；对标 Oracle 资源剖析表
 *   —— 按「角色 × 周」展开负荷矩阵，识别逐周超负荷，而非仅静态按角色汇总。
 *
 * 纪律：纯函数、零框架依赖、TS 权威；输入为「任务资源占用区间」（startDay/finishDay
 *   工作日序号，来自 CPM 最早开始 es/ef），本引擎只做周映射与聚合，禁止自造工时比例。
 */

/** 单任务资源占用（由 store 从 CPM 节点派生：es/ef + ownerRole） */
export interface TaskResourceSpan {
  id: string
  code: string
  name: string
  role: string
  /** 开始工作日序号（0-based，CPM es） */
  startDay: number
  /** 结束工作日序号（CPM ef，含当日） */
  finishDay: number
}

/** 周桶 */
export interface WeekBucket {
  week: string
  /** 该周分配总工时（所有角色） */
  assignedHours: number
  /** 该周容量工时（角色数 × 周标准工时，见 capacityPerRoleWeek） */
  capacityHours: number
  /** 负荷率（%） */
  loadRate: number
  /** 是否超负荷 */
  overloaded: boolean
}

/** 资源剖析表：角色 × 周 负荷矩阵 */
export interface ResourceProfile {
  /** 有序周列表 */
  weeks: string[]
  /** 有序角色列表 */
  roles: string[]
  /** 矩阵：matrix[role][weekIdx] = 该角色该周分配工时 */
  matrix: number[][]
  /** 角色逐周峰值负荷 */
  rolePeak: { role: string; week: string; hours: number; loadRate: number }[]
  /** 周桶（直方图） */
  buckets: WeekBucket[]
  /** 超负荷周 */
  overloadedWeeks: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** 工作日序号 → ISO 周（YYYY-Wnn）。projectStart 为 YYYY-MM-DD，dayIdx 为 0-based 工作日序号 */
export function dayToWeek(projectStart: string, dayIdx: number): string {
  const [y, m, d] = projectStart.split('-').map(Number)
  const base = Date.UTC(y, m - 1, d)
  // 工作日序号：跳过周末（近似：周一至周五计数）
  const days = Math.floor(dayIdx / 5) * 7 + (dayIdx % 5)
  const ms = base + days * 86400000
  const dt = new Date(ms)
  const year = dt.getUTCFullYear()
  const month = dt.getUTCMonth()
  const date = dt.getUTCDate()
  // ISO 周号：以该年 1 月 4 日为基准
  const jan4 = Date.UTC(year, 0, 4)
  const jan4Day = (new Date(jan4).getUTCDay() + 6) % 7 // 周一=0
  const week = Math.floor((ms - jan4 + jan4Day * 86400000) / (7 * 86400000)) + 1
  void month; void date
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** 任务区间展开为周工时：startDay~finishDay 内每个工作日 8h，跨周按周累计 */
export function taskWeeklyHours(span: TaskResourceSpan, projectStart: string): Map<string, number> {
  const map = new Map<string, number>()
  for (let day = span.startDay; day <= span.finishDay; day++) {
    const week = dayToWeek(projectStart, day)
    map.set(week, (map.get(week) ?? 0) + 8)
  }
  return map
}

/** 构建资源剖析表（角色 × 周 负荷矩阵 + 按周直方图） */
export function buildResourceProfile(
  spans: TaskResourceSpan[],
  projectStart: string,
  capacityPerRoleWeek = 40,
  overloadThreshold = 1.1
): ResourceProfile {
  // 收集所有周与角色
  const weekSet = new Set<string>()
  const roleSet = new Set<string>()
  const roleWeek = new Map<string, Map<string, number>>() // role -> week -> hours
  const weekHours = new Map<string, number>()

  for (const span of spans) {
    roleSet.add(span.role)
    const wh = taskWeeklyHours(span, projectStart)
    for (const [week, hours] of wh) {
      weekSet.add(week)
      weekHours.set(week, (weekHours.get(week) ?? 0) + hours)
      if (!roleWeek.has(span.role)) roleWeek.set(span.role, new Map())
      roleWeek.get(span.role)!.set(week, (roleWeek.get(span.role)!.get(week) ?? 0) + hours)
    }
  }

  const weeks = [...weekSet].sort()
  const roles = [...roleSet].sort()

  // 矩阵：matrix[role][weekIdx]
  const matrix = roles.map((role) => weeks.map((w) => roleWeek.get(role)?.get(w) ?? 0))

  // 角色峰值
  const rolePeak = roles
    .map((role) => {
      let peakHours = 0
      let peakWeek = ''
      weeks.forEach((w, i) => {
        const h = matrix[roles.indexOf(role)][i]
        if (h > peakHours) {
          peakHours = h
          peakWeek = w
        }
      })
      const loadRate = r2((peakHours / capacityPerRoleWeek) * 100)
      return { role, week: peakWeek, hours: peakHours, loadRate }
    })
    .sort((a, b) => b.loadRate - a.loadRate)

  // 周桶（直方图）：容量 = 角色数 × 周标准工时
  const capacityHours = Math.max(1, roles.length) * capacityPerRoleWeek
  const buckets: WeekBucket[] = weeks.map((week) => {
    const assignedHours = r2(weekHours.get(week) ?? 0)
    const loadRate = r2((assignedHours / capacityHours) * 100)
    return { week, assignedHours, capacityHours, loadRate, overloaded: loadRate > overloadThreshold * 100 }
  })

  const overloadedWeeks = buckets.filter((b) => b.overloaded).map((b) => b.week)

  return { weeks, roles, matrix, rolePeak, buckets, overloadedWeeks }
}
