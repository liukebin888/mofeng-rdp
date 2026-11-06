<template>
  <div>
    <PageHeader title="流程管理（APQP）" desc="APQP（先期产品质量策划）五阶段流程是项目主计划固定节点的权威来源。主计划模板 A/B/C/D 由本流程节点按裁剪规则裁剪而来：A 骨架级 → B 控制级 → C 核心专项级 → D 全专项级。">
      <template #actions>
        <el-button size="small" @click="activeTab = 'flow'">查看流程</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="APQP 阶段" :value="APQP_PHASES.length" unit="个" sub="计划定义→产品设计→过程设计→确认→反馈" />
      <KpiCard label="流程节点" :value="APQP_NODES.length" unit="个" sub="里程碑 / 闸门 / 活动" />
      <KpiCard label="里程碑" :value="milestoneCount" unit="个" sub="L1 客户计划节点" zone="brand" />
      <KpiCard label="主计划模板" value="4" unit="套" sub="A / B / C / D 四套裁剪模板" />
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- ① APQP 流程节点 -->
      <el-tab-pane label="① APQP 流程" name="flow">
        <div class="muted" style="margin-bottom: 10px">
          APQP 五阶段流程（{{ APQP_FLOW.name }}，v{{ APQP_FLOW.version }}）。节点按「阶段 → 类型 → 层级」组织，层级映射：L1 客户里程碑 / L2 阶段闸门 / L3 项目控制活动 / L4 专项计划。
        </div>
        <div v-for="p in phaseList" :key="p.code" class="phase-block">
          <div class="phase-head">
            <span class="phase-badge">{{ p.code }}</span>
            <span class="phase-name">{{ p.name }}</span>
            <span v-if="p.gateCode" class="tag ok">闸门 {{ p.gateCode }}</span>
          </div>
          <el-table :data="phaseNodes(p.code)" size="small" border>
            <el-table-column label="类型" width="90" align="center">
              <template #default="{ row }">
                <span class="tag" :class="kindCls(row.kind)">{{ kindLabel(row.kind) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="code" label="编码" width="110">
              <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column prop="name" label="节点名称" min-width="180" />
            <el-table-column label="层级" width="70" align="center">
              <template #default="{ row }">
                <span class="level-badge" :class="row.level.toLowerCase()">{{ row.level }}</span>
              </template>
            </el-table-column>
            <el-table-column label="专项线" width="110">
              <template #default="{ row }">
                <span v-if="row.specialty" class="dim">{{ row.specialty }}</span>
                <span v-else class="dim">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="defaultOwnerRole" label="默认责任角色" width="120" />
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ② 主计划模板裁剪 -->
      <el-tab-pane label="② 主计划模板（A/B/C/D）" name="template">
        <div class="muted" style="margin-bottom: 10px">
          四套主计划模板由 APQP 流程节点裁剪而来。裁剪规则（APQ-003）：A 仅里程碑+闸门 → B 加项目控制活动 → C 加核心四大线专项 → D 全部专项。
        </div>
        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px; align-items: start">
          <div v-for="t in tmplMetas" :key="t.kind" class="panel tmpl-card" :class="`tmpl-${t.kind.toLowerCase()}`">
            <div class="panel-title">
              {{ t.name }}
              <span class="tag ok" style="margin-left: 6px">{{ t.nodeCount }} 节点</span>
            </div>
            <div class="muted" style="font-size: 12px; margin-bottom: 8px">{{ t.desc }}</div>
            <div v-for="n in nodesOf(t.kind)" :key="n.id" class="tmpl-node">
              <span class="level-badge" :class="n.level.toLowerCase()">{{ n.level }}</span>
              <span class="mono tmpl-code">{{ n.code }}</span>
              <span class="tmpl-name">{{ n.name }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { APQP_FLOW, APQP_PHASES, APQP_NODES, orderedPhases as orderedPhasesOf, nodesByPhase as nodesByPhaseOf, type ApqpNodeKind } from '@/domain/apqpFlow'
import { templateMetas as templateMetasOf, templateNodesOf, type PlanTemplateKind } from '@/domain/planTemplate'

const activeTab = ref('flow')

const milestoneCount = computed(() => APQP_NODES.filter((n) => n.milestone).length)
const phaseList = computed(() => orderedPhasesOf(APQP_FLOW))
const tmplMetas = computed(() => templateMetasOf(APQP_FLOW))

function phaseNodes(phase: string) {
  return nodesByPhaseOf(APQP_FLOW, phase)
}

function nodesOf(kind: PlanTemplateKind) {
  return templateNodesOf(kind, APQP_FLOW)
}

function kindLabel(kind: ApqpNodeKind): string {
  return { phase: '阶段', gate: '闸门', activity: '活动', milestone: '里程碑' }[kind]
}

function kindCls(kind: ApqpNodeKind): string {
  return { phase: 'info', gate: 'warn', activity: 'ok', milestone: 'brand' }[kind]
}
</script>

<style scoped>
.phase-block { margin-bottom: 14px; }
.phase-head { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--line); margin-bottom: 6px; }
.phase-badge { display: inline-block; min-width: 30px; text-align: center; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; background: #1d3a5f; color: #93c5fd; }
.phase-name { font-size: 14px; font-weight: 600; color: var(--text-1); }
.level-badge { display: inline-block; min-width: 24px; text-align: center; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
.level-badge.l1 { background: #5b1a1a; color: #fca5a5; }
.level-badge.l2 { background: #5b3c14; color: #ffd79a; }
.level-badge.l3 { background: #1d3a5f; color: #93c5fd; }
.level-badge.l4 { background: #1d4a2e; color: #8ee6b0; }
.tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.tag.ok { color: #8ee6b0; border: 1px solid #1d4a2e; background: #0f2418; }
.tag.warn { color: #ffd79a; border: 1px solid #5b3c14; background: #2a1f10; }
.tag.info { color: #93c5fd; border: 1px solid #1d3a5f; background: #101c30; }
.tag.brand { color: #c4b5fd; border: 1px solid #3b2a6b; background: #1d1535; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--text-3); }
.muted { color: var(--text-3); }
.dim { color: var(--text-3); font-size: 12px; }
.tmpl-card { border-left: 3px solid var(--line); }
.tmpl-a { border-left-color: #64748b; }
.tmpl-b { border-left-color: #3b82f6; }
.tmpl-c { border-left-color: #8b5cf6; }
.tmpl-d { border-left-color: #10b981; }
.tmpl-node { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.tmpl-code { min-width: 74px; }
.tmpl-name { color: var(--text-1); }
</style>
