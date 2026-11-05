<template>
  <div>
    <PageHeader title="计划告警" desc="四段式时点告警（S1 提醒 → S2 预警 → S3 报警 → S4 抱怨）：逐节点判定、阶段跃迁去重、幂等登记，投递渠道/接收人留痕不虚假发送">
      <template #actions>
        <el-button type="primary" :loading="scanning" @click="doScan">立即巡检</el-button>
      </template>
    </PageHeader>

    <!-- 中间指标披露：防「零告警」假阳性 -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="扫描节点" :value="scanResult?.scannedNodes ?? '—'" unit="个" sub="巡检覆盖的已落表节点" />
      <KpiCard label="命中告警" :value="scanResult?.hitNodes ?? '—'" unit="个" :zone="(scanResult?.hitNodes ?? 0) ? 'danger' : 'ok'" sub="进入告警窗口的节点" />
      <KpiCard label="新发告警" :value="scanResult?.fired ?? '—'" unit="条" :zone="(scanResult?.fired ?? 0) ? 'warn' : 'ok'" sub="本次幂等登记（阶段跃迁去重后）" />
      <KpiCard label="幂等跳过" :value="scanResult?.skipped ?? '—'" unit="条" sub="阶段已发过而跳过" />
    </div>

    <div v-if="!scanned" class="panel empty-panel">
      <el-empty description="点击「立即巡检」触发四段式告警扫描" :image-size="80" />
    </div>

    <div v-else class="panel">
      <div class="panel-title">
        巡检结果
        <span class="muted" style="font-size: 11px; margin-left: 8px">基准日 {{ scanResult?.today ?? '—' }} · 项目 {{ scanResult?.projectId ?? '—' }}</span>
      </div>

      <div v-if="scanResult && scanResult.scannedNodes === 0" class="note">
        本次扫描 0 个节点（项目尚无已落表的四级计划），「零告警」不代表无风险——请先在「项目主计划」提交并落表四级计划节点。
      </div>

      <div v-else-if="scanResult && !scanResult.items.length" class="ok-box">
        扫描 {{ scanResult.scannedNodes }} 个节点，无命中告警窗口（S1~S4 均未触发）。
      </div>

      <el-table v-else :data="scanResult?.items ?? []" size="small" style="width: 100%">
        <el-table-column label="阶段" width="72">
          <template #default="{ row }">
            <span class="tag" :class="stageClass(row.stage)">{{ row.stage }}</span>
          </template>
        </el-table-column>
        <el-table-column label="级别" width="90">
          <template #default="{ row }"><span class="level" :class="row.level.toLowerCase()">{{ levelText(row.level) }}</span></template>
        </el-table-column>
        <el-table-column prop="planLevel" label="层级" width="64" />
        <el-table-column prop="objId" label="对象" min-width="120" show-overflow-tooltip />
        <el-table-column label="距到期" width="90">
          <template #default="{ row }">
            <span :class="row.remainDays < 0 ? 'overdue' : ''">{{ row.remainDays >= 0 ? `还有 ${row.remainDays} 天` : `已逾期 ${-row.remainDays} 天` }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="receiverIds" label="接收人" min-width="140" show-overflow-tooltip />
        <el-table-column prop="channelMask" label="投递渠道" min-width="140" show-overflow-tooltip />
        <el-table-column label="PRR" width="72">
          <template #default="{ row }"><span v-if="row.prrTriggered" class="tag danger">PRR</span><span v-else class="muted">—</span></template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import type { PlanAlertScanData } from '@/infra/apiV1'

const store = useAppStore()
const scanning = ref(false)
const scanned = ref(false)
const scanResult = ref<PlanAlertScanData | null>(null)

function stageClass(stage: string): string {
  // 复用全局 .tag.ok/.tag.cond/.tag.fail；S4 用自定义 danger 深红（scoped 定义）
  return { S1: 'ok', S2: 'cond', S3: 'fail', S4: 'danger' }[stage] ?? ''
}

function levelText(level: string): string {
  return { NORMAL: '提醒', URGENT: '预警', CRITICAL: '报警' }[level] ?? level
}

async function doScan() {
  scanning.value = true
  try {
    const r = await store.scanPlanAlerts()
    scanned.value = true
    if (r) {
      scanResult.value = r
      store.notify('success', `巡检完成：扫描 ${r.scannedNodes} 节点，命中 ${r.hitNodes}，新发告警 ${r.fired} 条`)
    }
  } finally {
    scanning.value = false
  }
}
</script>

<style scoped>
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.empty-panel { display: flex; flex-direction: column; align-items: center; padding: 40px 0; }
.note { padding: 10px 12px; border: 1px solid #5b3c14; background: #2a1f10; color: #ffd79a; border-radius: 6px; font-size: 12px; line-height: 1.6; }
.ok-box { padding: 10px 12px; border: 1px solid #1d4a2e; background: #0f2418; color: #8ee6b0; border-radius: 6px; font-size: 12px; }
.muted { color: var(--text-3); }
.level { font-weight: 600; }
.level.normal { color: #8ee6b0; }
.level.urgent { color: #ffd79a; }
.level.critical { color: #f87171; }
.overdue { color: #f87171; font-weight: 600; }
.tag.danger { background: #2a1114; color: #ffb4b4; border-color: #5b2020; }
</style>
