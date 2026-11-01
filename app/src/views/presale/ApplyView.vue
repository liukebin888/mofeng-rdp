<template>
  <div>
    <PageHeader title="立项申请" desc="五项分级输入必填，缺项即「未定级」并阻断 Gate1（CLS-001/CLS-007）；技术方案与报价未关联不得审批（C-02）">
      <template #actions>
        <el-button size="small" @click="fillDemo('L1')">载入 L1 样例</el-button>
        <el-button size="small" @click="fillDemo('L3')">载入 L3 样例</el-button>
        <el-button type="primary" size="small" :disabled="!result.level" @click="submit">提交立项申请</el-button>
      </template>
    </PageHeader>

    <div class="grid" style="grid-template-columns: 1fr 1.1fr">
      <div class="panel">
        <div class="panel-title">项目基本信息（PRJ-002 八项必填）</div>
        <el-form label-width="96px" size="small">
          <el-form-item label="项目编码"><el-input :model-value="p.code" disabled /></el-form-item>
          <el-form-item label="项目名称"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="客户">
            <el-select v-model="form.customer" filterable placeholder="从客户主数据选择" style="width: 100%">
              <el-option v-for="c in store.customers" :key="c.id" :value="c.name" :label="`${c.name}（${c.code}）`" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品线 / 平台">
            <div class="row" style="width: 100%">
              <el-select v-model="form.productLine" filterable placeholder="从产品线主数据选择" style="flex: 1">
                <el-option-group v-for="cat in productCategories" :key="cat.id" :label="cat.name">
                  <el-option v-for="l in linesOf(cat.id)" :key="l.id" :value="l.name" :label="`${l.name}${l.code ? '（' + l.code + '）' : ''}`" />
                </el-option-group>
              </el-select>
              <el-input v-model="form.platform" placeholder="平台（自由文本）" style="flex: 1" />
            </div>
          </el-form-item>
          <el-form-item label="负责人"><el-input v-model="form.owner" /></el-form-item>
          <el-form-item label="起止日期">
            <div class="row" style="width: 100%">
              <el-input v-model="form.start" />
              <el-input v-model="form.end" />
            </div>
          </el-form-item>
        </el-form>

        <div class="hr" />
        <div class="panel-title">分级判定输入（仅五项，决定 L1~L4）</div>
        <el-form label-width="140px" size="small">
          <el-form-item label="ASIL 等级" required>
            <el-select v-model="input.asil" placeholder="选择" style="width: 160px">
              <el-option v-for="a in ['D', 'C', 'B', 'A', 'QM']" :key="a" :value="a" :label="a" />
            </el-select>
          </el-form-item>
          <el-form-item label="CAL 信息安全等级" required>
            <el-select v-model="input.cal" style="width: 160px">
              <el-option v-for="c in [0, 1, 2, 3, 4]" :key="c" :value="c" :label="`CAL ${c}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="自研软件属性" required>
            <el-select v-model="input.selfDev" style="width: 220px">
              <el-option value="FULL" label="自研软件（含新增功能）" />
              <el-option value="PARAM_ONLY" label="仅参数配置" />
              <el-option value="NONE_HW" label="无自研软件（纯硬件）" />
              <el-option value="NONE_DOC" label="无自研软件（纯文档/参数变更）" />
            </el-select>
          </el-form-item>
          <el-form-item label="新架构 / 新算法" required>
            <el-switch v-model="input.newArch" />
          </el-form-item>
          <el-form-item label="客户强制要求（安全相关）" required>
            <el-switch v-model="input.customerSafety" />
          </el-form-item>
        </el-form>

        <div class="hr" />
        <div class="panel-title">技术方案与报价关联（C-02）</div>
        <div class="row wrap">
          <el-checkbox v-model="schemeLinked">技术方案已关联（TS-E15-V2.1）</el-checkbox>
          <el-checkbox v-model="quoteLinked">报价单已关联（QT-2026-0087）</el-checkbox>
        </div>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">
            判定结果（查表，不写表达式）
            <span class="tag" :class="result.level ? 'l' + result.level.slice(1) : 'fail'">{{ te(result.level || '未定级') }}</span>
          </div>
          <div class="big" v-if="result.level">{{ te(result.level) }}</div>
          <div v-else class="big fail">未定级</div>
          <div class="muted" style="margin: 4px 0 10px">{{ LEVEL_DESC[result.level as Level] || '五项输入不齐，按最严禁要求阻断' }}</div>
          <div class="kv"><span>命中行号</span><em class="mono">{{ result.hitRowNo > 0 ? `第 ${result.hitRowNo} 行` : '未命中（缺项）' }}</em></div>
          <div class="kv"><span>判定依据</span><em>{{ result.basis }}</em></div>
          <div class="kv"><span>管控要点</span><em>{{ result.controlPoints }}</em></div>
          <div class="kv"><span>快照哈希</span><em class="mono">{{ result.trace.snapshotHash.slice(0, 32) }}…</em></div>
          <div class="kv"><span>判定留痕</span><em>{{ result.trace.decidedBy }} · {{ result.trace.decidedAt.slice(0, 19).replace('T', ' ') }}</em></div>
          <div v-if="result.missing.length" class="warn-box">缺项：{{ result.missing.join('、') }}</div>
        </div>

        <div class="panel">
          <div class="panel-title">六条裁定规则校验（校验层，不参与定级）</div>
          <div v-for="c in result.checks" :key="c.code" class="check">
            <span class="tag" :class="c.ok ? 'ok' : 'fail'">{{ c.ok ? 'OK' : '冲突' }}</span>
            <b class="mono">{{ c.code }}</b>
            <span>{{ c.name }}</span>
            <em>{{ c.note }}</em>
          </div>
          <el-empty v-if="!result.checks.length" description="五项输入齐备后显示校验结果" :image-size="54" />
        </div>

        <div class="panel">
          <div class="panel-title">
            Gate1 准入校验
            <span class="tag" :class="gate.passed ? 'ok' : 'fail'">{{ gate.passed ? '可提交' : `${gate.missing.length} 项阻断` }}</span>
          </div>
          <div v-for="r in gate.results" :key="r.code" class="check">
            <span class="tag" :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? '通过' : '阻断' }}</span>
            <b class="mono">{{ r.code }}</b>
            <span>{{ r.name }}</span>
            <em>{{ r.note }}</em>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { grade, LEVEL_DESC } from '@/domain/grading'
