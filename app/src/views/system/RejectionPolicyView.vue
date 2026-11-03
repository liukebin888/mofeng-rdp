<template>
  <div>
    <PageHeader title="服务端拒绝拦截策略" desc="三档可配置（SRP-001/002）：硬拒绝 / 可配置拒绝 / 只读披露，按问题事项逐项自定义，不搞一刀切">
      <template #actions>
        <el-button size="small" type="primary" @click="store.persist()">保存配置</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="硬拒绝" :value="store.rejectionSummary.HARD" unit="项" sub="fail-closed，不可配置关闭" zone="danger" />
      <KpiCard label="可配置拒绝" :value="store.rejectionSummary.CONFIGURABLE" unit="项" sub="读模板/审批链配置字段" zone="warn" />
      <KpiCard label="只读披露" :value="store.rejectionSummary.DISCLOSE" unit="项" sub="不拦截，仅返回状态提示" zone="brand" />
      <KpiCard label="问题事项合计" :value="store.rejectionPolicies.length" unit="项" sub="5 组 16 项全覆盖" />
    </div>

    <div class="src-note" style="margin-bottom: 12px">
      三档拦截语义：<b>硬拒绝</b> = 数据完整性/底线合规，服务端 fail-closed 不可关闭；
      <b>可配置拒绝</b> = 管控严格度由阶段模板/审批链配置字段决定，此处可改字段值；
      <b>只读披露</b> = 服务端不拦截，仅提示。修改即生效并审计留痕，规则只对新数据生效。
    </div>

    <div v-for="g in groups" :key="g" class="panel" style="margin-bottom: 12px">
      <div class="panel-title">{{ g }}（{{ itemsOf(g).length }} 项）</div>
      <el-table :data="itemsOf(g)" size="small">
        <el-table-column prop="id" label="编号" width="64">
          <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="问题事项" min-width="200" />
        <el-table-column prop="basis" label="引擎依据" min-width="180">
          <template #default="{ row }"><span class="mono dim">{{ row.basis }}</span></template>
        </el-table-column>
        <el-table-column label="拦截档位" width="220">
          <template #default="{ row }">
            <el-select
              :model-value="row.severity"
              size="small"
              style="width: 130px"
              :disabled="row.locked"
              @update:model-value="(v: string | number | boolean | undefined) => change(row, v as RejectionSeverity)"
            >
              <el-option label="硬拒绝" value="HARD" />
              <el-option label="可配置拒绝" value="CONFIGURABLE" />
              <el-option label="只读披露" value="DISCLOSE" />
            </el-select>
            <span v-if="row.locked" class="tag fail" style="margin-left: 4px" :title="'数据完整性底线，不可降档'">锁定</span>
          </template>
        </el-table-column>
        <el-table-column label="配置字段 / 值" min-width="200">
          <template #default="{ row }">
            <template v-if="row.severity === 'CONFIGURABLE' && row.field">
              <span class="mono">{{ row.field }}</span>
              <span class="dim" style="margin: 0 4px">=</span>
              <el-select
                v-if="row.fieldOptions && row.fieldOptions.length"
                :model-value="String(row.fieldValue)"
                size="small"
                style="width: 90px"
                @update:model-value="(v: string | number | boolean | undefined) => change(row, 'CONFIGURABLE', String(v))"
              >
                <el-option v-for="o in row.fieldOptions" :key="o" :label="o" :value="o" />
              </el-select>
              <span v-else class="tag ok">{{ row.fieldValue }}</span>
            </template>
            <span v-else class="dim">—</span>
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
import { REJECTION_GROUPS, SEVERITY_META, type RejectionPolicyItem, type RejectionSeverity } from '@/domain/rejectionPolicy'

const store = useAppStore()
const groups = REJECTION_GROUPS

function itemsOf(g: string) {
  return store.rejectionPolicies.filter((p) => p.group === g)
}

function change(row: RejectionPolicyItem, severity: RejectionSeverity, fieldValue?: string) {
  store.updateRejectionPolicy(row.id, severity, fieldValue)
}

const _meta = SEVERITY_META // 保持引用（供未来扩展展示）
</script>

<style scoped>
.dim { color: var(--text-3); font-size: 12px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tag.fail { background: #3a1d1d; color: #f87171; border: 1px solid #5b2b2b; }
.tag.ok { background: #14301f; color: #4ade80; border: 1px solid #1d4a2e; }
</style>
