<template>
  <div>
    <PageHeader title="EPS 节点树" desc="企业项目结构（EPS）四级树逐层汇总：组合 → 产品线 → 项目 → 阶段；预算与健康度自下而上滚动（PFM 组合分解）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="EPS 节点" :value="nodeCount" unit="个" sub="四级树" />
      <KpiCard label="组合数" :value="portfolioCount" unit="个" />
      <KpiCard label="在册项目" :value="store.data.projects.length" unit="个" />
      <KpiCard label="总预算" :value="totalBudget" unit="万元" zone="brand" sub="组合级汇总" />
    </div>

    <div class="panel">
      <div class="panel-title">EPS 节点树（逐层汇总）</div>
      <el-table :data="treeRows" size="small" row-key="id" :tree-props="{ children: 'children' }" default-expand-all>
        <el-table-column prop="label" label="节点" min-width="220" />
        <el-table-column prop="level" label="层级" width="80"><template #default="{ row }"><span class="tag" :class="row.level === 1 ? 'cond' : ''">{{ 'L' + row.level }}</span></template></el-table-column>
        <el-table-column label="预算(万元)" width="120" align="right"><template #default="{ row }"><span class="num">{{ row.budget }}</span></template></el-table-column>
        <el-table-column label="项目数" width="90" align="right"><template #default="{ row }"><span class="num">{{ row.projectCount }}</span></template></el-table-column>
        <el-table-column label="健康" width="90"><template #default="{ row }"><span v-if="row.health" class="tag" :class="row.health === '绿' ? 'ok' : row.health === '红' ? 'fail' : 'cond'">{{ te(row.health) }}</span></template></el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        EPS 层级：L1 集团组合 → L2 产品线 → L3 项目 → L4 阶段；预算自下而上滚动，组合级预算为各项目预算之和（与组合评分页同源）。
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

interface EpsNode {
  id: string
  label: string
  level: number
  budget: number
  projectCount: number
  health?: '绿' | '黄' | '红' | '灰'
  children?: EpsNode[]
}

const treeRows = computed<EpsNode[]>(() => {
  const projects = store.data.projects
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0)
  // 按产品线分组（L2），项目挂 L3，阶段挂 L4（演示阶段取固定 4 阶段）
  const byLine = new Map<string, typeof projects>()
  for (const p of projects) {
    const key = p.productLine || '其他'
    byLine.set(key, [...(byLine.get(key) || []), p])
  }
  const lines: EpsNode[] = [...byLine.entries()].map(([line, projs], li) => {
    const lineBudget = projs.reduce((s, p) => s + p.budget, 0)
    const stages: EpsNode[] = projs.flatMap((p) =>
      ['P1 立项', 'P3 计划', 'P5 试制', 'P7 交付'].map((st, si) => ({
        id: `${p.id}-s${si}`,
        label: st,
        level: 4,
        budget: Math.round(p.budget / 4),
        projectCount: 0
      }))
    )
    const children: EpsNode[] = projs.map((p) => ({
      id: p.id,
      label: `${p.code} ${p.name}`,
      level: 3,
      budget: p.budget,
      projectCount: 1,
      health: p.health,
      children: stages
    }))
    return {
      id: `line-${li}`,
      label: line,
      level: 2,
      budget: lineBudget,
      projectCount: projs.length,
      health: (projs.every((p) => p.health === '绿') ? '绿' : projs.some((p) => p.health === '红') ? '红' : '黄') as EpsNode['health'],
      children
    }
  })
  return [
    {
      id: 'root',
      label: '集团组合',
      level: 1,
      budget: totalBudget,
      projectCount: projects.length,
      health: projects.some((p) => p.health === '红') ? '红' : projects.some((p) => p.health === '黄') ? '黄' : '绿',
      children: lines
    }
  ]
})

const nodeCount = computed(() => {
  let n = 0
  const walk = (nodes: EpsNode[]) => nodes.forEach((x) => { n += 1; if (x.children) walk(x.children) })
  walk(treeRows.value)
  return n
})
const portfolioCount = computed(() => treeRows.value[0]?.children?.length || 0)
const totalBudget = computed(() => store.data.projects.reduce((s, p) => s + p.budget, 0))
</script>

<style scoped>
</style>
