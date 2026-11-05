<template>
  <div class="wff">
    <!-- 四按钮统一工具栏：新增 / 保存 / 关闭 / 提交（WF-001 硬约束，缺一不可） -->
    <div class="wff-bar">
      <div class="wff-bar-left">
        <el-button size="small" type="primary" :disabled="!canNew" @click="$emit('new')">
          {{ t('wf.btn.new') }}
        </el-button>
        <el-button size="small" :disabled="!canSave" @click="$emit('save')">
          {{ t('wf.btn.save') }}
        </el-button>
        <el-button size="small" :disabled="!canClose" @click="$emit('close')">
          {{ t('wf.btn.close') }}
        </el-button>
        <el-button size="small" type="success" :disabled="!canSubmit" @click="onSubmit">
          {{ t('wf.btn.submit') }}
        </el-button>
        <el-button size="small" text :disabled="!canConfigure" @click="showConfig = !showConfig">
          {{ t('wf.btn.customApprovers') }}
          <el-badge v-if="customApprovers.length" :value="customApprovers.length" class="wff-badge" />
        </el-button>
      </div>
      <div class="wff-bar-right">
        <span class="wf-status-tag" :class="status">{{ statusText }}</span>
        <span v-if="dirty" class="wf-dirty">{{ t('wf.dirty') }}</span>
      </div>
    </div>

    <!-- 自定义审批人配置：发起人可在固定审批链之外增加审核/并行会签节点 -->
    <div v-if="showConfig" class="wff-config panel">
      <div class="wff-config-head">
        <span class="wff-config-title">{{ t('wf.customApprovers.title') }}</span>
        <span class="muted">{{ t('wf.customApprovers.hint') }}</span>
      </div>
      <div v-for="(a, i) in customApprovers" :key="i" class="wff-config-row">
        <el-select v-model="a.kind" size="small" style="width: 108px" @change="markConfigDirty">
          <el-option value="approve" :label="t('wf.customApprovers.approve')" />
          <el-option value="sign" :label="t('wf.customApprovers.sign')" />
        </el-select>
        <el-input v-model="a.name" size="small" style="width: 160px" :placeholder="t('wf.customApprovers.namePh')" @input="markConfigDirty" />
        <el-select
          v-if="a.kind === 'approve'"
          v-model="a.approverRole"
          size="small"
          filterable
          allow-create
          style="flex: 1"
          :placeholder="t('wf.customApprovers.rolePh')"
          @change="markConfigDirty"
        >
          <el-option v-for="r in approverRoleOptions" :key="r" :value="r" :label="r" />
        </el-select>
        <el-select
          v-else
          v-model="a.signRoles"
          size="small"
          multiple
          filterable
          allow-create
          style="flex: 1"
          :placeholder="t('wf.customApprovers.signRolesPh')"
          @change="markConfigDirty"
        >
          <el-option v-for="r in approverRoleOptions" :key="r" :value="r" :label="r" />
        </el-select>
        <el-button link size="small" type="danger" @click="removeApprover(i)">{{ t('btn.delete') }}</el-button>
      </div>
      <div class="wff-config-actions">
        <el-button size="small" @click="addApprove">{{ t('wf.customApprovers.addApprove') }}</el-button>
        <el-button size="small" @click="addSign">{{ t('wf.customApprovers.addSign') }}</el-button>
      </div>
    </div>

    <!-- 提交前校验阻断提示 -->
    <div v-if="blockers && blockers.length" class="wf-blockers">
      <span class="wf-blockers-title">{{ t('wf.blockers') }}</span>
      <span v-for="b in blockers" :key="b" class="wf-blocker-item">{{ b }}</span>
    </div>

    <!-- 业务表单插槽：由具体工作流视图注入 -->
    <slot :status="status" :form="form" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '@/infra/i18nPlugin'
import { useAppStore } from '@/store/app'
import { canDo } from '@/domain/workflowForm'
import type { WorkflowForm, WorkflowFormStatus } from '@/domain/workflowForm'
import type { CustomApproverAddition } from '@/domain/flowEngine'

const props = defineProps<{
  form: WorkflowForm | null
  dirty?: boolean
  blockers?: string[]
}>()

const emit = defineEmits<{
  (e: 'new'): void
  (e: 'save'): void
  (e: 'close'): void
  (e: 'submit', customApprovers: CustomApproverAddition[]): void
}>()

const { t } = useI18n()
const store = useAppStore()

