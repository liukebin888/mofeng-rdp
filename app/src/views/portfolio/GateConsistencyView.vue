<template>
  <div>
    <PageHeader
      title="组合闸门一致性"
      desc="PFM-011：同一 Gate 在不同项目适用同一判据集，例外须登记——否则「谁的项目松谁先过」，组合排序失去意义。判据集版本统一 + 例外登记完整 + 合规率可复算。"
    />

    <!-- 合规率中间指标披露 -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="校验组合数" :value="summary.total ?? '—'" unit="项" sub="项目 × 闸门判据集声明" />
      <KpiCard label="合规" :value="summary.compliant ?? '—'" unit="项" :zone="(summary.violating ?? 0) ? 'warn' : 'ok'" sub="版本一致 + 豁免已登记" />
      <KpiCard label="违规" :value="summary.violating ?? '—'" unit="项" :zone="(summary.violating ?? 0) ? 'danger' : 'ok'" sub="版本偏离 / 未登记豁免 / 自建判据" />
      <KpiCard label="合规率" :value="summary.complianceRate ?? '—'" unit="%" :zone="(summary.complianceRate ?? 100) >= 100 ? 'ok' : (summary.complianceRate ?? 100) >= 80 ? 'warn' : 'danger'" sub="可复算（纯函数）" />
    </div>

    <!-- 判据集版本统一性 -->
    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">
        判据集版本
        <span class="muted" style="font-size: 11px; margin-left: 8px">权威模板 {{ summary.authoritativeVersion ?? '—' }}</span>
      </div>
      <div v-if="versionAligned" class="ok-box">所有项目引用的判据集版本统一为 {{ summary.authoritativeVersion }}。</div>
      <div v-else class="note">
        检测到多个判据集版本：{{ summary.distinctVersions?.join('、') }}。存在项目引用非权威版本，其 Gate 判据与 PMO 权威模板不一致。
      </div>
    </div>

    <!-- 一致性明细表 -->
    <div class="panel">
      <div class="panel-title">一致性明细</div>
      <el-table :data="results" size="small" style="width: 100%">
        <el-table-column prop="projectName" label="项目" min-width="160" show-overflow-tooltip />
        <el-table-column prop="gate" label="闸门" width="64" />
        <el-table-column label="版本" width="140">
          <template #default="{ row }">
            <span :class="row.versionAligned ? '' : 'overdue'">{{ row.versionAligned ? '一致' : row.templateVersion + '（偏离）' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="违规类型" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.compliant" class="muted">—</span>
            <span v-else>
              <span v-if="row.unknownItems.length" class="tag danger">自建判据 {{ row.unknownItems.join(', ') }}</span>
              <span v-if="row.unregisteredExemptions.length" class="tag fail" style="margin-left: 4px">未登记豁免 {{ row.unregisteredExemptions.join(', ') }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="合规" width="72">
          <template #default="{ row }">
            <span class="tag" :class="row.compliant ? 'ok' : 'fail'">{{ row.compliant ? '合规' : '违规' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'

const store = useAppStore()

const summary = computed(() => store.gateConsistency.summary)
const results = computed(() => store.gateConsistency.results)
const versionAligned = computed(() => (summary.value.distinctVersions ?? []).length <= 1)
</script>

<style scoped>
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.muted { color: var(--text-3); }
.note { padding: 10px 12px; border: 1px solid #5b3c14; background: #2a1f10; color: #ffd79a; border-radius: 6px; font-size: 12px; line-height: 1.6; }
.ok-box { padding: 10px 12px; border: 1px solid #1d4a2e; background: #0f2418; color: #8ee6b0; border-radius: 6px; font-size: 12px; }
.overdue { color: #f87171; font-weight: 600; }
.tag.danger { background: #2a1114; color: #ffb4b4; border-color: #5b2020; }
</style>
