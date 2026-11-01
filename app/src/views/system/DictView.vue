<template>
  <div>
    <PageHeader title="分类码与 UDF" desc="治理配置（TEN-016）：分类码可配可筛、六类 UDF 可建可校验、步骤模板可复用可统计；配置权与填值权分离">
      <template #actions>
        <el-button size="small" type="primary" @click="store.persist()">保存配置</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="分类码" :value="store.codeDicts.length" unit="套" zone="brand" />
      <KpiCard label="码值" :value="totalCodeValues" unit="个" sub="项目/活动/资源三类" />
      <KpiCard label="UDF 字段" :value="store.udfs.length" unit="个" sub="六类对象可挂接" />
      <KpiCard label="步骤模板" :value="store.stepTemplates.length" unit="套" sub="版本化可复用" />
    </div>

    <el-tabs v-model="tab">
      <!-- 分类码 -->
      <el-tab-pane label="分类码" name="dict">
        <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
          <div class="panel">
            <div class="panel-title">分类码字典（可配可筛）</div>
            <el-table :data="store.codeDicts" size="small">
              <el-table-column prop="domain" label="域" width="80">
                <template #default="{ row }"><span class="tag">{{ row.domain }}</span></template>
              </el-table-column>
              <el-table-column prop="name" label="分类码名" width="110" />
              <el-table-column label="码值" min-width="180">
                <template #default="{ row }">
                  <span v-for="v in row.values" :key="v" class="tag ok" style="margin: 2px">{{ v }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="version" label="版本" width="70" />
            </el-table>
          </div>
          <div class="panel">
            <div class="panel-title">新增码值（不追溯历史）</div>
            <el-form label-position="top" size="small">
              <el-form-item label="分类码">
                <el-select v-model="dictForm.dictId" style="width: 100%">
                  <el-option v-for="d in store.codeDicts" :key="d.id" :label="`${d.domain} · ${d.name}`" :value="d.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="码值">
                <el-input v-model="dictForm.value" placeholder="例：域控制器" />
              </el-form-item>
              <el-button type="primary" size="small" style="width: 100%" @click="addValue">新增码值</el-button>
            </el-form>
            <div class="src-note" style="margin-top: 8px">
              新增码值不追溯历史（TEN-016）：历史项目已归档的分类码值不变。
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- UDF -->
      <el-tab-pane label="UDF 自定义字段" name="udf">
        <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
          <div class="panel">
            <div class="panel-title">UDF 字段（六类对象可挂接）</div>
            <el-table :data="store.udfs" size="small">
              <el-table-column prop="name" label="字段" min-width="130" />
              <el-table-column prop="target" label="挂接对象" width="90">
                <template #default="{ row }"><span class="tag cond">{{ row.target }}</span></template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="70" />
              <el-table-column label="必填" width="60"><template #default="{ row }"><span :class="row.required ? 'num' : 'muted'">{{ row.required ? '是' : '否' }}</span></template></el-table-column>
              <el-table-column label="规则" width="70"><template #default="{ row }"><span class="tag" :class="row.core ? 'fail' : 'ok'">{{ row.core ? '核心' : '扩展' }}</span></template></el-table-column>
            </el-table>
          </div>
          <div class="panel">
            <div class="panel-title">新建 UDF（可校验）</div>
            <el-form label-position="top" size="small">
              <el-form-item label="字段名"><el-input v-model="udfForm.name" placeholder="例：客户内部编号" /></el-form-item>
              <el-form-item label="挂接对象">
                <el-select v-model="udfForm.target" style="width: 100%">
                  <el-option v-for="t in udfTargets" :key="t" :label="t" :value="t" />
                </el-select>
              </el-form-item>
              <el-form-item label="类型">
                <el-select v-model="udfForm.type" style="width: 100%">
                  <el-option v-for="t in udfTypes" :key="t" :label="t" :value="t" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="udfForm.type === '枚举'" label="枚举值（逗号分隔）">
                <el-input v-model="udfForm.enumValues" placeholder="QM,A,B,C,D" />
              </el-form-item>
              <el-button type="primary" size="small" style="width: 100%" @click="addUdf">新建 UDF</el-button>
            </el-form>
          </div>
        </div>
      </el-tab-pane>

      <!-- 步骤模板 -->
      <el-tab-pane label="步骤模板" name="step">
        <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
          <div class="panel">
            <div class="panel-title">步骤模板（可复用可统计）</div>
            <el-table :data="store.stepTemplates" size="small">
              <el-table-column prop="name" label="模板" min-width="150" />
              <el-table-column prop="version" label="版本" width="70"><template #default="{ row }"><span class="mono">v{{ row.version }}</span></template></el-table-column>
              <el-table-column label="步骤" min-width="200">
                <template #default="{ row }">
                  <span v-for="s in row.steps" :key="s.id" class="tag" :class="s.required ? 'cond' : ''" style="margin: 2px">{{ s.name }}</span>
                </template>
              </el-table-column>
              <el-table-column label="完成度" width="120">
                <template #default="{ row }">
                  <template v-if="runOf(row.id)">
                    <span class="num">{{ runOf(row.id)!.done }}/{{ runOf(row.id)!.total }}</span>
                  </template>
                  <span v-else class="muted">未执行</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{ row }"><el-button link size="small" @click="store.bumpStepTemplate(row.id)">升版</el-button></template>
              </el-table-column>
            </el-table>
          </div>
          <div class="panel">
            <div class="panel-title">执行统计（SR1）</div>
            <div v-if="stepStats" class="src-note">
              模板「{{ store.stepTemplates.find((t) => t.id === 'ST1')?.name }}」完成度：
              <b>{{ stepStats.done }}/{{ stepStats.total }}</b>（{{ stepStats.percent }}%）
              <span v-if="stepStats.missingRequired.length" class="tag fail" style="margin-left: 6px">
                缺 {{ stepStats.missingRequired.join('、') }}
              </span>
              <span v-else class="tag ok" style="margin-left: 6px">必做步骤已完成</span>
            </div>
            <div class="src-note" style="margin-top: 8px">
              步骤模板版本化：升版后已执行活动锁定旧版本，不受新版本影响（TEN-016）。
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 扩展点与可访问性 -->
      <el-tab-pane label="扩展点与可访问性" name="extension">
        <div class="grid grid-4" style="margin-bottom: 12px">
          <KpiCard label="扩展点完备" :value="store.extensionCheck.ok ? '四类齐备' : '缺' + store.extensionCheck.missing.length + '类'" unit="" :zone="store.extensionCheck.ok ? 'ok' : 'danger'" sub="ARC-020 客户化不改主干" />
          <KpiCard label="自定义表单" :value="store.customForms.length" unit="张" sub="配置驱动无需发版" />
          <KpiCard label="事件钩子" :value="store.eventHooks.length" unit="个" sub="失败不影响主流程" />
          <KpiCard label="可访问性通过率" :value="store.accessibilityRate.rate" unit="%" :zone="store.accessibilityRate.rate === 100 ? 'ok' : 'danger'" sub="NFR-017 关键页面抽查" />
        </div>

        <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 12px">
          <div class="panel">
            <div class="panel-title">扩展点（ARC-020 · 四类）</div>
            <div class="sub-title">自定义表单（配置驱动）</div>
            <div v-for="f in store.customForms" :key="f.id" class="rrow">
              <span class="mono">{{ f.name }}</span>
              <span class="dim">v{{ f.version }} · {{ f.targetType }}</span>
              <span class="tag ok">{{ f.enabled ? '启用' : '停用' }}</span>
            </div>
            <div class="sub-title" style="margin-top: 8px">事件钩子（失败不影响主流程）</div>
            <div v-for="h in store.eventHooks" :key="h.id" class="rrow">
              <span class="mono">{{ h.name }}</span>
              <span class="dim">{{ h.point }}</span>
              <el-button link size="small" @click="store.fireHook(h.point, {})">触发</el-button>
            </div>
            <div class="sub-title" style="margin-top: 8px">开放 API（OpenAPI 3.1 + 幂等）</div>
            <div v-for="a in store.openApis" :key="a.id" class="rrow">
              <span class="mono">{{ a.method }}</span>
              <span class="dim">{{ a.path }}</span>
              <span class="tag" :class="a.idempotent ? 'ok' : 'cond'">{{ a.idempotent ? '幂等' : '只读' }}</span>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">可访问性取证（NFR-017）</div>
            <div class="sub-title">文字对比度（≥4.5:1）</div>
            <div v-for="(c, i) in store.accessibilityAudit.contrastChecks" :key="i" class="rrow">
              <span class="tag" :class="c.ok ? 'ok' : 'fail'">{{ c.ratio }}:1</span>
              <span class="dim">{{ c.note }}</span>
            </div>
            <div class="sub-title" style="margin-top: 8px">键盘可达与标签</div>
            <div class="rrow">
              <span class="tag" :class="store.accessibilityAudit.keyboardCheck.ok ? 'ok' : 'fail'">{{ store.accessibilityAudit.keyboardCheck.note }}</span>
            </div>
            <div class="rrow">
              <span class="tag" :class="store.accessibilityAudit.labelCheck.ok ? 'ok' : 'fail'">{{ store.accessibilityAudit.labelCheck.note }}</span>
            </div>
            <div class="src-note" style="margin-top: 8px">
              键盘可达、对比度 ≥4.5:1、表单可读标签，供审核方在不安装辅助软件环境下取证。
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()
const tab = ref('dict')

const totalCodeValues = computed(() => store.codeDicts.reduce((s, d) => s + d.values.length, 0))

const udfTargets = ['项目', 'WBS', '活动', '资源', '分配', '费用'] as const
const udfTypes = ['文本', '数字', '枚举', '日期', '布尔'] as const

const dictForm = reactive({ dictId: 'CD1', value: '' })
const udfForm = reactive({ name: '', target: '项目' as typeof udfTargets[number], type: '文本' as typeof udfTypes[number], enumValues: '' })

function addValue() {
  if (!dictForm.dictId) {
    store.notify('error', '请选择分类码')
    return
  }
  store.addCodeDictValue(dictForm.dictId, dictForm.value)
  dictForm.value = ''
}

function addUdf() {
  store.saveUdf({
    target: udfForm.target,
    name: udfForm.name,
    type: udfForm.type,
    enumValues: udfForm.type === '枚举' ? udfForm.enumValues.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  })
  udfForm.name = ''
  udfForm.enumValues = ''
}

const stepStats = computed(() => store.stepRunStats('SR1'))

function runOf(templateId: string) {
  const run = store.stepRuns.find((r) => r.templateId === templateId)
  return run ? store.stepRunStats(run.id) : null
}
</script>

<style scoped>
.muted { color: var(--text-3); font-size: 12px; }
.sub-title { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
.rrow { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--line); font-size: 12px; flex-wrap: wrap; }
</style>
