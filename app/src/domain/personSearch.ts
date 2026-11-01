/**
 * 人员姓名首拼搜索（纯函数，零依赖）
 * 依据：命名与编码规则菜单配套能力 —— 填写人员姓名时按「姓名首拼」引出候选，
 *      选中后自动带出部门 / 岗位等关联信息。
 * 约束：本层不得依赖 vue / element-plus / pinia / DOM（ARC-001）。
 *
 * 说明：为保持零第三方依赖，内置一份覆盖常见姓氏与名字用字的「汉字→拼音首字母」
 *      映射表；未收录汉字降级为原字符，仍可通过全名精确匹配命中选择。
 */

export interface PersonCandidate {
  /** 人员唯一标识 */
  id: string
  /** 姓名 */
  name: string
  /** 姓名全拼首字母串（如「周立群」→ zlq） */
  initials: string
  /** 可选附加信息（部门/岗位等，由调用方按需填充） */
  dept?: string
  post?: string
  roleName?: string
  account?: string
}

/**
 * 汉字 → 拼音首字母映射（覆盖 seed 54 人姓名全集 + 常见姓氏/名用字）。
 * 键为单字，值为该字拼音首字母（小写）。
 */
const PINYIN_INITIALS: Record<string, string> = {
  // —— 姓氏（百家姓高频）——
  陈: 'c', 林: 'l', 周: 'z', 吴: 'w', 赵: 'z', 钱: 'q', 孙: 's', 李: 'l',
  郑: 'z', 王: 'w', 冯: 'f', 何: 'h', 徐: 'x', 马: 'm', 顾: 'g', 沈: 's',
  许: 'x', 唐: 't', 韩: 'h', 罗: 'l', 蒋: 'j', 曹: 'c', 邓: 'd', 梁: 'l',
  谢: 'x', 袁: 'y', 崔: 'c', 龙: 'l', 曾: 'z', 彭: 'p', 蔡: 'c', 潘: 'p',
  董: 'd', 苏: 's', 魏: 'w', 叶: 'y', 田: 't', 万: 'w', 石: 's', 于: 'y',
  邵: 's', 孟: 'm', 秦: 'q', 段: 'd', 郝: 'h', 侯: 'h', 邹: 'z', 武: 'w',
  廖: 'l', 龚: 'g', 姚: 'y', 张: 'z', 刘: 'l', 杨: 'y', 黄: 'h', 胡: 'h',
  郭: 'g', 高: 'g', 金: 'j', 姜: 'j', 朱: 'z', 钟: 'z', 陆: 'l', 康: 'k',
  任: 'r', 卢: 'l', 方: 'f', 余: 'y', 杜: 'd', 丁: 'd', 程: 'c', 谭: 't',
  毛: 'm', 江: 'j', 熊: 'x', 宋: 's', 白: 'b', 雷: 'l', 赖: 'l', 汪: 'w',
  戴: 'd', 范: 'f', 肖: 'x', 尹: 'y', 苗: 'm', 施: 's', 严: 'y', 孔: 'k',
  尤: 'y', 欧: 'o', 华: 'h',
  // —— 名字用字（seed 全集 + 常见）——
  志: 'z', 远: 'y', 静: 'j', 立: 'l', 群: 'q', 敏: 'm', 启: 'q', 明: 'm',
  伟: 'w', 烨: 'y', 文: 'w', 杰: 'j', 昊: 'h', 琳: 'l', 磊: 'l', 晓: 'x',
  东: 'd', 宁: 'n', 强: 'q', 晨: 'c', 雅: 'y', 国: 'g', 栋: 'd', 峰: 'f',
  建: 'j', 博: 'b', 涛: 't', 刚: 'g', 永: 'y', 平: 'p', 雪: 'x', 梅: 'm',
  丽: 'l', 海: 'h', 军: 'j', 燕: 'y', 娟: 'j', 芳: 'f', 婷: 't', 雨: 'y',
  欣: 'x', 娜: 'n', 晶: 'j', 超: 'c', 旭: 'x', 阳: 'y', 鹏: 'p', 宇: 'y',
  飞: 'f', 勇: 'y', 祥: 'x', 兵: 'b', 帅: 's', 俊: 'j', 霞: 'x', 云: 'y',
  荣: 'r', 斌: 'b', 哲: 'z', 睿: 'r', 慧: 'h', 凯: 'k', 迪: 'd', 天: 't',
  一: 'y', 涵: 'h', 妍: 'y', 琪: 'q', 璐: 'l', 瑶: 'y', 皓: 'h', 轩: 'x',
  辰: 'c', 世: 's', 成: 'c', 德: 'd', 恩: 'e', 福: 'f', 光: 'g', 宏: 'h',
  辉: 'h', 嘉: 'j', 民: 'm', 庆: 'q', 瑞: 'r', 生: 's', 顺: 's', 维: 'w',
  希: 'x', 翔: 'x', 兴: 'x', 秀: 'x', 学: 'x', 亚: 'y', 岩: 'y', 毅: 'y',
  英: 'y', 玉: 'y', 越: 'y', 泽: 'z', 振: 'z', 正: 'z', 中: 'z', 忠: 'z',
  子: 'z', 宗: 'z'
}

/**
 * 单字 → 拼音首字母（未收录返回原字符，保证降级安全）
 */
export function initialOfChar(ch: string): string {
  return PINYIN_INITIALS[ch] ?? ch.toLowerCase()
}

/**
 * 姓名 → 全拼首字母串（如「周立群」→ "zlq"；「吴敏」→ "wm"）
 * 非汉字（字母/数字/空格）原样保留并转小写，便于「姓名」与「英文名」混合输入。
 */
export function pinyinInitials(name: string): string {
  return Array.from(name)
    .map((ch) => initialOfChar(ch))
    .join('')
    .replace(/\s+/g, '')
}

/**
 * 按关键字搜索人员（支持：全名 / 姓名片段 / 全拼首字母 / 首拼子串）
 * 匹配优先级：全名精确 > 首拼精确 > 首拼前缀 > 姓名包含。
 * 返回去重后的候选列表（已附加 initials）。
 */
export function searchPersons(
  people: Array<{ id: string; name: string }>,
  keyword: string
): PersonCandidate[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return []
  const seen = new Set<string>()
  const scored: Array<{ c: PersonCandidate; score: number }> = []
  for (const p of people) {
    const name = p.name
    const init = pinyinInitials(name)
    const nameLower = name.toLowerCase()
    let score = -1
    if (nameLower === kw) score = 100
    else if (init === kw) score = 90
    else if (init.startsWith(kw)) score = 80
    else if (nameLower.includes(kw)) score = 60
    else if (init.includes(kw)) score = 50
    if (score < 0 || seen.has(p.id)) continue
    seen.add(p.id)
    scored.push({ c: { id: p.id, name, initials: init }, score })
  }
  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
  return scored.map((s) => s.c)
}
