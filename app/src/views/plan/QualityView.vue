<template>
  <div>
    <PageHeader title="13 项计划质量检查" desc="计划发布前自动体检：每项给阈值与超标活动编号，健康度 <80 不得发布、<60 视为无效（SCH-026）">
      <template #actions>
        <el-button size="small" :disabled="!store.quality.publishable" type="primary" @click="publish">发布计划</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="计划健康度" :value="store.quality.health" unit="分" :target="100" :zone="store.quality.health >= 80 ? 'ok' : store.quality.health >= 60 ? 'warn' : 'danger'" sub="<80 不得发布 / <60 无效" />
      <KpiCard label="通过项" :value="store.quality.checks.filter((c) => c.ok).length + ' / 13'" :zone="store.quality.checks.every((c) => c.ok) ? 'ok' : 'warn'" />
      <KpiCard label="阻断项" :value="hardFails.length" unit="项" :zone="hardFails.length ? 'danger' : 'ok'" sub="零容忍项：缺逻辑 / 负浮时 / 无效日期 / 异常日历" />
      <KpiCard label="计划冻结" :value="store.currentProject.planFrozen ? '已冻结' : '未冻结'" :zone="store.currentProject.planFrozen ? 'ok' : 'danger'" sub="未冻结不得下达任务（C-37）" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">
        检查明细
        <span class="dim">实测值 / 阈值 / 超标活动</span>
      </div>
      <el-table :data="store.quality.checks" size="small">
        <el-table-column prop="no" label="#" width="42" />
        <el-table-column prop="name" label="检查项" min-width="170" />
        <el-table-column label="实测" width="96" align="right">
          <template #default="{ row }"><span class="num">{{ row.value }}{{ row.unit === 'percent' ? '%' : ' 条' }}</span></template>
        </el-table-column>
        <el-table-column prop="threshold" label="阈值" width="130" />
        <el-table-column label="结论" width="82">
          <template #default="{ row }"><span class="tag" :class="row.ok ? 'ok' : 'fail'">{{ row.ok ? '通过' : '超标' }}</span></template>
        </el-table-column>
        <el-table-column label="超标活动（可下钻）" min-width="220">
          <template #default="{ row }">
            <span v-if="!row.offenders.length" class="dim">—</span>
            <span v-else class="mono" style="color: #ffb4b4">{{ row.offenders.slice(0, 8).join('、') }}{{ row.offenders.length > 8 ? ` 等 ${row.offenders.length} 个` : '' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        阈值可由 PMO 按项目等级调整，但调整必须留痕并说明理由，否则「按需放宽阈值」会让检查形同虚设。
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1.2fr 1fr">
      <div class="panel">
        <div class="panel-title">里程碑与关键节点（样件节点同时是一级里程碑，两处状态必须一致 PRJ-010）</div>
        <el-table :data="milestones" size="small">
          <el-table-column prop="code" label="WBS" width="60" />
          <el-table-column prop="name" label="里程碑" min-width="160" />
          <el-table-column label="绑定 Gate" width="86">
            <template #default="{ row }"><span class="tag">{{ row.gate || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="计划完成" width="90"><template #default="{ row }"><span class="num">D+{{ row.ef }}</span></template></el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><span class="tag" :class="row.percent >= 100 ? 'ok' : row.critical ? 'fail' : 'cond'">{{ row.percent >= 100 ? '已达成' : '未达成' }}</span></template>
          </el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">阻断判定（C-38 四项主导口径）</div>
        <div v-for="c in keyChecks" :key="c.no" class="krow">
          <span class="tag" :class="c.ok ? 'ok' : 'fail'">{{ c.ok ? 'OK' : 'BLOCK' }}</span>
          <span>{{ c.name }}</span>
          <em class="num">{{ c.value }}{{ c.unit === 'percent' ? '%' : '' }} / {{ c.threshold }}</em>
        </div>
        <div class="hr" />
        <div class="between">
          <b>发布判定</b>
          <span class="tag" :class="store.quality.publishable ? 'ok' : 'fail'">{{ store.quality.publishable ? '允许发布' : '阻断发布' }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          阻断理由指名具体活动编号（C-38），不接受「计划质量不佳」这类无定位结论。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()
const hardFails = computed(() => store.quality.checks.filter((c) => [1, 9, 11, 13].includes(c.no) && !c.ok))
const keyChecks = computed(() => store.quality.checks.filter((c) => [1, 4, 9, 6].includes(c.no)))
const milestones = computed(() => store.cpm.nodes.filter((n) => n.isMilestone || n.level === 1).map((n) => ({ ...n })))

function publish() {
  if (!store.quality.publishable) {
    store.notify('error', 'C-38：计划质量未达标，阻断发布')
    return
  }
  store.currentProject.planFrozen = true
  store.log('UPDATE', '计划', store.projectId, { frozen: true })
  store.notify('success', '计划已发布并冻结，可下达任务（C-37）')
}
</script>

<style scoped>
.dim { color: var(--text-3); font-size: 11px; }
.krow { display: grid; grid-template-columns: 56px 1fr auto; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.krow em { font-style: normal; color: var(--text-3); }
</style>
