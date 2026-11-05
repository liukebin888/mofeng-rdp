<template>
  <div>
    <PageHeader title="输出物管控标准" desc="产品开发输出物管控一览表（2022-09-01 各部门意见汇总）——按部门定义各门控阶段（CG0-CG7）输出物、等级、检查/监控部门与频次">
      <template #actions>
        <el-button size="small" @click="kw = ''; activeTab = 'matrix'">重置</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="部门数" :value="CONTROL_DEPTS.length" unit="个" sub="市场/项目/研发/工艺/采购/物流/制造/质量" />
      <KpiCard label="门控阶段" value="7" unit="个" sub="CG0-CG1 至 CG6-CG7" />
      <KpiCard label="输出物条目" :value="totalItems" unit="条" sub="部门 × 阶段 × 等级汇总" />
      <KpiCard label="等级口径" value="5" unit="级" sub="关键★/重要☆/一般▲/辅助△/前置" />
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- ① 输出物矩阵 -->
      <el-tab-pane label="① 输出物矩阵" name="matrix">
        <div class="toolbar">
          <el-input v-model="kw" placeholder="搜索部门或输出物名称" clearable style="width: 300px" />
          <el-select v-model="selDept" placeholder="选择部门" clearable style="width: 200px" @change="onDeptChange">
            <el-option v-for="d in CONTROL_DEPTS" :key="d.name" :label="d.name" :value="d.name" />
          </el-select>
        </div>

        <div v-if="kw" class="panel">
          <div class="panel-title">搜索结果（{{ searchResult.length }} 条）</div>
          <el-table :data="searchResult" size="small" border height="520">
            <el-table-column prop="dept" label="部门" width="120" />
            <el-table-column label="等级" width="70" align="center">
              <template #default="{ row }"><span class="mark">{{ row.mark }}</span></template>
            </el-table-column>
            <el-table-column label="阶段" width="130">
              <template #default="{ row }">{{ stageLabel(row.stage) }}<em class="dim">({{ row.stage }})</em></template>
            </el-table-column>
            <el-table-column prop="name" label="输出物" min-width="300" />
          </el-table>
        </div>

        <div v-else-if="curDept" class="panel">
          <div class="panel-title">{{ curDept.name }} · 输出物管控矩阵</div>
          <el-table :data="deptRows" size="small" border>
            <el-table-column label="等级" width="90" fixed>
              <template #default="{ row }">
                <span class="mark">{{ row.mark }}</span> {{ row.level }}
              </template>
            </el-table-column>
            <el-table-column v-for="s in CONTROL_STAGES" :key="s.code" :label="s.label" min-width="150" align="left">
              <template #header>
                <div>{{ s.label }}</div>
                <div class="dim" style="font-weight: normal">{{ s.code }}</div>
              </template>
              <template #default="{ row }">
                <div v-for="it in cellItems(row.level, s.code)" :key="it.slot" class="cell-item">
                  <span class="slot">{{ it.slot }}</span><span>{{ it.name }}</span>
                </div>
                <span v-if="!cellItems(row.level, s.code).length" class="dim">—</span>
              </template>
            </el-table-column>
          </el-table>
          <div class="row" style="margin-top: 10px">
            <span class="dim">检查部门：{{ checkDept }} · 监控部门：{{ monitorDept }} · 自查频次：{{ freq }} / 检查 {{ freqCheck }} / 抽查 {{ freqSpot }}</span>
          </div>
        </div>

        <el-empty v-else description="请选择部门查看输出物矩阵" :image-size="60" />
      </el-tab-pane>

      <!-- ② 等级说明 -->
      <el-tab-pane label="② 等级说明" name="level">
        <div class="panel">
          <div class="panel-title">输出物等级与裁剪口径</div>
          <el-table :data="CONTROL_LEVELS" size="small" border>
            <el-table-column label="标记" width="70" align="center">
              <template #default="{ row }"><span class="mark">{{ row.mark }}</span></template>
            </el-table-column>
            <el-table-column prop="level" label="等级" width="110" />
            <el-table-column prop="fileLevel" label="文件等级" width="90" />
            <el-table-column prop="desc" label="裁剪口径说明" min-width="380" />
            <el-table-column label="裁剪结论" width="130" align="center">
              <template #default="{ row }">
                <el-tag :type="cutPolicyOf(row.level).trimmable ? 'warning' : 'danger'" size="small">{{ cutPolicyOf(row.level).trimmable ? '可裁剪' : '不可裁剪' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <p class="dim" style="margin-top: 12px">备注：关键不能裁剪；重要须总经理批准；一般须部门总监批准。文件属性等级 1-5 级，1 级文件不允许裁剪。</p>
        </div>
      </el-tab-pane>

      <!-- ③ 责任定义 -->
      <el-tab-pane label="③ 延期责任定义" name="duty">
        <div class="panel">
          <div class="panel-title">项目输出与延期责任定义（责任等级 × 延期时间 → 考核扣分）</div>
          <el-table :data="dutyRows" size="small" border>
            <el-table-column prop="scope" label="责任范围" width="110" />
            <el-table-column prop="grade" label="等级" width="90" />
            <el-table-column label="1周内" width="90" align="center"><template #default="{ row }">{{ row.w1 }}</template></el-table-column>
            <el-table-column label="1-2周" width="90" align="center"><template #default="{ row }">{{ row.w2 }}</template></el-table-column>
            <el-table-column label="2-4周" width="90" align="center"><template #default="{ row }">{{ row.w4 }}</template></el-table-column>
            <el-table-column label="4-8周" width="90" align="center"><template #default="{ row }">{{ row.w8 }}</template></el-table-column>
            <el-table-column label="8周以上" width="90" align="center"><template #default="{ row }">{{ row.w8p }}</template></el-table-column>
          </el-table>
          <p class="dim" style="margin-top: 12px">1、2 次或以上管理责任时，责任等级按比例提升；2、责任等级提升，在最级责任基础上，按等级比例增加。</p>
        </div>

        <div class="panel" style="margin-top: 12px">
          <div class="panel-title">考核等级与扣分</div>
          <el-table :data="penaltyRows" size="small" border>
            <el-table-column prop="order" label="序" width="60" />
            <el-table-column prop="grade" label="等级" width="100" />
            <el-table-column prop="score" label="扣分" width="100" />
            <el-table-column prop="note" label="备注" min-width="260" />
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useI18n } from '@/infra/i18nPlugin'
import {
  CONTROL_DEPTS,
  CONTROL_STAGES,
  CONTROL_LEVELS,
  deptByName,
  searchItems,
  cutPolicyOf,
  totalItemCount,
} from '@/domain/deliverableControl'
import type { DeliverableLevel } from '@/domain/deliverableControlData'

const { te } = useI18n()

const activeTab = ref('matrix')
const kw = ref('')
const selDept = ref('')

const totalItems = computed(() => totalItemCount())
const curDept = computed(() => (selDept.value ? deptByName(selDept.value) : null))

const searchResult = computed(() => searchItems(kw.value))

function onDeptChange() {
  kw.value = ''
}

function stageLabel(code: string): string {
  const s = CONTROL_STAGES.find((x) => x.code === code)
  return s ? s.label : code
}

// 部门矩阵行：每个等级一行
const deptRows = computed(() => curDept.value?.levels ?? [])

function cellItems(level: DeliverableLevel, stageCode: string) {
  const lv = curDept.value?.levels.find((l) => l.level === level)
  if (!lv) return []
  return lv.cells.filter((c) => c.stage === stageCode).sort((a, b) => a.slot - b.slot)
}

const checkDept = computed(() => curDept.value?.levels.find((l) => l.checkDept)?.checkDept ?? '—')
const monitorDept = computed(() => curDept.value?.levels.find((l) => l.monitorDept)?.monitorDept ?? '—')
const freq = computed(() => curDept.value?.levels.find((l) => l.freq)?.freq ?? '—')
const freqCheck = computed(() => curDept.value?.levels.find((l) => l.freqCheck)?.freqCheck ?? '—')
const freqSpot = computed(() => curDept.value?.levels.find((l) => l.freqSpot)?.freqSpot ?? '—')

// 责任定义矩阵（直接责任 + 管理责任）
const dutyRows = [
  { scope: '直接责任', grade: '★关键', w1: 'B', w2: 'A', w4: 'A', w8: 'A++', w8p: 'A+++' },
  { scope: '直接责任', grade: '☆重要', w1: 'C', w2: 'B', w4: 'A-', w8: 'A+', w8p: 'A++' },
  { scope: '直接责任', grade: '▲一般', w1: 'D', w2: 'C', w4: 'B', w8: 'A', w8p: 'A+' },
  { scope: '直接责任', grade: '△辅助', w1: 'E', w2: 'D', w4: 'C', w8: 'A-', w8p: 'A' },
  { scope: '管理责任·上1级', grade: '★关键', w1: '', w2: 'B', w4: 'A', w8: 'A', w8p: 'A++' },
  { scope: '管理责任·上1级', grade: '☆重要', w1: '', w2: 'C', w4: 'B', w8: 'A-', w8p: 'A+' },
  { scope: '管理责任·上1级', grade: '▲一般', w1: '', w2: 'D', w4: 'C', w8: 'B', w8p: 'A' },
  { scope: '管理责任·上1级', grade: '△辅助', w1: '', w2: 'E', w4: 'D', w8: 'C', w8p: 'A-' },
  { scope: '管理责任·上2级', grade: '★关键', w1: '', w2: '', w4: 'B', w8: 'A', w8p: 'A' },
  { scope: '管理责任·上2级', grade: '☆重要', w1: '', w2: '', w4: 'C', w8: 'B', w8p: 'A-' },
  { scope: '管理责任·上2级', grade: '▲一般', w1: '', w2: '', w4: 'D', w8: 'C', w8p: 'B' },
  { scope: '管理责任·上2级', grade: '△辅助', w1: '', w2: '', w4: 'E', w8: 'D', w8p: 'C' },
  { scope: '管理责任·上3级', grade: '★关键', w1: '', w2: '', w4: '', w8: 'B', w8p: 'A' },
  { scope: '管理责任·上3级', grade: '☆重要', w1: '', w2: '', w4: '', w8: 'C', w8p: 'B' },
  { scope: '管理责任·上3级', grade: '▲一般', w1: '', w2: '', w4: '', w8: 'D', w8p: 'C' },
  { scope: '管理责任·上3级', grade: '△辅助', w1: '', w2: '', w4: '', w8: 'E', w8p: 'D' },
  { scope: '管理责任·上4级', grade: '★关键', w1: '', w2: '', w4: '', w8: '', w8p: 'B' },
  { scope: '管理责任·上4级', grade: '☆重要', w1: '', w2: '', w4: '', w8: '', w8p: 'C' },
  { scope: '管理责任·上4级', grade: '▲一般', w1: '', w2: '', w4: '', w8: '', w8p: 'D' },
  { scope: '管理责任·上4级', grade: '△辅助', w1: '', w2: '', w4: '', w8: '', w8p: 'E' },
]

const penaltyRows = [
  { order: 1, grade: 'A+++', score: -1000, note: '年度 2 次即降职调岗' },
  { order: 2, grade: 'A++', score: -500, note: '年度 3 次即降职调岗' },
  { order: 3, grade: 'A+', score: -300, note: '' },
  { order: 4, grade: 'A', score: -200, note: '' },
  { order: 5, grade: 'A-', score: -100, note: '' },
  { order: 6, grade: 'B', score: -50, note: '年度少于 2 次免考核' },
  { order: 7, grade: 'C', score: -30, note: '季度少于 2 次免考核' },
  { order: 8, grade: 'D', score: -20, note: '' },
  { order: 9, grade: 'E', score: -10, note: '' },
]
</script>

<style scoped>
.toolbar { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; }
.mark { color: var(--brand, #c0392b); font-weight: 700; }
.cell-item { display: flex; gap: 4px; padding: 2px 0; line-height: 1.5; }
.slot { color: var(--text-3); font-size: 11px; min-width: 12px; }
.dim { color: var(--text-3); font-size: 11px; }
.row { display: flex; align-items: center; }
</style>
