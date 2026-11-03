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
        <el-button size="small" type="success" :disabled="!canSubmit" @click="$emit('submit')">
          {{ t('wf.btn.submit') }}
        </el-button>
      </div>
      <div class="wff-bar-right">
        <span class="wf-status-tag" :class="status">{{ statusText }}</span>
        <span v-if="dirty" class="wf-dirty">{{ t('wf.dirty') }}</span>
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
import { computed } from 'vue'
import { useI18n } from '@/infra/i18nPlugin'
import { canDo } from '@/domain/workflowForm'
import type { WorkflowForm, WorkflowFormStatus } from '@/domain/workflowForm'

const props = defineProps<{
  form: WorkflowForm | null
  dirty?: boolean
  blockers?: string[]
}>()

defineEmits<{
  (e: 'new'): void
  (e: 'save'): void
  (e: 'close'): void
  (e: 'submit'): void
}>()

const { t } = useI18n()

const status = computed<WorkflowFormStatus>(() => props.form?.status ?? 'draft')

const canNew = computed(() => true)
const canSave = computed(() => (props.form ? canDo(props.form, 'save') : false))
const canClose = computed(() => (props.form ? canDo(props.form, 'close') : false))
const canSubmit = computed(() => (props.form ? canDo(props.form, 'submit') : false))

const statusText = computed(() => t('wf.status.' + status.value))
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
.wff-bar-left { display: flex; gap: 8px; flex-wrap: wrap; }
.wff-bar-right { display: flex; align-items: center; gap: 8px; }
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
