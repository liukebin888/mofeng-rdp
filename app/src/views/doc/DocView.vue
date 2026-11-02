<template>
  <div>
    <PageHeader title="文档库与版本" desc="草稿→会签中→已发布→已作废；未发布不计入齐套（PMC-037）；多专业会签并行，任一否决整体退回（DOC-014）">
      <template #actions>
        <el-input v-model="query" placeholder="全文检索（DOC-008）" size="small" style="width: 200px" clearable @input="onSearch" />
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="受控文档" :value="docs.length" unit="份" />
      <KpiCard label="已发布" :value="published.length" unit="份" zone="ok" />
      <KpiCard label="会签未齐" :value="unsigned.length" unit="份" :zone="unsigned.length ? 'danger' : 'ok'" sub="缺签不得发布（C-45）" />
      <KpiCard label="MDR/TDR 齐套率" :value="mdrRate" unit="%" :target="100" :zone="mdrRate >= 100 ? 'ok' : 'warn'" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">文档清单（四态状态机 + 会签进度 + 版本链）</div>
      <el-table :data="docs" size="small" :row-class-name="rowClass">
        <el-table-column prop="code" label="编号" width="120" />
        <el-table-column prop="name" label="文档名称" min-width="180" />
        <el-table-column prop="discipline" label="专业" width="66" />
        <el-table-column prop="version" label="版本" width="70" />
        <el-table-column prop="mdrSet" label="MDR/TDR" width="90" />
        <el-table-column label="会签" width="150">
          <template #default="{ row }">
            <span class="tag" :class="signedCount(row) === row.signoffs.length ? 'ok' : 'cond'">{{ signedCount(row) }}/{{ row.signoffs.length }} 已签</span>
            <span v-if="row.signoffs.some((s: any) => s.veto)" class="tag fail" style="margin-left: 4px">否决</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="86">
          <template #default="{ row }"><span class="tag" :class="statusClass(row.status)">{{ te(row.status) }}</span></template>
        </el-table-column>
        <el-table-column label="版本链" width="120">
          <template #default="{ row }">
            <span class="mono dim" style="font-size: 10px">{{ row.versionChain.map((v: any) => v.version + (v.status === '有效' ? '✓' : v.status === '已作废' ? '×' : '')).join(' ← ') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230">
          <template #default="{ row }">
            <el-button v-if="row.status === '草稿'" link size="small" @click="submitSignoff(row)">发起会签</el-button>
            <el-button v-if="row.status === '会签中'" link size="small" @click="sign(row)">会签</el-button>
            <el-button v-if="row.status === '会签中'" link size="small" type="danger" @click="veto(row)">否决</el-button>
            <el-button v-if="row.status === '已发布'" link size="small" @click="download(row)">下载</el-button>
            <el-button v-if="row.status === '已发布'" link size="small" @click="share(row)">外链</el-button>
            <el-button v-if="row.status !== '已作废'" link size="small" @click="obsolete(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">文件交换外链（SUP-016 · 默认 7 天失效 · 可撤销 · 内外分离）</div>
      <el-table :data="store.shareLinks" size="small">
        <el-table-column prop="docName" label="文件" min-width="180" />
        <el-table-column label="到期时间" width="180"><template #default="{ row }"><span class="mono dim">{{ row.expireAt.slice(0, 10) }}</span></template></el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span v-if="row.revokedAt" class="tag fail">已撤销</span>
            <span v-else-if="expired(row)" class="tag cond">已到期</span>
            <span v-else class="tag ok">可访问</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button v-if="!row.revokedAt && !expired(row)" link size="small" type="danger" @click="store.revokeDocShareLink(row.id)">撤销</el-button>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!store.shareLinks.length" description="暂无外链，对「已发布」文档可生成外链（7 天有效）" :image-size="40" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="panel">
        <div class="panel-title">MDR / TDR 齐套检测（DOC-012）</div>
        <div v-for="s in sets" :key="s.name" class="srow">
          <span>{{ s.name }}</span>
          <el-progress :percentage="s.rate" :stroke-width="6" :show-text="false" :color="s.rate >= 100 ? '#22c55e' : '#f59e0b'" />
          <span class="num">{{ s.rate }}%</span>
          <span class="tag" :class="s.rate >= 100 ? 'ok' : 'fail'">{{ s.rate >= 100 ? '齐套' : '缺 ' + s.missing }}</span>
        </div>
        <div class="panel-title" style="margin-top: 12px">评审意见闭环（DOC-007）</div>
        <div v-for="c in openComments" :key="c.id" class="cmt">
          <span class="tag fail">未关闭</span>
          <span>{{ c.role }} · {{ c.author }}：{{ c.content }}</span>
          <el-button link size="small" @click="resolveComment(c)">关闭</el-button>
        </div>
        <el-empty v-if="!openComments.length" description="无未关闭评审意见" :image-size="40" />
      </div>

      <div class="grid" style="gap: 12px; align-content: start">
        <div class="panel">
          <div class="panel-title">图文档在线批注（Oracle 对标 P2）</div>
          <div class="grid grid-4" style="margin-bottom: 8px">
            <KpiCard label="批注总数" :value="store.annotationSummary.total" unit="条" />
            <KpiCard label="未解决" :value="store.annotationSummary.open" unit="条" :zone="store.annotationSummary.open ? 'danger' : 'ok'" />
            <KpiCard label="已解决" :value="store.annotationSummary.resolved" unit="条" />
            <KpiCard label="解决率" :value="store.annotationSummary.resolveRate" unit="%" :zone="store.annotationSummary.resolveRate === 100 ? 'ok' : 'warn'" />
          </div>
          <div v-for="a in store.projectAnnotations" :key="a.id" class="cmt">
            <span class="tag" :style="{ background: ANNOTATION_COLORS[a.type] + '22', color: ANNOTATION_COLORS[a.type] }">{{ a.type }}</span>
            <span class="tag" :class="a.status === '已解决' ? 'ok' : 'fail'">{{ a.status }}</span>
            <span class="dim" style="font-family: var(--mono)">{{ docCodeOf(a.docId) }}</span>
            <span class="dim">P{{ a.anchor.page }} · {{ a.anchor.region }}</span>
            <span>{{ a.author }}：{{ a.content }}</span>
            <span v-if="a.resolution" class="dim">→ {{ a.resolution }}（{{ a.resolvedBy }}）</span>
          </div>
          <el-empty v-if="!store.projectAnnotations.length" description="无在线批注" :image-size="40" />
          <div class="src-note" style="margin-top: 8px">
            批注锚定到（页码 + 坐标 + 区域），支持高亮/圈注/下划线/文字四类；解决须留痕（解决人 + 结论）。
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">全文检索（DOC-008）</div>
          <div v-if="searchState.hits.length" class="hit-list">
            <div v-for="h in searchState.hits" :key="h.doc.id" class="hit">
              <span class="mono">{{ h.doc.code }}</span>
              <span>{{ h.doc.name }}</span>
              <span class="tag cond">{{ h.fields.join('、') }}</span>
            </div>
          </div>
          <div v-if="searchState.dupGroups.length" class="src-note" style="margin-top: 8px">
            <b>重复文档提示：</b>
            <div v-for="(g, i) in searchState.dupGroups" :key="i">{{ g.map((d) => d.code + '(' + d.version + ')').join(' vs ') }}</div>
          </div>
          <el-empty v-if="!query" description="输入关键词检索" :image-size="40" />
          <el-empty v-else-if="!searchState.hits.length" description="无命中" :image-size="40" />
        </div>

        <div class="panel">
          <div class="panel-title">发布与受控规则</div>
          <div class="src-note">
            ① 未发布不计入齐套（PMC-037）；<br />
            ② 会签齐备 + 无未关闭意见才可发布（DOC-004/C-45/DOC-007）；<br />
            ③ 任一否决整体退回草稿并保留意见（DOC-014）；<br />
            ④ 作废后禁止下载，仅历史查询（DOC-005/009）。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { isSignoffComplete } from '@/domain/docEngine'
import { ANNOTATION_COLORS } from '@/domain/docAnnotation'

const store = useAppStore()
const { te } = useI18n()
const query = ref('')
const searchState = reactive<{ hits: { doc: any; fields: string[] }[]; dupGroups: any[][] }>({ hits: [], dupGroups: [] })

const docs = computed(() => store.projectDocs)
const published = computed(() => docs.value.filter((d) => d.status === '已发布'))
const unsigned = computed(() => docs.value.filter((d) => d.required && d.status !== '已发布'))
const mdrRate = computed(() => (docs.value.length ? Math.round((published.value.length / docs.value.length) * 100) : 100))
const sets = computed(() => {
  const names = Array.from(new Set(docs.value.map((d) => d.mdrSet)))
  return names.map((n) => {
    const list = docs.value.filter((d) => d.mdrSet === n)
    const ok = list.filter((d) => d.status === '已发布').length
    return { name: n, rate: Math.round((ok / list.length) * 100), missing: list.length - ok }
  })
})
const openComments = computed(() => docs.value.flatMap((d) => d.comments.filter((c) => !c.resolved).map((c) => ({ ...c, docId: d.id, docCode: d.code }))))
function docCodeOf(docId: string): string {
  return docs.value.find((d) => d.id === docId)?.code ?? docId
}

function signedCount(row: any) {
  return row.signoffs.filter((s: any) => s.signed).length
}
function statusClass(s: string) {
  return s === '已发布' ? 'ok' : s === '会签中' ? 'cond' : s === '已作废' ? 'fail' : ''
}
function rowClass({ row }: any) {
  return row.status === '已作废' ? 'obsolete-row' : ''
}
function onSearch() {
  const r = store.docSearch(query.value)
  searchState.hits = r.hits
  searchState.dupGroups = r.dupGroups
}

function submitSignoff(row: any) {
  store.docSubmitSignoff(row.id)
}
function sign(row: any) {
  // 会签当前用户所属角色
  const role = store.currentUser.roleName
  store.docSignoff(row.id, role)
}
function veto(row: any) {
  const comment = prompt('请输入否决意见（DOC-007 条目化）', '')
  if (comment === null) return
  store.docVeto(row.id, store.currentUser.roleName, comment || '未填写意见')
}
function download(row: any) {
  store.docDownload(row.id)
}
function share(row: any) {
  store.createDocShareLink(row.id)
}
function expired(row: any) {
  return new Date().getTime() >= new Date(row.expireAt).getTime()
}
function obsolete(row: any) {
  store.docObsolete(row.id)
}
function resolveComment(c: any) {
  const res = prompt('关闭意见须填写验证结论（DOC-007）', '已整改并复测通过')
  if (res === null) return
  store.docResolveComment(c.docId, c.id, res)
}
</script>

<style scoped>
.srow { display: grid; grid-template-columns: 90px 1fr 48px 84px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.cmt { display: flex; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; flex-wrap: wrap; }
.hit-list { display: flex; flex-direction: column; gap: 4px; }
.hit { display: flex; gap: 8px; align-items: center; font-size: 11.5px; padding: 3px 0; }
:deep(.obsolete-row) { opacity: 0.45; }
</style>
