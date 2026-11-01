<template>
  <div>
    <PageHeader title="命名与编码规则" desc="管理各对象的命名规范与编码规范：客户、产品、文档、部门、人员；编码规则可结构化配置（前缀+流水号），支持版本化审计与历史追溯">
      <template #actions>
        <el-button size="small" @click="doExport">导出 CSV</el-button>
        <el-button size="small" type="primary" @click="openAdd">新增规则</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="规则总数" :value="store.namingRules.length" unit="条" sub="命名 + 编码规则" />
      <KpiCard label="命名规则" :value="namingCount" unit="条" sub="名称命名规范" />
      <KpiCard label="编码规则" :value="codingCount" unit="条" sub="编号编码规范（可结构化）" />
      <KpiCard label="变更记录" :value="store.namingRuleHistory.length" unit="条" sub="append-only 审计链" />
    </div>

    <div class="panel">
      <div class="row" style="margin-bottom: 10px; flex-wrap: wrap; gap: 8px">
        <el-radio-group v-model="filterObject" size="small">
          <el-radio-button label="">全部对象</el-radio-button>
          <el-radio-button v-for="(v, k) in OBJECT_LABEL" :key="k" :label="k">{{ v }}</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="filterKind" size="small" style="margin-left: 4px">
          <el-radio-button label="">全部类别</el-radio-button>
          <el-radio-button label="naming">命名规则</el-radio-button>
          <el-radio-button label="coding">编码规则</el-radio-button>
        </el-radio-group>
      </div>

      <el-table :data="filteredRules" size="small" height="420">
        <el-table-column label="对象类型" width="90">
          <template #default="{ row }">
            <span class="tag">{{ OBJECT_LABEL[row.object as keyof typeof OBJECT_LABEL] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="90">
          <template #default="{ row }">
            <span class="tag" :class="row.kind === 'coding' ? 'tag-coding' : 'tag-naming'">{{ KIND_LABEL[row.kind as keyof typeof KIND_LABEL] }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="规则名称" width="160" />
        <el-table-column label="编码格式" min-width="150">
          <template #default="{ row }">
            <code v-if="row.pattern" class="example">{{ describePattern(row.pattern) }}</code>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="示例" min-width="160">
          <template #default="{ row }">
            <code v-if="row.example" class="example">{{ row.example }}</code>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="60" align="center">
          <template #default="{ row }">
            <span class="ver">v{{ row.version }}</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="70" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" size="small" @change="(v: boolean) => store.toggleNamingRule(row.id, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="info" size="small" @click="openHistory(row)">历史</el-button>
            <el-button link type="danger" size="small" @click="doDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="row" style="margin-top: 10px">
        <el-button size="small" @click="importInput?.click()">导入 CSV</el-button>
        <input ref="importInput" type="file" accept=".csv" style="display: none" @change="doImport" />
        <span class="dim">CSV 格式：对象类型,规则类别,规则名称,规则描述,编码格式,示例,是否启用</span>
      </div>
    </div>

    <!-- 新增/编辑规则 -->
    <el-dialog v-model="dlgVisible" :title="editing ? '编辑规则' : '新增规则'" width="560px">
      <el-form label-width="90px" size="small">
        <el-form-item label="对象类型" required>
          <el-select v-model="form.object" style="width: 100%">
            <el-option v-for="(v, k) in OBJECT_LABEL" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则类别" required>
          <el-radio-group v-model="form.kind">
            <el-radio-button label="naming">命名规则</el-radio-button>
            <el-radio-button label="coding">编码规则</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="规则名称" required><el-input v-model="form.name" placeholder="如 客户编号规则" /></el-form-item>
        <el-form-item label="规则描述"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="格式、分段、长度约束、禁用字符等" /></el-form-item>

        <!-- 编码规则：结构化模板编辑 -->
        <template v-if="form.kind === 'coding'">
          <el-form-item label="编码模板">
            <div class="seg-box">
              <div v-for="(seg, i) in form.segments" :key="i" class="seg-row">
                <el-select v-model="seg.type" size="small" style="width: 110px" @change="onSegTypeChange(seg)">
                  <el-option label="常量" value="literal" />
                  <el-option label="变量" value="variable" />
                  <el-option label="流水号" value="sequence" />
                </el-select>
                <el-input v-if="seg.type === 'literal'" v-model="seg.value" size="small" placeholder="常量值，如 CUST" style="width: 160px" />
                <el-input v-else-if="seg.type === 'variable'" v-model="seg.variable" size="small" placeholder="变量名，如 abbr" style="width: 160px" />
                <el-input v-else v-model.number="seg.width" size="small" type="number" placeholder="宽度，如 4" style="width: 120px" />
                <el-button link type="danger" size="small" @click="removeSegment(i)">删</el-button>
              </div>
              <el-button size="small" style="margin-top: 6px" @click="addSegment">+ 分段</el-button>
              <div class="dim" style="margin-top: 4px">流水号段必须放在最后；变量段从上下文注入（如客户缩写、产品线代码、专业代码）。当前格式：<code class="example">{{ segPreview }}</code></div>
            </div>
          </el-form-item>
          <el-form-item label="分隔符">
            <el-input v-model="form.separator" size="small" style="width: 80px" placeholder="-" />
          </el-form-item>
        </template>

        <el-form-item label="示例"><el-input v-model="form.example" placeholder="如 CUST-SGMW、DOC-SYS-001" /></el-form-item>
        <el-form-item label="是否启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dlgVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 历史追溯 -->
    <el-dialog v-model="histVisible" :title="`历史追溯：${histRule?.name ?? ''}`" width="620px">
      <div class="dim" style="margin-bottom: 8px">append-only 变更审计链，每次增删改/启停留痕 before/after 快照，可回溯任一历史版本。</div>
      <el-table :data="histList" size="small" max-height="420">
        <el-table-column label="动作" width="80">
          <template #default="{ row }">
            <span class="tag" :class="actionClass(row.action)">{{ ACTION_LABEL[row.action] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="70" align="center">
          <template #default="{ row }">
            <span class="ver">v{{ versionOf(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="变更人" width="90" prop="by" />
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ fmtTime(row.at) }}</template>
        </el-table-column>
        <el-table-column label="说明" min-width="160" prop="note" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button size="small" @click="histVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { NAMING_OBJECT_LABEL, RULE_KIND_LABEL } from '@/domain/naming'
import { describePattern } from '@/domain/codingEngine'
import type { CodeSegment } from '@/domain/types'

const store = useAppStore()

const OBJECT_LABEL = NAMING_OBJECT_LABEL
const KIND_LABEL = RULE_KIND_LABEL
const ACTION_LABEL: Record<string, string> = { create: '新增', update: '更新', delete: '删除', toggle: '启停' }

const filterObject = ref('')
const filterKind = ref('')

const namingCount = computed(() => store.namingRules.filter((r) => r.kind === 'naming').length)
const codingCount = computed(() => store.namingRules.filter((r) => r.kind === 'coding').length)

const filteredRules = computed(() =>
  store.namingRules.filter(
    (r) => (!filterObject.value || r.object === filterObject.value) && (!filterKind.value || r.kind === filterKind.value)
  )
)

const dlgVisible = ref(false)
const editing = ref<null | string>(null)
const importInput = ref<HTMLInputElement>()

const form = reactive({
  object: 'customer' as 'customer' | 'product' | 'document' | 'department' | 'person',
  kind: 'naming' as 'naming' | 'coding',
  name: '',
  description: '',
  example: '',
  enabled: true,
  segments: [] as CodeSegment[],
  separator: '-'
})

function openAdd() {
  editing.value = null
  form.object = 'customer'; form.kind = 'naming'; form.name = ''; form.description = ''; form.example = ''; form.enabled = true
  form.segments = []; form.separator = '-'
  dlgVisible.value = true
}
function openEdit(row: any) {
  editing.value = row.id
  form.object = row.object; form.kind = row.kind; form.name = row.name
  form.description = row.description ?? ''; form.example = row.example ?? ''; form.enabled = row.enabled
  form.segments = row.pattern ? row.pattern.segments.map((s: any) => ({ ...s })) : []
  form.separator = row.pattern?.separator ?? '-'
  dlgVisible.value = true
}

function addSegment() {
  form.segments.push({ type: 'literal', value: '' })
}
function removeSegment(i: number) {
  form.segments.splice(i, 1)
}
function onSegTypeChange(seg: CodeSegment) {
  if (seg.type === 'literal') { seg.value = seg.value ?? ''; delete (seg as any).variable; delete (seg as any).width }
  else if (seg.type === 'variable') { seg.variable = seg.variable ?? ''; delete (seg as any).value; delete (seg as any).width }
  else { seg.width = seg.width ?? 4; delete (seg as any).value; delete (seg as any).variable }
}

const segPreview = computed(() => {
  if (!form.segments.length) return '（未配置分段）'
  return form.segments
    .map((s) => (s.type === 'literal' ? (s.value || '?') : s.type === 'variable' ? `{${s.variable || '变量'}}` : `{流水${s.width ?? 4}位}`))
    .join(form.separator)
})

function buildPattern() {
  if (form.kind !== 'coding' || !form.segments.length) return undefined
  return { segments: form.segments.map((s) => ({ ...s })), separator: form.separator || '-' }
}

function submit() {
  const pattern = buildPattern()
  const payload = { object: form.object, kind: form.kind, name: form.name, description: form.description, example: form.example, enabled: form.enabled, pattern }
  if (editing.value) {
    if (store.saveNamingRule(editing.value, payload)) dlgVisible.value = false
  } else {
    if (store.createNamingRule(payload)) dlgVisible.value = false
  }
}
function doDelete(row: any) {
  store.deleteNamingRule(row.id)
}

// —— 历史追溯 ——
const histVisible = ref(false)
const histRuleId = ref('')
const histRule = computed(() => store.namingRules.find((r) => r.id === histRuleId.value))
const histList = computed(() => store.ruleHistoryOf(histRuleId.value))

function openHistory(row: any) {
  histRuleId.value = row.id
  histVisible.value = true
}
function actionClass(action: string) {
  return action === 'create' ? 'tag-naming' : action === 'delete' ? 'tag-danger' : action === 'toggle' ? 'tag-coding' : ''
}
function versionOf(row: any) {
  return row.action === 'delete' ? (row.before?.version ?? '—') : (row.after?.version ?? '—')
}
function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function doExport() {
  const csv = store.exportNamingRulesCsv()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '命名与编码规则.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
async function doImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  const r = store.importNamingRulesCsv(text)
  store.notify(r.errors.length ? 'warning' : 'success', `导入完成：${r.total} 条规则，${r.errors.length} 处异常`)
}
</script>

<style scoped>
.tag { font-size: 11px; padding: 1px 7px; border-radius: 3px; background: rgba(255, 255, 255, 0.08); }
.tag-naming { color: #409eff; background: rgba(64, 158, 255, 0.12); }
.tag-coding { color: #67c23a; background: rgba(103, 194, 58, 0.12); }
.tag-danger { color: #f56c6c; background: rgba(245, 108, 108, 0.12); }
.example { font-family: monospace; font-size: 12px; color: var(--text-2); background: rgba(255, 255, 255, 0.06); padding: 1px 5px; border-radius: 3px; }
.ver { font-family: monospace; font-size: 11px; color: var(--text-3); }
.dim { color: var(--text-3); font-size: 11px; }
.seg-box { width: 100%; }
.seg-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
</style>
