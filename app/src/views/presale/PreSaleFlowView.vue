<template>
  <div>
    <PageHeader title="项目前期审批流程" desc="三条审批主线次序固定（前期交申请 → 报价 → 立项申请），每条均为独立审批流；部门会签须全部签署方通过">
      <template #actions>
        <el-select v-model="launchDefId" size="small" placeholder="选择要发起的流程" style="width: 190px; margin-right: 8px">
          <el-option v-for="d in presaleDefs" :key="d.id" :label="`${d.order}. ${d.name}`" :value="d.id" />
        </el-select>
        <el-button size="small" type="primary" @click="launch">发起流程</el-button>
      </template>
    </PageHeader>

    <!-- 三条流程次序总览 -->
    <div class="grid grid-3" style="margin-bottom: 12px">
      <div v-for="d in presaleDefs" :key="d.id" class="panel" :class="{ active: launchDefId === d.id }">
        <div class="panel-title">{{ d.order }}. {{ d.name }}</div>
        <div class="stage-flow">
          <template v-for="(n, i) in d.def.nodes" :key="n.id">
            <span v-if="i" class="arrow">→</span>
            <span class="stage-tag" :class="{ sign: n.type === 'sign', end: n.type === 'end' }">{{ n.name }}</span>
          </template>
        </div>
        <div class="dim" style="margin-top: 6px">
          <span v-if="d.order === 1">市场客户经理发起 → 市场总监审核 → 三中心总监会签 → 总经理批准</span>
          <span v-else-if="d.order === 2">四角色并行填报 → 财务汇总核对 → 总经理批准报价</span>
          <span v-else>市场客户经理发起 → 市场总监审核 → 八部门会签 → 总经理批准</span>
        </div>
      </div>
    </div>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="运行中" :value="running.length" unit="单" :zone="running.length ? 'brand' : 'ok'" />
      <KpiCard label="已走完" :value="finished.length" unit="单" :zone="finished.length ? 'ok' : 'ok'" />
      <KpiCard label="会签节点" :value="signNodes" unit="个" sub="全签方通过" />
      <KpiCard label="当前身份" :value="store.currentUser.roleName" sub="可切换角色模拟会签" />
    </div>

    <!-- 审批列表 -->
    <div class="panel">
      <div class="panel-title">前期流程实例（次序固定：前期交 → 报价 → 立项）</div>
      <el-table :data="rows" size="small">
        <el-table-column prop="defCode" label="流程" width="110">
          <template #default="{ row }">
            <span class="tag" :class="row.order === 1 ? 'cond' : row.order === 2 ? 'brand' : 'ok'">{{ row.defName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column label="当前节点" width="150">
          <template #default="{ row }"><span class="tag" :class="row.status === '已完成' ? 'ok' : 'cond'">{{ row.view.node?.name ?? '—' }}</span></template>
        </el-table-column>
        <el-table-column label="进度" min-width="160">
          <template #default="{ row }">
            <span class="dim">{{ passedCount(row) }}/{{ row.def?.nodes.length ?? 0 }} 节点</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><span class="tag" :class="row.status === '已完成' ? 'ok' : row.status === '已驳回' ? 'fail' : 'cond'">{{ row.status }}</span></template>
        </el-table-column>
        <el-table-column label="操作" min-width="230">
          <template #default="{ row }">
            <template v-if="row.status === '运行中'">
              <template v-if="row.view.node?.type === 'sign'">
                <el-select v-model="signRole[row.id]" size="small" placeholder="选角色会签" style="width: 120px; margin-right: 4px">
                  <el-option v-for="r in remainingSignRoles(row)" :key="r" :label="r" :value="r" />
                </el-select>
                <el-button link size="small" type="primary" @click="sign(row)">会签</el-button>
              </template>
              <template v-else>
                <el-button link size="small" type="primary" @click="approve(row)">通过</el-button>
                <el-button link size="small" type="danger" @click="reject(row)">驳回</el-button>
              </template>
            </template>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!rows.length" description="暂无前期流程实例" :image-size="54" />
    </div>

    <!-- 会签进度明细 -->
    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">会签进度（已签署角色 / 待签角色）</div>
        <div v-for="f in signInstances" :key="f.id" class="mrow">
          <span class="mono">{{ f.id }}</span>
          <span class="nm">{{ f.view.node?.name }}</span>
          <span class="dim">{{ signedRoles(f).join('、') || '尚未签署' }}</span>
        </div>
        <el-empty v-if="!signInstances.length" description="当前无会签中的节点" :image-size="44" />
      </div>
      <div class="panel">
        <div class="panel-title">次序约束说明</div>
        <div class="kv"><span>次序固定</span><em>前期交申请 → 报价 → 立项申请，不可颠倒</em></div>
        <div class="kv"><span>每流程独立</span><em>各自完整审批链，互不合并</em></div>
        <div class="kv"><span>会签规则</span><em>部门会签全通过方推进（signMode: all）</em></div>
        <div class="kv"><span>并行填报</span><em>报价四角色（电子/结构/工艺/采购）并行，全部完成后财务汇总</em></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import type { FlowInstance } from '@/domain/flowEngine'

const store = useAppStore()
const { te } = useI18n()
void te

const launchDefId = ref<string>('')
const signRole = reactive<Record<string, string>>({})

// 三条前期流程（按次序）
const presaleDefs = computed(() => {
  const order = ['DEF-PRE-1', 'DEF-PRE-2', 'DEF-PRE-3']
  return order
    .map((id, i) => {
      const def = store.flowDefinitions.find((d) => d.id === id)
      return def ? { id, order: i + 1, name: def.name, def } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
})

// 仅取前期流程的实例
const presaleInstances = computed(() =>
  (store.data.flowInstances ?? []).filter((f) => ['DEF-PRE-1', 'DEF-PRE-2', 'DEF-PRE-3'].includes(f.defId))
)

const rows = computed(() =>
  presaleInstances.value.map((f) => {
    const pd = presaleDefs.value.find((d) => d.id === f.defId)
    return { ...f, def: pd?.def, defName: pd?.name ?? f.defCode, order: pd?.order ?? 0, view: store.flowView(f as FlowInstance) }
  })
)

const running = computed(() => rows.value.filter((r) => r.status === '运行中'))
const finished = computed(() => rows.value.filter((r) => r.status === '已完成'))
const signNodes = computed(() => running.value.filter((r) => r.view.node?.type === 'sign').length)
const signInstances = computed(() => running.value.filter((r) => r.view.node?.type === 'sign'))

function passedCount(row: (typeof rows.value)[number]) {
  return row.passedNodeIds.length
}

// 已签署的角色（从历史 counterSign 记录取）
function signedRoles(row: (typeof rows.value)[number]): string[] {
  const rec = row.history.find((h) => h.nodeId === row.currentNodeId && h.action === 'counterSign')
  return rec?.signatures?.filter((s) => s.pass).map((s) => s.role) ?? []
}

// 剩余待签角色
function remainingSignRoles(row: (typeof rows.value)[number]): string[] {
  const node = row.view.node
  const roles = node?.signRoles ?? []
  const signed = signedRoles(row)
  return roles.filter((r) => !signed.includes(r))
}

function launch() {
  const d = presaleDefs.value.find((x) => x.id === launchDefId.value)
  if (!d) {
    store.notify('warning', '请先选择要发起的流程')
    return
  }
  const titles: Record<string, string> = {
    'DEF-PRE-1': 'XX 客户项目前期交申请',
    'DEF-PRE-2': 'XX 客户项目报价',
    'DEF-PRE-3': 'XX 客户项目立项申请'
  }
  store.launchFlow(d.id, titles[d.id] ?? d.name, {})
}

function approve(row: (typeof rows.value)[number]) {
  store.approveFlow(row.id)
}

function reject(row: (typeof rows.value)[number]) {
  store.rejectFlow(row.id)
}

function sign(row: (typeof rows.value)[number]) {
  const role = signRole[row.id]
  if (!role) {
    store.notify('warning', '请先选择要会签的角色')
    return
  }
  store.signAsFlow(row.id, role)
  delete signRole[row.id]
}
</script>

<style scoped>
.stage-flow { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 10.5px; }
.arrow { color: var(--text-3); }
.stage-tag { padding: 2px 6px; border-radius: 4px; background: var(--bg-2); color: var(--text-2); }
.stage-tag.sign { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.stage-tag.end { background: rgba(74, 222, 128, 0.12); color: #4ade80; }
.active { outline: 1px solid var(--brand, #4f8cff); }
.mrow { display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kv { display: grid; grid-template-columns: 90px 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; }
</style>
