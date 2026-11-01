<template>
  <div>
    <PageHeader title="角色权限" desc="18 角色 × 6 动作矩阵为权限实现唯一依据（SEC-006）；三层取交集：角色 × 数据作用域 × 字段策略" />

    <div class="grid" style="grid-template-columns: 1fr 320px; align-items: start">
      <div class="panel">
        <div class="panel-title">
          权限矩阵（● 允许 / ○ 受限 / — 禁止）
          <span class="dim">点击行查看限制条件</span>
        </div>
        <el-table :data="ROLES" size="small" height="420" @row-click="(r: any) => (role = r)">
          <el-table-column prop="name" label="角色" width="120" />
          <el-table-column prop="scope" label="作用域" width="88" />
          <el-table-column v-for="a in ACTIONS" :key="a.key" :label="a.label" width="62" align="center">
            <template #default="{ row }">
              <span :class="['act', row.actions[a.key] === '●' ? 'allow' : row.actions[a.key] === '○' ? 'cond' : 'deny']">{{ row.actions[a.key] }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="limits" label="限制条件" min-width="260" show-overflow-tooltip />
        </el-table>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">当前身份授权</div>
          <div class="kv"><span>用户</span><em>{{ store.currentUser.name }}</em></div>
          <div class="kv"><span>角色</span><em>{{ store.currentUser.roleName }}</em></div>
          <div class="kv"><span>作用域</span><em>{{ role?.scope }}</em></div>
          <div class="kv"><span>限制</span><em>{{ role?.limits }}</em></div>
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
      <div class="panel-title">字段级策略（SEC-003：HIDDEN / MASK / READONLY / EDIT，三层取交集）</div>
      <el-table :data="FIELD_POLICIES" size="small">
        <el-table-column prop="role" label="角色" width="120" />
        <el-table-column prop="objType" label="对象" width="110" />
        <el-table-column prop="field" label="字段" width="130" />
        <el-table-column label="策略" width="120">
          <template #default="{ row }"><span class="tag" :class="row.policy === 'HIDDEN' ? 'fail' : row.policy === 'MASK' ? 'cond' : 'ok'">{{ row.policy }}</span></template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="260" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { FIELD_POLICIES, ROLES, SOD_RULES, can, checkSod } from '@/domain/rbac'
import type { RoleDef } from '@/domain/types'

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
const canDo = (a: (typeof ACTIONS)[number]['key']) => can(store.currentUser.roleCode, a).allowed
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
void SOD_RULES
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
</style>
