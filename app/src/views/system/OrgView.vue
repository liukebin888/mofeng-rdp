<template>
  <div>
    <PageHeader title="组织与用户" desc="六级组织架构（集团→公司→中心→部门→科室→小组）+ 岗位序列 + 人员挂靠；组织决定数据范围，RBAC 角色决定动作权限">
      <template #actions><el-button size="small" @click="store.reset()">重置演示数据</el-button></template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="租户" :value="store.data.tenant.name" :sub="`${store.data.tenant.code} · ${store.data.tenant.isolation}`" />
      <KpiCard label="组织节点" :value="orgNodeCount" unit="个" sub="六级层级，含研发/制造/职能系统" />
      <KpiCard label="中心" :value="centerCount" unit="个" sub="研发5 + 制造2 + 职能7" />
      <KpiCard label="岗位序列" :value="4" unit="类" sub="技术管理/技术/项目/软件" />
    </div>

    <el-tabs v-model="activeTab">
      <!-- ① 组织架构 -->
      <el-tab-pane label="组织架构" name="org">
        <div class="grid" style="grid-template-columns: 1.15fr 0.85fr; gap: 12px">
          <div class="panel">
            <div class="panel-title" style="display: flex; align-items: center; justify-content: space-between">
              <span>组织树（点击展开层级）</span>
              <span>
                <el-button link size="small" @click="doExportOrg">导出</el-button>
                <el-button link size="small" @click="orgImportInput?.click()">导入</el-button>
                <el-button link type="primary" size="small" @click="openAddOrg()">+ 新增</el-button>
                <input ref="orgImportInput" type="file" accept=".csv" style="display: none" @change="doImportOrg" />
              </span>
            </div>
            <el-tree
              :data="orgTree"
              :props="{ label: 'name', children: 'children' }"
              node-key="id"
              default-expand-all
              :expand-on-click-node="false"
              style="background: transparent; --el-tree-node-hover-bg-color: #16233a"
            >
              <template #default="{ data }">
                <span class="tree-node">
                  <span class="node-name">{{ data.name }}</span>
                  <span class="tag" :class="sysTagClass(data.system)">{{ data.system || '未归类' }}</span>
                  <span class="node-leader">{{ leaderTitleOf(data) }}<template v-if="data.leaderName">· {{ data.leaderName }}</template></span>
                  <el-button link type="danger" size="small" @click.stop="doDeleteOrg(data)">删</el-button>
                </span>
              </template>
            </el-tree>
          </div>

          <div>
            <div class="panel" style="margin-bottom: 12px">
              <div class="panel-title">中心归属系统</div>
              <div v-for="(g, gi) in centerGroups" :key="gi" class="sys-group">
                <div class="sys-head" :class="sysTagClass(g.system)">{{ g.system }}</div>
                <div class="sys-items">{{ g.names.join(' · ') }}</div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-title">人员挂靠（含跨组织兼职）</div>
              <el-table :data="membershipRows" size="small" height="300">
                <el-table-column prop="userName" label="姓名" width="80" />
                <el-table-column label="组织" min-width="150">
                  <template #default="{ row }"><span class="mono">{{ orgNameOf(row.orgId) }}</span></template>
                </el-table-column>
                <el-table-column prop="trackName" label="序列" width="92" />
                <el-table-column prop="postLevel" label="岗位" width="120" />
                <el-table-column label="主职/兼职" width="86">
                  <template #default="{ row }">
                    <span class="tag" :class="row.primary ? 'ok' : 'cond'">{{ row.primary ? '主职' : '兼职' }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>

        <div class="panel" style="margin-top: 12px">
          <div class="panel-title">岗位序列（四类，等级从高到低）</div>
          <div class="grid grid-4">
            <div v-for="t in postTracks" :key="t.track" class="track-card">
              <div class="track-name">{{ t.name }}</div>
              <div class="track-levels">
                <span v-for="(lv, i) in t.levels" :key="lv" class="lv" :class="{ top: i === 0 }">{{ lv }}</span>
              </div>
            </div>
          </div>
        </div>

        <el-dialog v-model="orgDlgVisible" :title="editingOrgId ? '编辑组织节点' : '新增组织节点'" width="440px">
          <el-form label-width="90px" size="small">
            <el-form-item label="层级" required>
              <el-select v-model="orgForm.level" style="width: 100%" :disabled="!!editingOrgId">
                <el-option v-for="(label, lv) in levelOptions" :key="lv" :label="label" :value="lv" />
              </el-select>
            </el-form-item>
            <el-form-item label="父节点">
              <el-select v-model="orgForm.parentId" style="width: 100%" clearable placeholder="留空则为集团根节点" :disabled="!!editingOrgId">
                <el-option v-for="n in parentOptions" :key="n.id" :label="n.name" :value="n.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="名称" required><el-input v-model="orgForm.name" /></el-form-item>
            <el-form-item label="负责人"><PersonSelect v-model="orgForm.leaderName" placeholder="输入姓名或首拼（如 zlq → 周立群）" /></el-form-item>
            <el-form-item label="所属系统">
              <el-select v-model="orgForm.system" style="width: 100%" clearable>
                <el-option label="研发系统" value="研发系统" />
                <el-option label="制造系统" value="制造系统" />
                <el-option label="职能系统" value="职能系统" />
                <el-option label="集团" value="集团" />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button size="small" @click="orgDlgVisible = false">取消</el-button>
            <el-button size="small" type="primary" @click="submitOrg">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <!-- ② 用户与角色 -->
      <el-tab-pane label="用户与角色" name="users">
        <div class="grid grid-4" style="margin-bottom: 12px">
          <KpiCard label="用户" :value="store.users.length" unit="人" sub="一人一角色，便于权限演示" />
          <KpiCard label="组织角色" :value="18" unit="类" sub="附录 D 全量" />
          <KpiCard label="schema 版本" :value="store.data.version" :sub="'变更即失效并重建种子'" />
          <KpiCard label="隔离模式" :value="store.data.tenant.isolation" sub="共享表 tenant_id 过滤" />
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
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { buildOrgTree, POST_TRACKS, LEVEL_LEADER_TITLE, trackOf, countBySystem } from '@/domain/org'
import type { OrgLevel } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()

const activeTab = ref('org')

/** 组织树（嵌套） */
const orgTree = computed(() => buildOrgTree(store.orgNodes as any))

const orgNodeCount = computed(() => store.orgNodes.length)
const centerCount = computed(() => store.orgNodes.filter((n) => n.level === 'center').length)

/** 中心按系统归类 */
const centerGroups = computed(() => {
  const centers = store.orgNodes.filter((n) => n.level === 'center')
  const bySystem = new Map<string, string[]>()
  centers.forEach((c) => {
    const s = c.system || '未归类'
    if (!bySystem.has(s)) bySystem.set(s, [])
    bySystem.get(s)!.push(c.name)
  })
  return [...bySystem.entries()].map(([system, names]) => ({ system, names }))
})

/** 人员挂靠行 */
const membershipRows = computed(() =>
  store.orgMemberships
    .filter((m) => m.active)
    .map((m) => ({ ...m, trackName: trackOf(m.track)?.name ?? m.track }))
)

/** 岗位序列（POST_TRACKS 常量） */
const postTracks = POST_TRACKS

const orgNameOf = (id: string) => store.orgNodes.find((n) => n.id === id)?.name ?? id

const leaderTitleOf = (n: { level: OrgLevel; leaderTitle?: string }) => n.leaderTitle || LEVEL_LEADER_TITLE[n.level]

const sysTagClass = (sys?: string) => {
  if (sys === '研发系统') return 'sys-rd'
  if (sys === '制造系统') return 'sys-mfg'
  if (sys === '集团') return 'sys-group'
  if (sys === '职能系统') return 'sys-func'
  return 'sys-none'
}

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

// —— 组织节点增删改 + 导入导出 ——
const levelOptions: Record<string, string> = { group: '集团', company: '公司', center: '中心', department: '部门', section: '科室', team: '小组' }
const orgDlgVisible = ref(false)
const editingOrgId = ref<null | string>(null)
const orgImportInput = ref<HTMLInputElement>()
const orgForm = reactive({ name: '', level: 'center' as OrgLevel, parentId: null as string | null, leaderName: '', system: '' })

const parentOptions = computed(() => store.orgNodes.filter((n) => n.level !== 'team'))

function openAddOrg() {
  editingOrgId.value = null
  orgForm.name = ''; orgForm.level = 'center'; orgForm.parentId = ''; orgForm.leaderName = ''; orgForm.system = ''
  orgDlgVisible.value = true
}
function submitOrg() {
  if (editingOrgId.value) {
    if (store.saveOrgNode(editingOrgId.value, { name: orgForm.name, leaderName: orgForm.leaderName, system: orgForm.system || undefined })) orgDlgVisible.value = false
  } else {
    if (store.createOrgNode({ name: orgForm.name, level: orgForm.level, parentId: orgForm.parentId || null, leaderName: orgForm.leaderName || undefined, system: orgForm.system || undefined })) orgDlgVisible.value = false
  }
}
function doDeleteOrg(node: any) {
  store.deleteOrgNode(node.id)
}
function doExportOrg() {
  const csv = store.exportOrgCsv()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '组织架构.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
async function doImportOrg(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  const r = store.importOrgCsv(text)
  store.notify(r.errors.length ? 'warning' : 'success', `导入完成，${r.errors.length} 处异常`)
}
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

.tree-node { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; }
.node-name { font-weight: 600; }
.node-leader { color: var(--text-3); font-size: 11px; }
.sys-rd { background: rgba(59,130,246,.18); color: #60a5fa; }
.sys-mfg { background: rgba(245,158,11,.18); color: #fbbf24; }
.sys-func { background: rgba(139,92,246,.18); color: #a78bfa; }
.sys-group { background: rgba(16,185,129,.18); color: #34d399; }
.sys-none { background: rgba(100,116,139,.18); color: #94a3b8; }

.sys-group { margin-bottom: 10px; }
.sys-head { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.sys-items { color: var(--text-2); font-size: 12px; line-height: 1.6; }

.track-card { background: #0f1a2e; border: 1px solid #16233a; border-radius: 8px; padding: 12px; }
.track-name { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #7dd3fc; }
.track-levels { display: flex; flex-wrap: wrap; gap: 6px; }
.lv { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #16233a; color: var(--text-2); }
.lv.top { background: rgba(34,197,94,.2); color: #4ade80; font-weight: 600; }
</style>
