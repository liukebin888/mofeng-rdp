<template>
  <div>
    <PageHeader title="计划变更" desc="双轨计划（基线计划 / 当前计划）与变更留痕：变更须评估对基线、门禁、追溯的影响（C-46 纠偏回写）">
      <template #actions>
        <el-button size="small" type="primary" @click="submitChange">提交变更申请</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="变更申请" :value="changes.length" unit="项" />
      <KpiCard label="待审批" :value="pendingCount" unit="项" :zone="pendingCount ? 'warn' : 'ok'" />
      <KpiCard label="已批准" :value="approvedCount" unit="项" zone="ok" />
      <KpiCard label="基线计划冻结" :value="store.currentProject.planFrozen ? '已冻结' : '未冻结'" :zone="store.currentProject.planFrozen ? 'ok' : 'warn'" sub="冻结后变更须走 ECR" />
    </div>

    <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">变更申请台账（留痕）</div>
        <el-table :data="changes" size="small">
          <el-table-column prop="code" label="编号" width="100" />
          <el-table-column prop="title" label="变更内容" min-width="180" />
          <el-table-column prop="impact" label="影响范围" width="120" />
          <el-table-column prop="status" label="状态" width="80"><template #default="{ row }"><span class="tag" :class="row.status === '已批准' ? 'ok' : row.status === '待审批' ? 'cond' : 'fail'">{{ te(row.status) }}</span></template></el-table-column>
          <el-table-column prop="by" label="申请人" width="80" />
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          双轨计划：基线计划不可变，当前计划可调；偏差由 C-46 控制点监控，纠偏措施须回写计划并重算偏差。
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">变更影响评估（须逐项确认）</div>
        <div v-for="d in impactDims" :key="d" class="rrow">
          <span>{{ d }}</span>
          <span class="tag" :class="d === '安全影响' ? 'cond' : 'ok'">{{ d === '安全影响' ? '须安全经理签' : '已评估' }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          变更影响闭包完整性由 ECR 引擎保证（change.ts），安全影响须独立签署（SOD-02）。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()

const impactDims = ['范围', '进度', '成本', '质量', '安全影响']

const changes = ref([
  { code: 'CHG-0011', title: 'MCU 交期延长，B 样件计划顺延 6 周', impact: '进度/交付', status: '待审批', by: '郑昊' },
  { code: 'CHG-0012', title: '刷写验签算法优化，产线节拍恢复', impact: '成本/工艺', status: '已批准', by: '顾晨' },
  { code: 'CHG-0013', title: 'OTS 台架排期冲突，试验顺延 2 周', impact: '进度', status: '待审批', by: '冯磊' }
])

const pendingCount = computed(() => changes.value.filter((c) => c.status === '待审批').length)
const approvedCount = computed(() => changes.value.filter((c) => c.status === '已批准').length)

function submitChange() {
  store.log('SUBMIT', '计划变更', 'CHG', { count: changes.value.length })
  store.notify('info', '计划变更须走 ECR 流程并做影响闭包评估，本演示登记留痕')
}
</script>

<style scoped>
.rrow { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed var(--line); font-size: 12.5px; }
</style>
