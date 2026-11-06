<template>
  <div>
    <PageHeader title="项目主计划 · 集成视图" desc="深度参照 RMP 研发管理平台项目主计划：项目上下文 + 5 项 KPI + 产品等级工时估算 + 集成整体视图（统一时间轴 / 里程碑×分计划支撑矩阵 / 分计划只读投影）。分计划数据投影自四级计划十大专业线，只读不可编辑。">
      <template #actions>
        <el-button size="small" @click="$router.push('/project/plan')">返回编辑模式</el-button>
      </template>
    </PageHeader>

    <!-- ① 项目上下文条 + RAG -->
    <div class="mp-projbar">
      <div class="mp-projbar-l">
        <span class="mp-projbar-lab">项目</span>
        <el-select v-model="projId" size="small" style="width: 260px" @change="onProjChange">
          <el-option v-for="p in store.spaceProjects" :key="p.id" :value="p.id" :label="`${p.code} · ${p.name}`" />
        </el-select>
        <span class="mp-projbar-ctx">
          <b>{{ proj.name }}</b> · 负责人 {{ projOwner }} · {{ proj.productLine || '—' }} · 周期 {{ projStart }}–{{ projEnd }}
          <el-link type="primary" :underline="false" @click="$router.push('/plan/list')">项目台账↗</el-link>
        </span>
      </div>
      <div class="mp-rag">
        <span class="rag" :class="ragCls"><i />{{ rag.label }}</span>
      </div>
    </div>

    <!-- ② 5 项 KPI -->
    <div class="grid grid-5" style="margin-top: 14px">
      <KpiCard label="计划总数" :value="kpis.total" unit="项" sub="1 主 + 5 分" />
      <KpiCard label="关键里程碑" :value="kpis.milestone" sub="CG1–CG7" />
      <KpiCard label="已完成里程碑" :value="kpis.done" :sub="`/ ${kpis.milestone}`" :zone="kpis.done ? 'ok' : ''" />
      <KpiCard label="关联风险" :value="kpis.risk" sub="高优先" :zone="kpis.risk ? 'danger' : 'ok'" />
      <KpiCard label="已同步分计划" :value="kpis.synced" :sub="`/ ${DEV_PLANS.length} 已确认`" :zone="kpis.synced ? 'ok' : 'warn'" />
    </div>

    <!-- ③ 项目产品等级与工时估算 -->
    <div class="panel" style="margin-top: 16px">
      <div class="panel-title">
        项目产品等级与工时估算
        <span class="sub-note">为项目产品清单设定等级（L1–L5，与输出等级一致），并依据「主计划计算等级」统一估算各分计划所需工时（1 工时 = 8 小时）</span>
      </div>
      <div class="pg-gd">
        <div class="pg-gd-l">
          <span class="pg-gd-t">主计划计算等级（所有分计划均按此等级估算工时）</span>
          <el-select v-model="calcGrade" size="small" style="width: 140px">
            <el-option v-for="l in LEVEL_OPTS" :key="l" :value="l" :label="`L${l}（${LEVEL_COEF[l] * 100}%）`" />
          </el-select>
          <span class="pg-gd-note">当前按 <b>L{{ calcGrade }}（{{ LEVEL_COEF[calcGrade] * 100 }}%）</b> 计算 · 1 工时 = 8 小时</span>
        </div>
      </div>

      <div class="pb" style="padding: 0; margin-top: 12px">
        <div class="sec-t">项目产品清单（含产品等级）</div>
        <el-table :data="MASTER_PLAN.products" size="small" border>
          <el-table-column prop="cat" label="产品大类" width="120" />
          <el-table-column prop="name" label="产品" min-width="140" />
          <el-table-column prop="model" label="型号" min-width="120" />
          <el-table-column label="产品等级" width="160">
            <template #default="{ row }">
              <el-select v-model="row.grade" size="small" style="width: 130px">
                <el-option v-for="l in LEVEL_OPTS" :key="l" :value="l" :label="`L${l}（${LEVEL_COEF[l] * 100}%）`" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pb" style="padding: 0; margin-top: 14px">
        <div class="sec-t">各分计划工时估算（按主计划计算等级 L{{ calcGrade }}）</div>
        <el-table :data="estimate.planWorks" size="small" border>
          <el-table-column label="分计划" min-width="180">
            <template #default="{ row }">
              <span class="dot" :style="{ background: row.hue }" />{{ row.name }}
            </template>
          </el-table-column>
          <el-table-column label="标准工时（L{{ calcGrade }}）" width="160" align="right">
            <template #default="{ row }"><b>{{ row.work }}</b> 工时</template>
          </el-table-column>
          <el-table-column label="折合小时" width="140" align="right">
            <template #default="{ row }">{{ row.hours }} 小时</template>
          </el-table-column>
        </el-table>
        <div class="wh-foot">
          <span>标准输出文档合计：<b>{{ estimate.docWork }}</b> 工时（{{ +(estimate.docWork * 8).toFixed(1) }} 小时）</span>
          <span style="margin-left: 24px">全部合计（分计划 + 文档）：<b>{{ estimate.totalWork }}</b> 工时（{{ estimate.totalHours }} 小时）</span>
        </div>
      </div>
    </div>

    <!-- ④ 项目主计划集成整体视图 -->
    <div class="panel" style="margin-top: 16px">
      <div class="panel-title">
        项目主计划（集成整体视图）
        <span class="sub-note">项目主计划（CG1–CG7）与各分计划（结构 / 硬件 / 软件 / 测试验证 / 过程）统一编排于同一时间轴，并展开里程碑门禁与分计划支撑，合成一个整体；分计划只读投影自「研发管理 · 开发计划」，修改请在开发计划中完成</span>
      </div>

      <!-- 统一时间轴 -->
      <div class="pp-uni">
        <div class="pp-uni-h">统一时间轴（项目主计划 + 各分计划 · 同一时间基准，红线为今天，跨所有泳道）</div>
        <div class="pp-tl-scroll">
          <div class="pp-lanes">
            <div v-for="(lane, i) in lanes" :key="lane.key" class="pp-lane" :class="{ master: lane.key === 'mp' }" :style="{ '--hue': lane.hue }">
              <div class="pp-lane-lab">
                <span class="dot" :style="{ background: lane.hue }" />{{ lane.name }}
                <span v-if="lane.key === 'mp'" class="mtag">主</span>
              </div>
              <div class="pp-lane-track">
                <div class="pp-lane-line" />
                <div
                  v-for="(n, k) in sortedTimeline(lane.timeline)"
                  :key="n.name"
                  class="tl-node"
                  :style="{ left: posOf(lane, n, k) + '%' }"
                >
                  <div class="tl-box" :class="k % 2 === 0 ? 'tl-above' : 'tl-below'">
                    <div class="tl-name">{{ stripCg(n.name) }}</div>
                    <div class="tl-meta">{{ n.date }} · {{ n.owner }}</div>
                    <span class="badge" :class="TL_ST[n.status].cls">{{ TL_ST[n.status].t }}</span>
                  </div>
                  <div class="tl-dot" :class="TL_ST[n.status].cls" :title="`${stripCg(n.name)} · ${n.date} · ${n.owner} · ${TL_ST[n.status].t}`" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="pp-legend">
          <span><i class="lg" style="background: #16a34a" />已完成</span>
          <span><i class="lg" style="background: #0891b2" />进行中</span>
          <span><i class="lg" style="background: #94a3b8" />未开始</span>
          <span><i class="lg" style="background: #ff4d4f" />今天（{{ todayLabel }}）</span>
          <span class="sub">· 同侧相邻图框间隔 ≥ 2mm；可横向滚动</span>
        </div>
      </div>

      <!-- 里程碑 × 分计划支撑矩阵 -->
      <div class="pp-master" style="margin-top: 14px">
        <div class="pp-master-h">
          <span class="dot" style="background: #dc2626; width: 10px; height: 10px; border-radius: 50%" />项目关键里程碑 × 各分计划支撑（集成整体）
          <span class="mtag">主计划</span>
        </div>
        <div class="mm-list">
          <div v-for="(w, i) in matrix" :key="w.milestone.name" class="mm-card" :class="{ open: i === 0 }">
            <div class="mm-head" @click="toggleCard(w.milestone.name)">
              <span class="mm-caret">▸</span>
              <span class="mm-badge">{{ w.milestone.name.split('-')[0] }}</span>
              <b class="mm-name">{{ stripCg(w.milestone.name) }}</b>
              <span class="cg-d">{{ w.milestone.date }}</span>
              <span class="cg-o">{{ w.milestone.owner }}</span>
              <span class="cg-dot" :class="TL_ST[w.milestone.status].cls" />
            </div>
            <div class="mm-body" v-show="openCards.has(w.milestone.name) || i === 0">
              <div class="mm-desc">{{ w.milestone.desc }}</div>
              <div class="mm-cap">分计划支撑活动（窗口 {{ w.lo }} → {{ w.up }}）</div>
              <div v-if="w.subs.length" class="mm-subs">
                <div v-for="s in w.subs" :key="s.plan.key" class="mm-sub" :style="{ borderLeft: `3px solid ${s.plan.hue}` }">
                  <div class="mm-sub-h"><span class="dot" :style="{ background: s.plan.hue }" />{{ s.plan.name }}</div>
                  <div class="mm-acts">
                    <span v-for="a in s.acts" :key="a.node.name" class="mm-act">
                      <i class="lg" :class="TL_ST[a.node.status].cls" />{{ a.node.name }} <em>{{ a.node.date.slice(5) }}</em>
                    </span>
                  </div>
                </div>
              </div>
              <div v-else class="mm-subs mm-empty">本里程碑窗口（{{ w.lo }} → {{ w.up }}）内暂无分计划活动</div>
            </div>
            <div class="mm-foot">
              <span v-if="w.subs.length" class="mm-sum">支撑：{{ w.subs.map((s) => `${s.plan.name} ${s.acts.length}`).join(' · ') }}</span>
              <span v-else class="mm-sum">本窗口暂无分计划活动</span>
            </div>
          </div>
        </div>
        <div class="mm-legend">
          <span><i class="lg" style="background: #16a34a" />已完成</span>
          <span><i class="lg" style="background: #0891b2" />进行中</span>
          <span><i class="lg" style="background: #94a3b8" />未开始</span>
          <span class="mm-lg-note">窗口 = 上一里程碑 → 本里程碑（归集各分计划活动）；末窗口含 CG7 之后收尾活动</span>
        </div>
      </div>

      <!-- 分计划只读投影 -->
      <div class="pp-subs-h">分计划只读投影（数据引用自「研发管理 / 开发计划」，本页不可编辑）</div>
      <div class="pp-subs-grid" style="margin-top: 2px">
        <div v-for="s in projections" :key="s.plan.key" class="pp-sub" :style="{ '--hue': s.plan.hue }">
          <div class="pp-sub-h">
            <span class="dot" :style="{ background: s.plan.hue }" />{{ s.plan.name }}
            <span class="pp-ro" :class="s.confirmed ? 'pp-ro-ok' : 'pp-ro-wait'">
              {{ s.confirmed ? '✅ 已同步 · 投影自「研发管理 / 开发计划」' : '⏳ 待确认 · 投影自「研发管理 / 开发计划」' }}
            </span>
          </div>
          <div class="po">负责人 {{ s.plan.owner }} · {{ s.plan.scope }}</div>
          <div class="req">
            <span class="tag comp fusa">功能安全</span> <span class="rq-l">{{ s.plan.fusa }}</span>
          </div>
          <div class="req">
            <span class="tag comp is">信息安全</span> <span class="rq-l">{{ s.plan.is }}</span>
          </div>
          <div class="req">
            <span class="tag comp as">ASPICE</span> <span class="rq-l">{{ s.plan.aspice }}</span>
          </div>
          <div class="sec-t" style="margin: 8px 0 6px">关键输出文档（只读 · 在开发计划中维护）</div>
          <div class="pout">
            <div v-for="o in s.outputStates" :key="o.name" class="po orow">
              <span>{{ o.name }} <span class="sub" style="font-size: 11px">· {{ o.type }}{{ o.doc ? ' · ' + o.doc : '' }}</span></span>
              <span class="badge" :class="o.cls">{{ o.state }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import {
  MASTER_PLAN,
  DEV_PLANS,
  SUB_ORDER,
  TL_ST,
  LEVEL_COEF,
  LEVEL_OPTS,
  unifiedTimelinePlans,
  milestoneMatrix,
  subProjections,
  masterPlanKpis,
  gradeEstimate,
  computeRag,
  type PlanTimelineNode
} from '@/domain/projectMasterPlan'

const store = useAppStore()
const router = useRouter()

const projId = ref(store.projectId)
const calcGrade = ref(MASTER_PLAN.calcGrade)

const proj = computed(() => store.spaceProjects.find((p) => p.id === projId.value) ?? store.spaceProjects[0] ?? { code: 'PRJ-001', name: '示例项目', productLine: '项目管理部', start: '2026-01-01', end: '2026-12-31', owner: '项目经理' } as any)
const projOwner = computed(() => (proj.value as any).owner ?? '项目经理')
const projStart = computed(() => (proj.value as any).start ?? (proj.value as any).from ?? '—')
const projEnd = computed(() => (proj.value as any).end ?? (proj.value as any).to ?? '—')

const kpis = computed(() => masterPlanKpis())
const rag = computed(() => computeRag())
const ragCls = computed(() => ({ red: 'rag-red', amber: 'rag-amber', green: 'rag-green' }[rag.value.cls]))
const estimate = computed(() => gradeEstimate(calcGrade.value))
const matrix = computed(() => milestoneMatrix())
const projections = computed(() => subProjections())
const lanes = computed(() => unifiedTimelinePlans())

function onProjChange() {
  // 仅切换视角；分计划/主计划数据为通用化只读投影，不随项目变化
  store.setProject(projId.value)
}

function stripCg(name: string): string {
  return name.replace(/^CG\d+[-—]?/, '')
}

function sortedTimeline(tl: PlanTimelineNode[]): PlanTimelineNode[] {
  return tl.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/** 统一时间轴节点位置（百分比），按泳道内时间范围映射，左右留白 */
function posOf(lane: { timeline: PlanTimelineNode[] }, node: PlanTimelineNode, idx: number): number {
  const arr = sortedTimeline(lane.timeline)
  const dates = arr.map((n) => new Date(n.date).getTime())
  const t0 = Math.min(...dates)
  const t1 = Math.max(...dates)
  const span = t1 - t0 || 1
  const IN = 6
  const p = IN + ((new Date(node.date).getTime() - t0) / span) * (100 - 2 * IN)
  void idx
  return Math.max(IN, Math.min(100 - IN, p))
}

const todayLabel = computed(() => {
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
})

// 里程碑卡片展开状态（首个默认展开）
const openCards = ref(new Set<string>())
function toggleCard(name: string) {
  const s = new Set(openCards.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  openCards.value = s
}

void router
void SUB_ORDER
</script>

<style scoped>
.mp-projbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-1); }
.mp-projbar-l { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mp-projbar-lab { font-size: 12px; font-weight: 700; color: var(--brand); }
.mp-projbar-ctx { font-size: 12px; color: var(--text-2); display: flex; align-items: center; gap: 8px; }
.mp-rag { display: flex; align-items: center; }
.rag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; }
.rag i { width: 8px; height: 8px; border-radius: 50%; }
.rag-red { color: #fca5a5; border: 1px solid #5b2020; background: #2a1114; }
.rag-red i { background: #ef4444; }
.rag-amber { color: #ffd79a; border: 1px solid #5b3c14; background: #2a1f10; }
.rag-amber i { background: #f59e0b; }
.rag-green { color: #9ae6b4; border: 1px solid #1d4a2e; background: #0f2418; }
.rag-green i { background: #22c55e; }

.sub-note { font-size: 11px; font-weight: 400; color: var(--text-3); }
.sec-t { font-size: 12px; font-weight: 600; color: var(--text-1); margin-bottom: 6px; }
.pg-gd { display: flex; flex-wrap: wrap; gap: 10px; }
.pg-gd-l { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pg-gd-t { font-size: 12px; font-weight: 600; color: var(--text-1); }
.pg-gd-note { font-size: 11px; color: var(--text-3); }
.pb { border: 1px solid var(--line-soft); border-radius: 8px; padding: 10px; }
.wh-foot { margin-top: 8px; font-size: 12px; color: var(--text-2); }

.pp-uni-h { font-size: 12px; font-weight: 600; color: var(--text-1); margin-bottom: 8px; }
.pp-tl-scroll { overflow-x: auto; }
.pp-lanes { display: flex; flex-direction: column; gap: 10px; min-width: 900px; }
.pp-lane { display: flex; gap: 10px; align-items: stretch; }
.pp-lane-lab { flex: none; width: 150px; font-size: 12px; font-weight: 600; color: var(--text-1); display: flex; align-items: center; gap: 6px; padding-top: 22px; }
.pp-lane.master .pp-lane-lab { color: #dc2626; }
.pp-lane-track { flex: 1; position: relative; height: 78px; }
.pp-lane-line { position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: var(--hue, #94a3b8); opacity: 0.35; border-radius: 1px; }
.tl-node { position: absolute; top: 0; height: 100%; display: flex; flex-direction: column; align-items: center; }
.tl-box { position: absolute; font-size: 10px; padding: 3px 7px; border-radius: 5px; background: var(--bg-2); border: 1px solid var(--line); white-space: nowrap; }
.tl-above { bottom: 55%; }
.tl-below { top: 55%; }
.tl-name { font-weight: 600; color: var(--text-1); }
.tl-meta { color: var(--text-3); font-size: 9px; }
.tl-dot { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; border-radius: 50%; }
.tl-dot.done { background: #16a34a; }
.tl-dot.doing { background: #0891b2; }
.tl-dot.todo { background: #94a3b8; }
.tl-dot.overdue { background: #ef4444; }
.badge { font-size: 9px; padding: 0 5px; border-radius: 4px; border: 1px solid; }
.badge.done { color: #9ae6b4; border-color: #1d4a2e; }
.badge.doing { color: #67e8f9; border-color: #155e75; }
.badge.todo { color: #cbd5e1; border-color: #475569; }
.badge.overdue { color: #fca5a5; border-color: #5b2020; }
.badge.approved { color: #9ae6b4; border-color: #1d4a2e; background: #0f2418; }
.badge.draft { color: #cbd5e1; border-color: #475569; }
.pp-legend { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-top: 8px; font-size: 11px; color: var(--text-2); }
.pp-legend .sub { color: var(--text-3); }
.lg { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }

.pp-master-h { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text-1); margin-bottom: 10px; }
.mtag { font-size: 9px; color: #ffd79a; border: 1px solid #5b3c14; border-radius: 4px; padding: 0 4px; }
.mm-list { display: flex; flex-direction: column; gap: 8px; }
.mm-card { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.mm-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; background: var(--bg-2); }
.mm-caret { font-size: 10px; color: var(--text-3); }
.mm-badge { font-size: 10px; font-weight: 700; color: #dc2626; border: 1px solid #5b2020; border-radius: 4px; padding: 0 5px; }
.mm-name { font-size: 12.5px; color: var(--text-1); }
.cg-d { font-size: 11px; color: var(--text-2); margin-left: auto; font-variant-numeric: tabular-nums; }
.cg-o { font-size: 11px; color: var(--text-3); }
.cg-dot { width: 8px; height: 8px; border-radius: 50%; }
.cg-dot.done { background: #16a34a; }
.cg-dot.doing { background: #0891b2; }
.cg-dot.todo { background: #94a3b8; }
.cg-dot.overdue { background: #ef4444; }
.mm-body { padding: 10px 12px; border-top: 1px solid var(--line-soft); }
.mm-desc { font-size: 11.5px; color: var(--text-2); margin-bottom: 8px; line-height: 1.6; }
.mm-cap { font-size: 11px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
.mm-subs { display: flex; flex-direction: column; gap: 6px; }
.mm-sub { padding: 6px 10px; border-radius: 6px; background: var(--bg-1); }
.mm-sub-h { font-size: 11.5px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.mm-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.mm-act { font-size: 11px; color: var(--text-2); display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--line-soft); border-radius: 999px; }
.mm-act em { color: var(--text-3); font-style: normal; font-size: 10px; }
.mm-empty { font-size: 11px; color: var(--text-3); padding: 6px 10px; }
.mm-foot { padding: 6px 12px; border-top: 1px solid var(--line-soft); font-size: 11px; color: var(--text-3); background: var(--bg-1); }
.mm-sum { color: var(--text-3); }
.mm-legend { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-top: 8px; font-size: 11px; color: var(--text-2); }
.mm-lg-note { color: var(--text-3); }

.pp-subs-h { font-size: 12px; font-weight: 700; color: var(--text-1); margin-top: 16px; }
.pp-subs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.pp-sub { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--bg-1); border-top: 3px solid var(--hue, #94a3b8); }
.pp-sub-h { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-1); flex-wrap: wrap; }
.pp-ro { font-size: 10px; padding: 1px 6px; border-radius: 999px; border: 1px solid; }
.pp-ro-ok { color: #9ae6b4; border-color: #1d4a2e; background: #0f2418; }
.pp-ro-wait { color: #ffd79a; border-color: #5b3c14; background: #2a1f10; }
.po { font-size: 11.5px; color: var(--text-2); margin-top: 6px; }
.req { font-size: 11px; color: var(--text-2); margin-top: 4px; display: flex; gap: 6px; align-items: flex-start; line-height: 1.5; }
.rq-l { flex: 1; }
.tag.comp { font-size: 9px; padding: 0 5px; border-radius: 4px; border: 1px solid; flex: none; margin-top: 1px; }
.tag.comp.fusa { color: #fca5a5; border-color: #5b2020; }
.tag.comp.is { color: #a8d5ff; border-color: #1b3d5e; }
.tag.comp.as { color: #c4b5fd; border-color: #4c3a7a; }
.pout { display: flex; flex-direction: column; gap: 3px; }
.po.orow { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.sub { color: var(--text-3); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
</style>
