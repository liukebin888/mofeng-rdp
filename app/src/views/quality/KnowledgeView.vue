<template>
  <div>
    <PageHeader title="复盘与经验库" desc="阶段复盘（C-34）+ 经验库登记/检索/回存资料库（COM-010 / C-35：入库打标签、按项目/阶段/问题类型检索复用、推送记录可查）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="复盘记录" :value="store.projectRetros.length" unit="项" />
      <KpiCard label="复盘三要素齐备" :value="completeRetros" unit="项" :zone="completeRetros === store.projectRetros.length ? 'ok' : 'warn'" />
      <KpiCard label="经验条目" :value="store.data.lessons.length" unit="条" />
      <KpiCard label="已回存资料库" :value="ks.pushed" unit="条" :zone="ks.pushed === store.data.lessons.length ? 'ok' : 'warn'" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">阶段复盘（C-34）</div>
        <div v-for="r in store.projectRetros" :key="r.id" class="card">
          <div class="between">
            <b>{{ te(r.stage) }}</b>
            <span class="tag" :class="retroOk(r) ? 'ok' : 'fail'">{{ retroOk(r) ? '三要素齐备' : '缺要素' }}</span>
          </div>
          <div class="dim">目标达成：{{ r.goalMet || '—' }}</div>
          <div class="dim">偏差原因：{{ r.deviationReason || '—' }}</div>
          <div class="dim">改进项：{{ r.improvement || '—' }}</div>
        </div>
        <el-empty v-if="!store.projectRetros.length" description="无复盘记录" :image-size="54" />
      </div>

      <div class="panel">
        <div class="panel-title">经验登记（COM-010：主题 + 阶段必填）</div>
        <el-form label-position="top" size="small">
          <el-form-item label="主题（必填）">
            <el-input v-model="form.title" placeholder="一句话主题，如：旋变信号共因失效规避" />
          </el-form-item>
          <el-form-item label="阶段标签（必填）">
            <el-select v-model="form.stage" placeholder="选择阶段" style="width: 100%">
              <el-option v-for="s in LESSON_STAGES" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
          <el-form-item label="问题类型">
            <el-select v-model="form.category" placeholder="选择问题类型" style="width: 100%">
              <el-option v-for="c in LESSON_CATEGORIES" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
          <el-form-item label="标签（逗号分隔）">
            <el-input v-model="form.tagsText" placeholder="硬件,EMC,ASIL-B" />
          </el-form-item>
          <el-form-item label="内容">
            <el-input v-model="form.content" type="textarea" :rows="3" placeholder="经验正文" />
          </el-form-item>
          <el-button type="primary" size="small" @click="submitLesson">登记入库</el-button>
        </el-form>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">经验库检索（C-35：按项目 / 阶段 / 问题类型 / 关键词，跨项目复用）</div>
      <div class="grid" style="grid-template-columns: 1.2fr 1fr 1fr 1.6fr auto; gap: 8px; align-items: center; margin-bottom: 10px">
        <el-select v-model="q.projectId" size="small" placeholder="项目">
          <el-option label="全部项目（立项复用）" value="*" />
          <el-option v-for="p in store.visibleProjects" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <el-select v-model="q.stage" size="small" clearable placeholder="阶段">
          <el-option v-for="s in LESSON_STAGES" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="q.category" size="small" clearable placeholder="问题类型">
          <el-option v-for="c in LESSON_CATEGORIES" :key="c" :label="c" :value="c" />
        </el-select>
        <el-input v-model="q.keyword" size="small" placeholder="关键词检索标题/内容/标签" clearable />
        <el-button size="small" type="primary" @click="doSearch">检索</el-button>
      </div>

      <div class="dim" style="margin-bottom: 8px">命中 <b>{{ results.length }}</b> 条（复用累计 <b>{{ ks.reused }}</b> 次）</div>
      <div v-for="l in results" :key="l.id" class="card">
        <div class="between">
          <b class="mono">{{ l.code }}</b>
          <div style="display: flex; gap: 6px; align-items: center">
            <span class="tag" :class="l.tags.length ? 'ok' : 'fail'">{{ l.tags.length ? `${l.tags.length} 标签` : '未打标签' }}</span>
            <span class="tag cond">{{ te(l.stage) }}</span>
            <span class="tag">{{ te(l.category) }}</span>
          </div>
        </div>
        <div class="t">{{ l.title }}</div>
        <div class="dim">{{ l.content }}</div>
        <div class="tags">
          <span v-for="t in l.tags" :key="t" class="tag cond">{{ t }}</span>
        </div>
        <div class="dim" style="margin-top: 6px">
          所属项目：<b>{{ projectName(l.projectId) }}</b>
          <template v-if="l.reusedBy.length">｜复用：{{ l.reusedBy.map(projectName).join('、') }}</template>
        </div>
        <div class="between" style="margin-top: 8px">
          <div class="dim">
            <template v-if="l.pushLog.length">
              推送记录：
              <span v-for="(p, i) in l.pushLog" :key="i" class="tag">{{ p.target }}（{{ p.at.slice(0, 10) }}·{{ p.by }}）</span>
            </template>
            <template v-else>未回存资料库</template>
          </div>
          <div style="display: flex; gap: 6px">
            <el-button size="small" type="primary" plain @click="store.pushLessonToLibrary(l.id, libTarget)">回存资料库</el-button>
            <el-button size="small" plain @click="store.reuseLesson(l.id, store.projectId)">标记复用</el-button>
          </div>
        </div>
      </div>
      <el-empty v-if="!results.length" description="无匹配经验" :image-size="54" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import type { RetroItem } from '@/domain/types'
import { LESSON_CATEGORIES, LESSON_STAGES } from '@/domain/lessonEngine'

const store = useAppStore()
const { te } = useI18n()

const retroOk = (r: RetroItem) => !!(r.goalMet.trim() && r.deviationReason.trim() && r.improvement.trim())
const completeRetros = computed(() => store.projectRetros.filter(retroOk).length)
const ks = computed(() => store.knowledgeStats())

const form = reactive({ title: '', stage: '', category: '硬件', tagsText: '', content: '' })

const q = reactive({ projectId: '*', stage: '', category: '', keyword: '' })
const results = ref(store.data.lessons)
const libTarget = ref('研发经验库/通用')

function submitLesson() {
  const tags = form.tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
  const ok = store.addLesson({ title: form.title, content: form.content, stage: form.stage, category: form.category, tags })
  if (ok) {
    form.title = ''
    form.content = ''
    form.tagsText = ''
    doSearch()
  }
}

function doSearch() {
  results.value = store.searchLessons({ ...q })
}

function projectName(id: string) {
  return store.visibleProjects.find((p) => p.id === id)?.name ?? id
}
</script>

<style scoped>
.card { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
.card .t { font-size: 12.5px; color: var(--text-1); margin: 3px 0; }
.between { display: flex; justify-content: space-between; align-items: center; }
.tags { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
.dim { color: var(--text-3); font-size: 11.5px; }
</style>
