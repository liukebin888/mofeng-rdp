# -*- coding: utf-8 -*-
import openpyxl, json, re

SRC = r'E:\BaiduNetdiskDownload\产品开发输出物管控一览表20220901各部门意见汇总表.xlsx'
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb['一览表']

STAGES = [
    ('CG0-CG1', '项目立项', 10),
    ('CG1-CG2', '工程发布', 13),
    ('CG2-CG3', '首次工装样件', 18),
    ('CG3-CG4', '工装样件认可', 23),
    ('CG4-CG5', '过程认可', 28),
    ('CG5-CG6', '生产件批准', 33),
    ('CG6-CG7', '项目验收', 38),
]

# 每个部门：name -> 行区间列表，靠后的区间覆盖靠前的（反馈/修改版覆盖原始版）
DEPT_DEFS = [
    ('市场部',          [(5, 8)]),
    ('项目管理中心',    [(10, 13), (15, 18)]),
    ('结构研发中心',    [(21, 24), (26, 29)]),
    ('模具中心',        [(31, 34), (36, 40)]),
    ('电子研发中心',    [(42, 47), (49, 54), (58, 64)]),
    ('工艺技术中心',    [(68, 71), (73, 76)]),
    ('采购部',          [(79, 82), (84, 87)]),
    ('计划物流',        [(90, 93)]),
    ('制造部',          [(95, 98), (100, 103)]),
    ('质量中心',        [(108, 111)]),
]

def cellval(r, c):
    v = ws.cell(r, c).value
    return '' if v is None else str(v).strip()

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

def parse_dept(ranges):
    levels = {}
    order = []
    for (r0, r1) in ranges:
        for r in range(r0, r1 + 1):
            lv = cellval(r, 3)
            if not lv:
                continue
            mark = cellval(r, 4)
            meta = {
                'freq': norm(cellval(r, 5)),
                'freqCheck': norm(cellval(r, 6)),
                'freqSpot': norm(cellval(r, 7)),
                'checkDept': norm(cellval(r, 8)),
                'monitorDept': norm(cellval(r, 9)),
            }
            cells = {}
            for code, label, col0 in STAGES:
                for sub in range(5):
                    c = col0 + sub
                    v = norm(cellval(r, c))
                    if v:
                        cells[code + '-' + str(sub + 1)] = v
            if lv not in levels:
                levels[lv] = {'mark': mark, 'meta': meta, 'cells': cells}
                order.append(lv)
            else:
                for k, v in meta.items():
                    if v:
                        levels[lv]['meta'][k] = v
                if mark:
                    levels[lv]['mark'] = mark
                for k, v in cells.items():
                    if v:
                        levels[lv]['cells'][k] = v
    return order, levels

result = []
for dept_name, ranges in DEPT_DEFS:
    order, levels = parse_dept(ranges)
    dept = {'name': dept_name, 'levels': []}
    for lv in order:
        d = levels[lv]
        dept['levels'].append({
            'level': lv,
            'mark': d['mark'],
            'freq': d['meta']['freq'],
            'freqCheck': d['meta']['freqCheck'],
            'freqSpot': d['meta']['freqSpot'],
            'checkDept': d['meta']['checkDept'],
            'monitorDept': d['meta']['monitorDept'],
            'cells': d['cells'],
        })
    result.append(dept)

total = sum(len(l['cells']) for d in result for l in d['levels'])
print('部门数:', len(result))
for d in result:
    levels_str = '/'.join(l['level'] for l in d['levels'])
    cnt = sum(len(l['cells']) for l in d['levels'])
    print('  %s: %s 条目=%d' % (d['name'], levels_str, cnt))
print('输出物总条目数:', total)

with open('/tmp/dc_data.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
print('OK -> /tmp/dc_data.json')
