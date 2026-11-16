<template>
  <div>
    <PageHeader title="项目主计划">
      <template #actions>
        <el-button size="small" @click="$router.push('/plan/wbs')">查看 WBS 与任务</el-button>
        <el-button size="small" type="primary" @click="tplDialog = true">新建</el-button>
        <el-button size="small" @click="onOpen">打开</el-button>
      </template>
    </PageHeader>

    <!-- 模板选择对话框（A/B/C/D） -->
    <el-dialog v-model="tplDialog" title="选择主计划模板" width="720px" append-to-body>
      <div class="tpl-grid">
        <div
          v-for="t in metas"
          :key="t.kind"
          class="tpl-card"
          :class="`tpl-${t.kind.toLowerCase()}`"
          @click="pickTemplate(t.kind)"
        >
          <div class="tpl-title">{{ t.name }}</div>
          <div class="tpl-desc">{{ t.desc }}</div>
          <div class="tpl-count">{{ t.nodeCount }} 节点</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { templateMetas, type PlanTemplateKind } from '@/domain/planTemplate'

const router = useRouter()
const tplDialog = ref(false)
const metas = computed(() => templateMetas())

function pickTemplate(kind: PlanTemplateKind) {
  tplDialog.value = false
  router.push(`/project/master-plan-editor?template=${kind}`)
}

function onOpen() {
  // 打开：打开一个已存在的项目主计划（具体交互下一步再确定）
}
</script>

<style scoped>
.tpl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tpl-card { border: 1px solid var(--line); border-left: 4px solid var(--line); border-radius: 8px; padding: 14px; cursor: pointer; background: var(--bg-1); transition: all 0.15s; }
.tpl-card:hover { border-color: var(--brand); box-shadow: 0 2px 10px rgba(0,0,0,.1); }
.tpl-a { border-left-color: #64748b; }
.tpl-b { border-left-color: #3b82f6; }
.tpl-c { border-left-color: #8b5cf6; }
.tpl-d { border-left-color: #10b981; }
.tpl-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
.tpl-desc { font-size: 12px; color: var(--text-2); margin-top: 6px; line-height: 1.5; }
.tpl-count { font-size: 11px; color: var(--brand); margin-top: 8px; font-weight: 600; }
</style>