// 自定义审批人（双向绑定，视图可持久化到草稿实现续编）
const customApprovers = defineModel<Array<CustomApproverAddition & { signRoles: string[] }>>('customApprovers', { default: () => [] })

const status = computed<WorkflowFormStatus>(() => props.form?.status ?? 'draft')

const canNew = computed(() => true)
const canSave = computed(() => (props.form ? canDo(props.form, 'save') : false))
const canClose = computed(() => (props.form ? canDo(props.form, 'close') : false))
const canSubmit = computed(() => (props.form ? canDo(props.form, 'submit') : false))
// 仅草稿态可配置自定义审批人（提交前）
const canConfigure = computed(() => canSubmit.value)

const statusText = computed(() => t('wf.status.' + status.value))

// —— 自定义审批人（发起人自行增加的审核/并行会签节点）——
const showConfig = ref(false)
const configDirty = ref(false)

/** 可选审批角色：组织负责人岗位（中心名→负责人）+ RBAC 角色名，去重 */
const approverRoleOptions = computed<string[]>(() => {
  const set = new Set<string>()
  store.orgNodes.forEach((n) => {
    if (n.name) set.add(n.name)
    if (n.leaderTitle) set.add(n.leaderTitle)
  })
  store.users.forEach((u) => {
    if (u.roleName) set.add(u.roleName)
  })
  return [...set].sort()
})

function addApprove() {
  customApprovers.value.push({ kind: 'approve', name: '', approverRole: '', signRoles: [] })
  markConfigDirty()
}
function addSign() {
  customApprovers.value.push({ kind: 'sign', name: '', signRoles: [] })
  markConfigDirty()
}
function removeApprover(i: number) {
  customApprovers.value.splice(i, 1)
  markConfigDirty()
}
function markConfigDirty() {
  configDirty.value = true
}

/** 过滤出合法自定义节点（会签须有角色，审核须有审批角色） */
function validCustomApprovers(): CustomApproverAddition[] {
  return customApprovers.value
    .filter((a) => {
      if (a.kind === 'sign') return !!(a.name?.trim()) && a.signRoles.filter((r) => r && r.trim()).length > 0
      return !!(a.name?.trim()) && !!(a.approverRole?.trim())
    })
    .map((a) =>
      a.kind === 'sign'
        ? { kind: 'sign' as const, name: a.name.trim(), signRoles: a.signRoles.filter((r) => r && r.trim()) }
        : { kind: 'approve' as const, name: a.name.trim(), approverRole: a.approverRole!.trim() }
    )
}

function onSubmit() {
  emit('submit', validCustomApprovers())
}

// 关闭编辑或切换单据时，重置自定义审批人配置
watch(
  () => props.form?.id,
  () => {
    showConfig.value = false
    configDirty.value = false
  }
)
</script>

<style scoped>
.wff { display: flex; flex-direction: column; gap: 10px; }
.wff-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-bg, #0f1a2a);
}
.wff-bar-left { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.wff-bar-right { display: flex; align-items: center; gap: 8px; }
.wff-badge { margin-left: 6px; }
.wf-status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-2);
}
.wf-status-tag.draft { color: #ffd79a; border-color: #5b3c14; background: #2a1f10; }
.wf-status-tag.submitted { color: #93c5fd; border-color: #1d3a5f; background: #12233a; }
.wf-status-tag.completed { color: #8ee6b0; border-color: #1d4a2e; background: #0f2418; }
.wf-status-tag.rejected { color: #f87171; border-color: #5b1a1a; background: #2a1010; }
.wf-status-tag.terminated { color: var(--text-3); border-color: var(--line); background: #1a1f29; }
.wf-dirty { font-size: 11px; color: #ffd79a; }
.wff-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}
.wff-config-head { display: flex; align-items: baseline; gap: 10px; }
.wff-config-title { font-weight: 600; font-size: 12px; }
.wff-config-row { display: flex; gap: 8px; align-items: center; }
.wff-config-actions { display: flex; gap: 8px; margin-top: 2px; }
.muted { font-size: 11px; color: var(--text-3); }
.wf-blockers {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 7px 10px;
  border: 1px solid #5b3c14;
  background: #2a1f10;
  border-radius: 6px;
  font-size: 11.5px;
}
.wf-blockers-title { color: #ffd79a; font-weight: 600; }
.wf-blocker-item { color: #ffd79a; }
</style>
