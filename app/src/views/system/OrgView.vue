<template>
  <div>
    <PageHeader title="组织与用户" desc="18 个角色预置用户（附录 D），切换身份即切换菜单与操作权限；租户与隔离模式为架构级配置">
      <template #actions><el-button size="small" @click="store.reset()">重置演示数据</el-button></template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="租户" :value="store.data.tenant.name" :sub="`${store.data.tenant.code} · ${store.data.tenant.isolation}`" />
      <KpiCard label="用户" :value="store.users.length" unit="人" sub="一人一角色，便于权限演示" />
      <KpiCard label="组织角色" :value="18" unit="类" sub="附录 D 全量" />
      <KpiCard label="schema 版本" :value="store.data.version" :sub="'变更即失效并重建种子'" />
    </div>

    <div class="panel">
      <div class="panel-title">用户与角色（点击切换当前身份）</div>
      <el-table :data="store.users" size="small" height="420" @row-click="(r: any) => store.selectUser(r.id)">
        <el-table-column prop="id" label="ID" width="66" />
        <el-table-column prop="name" label="姓名" width="86" />
        <el-table-column prop="account" label="账号" width="170" />
        <el-table-column prop="roleName" label="角色" width="130" />
        <el-table-column prop="roleCode" label="角色代码" width="120" />
        <el-table-column prop="dept" label="部门" width="110" />
        <el-table-column label="当前" width="70">
          <template #default="{ row }"><span v-if="row.id === store.userId" class="tag ok">当前</span></template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid grid-3" style="margin-top: 12px">
      <div class="panel">
        <div class="panel-title">租户配额与降级（TEN-012 · 超限只拒绝新增，查询/导出不受影响）</div>
        <div v-for="q in quotaRows" :key="q.label" class="quota-row">
          <span class="q-label">{{ q.label }}</span>
          <div class="q-bar">
            <div class="q-fill" :style="{ width: q.pct + '%', background: q.over ? '#f87171' : q.pct > 80 ? '#fbbf24' : '#22c55e' }" />
          </div>
          <span class="num">{{ q.used }} / {{ q.max }}</span>
          <span class="tag" :class="q.over ? 'fail' : 'ok'">{{ q.over ? '超限' : '正常' }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          配额按租户配置：用户数 / 存储 / 并发 / AI token。任一超限仅拒绝「新增」并提示，既有查询与导出继续可用，不得整租户不可用。
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">租户与隔离（ARC-010：三种模式共用一套代码）</div>
        <div class="kv"><span>隔离模式</span><em>SHARED（共享表 + tenant_id 过滤）</em></div>
        <div class="kv"><span>可选模式</span><em>SCHEMA（独立 Schema）/ INSTANCE（独立实例）</em></div>
        <div class="kv"><span>切换方式</span><em>运行时策略，禁止分支代码</em></div>
        <div class="kv"><span>集团结构</span><em>parent_id 自关联，支持集团 → 子公司两级</em></div>
      </div>
      <div class="panel">
        <div class="panel-title">数据与版本</div>
        <div class="kv"><span>种子版本</span><em class="mono">{{ store.data.version }}</em></div>
        <div class="kv"><span>存储</span><em>localStorage（Repository 适配器，可替换为 REST）</em></div>
        <div class="kv"><span>集合</span><em>projects / wbs / reqs / links / risks / ecrs / baselines / audit …</em></div>
        <div class="row" style="margin-top: 10px">
          <el-button size="small" @click="store.reset()">重置为初始种子</el-button>
          <span class="dim">重置后审计链从头重建，便于反复演示</span>
        </div>
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

/** TEN-012：四类配额展示（用量 / 上限 / 占比 / 是否超限） */
const quotaRows = computed(() => {
  const u = store.quotaUsage
  const c = store.quotaConfig
  const mk = (label: string, used: number, max: number) => ({
    label,
    used,
    max,
    pct: max ? Math.min(100, Math.round((used / max) * 100)) : 0,
    over: used >= max
  })
  return [
    mk('用户数', u.users, c.maxUsers),
    mk('存储(MB)', u.storageMb, c.maxStorageMb),
    mk('并发', u.concurrency, c.maxConcurrency),
    mk('AI token', u.aiToken, c.maxAiToken)
  ]
})
</script>

<style scoped>
.kv { display: grid; grid-template-columns: 90px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; }
.dim { color: var(--text-3); font-size: 10.5px; }
.quota-row { display: grid; grid-template-columns: 72px 1fr 90px 52px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.q-label { color: var(--text-3); }
.q-bar { height: 8px; background: #16233a; border-radius: 4px; overflow: hidden; }
.q-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.src-note { color: var(--text-3); font-size: 10.5px; line-height: 1.5; }
</style>
