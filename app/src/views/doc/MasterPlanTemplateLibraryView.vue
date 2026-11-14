<template>
  <div>
    <PageHeader title="主计划模板库" desc="四套项目主计划模板（A/B/C/D），由 APQP 五阶段流程节点按裁剪规则裁剪而来，是「新建项目主计划」的固定节点骨架权威来源。B/C/D 模板已融合 APQP 清单的 59 项活动与 175 条输出物。" />

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 14px; align-items: start">
      <div v-for="t in metas" :key="t.kind" class="panel tmpl-card" :class="`tmpl-${t.kind.toLowerCase()}`">
        <div class="panel-title">
          {{ t.name }}
          <span class="tag ok" style="margin-left: 6px">{{ t.nodeCount }} 节点</span>
          <span v-if="t.kind !== 'A'" class="tag brand" style="margin-left: 4px">{{ actCountOf(t.kind) }} 活动</span>
          <span v-if="t.kind !== 'A'" class="tag info" style="margin-left: 4px">{{ delivCountOf(t.kind) }} 输出物</span>
        </div>
        <div class="muted" style="font-size: 12px; margin-bottom: 10px">{{ t.desc }}</div>

        <!-- 骨架节点（里程碑/闸门/L4 专项） -->
        <div class="lane-note">骨架节点（里程碑 / 闸门 / 专项）</div>
        <div class="node-list node-list-compact">
          <div v-for="n in skeletonNodes(t.kind)" :key="n.id" class="tmpl-node">
            <span class="level-badge" :class="n.level.toLowerCase()">{{ n.level }}</span>
            <span class="mono tmpl-code">{{ n.code }}</span>
            <span class="tmpl-name">{{ n.name }}</span>
            <span v-if="n.specialty" class="dim">{{ n.specialty }}</span>
          </div>
        </div>

        <!-- 八门分组（CG0~CG7）：清单活动 + 输出物 -->
        <template v-if="t.kind !== 'A'">
          <div class="lane-note">八门分组（CG 质量门 · 清单活动）</div>
          <div v-for="g in gatesIn(t.kind)" :key="g.code" class="gate-block">
            <div class="gate-head">
              <span class="gate-badge">{{ g.code }}</span>
              <span class="gate-name">{{ g.name }}</span>
              <span class="dim">{{ gateActCount(t.kind, g.code) }} 活动 · {{ gateDelivCount(t.kind, g.code) }} 输出物</span>
            </div>
            <div v-for="n in gateNodes(t.kind, g.code)" :key="n.id" class="act-node">
              <span class="mono act-code">{{ n.code }}</span>
              <span class="act-name">{{ n.name }}</span>
              <span class="act-deliv">{{ n.deliverables?.length ?? 0 }} 输出物</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { templateMetas, type PlanTemplateKind } from '@/domain/planTemplate'
import { cutNodes, APQP_FLOW, CG_GATES, type ApqpNode } from '@/domain/apqpFlow'

const metas = computed(() => templateMetas())

/** 某模板的裁剪节点 */
const nodesOf = (k: PlanTemplateKind) => cutNodes(APQP_FLOW, k)

/** 骨架节点：里程碑 / 闸门 / L4 专项（不含清单 L3 活动） */
function skeletonNodes(k: PlanTemplateKind): ApqpNode[] {
  return nodesOf(k).filter((n) => n.level !== 'L3')
}

/** 某模板含清单活动的质量门（按 CG 顺序） */
function gatesIn(k: PlanTemplateKind): typeof CG_GATES {
  const codes = new Set(
    nodesOf(k).filter((n) => n.gateCode && n.deliverables?.length).map((n) => n.gateCode!)
  )
  return CG_GATES.filter((g) => codes.has(g.code))
}

/** 某模板下某质量门的清单活动节点 */
function gateNodes(k: PlanTemplateKind, gateCode: string): ApqpNode[] {
  return nodesOf(k).filter((n) => n.gateCode === gateCode)
}

function gateActCount(k: PlanTemplateKind, gateCode: string): number {
  return gateNodes(k, gateCode).length
}

function gateDelivCount(k: PlanTemplateKind, gateCode: string): number {
  return gateNodes(k, gateCode).reduce((s, n) => s + (n.deliverables?.length ?? 0), 0)
}

/** 某模板清单活动总数 */
function actCountOf(k: PlanTemplateKind): number {
  return nodesOf(k).filter((n) => n.gateCode && n.deliverables?.length).length
}

/** 某模板输出物总数 */
function delivCountOf(k: PlanTemplateKind): number {
  return nodesOf(k).reduce((s, n) => s + (n.deliverables?.length ?? 0), 0)
}
</script>

<style scoped>
.panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-1); padding: 14px 16px; }
.panel-title { font-size: 13px; font-weight: 700; color: var(--text-1); margin-bottom: 6px; }
.muted { color: var(--text-3); }
.tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.tag.ok { color: #8ee6b0; border: 1px solid #1d4a2e; background: #0f2418; }
.tag.brand { color: #c4b5fd; border: 1px solid #3b2a6b; background: #1d1535; }
.tag.info { color: #93c5fd; border: 1px solid #1d3a5f; background: #101c30; }
.tmpl-card { border-left: 3px solid var(--line); }
.tmpl-a { border-left-color: #64748b; }
.tmpl-b { border-left-color: #3b82f6; }
.tmpl-c { border-left-color: #8b5cf6; }
.tmpl-d { border-left-color: #10b981; }
.lane-note { font-size: 11px; color: var(--text-3); margin: 8px 0 6px; font-weight: 600; }
.node-list { margin-top: 6px; border-top: 1px dashed var(--line-soft); padding-top: 4px; }
.node-list-compact { max-height: 200px; overflow-y: auto; }
.tmpl-node { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.level-badge { display: inline-block; min-width: 24px; text-align: center; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; flex: none; }
.level-badge.l1 { background: #5b1a1a; color: #fca5a5; }
.level-badge.l2 { background: #5b3c14; color: #ffd79a; }
.level-badge.l3 { background: #1d3a5f; color: #93c5fd; }
.level-badge.l4 { background: #1d4a2e; color: #8ee6b0; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--text-3); }
.tmpl-code { min-width: 74px; flex: none; }
.tmpl-name { color: var(--text-1); flex: 1; }
.dim { color: var(--text-3); font-size: 11px; }
.gate-block { margin-bottom: 8px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-2); }
.gate-head { display: flex; align-items: center; gap: 8px; padding: 2px 0 5px; }
.gate-badge { display: inline-block; min-width: 32px; text-align: center; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 11px; background: #3b2a6b; color: #c4b5fd; }
.gate-name { font-size: 12px; font-weight: 600; color: var(--text-1); }
.act-node { display: flex; align-items: center; gap: 8px; padding: 2px 0; font-size: 12px; border-top: 1px dashed #16233a; }
.act-code { min-width: 70px; flex: none; }
.act-name { color: var(--text-1); flex: 1; }
.act-deliv { color: var(--text-3); font-size: 11px; flex: none; }
</style>
