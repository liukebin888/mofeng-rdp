/**
 * 产品开发输出物管控引擎（单一权威）
 *
 * 依据：《产品开发输出物管控一览表20220901各部门意见汇总表》，
 * 定义「哪个部门在哪个门控阶段（CG0-CG7）应产出什么输出物、等级如何、
 * 检查部门/监控部门/频次如何」，作为研发项目管理的主数据标准库。
 *
 * 规则（单一权威，禁止调用方自造判定）：
 *   R-DC-STAGE  门控阶段固定 7 个：CG0-CG1 项目立项 / CG1-CG2 工程发布 /
 *               CG2-CG3 首次工装样件 / CG3-CG4 工装样件认可 / CG4-CG5 过程认可 /
 *               CG5-CG6 生产件批准 / CG6-CG7 项目验收，每阶段 1-5 子位。
 *   R-DC-LEVEL  输出物等级固定 5 类：关键★(1级不可裁剪)/重要☆(2级)/一般▲(3级)/
 *               辅助△(4级)/前置条件。
 *   R-DC-CUT    裁剪口径：关键不可裁剪；重要须客户同意；一般须内部同意；辅助可裁剪。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - fail-closed：查不到部门/阶段/等级时返回空结果，不臆造
 *   - 数据只读复用，绝不改写 deliverableControlData.ts
 */

import { DELIVERABLE_CONTROL, GATE_STAGES, LEVEL_DEFS } from './deliverableControlData'
import type { DeliverableDeptDef, DeliverableLevel } from './deliverableControlData'

/** 部门列表（转发） */
export const CONTROL_DEPTS: DeliverableDeptDef[] = DELIVERABLE_CONTROL

/** 门控阶段（转发） */
export const CONTROL_STAGES = GATE_STAGES

/** 等级说明（转发） */
export const CONTROL_LEVELS = LEVEL_DEFS

/** 部门名列表 */
export const deptNames = (): string[] => DELIVERABLE_CONTROL.map((d) => d.name)

/**
 * 按部门名查找输出物管控定义。
 */
export function deptByName(name: string): DeliverableDeptDef | null {
  return DELIVERABLE_CONTROL.find((d) => d.name === name) ?? null
}

/**
 * 统计某部门的输出物条目总数（按 等级×阶段×子位 去重计数）。
 */
export function deptItemCount(deptName: string): number {
  const d = deptByName(deptName)
  if (!d) return 0
  return d.levels.reduce((s, l) => s + l.cells.length, 0)
}

/**
 * 统计全部部门输出物条目总数。
 */
export function totalItemCount(): number {
  return DELIVERABLE_CONTROL.reduce((s, d) => s + d.levels.reduce((x, l) => x + l.cells.length, 0), 0)
}

/**
 * 按部门 + 门控阶段检索输出物（跨等级聚合）。
 * fail-closed：部门或阶段不存在返回空数组。
 */
export function itemsByStage(deptName: string, stageCode: string): { level: DeliverableLevel; mark: string; slot: number; name: string }[] {
  const d = deptByName(deptName)
  if (!d) return []
  if (!GATE_STAGES.some((s) => s.code === stageCode)) return []
  const out: { level: DeliverableLevel; mark: string; slot: number; name: string }[] = []
  for (const l of d.levels) {
    for (const c of l.cells) {
      if (c.stage === stageCode) {
        out.push({ level: l.level, mark: l.mark, slot: c.slot, name: c.name })
      }
    }
  }
  return out.sort((a, b) => a.slot - b.slot)
}

/**
 * 按部门 + 等级检索输出物（跨阶段聚合）。
 */
export function itemsByLevel(deptName: string, level: DeliverableLevel): { stage: string; slot: number; name: string }[] {
  const d = deptByName(deptName)
  if (!d) return []
  const lv = d.levels.find((l) => l.level === level)
  if (!lv) return []
  return lv.cells.map((c) => ({ stage: c.stage, slot: c.slot, name: c.name }))
}

/**
 * 关键词检索：在部门名 + 输出物名称中模糊匹配。
 */
export function searchItems(keyword: string): { dept: string; level: DeliverableLevel; mark: string; stage: string; slot: number; name: string }[] {
  const q = (keyword ?? '').trim()
  if (!q) return []
  const out: { dept: string; level: DeliverableLevel; mark: string; stage: string; slot: number; name: string }[] = []
  for (const d of DELIVERABLE_CONTROL) {
    for (const l of d.levels) {
      for (const c of l.cells) {
        if (c.name.includes(q) || d.name.includes(q)) {
          out.push({ dept: d.name, level: l.level, mark: l.mark, stage: c.stage, slot: c.slot, name: c.name })
        }
      }
    }
  }
  return out
}

/**
 * 裁剪口径校验：给定等级，返回是否可裁剪 + 说明。
 * 关键 → 不可裁剪；重要 → 客户同意可裁剪；一般 → 内部同意可裁剪；辅助 → 可裁剪。
 */
export function cutPolicyOf(level: DeliverableLevel): { trimmable: boolean; note: string } {
  switch (level) {
    case '关键': return { trimmable: false, note: '不可裁剪，必须执行，缺失则产品无法开发生产' }
    case '重要': return { trimmable: true, note: '客户同意后可裁剪，允许借用' }
    case '一般': return { trimmable: true, note: '内部同意后可裁剪' }
    case '辅助': return { trimmable: true, note: '可裁剪（其他主流程的凭证附件）' }
    case '前置条件': return { trimmable: false, note: '前置条件，满足后方可继续' }
    default: return { trimmable: false, note: '' }
  }
}

/** 等级 → 标记映射（供视图渲染） */
export const LEVEL_MARK: Record<string, string> = {
  关键: '★',
  重要: '☆',
  一般: '▲',
  辅助: '△',
  前置条件: '-',
}
