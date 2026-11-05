# -*- coding: utf-8 -*-
"""从 /tmp/dc_data.json 生成 domain/deliverableControlData.ts"""
import json

data = json.load(open('/tmp/dc_data.json', encoding='utf-8'))

# 阶段标签
STAGE_LABELS = {
    'CG0-CG1': '项目立项',
    'CG1-CG2': '工程发布',
    'CG2-CG3': '首次工装样件',
    'CG3-CG4': '工装样件认可',
    'CG4-CG5': '过程认可',
    'CG5-CG6': '生产件批准',
    'CG6-CG7': '项目验收',
}

LEVEL_ORDER = ['关键', '重要', '一般', '辅助', '前置条件']

def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

lines = []
lines.append('/**')
lines.append(' * 产品开发输出物管控一览表 数据字典')
lines.append(' *')
lines.append(' * 依据：正式发布文件《产品开发输出物管控一览表20220901各部门意见汇总表.xlsx》')
lines.append(' * 由 scripts/extract_dc.py 逐条提取生成，忠实原文、未做任何修改。')
lines.append(' *')
lines.append(' * 结构：10 个部门 × 门控阶段（CG0-CG7，7 个阶段，每阶段 1-5 子位）× 输出物等级')
lines.append(' * 等级：关键★不可裁剪 / 重要☆客户同意可裁剪 / 一般▲内部同意可裁剪 / 辅助△可裁剪 / 前置条件')
lines.append(' */')
lines.append('')
lines.append('/** 输出物等级 */')
lines.append('export type DeliverableLevel = \'关键\' | \'重要\' | \'一般\' | \'辅助\' | \'前置条件\'')
lines.append('')
lines.append('/** 门控阶段代码（CG0-CG7） */')
lines.append('export const GATE_STAGES = [')
lines.append('  { code: \'CG0-CG1\', label: \'项目立项\' },')
lines.append('  { code: \'CG1-CG2\', label: \'工程发布\' },')
lines.append('  { code: \'CG2-CG3\', label: \'首次工装样件\' },')
lines.append('  { code: \'CG3-CG4\', label: \'工装样件认可\' },')
lines.append('  { code: \'CG4-CG5\', label: \'过程认可\' },')
lines.append('  { code: \'CG5-CG6\', label: \'生产件批准\' },')
lines.append('  { code: \'CG6-CG7\', label: \'项目验收\' },')
lines.append('] as const')
lines.append('')
lines.append('/** 输出物等级说明（含标记与裁剪口径） */')
lines.append('export const LEVEL_DEFS: { level: DeliverableLevel; mark: string; desc: string; fileLevel: string }[] = [')
lines.append('  { level: \'关键\', mark: \'★\', desc: \'不可裁剪，必须执行；缺失则产品无法开发生产，输出物必须输出\', fileLevel: \'1级\' },')
lines.append('  { level: \'重要\', mark: \'☆\', desc: \'适用时必须执行；缺失会引起内外部客户严重抱怨或开发生产受阻，允许借用\', fileLevel: \'2级\' },')
lines.append('  { level: \'一般\', mark: \'▲\', desc: \'内部管控需求，评审后不可执行\', fileLevel: \'3级\' },')
lines.append('  { level: \'辅助\', mark: \'△\', desc: \'其他主流程的凭证附件，可裁剪\', fileLevel: \'4级\' },')
lines.append('  { level: \'前置条件\', mark: \'-\', desc: \'前置条件（模具中心特有，满足后方可继续）\', fileLevel: \'-\' },')
lines.append(']')
lines.append('')
lines.append('/** 单个输出物条目：阶段 + 子位 → 输出物名称 */')
lines.append('export interface DeliverableCell {')
lines.append('  /** 阶段代码（CG0-CG1 ~ CG6-CG7） */')
lines.append('  stage: string')
lines.append('  /** 子位（1-5） */')
lines.append('  slot: number')
lines.append('  /** 输出物名称 */')
lines.append('  name: string')
lines.append('}')
lines.append('')
lines.append('/** 某部门某等级的管控定义 */')
lines.append('export interface DeliverableLevelDef {')
lines.append('  level: DeliverableLevel')
lines.append('  mark: string')
lines.append('  freq: string')
lines.append('  freqCheck: string')
lines.append('  freqSpot: string')
lines.append('  checkDept: string')
lines.append('  monitorDept: string')
lines.append('  cells: DeliverableCell[]')
lines.append('}')
lines.append('')
lines.append('/** 某部门的输出物管控定义 */')
lines.append('export interface DeliverableDeptDef {')
lines.append('  name: string')
lines.append('  levels: DeliverableLevelDef[]')
lines.append('}')
lines.append('')
lines.append('export const DELIVERABLE_CONTROL: DeliverableDeptDef[] = [')

for dept in data:
    lines.append('  {')
    lines.append('    name: "%s",' % esc(dept['name']))
    # 找出关键等级的元数据（用于非关键等级继承）
    key_meta = None
    for l in dept['levels']:
        if l['level'] == '关键':
            key_meta = l
            break
    levels = dept['levels']
    lines.append('    levels: [')
    for l in levels:
        freq = l['freq'] or (key_meta['freq'] if key_meta else '')
        freqCheck = l['freqCheck'] or (key_meta['freqCheck'] if key_meta else '')
        freqSpot = l['freqSpot'] or (key_meta['freqSpot'] if key_meta else '')
        checkDept = l['checkDept'] or (key_meta['checkDept'] if key_meta else '')
        monitorDept = l['monitorDept'] or (key_meta['monitorDept'] if key_meta else '')
        lines.append('      {')
        lines.append('        level: "%s",' % esc(l['level']))
        lines.append('        mark: "%s",' % esc(l['mark']))
        lines.append('        freq: "%s",' % esc(freq))
        lines.append('        freqCheck: "%s",' % esc(freqCheck))
        lines.append('        freqSpot: "%s",' % esc(freqSpot))
        lines.append('        checkDept: "%s",' % esc(checkDept))
        lines.append('        monitorDept: "%s",' % esc(monitorDept))
        lines.append('        cells: [')
        for k, v in sorted(l['cells'].items()):
            stage, slot = k.rsplit('-', 1)
            lines.append('          { stage: "%s", slot: %s, name: "%s" },' % (esc(stage), slot, esc(v)))
        lines.append('        ],')
        lines.append('      },')
    lines.append('    ],')
    lines.append('  },')
lines.append(']')
lines.append('')

out = '\n'.join(lines)
with open('src/domain/deliverableControlData.ts', 'w', encoding='utf-8') as f:
    f.write(out)
print('已生成 src/domain/deliverableControlData.ts, 行数=', len(lines))
