<template>
  <div>
    <PageHeader title="项目门户" desc="五区数据全部来自业务对象，区块不可手工填数（POR-001~003）；决定四视图同值（口径一致性 C-47）">
      <template #actions>
        <el-button size="small" @click="configVisible = true">区块配置</el-button>
      </template>
    </PageHeader>

    <div class="hero">
      <div>
        <div class="dim">{{ store.currentProject.code }}</div>
        <h3>{{ store.currentProject.name }}</h3>
        <div class="row" style="gap: 8px; margin-top: 6px">
          <span class="tag" :class="'l' + (store.currentProject.level || '4').slice(1)">{{ te(store.currentProject.level) }}</span>
          <span class="tag">{{ store.currentProject.customer }}</span>
          <span class="tag">负责人 {{ store.currentProject.owner }}</span>
          <span class="tag" :class="store.currentProject.health === '绿' ? 'ok' : store.currentProject.health === '红' ? 'fail' : 'cond'">{{ te(store.currentProject.health) }}灯</span>
        </div>
      </div>
      <div class="hstats">
        <div><span>加权完成率</span><b class="num">{{ store.completion.weightedPercent }}%</b></div>
        <div><span>SPI / CPI</span><b class="num">{{ store.evm.spi }} / {{ store.evm.cpi }}</b></div>
        <div><span>Gate 可放行</span><b class="num">{{ passedGates }}/5</b></div>
        <div><span>断链</span><b class="num" :style="{ color: store.traceBreaks.length ? '#f87171' : '#4ade80' }">{{ store.traceBreaks.length }}</b></div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1.2fr 1fr; margin-top: 12px; align-items: start">
      <div class="grid" style="gap: 12px">
        <div v-if="sec('progress')" class="panel">
          <div class="panel-title">进展区（S 曲线摘要）</div>
          <SvgLine :labels="curve.map((c) => 'W' + c.week)" :series="series" :height="170" />
        </div>

        <div v-if="sec('risk')" class="panel">
          <div class="panel-title">风险区（红区优先，数据来自风险台账）</div>
          <div v-for="r in store.projectRisks.slice(0, 4)" :key="r.id" class="prow">
            <span class="tag" :class="rpn(r) >= 200 ? 'fail' : 'cond'">RPN {{ rpn(r) }}</span>
            <span class="nm">{{ r.title }}</span>
            <span class="dim">{{ r.owner }}</span>
          </div>
        </div>

        <div v-if="sec('delivery')" class="panel">
          <div class="panel-title">交付区（缺件即阻断 Gate）</div>
          <div v-for="d in store.projectDeliverables.filter((x) => x.required && !x.provided)" :key="d.id" class="prow">
            <span class="tag fail">{{ d.gate }}</span>
            <span class="nm">{{ d.name }}</span>
            <span class="dim">缺件</span>
          </div>
          <el-empty v-if="!store.projectDeliverables.some((x) => x.required && !x.provided)" description="交付物齐套" :image-size="50" />
        </div>
      </div>

      <div class="grid" style="gap: 12px">
        <div v-if="sec('announce')" class="panel">
          <div class="panel-title">公告与变更通告</div>
          <div class="notice">ECR-2026-0042 旋变芯片替换进入 ECN 执行阶段，涉及软件配置字与 PPAP 二级提交。</div>
          <div class="notice">Gate3 评审结论为「有条件通过」，整改项 3 条，期限 2026-11-06。</div>
          <div class="notice">OTS 台架排期调整：DV 试验顺延 5 个工作日（见风险 RSK-024）。</div>
        </div>

        <div v-if="sec('meeting')" class="panel">
          <div class="panel-title">会议与决议（决议条目化转任务 COM-006/007）</div>
          <div v-for="m in store.projectMeetings" :key="m.id" class="mrow">
            <div class="between">
              <b>{{ m.title }}</b>
              <span class="tag" :class="m.status === '已归档' ? 'ok' : 'cond'">{{ te(m.status) }}</span>
            </div>
            <div class="dim">{{ m.date }} · 决议 {{ m.resolutions.length }} 条 · 主持 {{ m.host }}</div>
            <div v-if="m.resolutions.length" class="res">
              <div v-for="rid in m.resolutions" :key="rid" class="res-row">
                <ResolutionLine :resolution="resolutionById(rid)" @close="store.closeResolution(rid, $event)" />
              </div>
            </div>
          </div>
          <el-empty v-if="!store.projectMeetings.length" description="无会议记录" :image-size="50" />
        </div>

        <div v-if="sec('sendAudit')" class="panel">
          <div class="panel-title">送审件（送审与答复留痕 COM-001/002）</div>
          <div v-for="s in store.projectSendAudits" :key="s.id" class="mrow">
            <div class="between">
              <b>{{ s.title }} <span class="dim">v{{ s.version }}</span></b>
              <span class="tag" :class="s.status === '已答复' ? 'ok' : s.escalated ? 'fail' : 'cond'">{{ s.status === '已答复' ? '已答复' : s.escalated ? '已超期' : '待答复' }}</span>
            </div>
            <div class="dim">{{ s.reviewerType }}·{{ s.reviewer }} · 送审 {{ s.sentAt }} · 期限 {{ s.dueAt }}</div>
            <div v-if="s.answers.length" class="dim">答复：{{ s.answers[0].content }}（{{ s.answers[0].by }}）</div>
          </div>
          <el-empty v-if="!store.projectSendAudits.length" description="无送审件" :image-size="50" />
        </div>
      </div>
    </div>

    <el-dialog v-model="configVisible" title="门户区块配置（POR-003）" width="560px">
      <el-table :data="store.portalSections" size="small">
        <el-table-column prop="title" label="区块" width="140" />
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(v: boolean) => store.togglePortalSection(row.key, v)" />
          </template>
        </el-table-column>
        <el-table-column label="可见角色（空=所有角色）" min-width="200">
          <template #default="{ row }">
            <el-select :model-value="row.visibleRoles" multiple size="small" style="width: 100%" placeholder="所有角色" @change="(v: string[]) => store.setPortalSectionRoles(row.key, v)">
              <el-option v-for="r in roleOptions" :key="r.code" :value="r.code" :label="r.name" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">越权区块前端不渲染（数据亦不聚合）；关闭区块即当前角色看不到该区块。</div>
      <template #footer>
        <el-button size="small" @click="store.resetPortalSections()">恢复默认</el-button>
        <el-button size="small" type="primary" @click="configVisible = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import SvgLine from '@/components/SvgLine.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { rpn } from '@/domain/risk'
