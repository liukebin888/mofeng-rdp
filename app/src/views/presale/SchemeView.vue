<template>
  <div>
    <PageHeader title="技术方案（TR）" desc="技术方案（TR）的版本管理与技术评审：方案版本、评审结论、评审状态统一留痕。TR 评审走审批流（技术负责人发起 → TR 技术评审 → 总经理批准，FLOW-PRE-5），「通过」后方可作为报价与立项的技术输入（C-02）。报价信息请到「项目/产品报价」查看">
      <template #actions>
        <el-button size="small" type="primary" @click="newSchemeVersion">新建方案版本</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="方案版本" :value="schemes.length" unit="版" />
      <KpiCard label="已通过 TR" :value="trApprovedCount" unit="版" zone="ok" />
      <KpiCard label="TR 待评审" :value="trPendingCount" unit="版" :zone="trPendingCount > 0 ? 'warn' : 'ok'" />
      <KpiCard label="最新版本" :value="schemes[0]?.version ?? '—'" unit="" zone="brand" />
    </div>

    <div class="panel">
      <div class="panel-title">技术方案版本</div>
      <el-table :data="schemes" size="small">
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="title" label="方案主题" min-width="200" />
        <el-table-column prop="date" label="日期" width="96" />
        <el-table-column label="TR 评审结论" width="110">
          <template #default="{ row }">
            <span class="tag" :class="trZone(row)">{{ te(row.trResult) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }"><span class="tag ok">{{ te(row.status) }}</span></template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        TR（技术评审）对技术方案进行正式评审，结论「通过」后方可作为报价与立项的技术输入（C-02）。
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

/** 技术方案版本清单（技术方案域唯一权威数据；报价单不在此持有，归属「项目/产品报价」） */
const schemes = computed(() => [
  { version: 'V1.2', title: '转向助力域控制器技术方案', date: '2026-08-20', status: '已批准', trResult: 'TR 通过' },
  { version: 'V1.1', title: '转向助力域控制器技术方案', date: '2026-07-15', status: '已归档', trResult: 'TR 通过' },
  { version: 'V1.0', title: '转向助力域控制器技术方案', date: '2026-06-01', status: '已归档', trResult: 'TR 有条件通过' }
])

const trApprovedCount = computed(() => schemes.value.filter((s) => s.trResult.startsWith('TR 通过')).length)
const trPendingCount = computed(() => schemes.value.filter((s) => !s.trResult.startsWith('TR 通过')).length)

/** TR 结论标签配色：通过=绿，有条件通过=黄，其余=默认 */
function trZone(row: { trResult: string }): string {
  if (row.trResult.startsWith('TR 通过')) return 'ok'
  if (row.trResult.startsWith('TR 有条件')) return 'cond'
  return ''
}

function newSchemeVersion() {
  store.log('UPDATE', '技术方案', 'TS', { count: schemes.value.length })
  store.notify('info', '新建方案版本功能待接入（版本号将由方案版本规则自动递增）')
}
</script>

<style scoped>
.src-note { font-size: 12px; color: var(--text-3); }
</style>
