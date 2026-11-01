<template>
  <div>
    <PageHeader title="AI 智能辅助" desc="R1 六类场景规则型 RAG：检索前置过滤（越权命中 0）、结论带引用可溯、强制水印、三态复核、未复核不可入基线（AIA-001~007）">
      <template #actions>
        <el-button size="small" :type="aiSwitch.enabled ? 'success' : 'info'" @click="toggleProjectSwitch">{{ aiSwitch.enabled ? '项目 AI 已开启' : '项目 AI 已关闭' }}</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="AI 可用性" :value="aiSwitch.enabled ? '可用' : '不可用'" :zone="aiSwitch.enabled ? 'ok' : 'danger'" :sub="aiSwitch.reason" />
      <KpiCard label="可见语料" :value="aiCorpus.visible.length" unit="条" :zone="aiCorpus.filtered.length === 0 ? 'ok' : 'warn'" :sub="`越权剔除 ${aiCorpus.filtered.length} 条`" />
      <KpiCard label="调用日志" :value="aiCallLogs.length" unit="条" sub="三态复核留痕" />
      <KpiCard label="待复核" :value="aiCallLogs.filter((l) => l.reviewStatus === 'PENDING').length" unit="条" :zone="aiCallLogs.filter((l) => l.reviewStatus === 'PENDING').length === 0 ? 'ok' : 'warn'" sub="未复核不可入基线" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start; margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">六类场景（AIA-002）</div>
        <div class="scene-list">
          <div v-for="s in scenes" :key="s" class="scene-item" :class="{ active: scene === s }" @click="scene = s">
            <span class="tag">{{ sceneMeta[s].tag }}</span>
            <span class="nm">{{ s }}</span>
          </div>
        </div>
        <div style="margin-top: 8px">
          <el-input v-model="query" size="small" :placeholder="`输入检索词（当前场景：${scene}）`" clearable @keyup.enter="runScene" />
          <el-button size="small" type="primary" style="margin-top: 8px" :disabled="!aiSwitch.enabled" @click="runScene">执行预审</el-button>
        </div>
        <div v-if="lastResult" class="result-box" style="margin-top: 10px">
          <div class="rrow" style="grid-template-columns: 1fr auto">
            <span class="nm">{{ lastResult.watermarkText }}</span>
            <span class="tag" :class="lastResult.output.confidence === '高' ? 'ok' : lastResult.output.confidence === '中' ? 'warn' : 'fail'">{{ lastResult.output.confidence }}</span>
          </div>
          <div v-if="lastResult.output.citations.length" style="margin-top: 6px">
            <div class="src-note">依据引用（可溯）：</div>
            <div v-for="c in lastResult.output.citations" :key="c.objId" class="cite">
              <span class="mono">{{ c.objId }}</span><span class="tag">v{{ c.version }}</span><span class="mono" style="color: var(--text-3)">{{ c.objType }}</span>
            </div>
          </div>
        </div>
        <div v-if="lastError" class="result-box" style="margin-top: 10px; border-color: #f87171">
          <span style="color: #f87171">{{ lastError }}</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">调用日志与复核工作流（AIA-005/006）</div>
        <el-table :data="aiCallLogs" size="small" height="360">
          <el-table-column prop="id" label="日志" width="110" />
          <el-table-column prop="sceneCode" label="场景" min-width="110" />
          <el-table-column label="引用" width="70"><template #default="{ row }"><span class="mono">{{ row.citedIds.length }}</span></template></el-table-column>
          <el-table-column label="状态" width="80"><template #default="{ row }"><span class="tag" :class="statusClass(row.reviewStatus)">{{ statusLabel(row.reviewStatus) }}</span></template></el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <template v-if="row.reviewStatus === 'PENDING'">
                <el-button size="small" type="success" @click="review(row.id, 'ACCEPT')">采纳</el-button>
                <el-button size="small" type="danger" @click="review(row.id, 'REJECT')">驳回</el-button>
              </template>
              <span v-else class="mono" style="color: var(--text-3)">{{ row.reviewerId || '—' }}</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          未复核（待复核）或已驳回的产出<b>不得入基线</b>（AIA-006）；采纳/驳回均生成 <span class="mono">AI_REVIEW</span> 审计事件。
          全部输出强制带「AI 生成·待复核」水印（AIA-004），AI 仅作预审提示，不替代人工放行判断。
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">红线与两级开关说明（AIA-007 / SRS 24.6）</div>
      <div class="src-note">
        两级 AI 开关采用<b>三级优先级</b>：① 总开关（关闭则所有 AI 入口不可用，临时开启也不能凌驾）→ ② 项目级开关 → ③ 临时开启（须填理由与有效期，<b>到期自动关闭</b>）。
        红线：AI 不得自动批准任何门禁/评审/变更结论；不得在无引用下生成安全相关结论；未复核产出不得纳入交付物。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { AI_SCENES, type AiScene, type AiSceneOutput } from '@/domain/aiAssist'

const store = useAppStore()
const scene = ref<AiScene>('需求检索问答')
const query = ref('')
const lastResult = ref<{ output: AiSceneOutput; watermarkText: string } | null>(null)
const lastError = ref('')

const scenes = AI_SCENES
const sceneMeta: Record<AiScene, { tag: string }> = {
  需求检索问答: { tag: 'P0' },
  追溯断链提示: { tag: 'P0' },
  需求质量体检: { tag: 'P0' },
  ECR影响预判: { tag: 'P0' },
  Gate材料预审: { tag: 'P0' },
  冲突检测: { tag: 'P0' }
}

const aiSwitch = computed(() => store.aiSwitchState)
const aiCorpus = computed(() => store.aiVisibleCorpus)
const aiCallLogs = computed(() => store.aiCallLogs)

const statusClass = (s: string) => (s === 'ACCEPTED' ? 'ok' : s === 'REJECTED' ? 'fail' : 'warn')
const statusLabel = (s: string) => (s === 'ACCEPTED' ? '已采纳' : s === 'REJECTED' ? '已驳回' : '待复核')

function runScene() {
  lastError.value = ''
  lastResult.value = null
  const r = store.runAiScene(scene.value, query.value.trim())
  if (r.ok) {
    lastResult.value = { output: r.output!, watermarkText: r.watermarkText! }
  } else {
    lastError.value = r.reason || '执行失败'
  }
}

function review(logId: string, action: 'ACCEPT' | 'REJECT') {
  store.reviewAi(logId, action)
}

function toggleProjectSwitch() {
  store.toggleAiSwitch(store.projectId, !aiSwitch.value.enabled)
}
</script>

<style scoped>
.scene-list { display: flex; flex-wrap: wrap; gap: 6px; }
.scene-item { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--bg-3); border-radius: 6px; cursor: pointer; font-size: 12px; }
.scene-item.active { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.scene-item .nm { color: var(--text-2); }
.result-box { border: 1px solid var(--bg-3); border-radius: 6px; padding: 10px; }
.cite { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; }
.rrow { display: grid; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed var(--bg-3); font-size: 12px; }
.rrow .nm { color: var(--text-2); }
</style>
