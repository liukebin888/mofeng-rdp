<template>
  <div>
    <PageHeader title="角色权限" desc="四维权限模型（SEC-001~006 / PRJ-013）：角色动作矩阵 × 对象级权限 × 数据范围四级 × 字段策略三处，均为权限实现唯一依据" />

    <div class="grid" style="grid-template-columns: 1fr 320px; align-items: start">
      <div class="panel">
        <div class="panel-title">
          角色 × 动作矩阵（● 允许 / ○ 受限 / — 禁止）
          <span class="dim">点击行查看限制条件</span>
        </div>
        <el-table :data="ROLES" size="small" height="420" @row-click="(r: any) => (role = r)">
          <el-table-column prop="name" label="角色" width="110" />
          <el-table-column prop="scope" label="作用域" width="80" />
          <el-table-column label="类型" width="66" align="center">
            <template #default="{ row }">
              <span class="tag" :class="row.roleType === 'project' ? 'proj' : 'org'">{{ row.roleType === 'project' ? '项目' : '组织' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="数据范围" width="76" align="center">
            <template #default="{ row }">
              <span class="tag scope">{{ scopeLabel(row.dataScope) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-for="a in ACTIONS" :key="a.key" :label="a.label" width="54" align="center">
            <template #default="{ row }">
              <span :class="['act', row.actions[a.key] === '●' ? 'allow' : row.actions[a.key] === '○' ? 'cond' : 'deny']">{{ row.actions[a.key] }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="limits" label="限制条件" min-width="220" show-overflow-tooltip />
        </el-table>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">当前身份授权（多角色并集）</div>
          <div class="kv"><span>用户</span><em>{{ store.currentUser.name }}</em></div>
          <div class="kv"><span>角色</span><em>{{ roleNames.join('、') }}</em></div>
          <div class="kv"><span>数据范围</span><em>{{ scopeLabel(store.currentDataScope) }}</em></div>
          <div class="row wrap" style="margin-top: 8px">
            <el-tag v-for="a in ACTIONS" :key="a.key" size="small" :type="canDo(a.key) ? 'success' : 'info'" effect="dark">
              {{ a.label }}{{ canDo(a.key) ? '' : '×' }}
            </el-tag>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">SOD 职责分离校验（7 条硬约束）</div>
          <div v-for="s in sodResults" :key="s.code" class="srow">
            <span class="tag" :class="s.ok ? 'ok' : 'fail'">{{ s.code }}</span>
            <span class="nm">{{ s.name }}</span>
            <em>{{ s.note }}</em>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">对象级权限矩阵（SEC-001：角色 × 动作 × 对象类型，未知对象 fail-closed）</div>
      <div class="dim" style="margin-bottom: 6px">受控对象清单（{{ OBJECT_TYPES.length }} 类）：{{ OBJECT_TYPES.join('、') }}</div>
      <el-table :data="objectScopeRows" size="small">
        <el-table-column prop="role" label="角色" width="110" />
        <el-table-column prop="action" label="动作" width="70" />
        <el-table-column prop="allow" label="允许对象" min-width="220" />
        <el-table-column prop="deny" label="禁止对象" min-width="220" />
      </el-table>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">字段级策略（SEC-003：HIDDEN / MASK / READONLY / EDIT，页面 / 接口 / 导出三处一致）</div>
      <el-table :data="FIELD_POLICIES" size="small">
        <el-table-column prop="role" label="角色" width="110" />
        <el-table-column prop="objType" label="对象" width="100" />
        <el-table-column prop="field" label="字段" width="120" />
        <el-table-column label="策略" width="110">
          <template #default="{ row }"><span class="tag" :class="row.policy === 'HIDDEN' ? 'fail' : row.policy === 'MASK' ? 'cond' : row.policy === 'READONLY' ? 'warn' : 'ok'">{{ row.policy }}</span></template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="240" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { FIELD_POLICIES, ROLES, SOD_RULES, OBJECT_SCOPES, OBJECT_TYPES, canAny, checkSod } from '@/domain/rbac'
import type { RoleDef, DataScope } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const ACTIONS = [
  { key: 'view', label: '查' },
  { key: 'create', label: '增' },
  { key: 'update', label: '改' },
  { key: 'delete', label: '删' },
  { key: 'approve', label: '审' },
  { key: 'export', label: '导出' }
] as const
const role = ref<RoleDef>(ROLES.find((r) => r.code === store.currentUser.roleCode) || ROLES[0])
const roleNames = computed(() => store.currentUserRoleNames)
const canDo = (a: (typeof ACTIONS)[number]['key']) => canAny(store.currentUserRoles, a).allowed

const scopeLabel = (s: DataScope) => ({ SELF: '本人', DEPT: '本部门', PROJECT: '本项目', TENANT: '本租户' })[s]

const sodResults = computed(() =>
  checkSod({
    submitter: '周立群',
    releasedBy: '陈志远',
    author: '吴敏',
    reviewer: '孙烨',
    proxyRecorder: '沈雅',
    ppapJudge: '李文杰',
    frozenUpdates: '0',
    auditMutate: '1',
    grantDays: '30'
  })
)

/** 对象级权限矩阵（展平 OBJECT_SCOPES 为可展示行） */
const objectScopeRows = computed(() => {
  const actionLabel: Record<string, string> = { view: '查', create: '增', update: '改', delete: '删', approve: '审', export: '导出' }
  const rows: { role: string; action: string; allow: string; deny: string }[] = []
  Object.entries(OBJECT_SCOPES).forEach(([roleCode, actions]) => {
    Object.entries(actions).forEach(([action, scope]) => {
      rows.push({
        role: ROLES.find((r) => r.code === roleCode)?.name || roleCode,
        action: actionLabel[action] || action,
        allow: scope.allow ? scope.allow.join('、') : '（无白名单，回退全局矩阵）',
        deny: scope.deny ? scope.deny.join('、') : '—'
      })
    })
  })
  return rows
})

void SOD_RULES
void te
</script>

<style scoped>
.act { font-size: 13px; font-weight: 700; }
.allow { color: #4ade80; } .cond { color: #fbbf24; } .deny { color: #64748b; }
.kv { display: grid; grid-template-columns: 58px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; line-height: 1.6; }
.srow { display: grid; grid-template-columns: 58px 1fr; gap: 6px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11px; }
.srow em { grid-column: 2; font-style: normal; color: var(--text-3); font-size: 10.5px; }
.dim { font-size: 10.5px; color: var(--text-3); }
.tag { display: inline-block; padding: 0 5px; border-radius: 3px; font-size: 10px; line-height: 16px; }
.tag.ok { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.tag.fail { background: rgba(248, 113, 113, 0.15); color: #f87171; }
.tag.cond { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.tag.warn { background: rgba(251, 146, 60, 0.15); color: #fb923c; }
.tag.proj { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.tag.org { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.tag.scope { background: rgba(45, 212, 191, 0.15); color: #2dd4bf; }
</style>
