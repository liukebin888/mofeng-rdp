<template>
  <div>
    <PageHeader title="交付物清单" desc="Gate 放行前交付物齐套、缺件率 0；未冻结基线不得交付（C-19/C-20）；签收或拒收结论必须留痕（C-21）">
      <template #actions>
        <el-button size="small" :disabled="missing.length" type="primary" @click="submit">提交 Gate5 交付</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="应有交付物" :value="required.length" unit="项" />
      <KpiCard label="已提供" :value="required.length - missing.length" unit="项" zone="ok" />
      <KpiCard label="缺件" :value="missing.length" unit="项" :zone="missing.length ? 'danger' : 'ok'" sub="缺件逐条可下钻" />
      <KpiCard label="基线冻结" :value="frozen ? '已冻结' : '未冻结'" :zone="frozen ? 'ok' : 'danger'" sub="未冻结不得交付" />
    </div>

    <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">交付物台账（按 Gate 分组）</div>
        <el-table :data="list" size="small" height="400">
          <el-table-column prop="code" label="编号" width="96" />
          <el-table-column prop="name" label="交付物" min-width="190" />
          <el-table-column prop="category" label="类别" width="70" />
          <el-table-column prop="gate" label="Gate" width="66" />
          <el-table-column label="必须" width="60"><template #default="{ row }"><span class="tag" :class="row.required ? 'cond' : ''">{{ row.required ? '必须' : '可选' }}</span></template></el-table-column>
          <el-table-column label="状态" width="86">
            <template #default="{ row }"><span class="tag" :class="row.provided ? 'ok' : 'fail'">{{ row.provided ? '已提供' : '缺件' }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="96">
            <template #default="{ row }"><el-button v-if="!row.provided" link size="small" @click="provide(row)">登记提供</el-button></template>
          </el-table-column>
        </el-table>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">缺件阻断清单（输出后可逐条下钻）</div>
          <div v-for="d in missing" :key="d.id" class="miss">
            <span class="mono">{{ d.code }}</span>
            <span>{{ d.name }}</span>
            <span class="tag fail">{{ d.gate }}</span>
          </div>
          <el-empty v-if="!missing.length" description="无缺件，可提交 Gate5" :image-size="54" />
        </div>

        <div class="panel">
          <div class="panel-title">发运与签收</div>
          <div class="kv"><span>发运单号</span><em class="mono">SHIP-2026-0142</em></div>
          <div class="kv"><span>承运商</span><em>中远物流</em></div>
          <div class="kv"><span>数量</span><em class="num">30 台（OTS）</em></div>
          <div class="kv"><span>签收结论</span><em><span class="tag ok">已签收</span> 客户 SQE 张工 · 2026-10-28</em></div>
          <div class="row" style="margin-top: 8px">
            <el-button size="small" @click="reject">模拟拒收</el-button>
            <span class="dim">拒收须启动 8D 并回退交付状态（C-21）</span>
          </div>
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
const list = computed(() => store.projectDeliverables)
const required = computed(() => list.value.filter((d) => d.required))
const missing = computed(() => required.value.filter((d) => !d.provided))
const frozen = computed(() => store.projectBaselines.some((b) => b.status === '已冻结'))

function provide(row: { id: string; code: string }) {
  const d = list.value.find((x) => x.id === row.id)
  if (!d) return
  // PMC-037：未发布文档不计入交付物齐套——登记提供前须校验关联受控文档已发布
  if (d.category === '文档' || d.category === '图纸' || d.category === '报告') {
    const linked = store.projectDocs.find((doc) => doc.name.replace(/\s+/g, '') === d.name.replace(/\s+/g, ''))
    if (linked && linked.status !== '已发布') {
      store.notify('error', `PMC-037：${linked.code} 尚未受控发布（当前「${linked.status}」），不计入齐套，禁止登记提供`)
      store.log('UPDATE', '交付物', d.id, { provided: false }, { reason: 'PMC-037 未发布拦截' }, 'DENY')
      return
    }
  }
  d.provided = true
  store.log('UPDATE', '交付物', d.id, { provided: true })
  store.notify('success', `${d.code} ${d.name} 已登记提供`)
}
function submit() {
  if (missing.value.length) {
    store.notify('error', `C-19：缺件 ${missing.value.length} 项，阻断放行`)
    return
  }
  if (!frozen.value) {
    store.notify('error', 'C-20：对应基线未冻结，不得交付')
    return
  }
  store.log('SUBMIT', '交付', store.projectId, { gate: 'G5' })
  store.notify('success', 'Gate5 交付已提交，等待客户签收')
}
function reject() {
  store.notify('warning', '已登记拒收：启动 8D，交付状态回退为「待重新交付」（C-21）')
  store.log('UPDATE', '交付', store.projectId, { result: '拒收', action: '8D 启动' })
}
</script>

<style scoped>
.miss { display: grid; grid-template-columns: 84px 1fr 56px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv { display: grid; grid-template-columns: 74px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; }
.dim { color: var(--text-3); font-size: 10.5px; }
</style>