import type { GradingInput, Level } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const p = computed(() => store.currentProject)
const form = reactive({ name: p.value.name, customer: p.value.customer, productLine: p.value.productLine, platform: p.value.platform, owner: p.value.owner, start: p.value.start, end: p.value.end })
const init = p.value.grading?.input
const input = reactive<GradingInput>({ asil: init?.asil ?? '', cal: init?.cal ?? -1, selfDev: init?.selfDev ?? '', newArch: init?.newArch ?? null, customerSafety: init?.customerSafety ?? null })
const schemeLinked = ref(true)
const quoteLinked = ref(true)

// 主数据下拉（客户 / 产品线，与基础数据菜单同源）
const productCategories = computed(() => store.productCategories)
const linesOf = (categoryId: string) => store.productLines.filter((l) => l.categoryId === categoryId)

const result = computed(() => grade(input, store.actor))
const gate = computed(() => store.gateResults.G1)

function fillDemo(level: 'L1' | 'L3') {
  if (level === 'L1') {
    Object.assign(input, { asil: 'B', cal: 2, selfDev: 'FULL', newArch: true, customerSafety: false })
  } else {
    Object.assign(input, { asil: 'QM', cal: 0, selfDev: 'PARAM_ONLY', newArch: false, customerSafety: false })
  }
}

function submit() {
  if (!result.value.level) {
    store.notify('error', '五项分级输入不齐，按最严禁要求阻断立项（CLS-001）')
    return
  }
  if (!schemeLinked.value || !quoteLinked.value) {
    store.notify('error', 'C-02：技术方案与报价必须已关联，未关联不得提交审批')
    return
  }
  const proj = store.currentProject
  const before = { level: proj.level }
  proj.level = result.value.level
  proj.grading = { input: { ...input }, result: result.value }
  // 主数据打通：客户 / 产品线回写项目台账，与基础数据菜单同源
  proj.customer = form.customer
  proj.productLine = form.productLine
  proj.name = form.name
  proj.platform = form.platform
  store.log('SUBMIT', '项目', proj.id, { level: proj.level, row: result.value.hitRowNo }, before)
  store.notify('success', `立项申请已提交：判定 ${result.value.level}（命中第 ${result.value.hitRowNo} 行），留痕哈希 ${result.value.trace.snapshotHash.slice(0, 10)}…`)
}
</script>

<style scoped>
.big { font-size: 40px; font-weight: 800; letter-spacing: -1px; color: #7dd3fc; }
.big.fail { color: #f87171; }
.kv { display: grid; grid-template-columns: 84px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; color: var(--text-1); }
.check { display: flex; gap: 7px; align-items: flex-start; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.check em { margin-left: auto; font-style: normal; color: var(--text-3); text-align: right; max-width: 46%; }
.warn-box { margin-top: 8px; padding: 7px 9px; border: 1px solid #5b3c14; background: #2a1f10; color: #ffd79a; border-radius: 6px; font-size: 11.5px; }
</style>