import { sCurve } from '@/domain/schedule'
import { ROLES } from '@/domain/rbac'
import type { PortalSectionKey, ResolutionItem } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const configVisible = ref(false)
const roleOptions = ROLES.map((r) => ({ code: r.code, name: r.name }))

/** POR-003：区块按当前角色可见（越权不渲染） */
function sec(key: PortalSectionKey): boolean {
  return store.myPortalSections.some((s) => s.key === key)
}

const passedGates = computed(() => Object.values(store.gateResults).filter((g) => g.passed).length)
const curve = computed(() => sCurve(store.projectWbs, 12, store.currentProject.budget, store.currentProject.spent))
const series = computed(() => [
  { name: 'PV', color: '#3b82f6', data: curve.value.map((c) => c.pv) },
  { name: 'EV', color: '#22c55e', data: curve.value.map((c) => c.ev) },
  { name: 'AC', color: '#f59e0b', data: curve.value.map((c) => c.ac) }
])

function resolutionById(id: string): ResolutionItem | undefined {
  return store.projectResolutions.find((r) => r.id === id)
}

// 决议行组件：展示条目 + 转任务/关闭动作（COM-007/008）
const ResolutionLine = defineComponent({
  props: { resolution: { type: Object as () => ResolutionItem | undefined, required: true } },
  emits: ['close'],
  setup(props, { emit }) {
    return () => {
      const r = props.resolution
      if (!r) return h('div', { class: 'dim' }, '决议已删除')
      return h('div', { class: 'res-line' }, [
        h('div', { class: 'between' }, [
          h('span', { class: 'mono' }, r.code),
          h('span', { class: 'tag ' + (r.status === '已闭环' ? 'ok' : r.status === '执行中' ? 'cond' : '') }, r.status)
        ]),
        h('div', { class: 'dim' }, `${r.content} · ${r.owner} · ${r.due}`),
        h('div', { class: 'res-acts' }, [
          r.status !== '已闭环' && !r.taskId
            ? h('button', { class: 'mini-btn', onClick: () => store.resolutionToTask(r.id) }, '转任务')
            : null,
          r.status === '执行中' || r.status === '待执行'
            ? h('button', { class: 'mini-btn', onClick: () => { const ev = window.prompt('填写关闭证据（无证据关闭被拒 COM-008）'); if (ev) emit('close', ev) } }, '关闭')
            : null
        ])
      ])
    }
  }
})
</script>

<style scoped>
.hero { display: flex; justify-content: space-between; gap: 20px; background: linear-gradient(120deg, #0d1b31, #0a1424); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
.hero h3 { margin: 4px 0 0; font-size: 20px; }
.hstats { display: grid; grid-template-columns: repeat(4, auto); gap: 20px; align-items: center; }
.hstats div { display: grid; gap: 3px; }
.hstats span { font-size: 10.5px; color: var(--text-3); }
.hstats b { font-size: 19px; }
.prow { display: grid; grid-template-columns: 76px 1fr 70px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.nm { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dim { color: var(--text-3); font-size: 10.5px; }
.notice { font-size: 11.5px; color: var(--text-2); line-height: 1.7; padding: 6px 0; border-bottom: 1px dashed #16233a; }
.mrow { padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.res { margin-top: 4px; padding-left: 6px; border-left: 2px solid #1e3a5f; }
.res-row { padding: 3px 0; }
.res-line { padding: 4px 0; }
.res-acts { display: flex; gap: 6px; margin-top: 4px; }
.mini-btn { font-size: 11px; padding: 2px 8px; border: 1px solid var(--line); border-radius: 4px; background: #16233a; color: var(--text-1); cursor: pointer; }
.mini-btn:hover { border-color: #3b82f6; }
.mono { font-family: monospace; font-size: 11px; color: var(--text-2); }
</style>
