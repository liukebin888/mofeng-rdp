<template>
  <div>
    <PageHeader title="资源池与技能" desc="技能矩阵与派工 + 跨节点资源共享（PFM-016）+ 三层资源池/派工承诺/工时回填/外部产能/效率系数/费率/情景（RES-001/002/009/010/011/013/015/016）">
      <template #actions>
        <el-button size="small" @click="store.sweepExpiredShares()">扫描到期共享</el-button>
        <el-button size="small" type="primary" @click="openApply">新建共享申请</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="资源池成员" :value="store.resourcePool.length" unit="人" />
      <KpiCard label="可用成员" :value="availableCount" unit="人" zone="brand" />
      <KpiCard label="生效共享" :value="activeShares.length" unit="项" />
      <KpiCard label="待审批共享" :value="pendingShares.length" unit="项" :zone="pendingShares.length ? 'warn' : 'ok'" />
    </div>

    <div class="grid" style="grid-template-columns: 1.5fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">技能矩阵（角色 × 技能 × 归属节点）</div>
        <el-table :data="store.resourcePool" size="small">
          <el-table-column prop="name" label="成员" width="80" />
          <el-table-column prop="role" label="角色" width="100" />
          <el-table-column prop="nodeId" label="归属节点" width="90" />
          <el-table-column label="核心技能" min-width="150"><template #default="{ row }"><span v-for="s in row.skills" :key="s" class="tag" style="margin-right: 4px">{{ s }}</span></template></el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <span class="tag" :class="isShared(row.id) ? 'cond' : row.available ? 'ok' : 'fail'">{{ isShared(row.id) ? '共享中' : row.available ? '可用' : '占用' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">跨节点资源共享申请（PFM-016）</div>
        <div v-for="a in store.resourceShares" :key="a.id" class="rrow">
          <span class="mono">{{ a.code }}</span>
          <span>{{ a.resourceName }}</span>
          <span class="dim">{{ a.fromNodeId }}→{{ a.toNodeId }}</span>
          <span class="tag" :class="shareTagClass(a.status)">{{ te(a.status) }}</span>
          <span v-if="a.status === '待审批'" style="display: flex; gap: 4px">
            <el-button link size="small" type="success" @click="store.approveShareApply(a.id, true)">批准</el-button>
            <el-button link size="small" type="danger" @click="store.approveShareApply(a.id, false)">驳回</el-button>
          </span>
          <span v-if="a.status === '草稿'" style="display: flex; gap: 4px">
            <el-button link size="small" type="primary" @click="store.submitShareForApproval(a.id)">提交审批</el-button>
          </span>
        </div>
        <el-empty v-if="!store.resourceShares.length" description="暂无共享申请" :image-size="54" />
        <div class="src-note" style="margin-top: 8px">
          未审批（草稿/待审批）不占用资源；已生效共享到期未续期将自动释放并告警。
        </div>
      </div>
    </div>

    <div class="grid grid-4" style="margin: 12px 0">
      <KpiCard label="资源池层级" :value="store.poolHierarchyCheck.ok ? '三层齐备' : '缺层'" unit="" :zone="store.poolHierarchyCheck.ok ? 'ok' : 'danger'" sub="RES-001" />
      <KpiCard label="派工承诺" :value="store.assignmentCommitments.length" unit="项" sub="未承诺不进基线（RES-009）" />
      <KpiCard label="工时回填" :value="store.hourBackfills.length" unit="条" sub="三值互不覆盖（RES-013）" />
      <KpiCard label="估算失效" :value="store.effortStale ? '是' : '否'" unit="" :zone="store.effortStale ? 'danger' : 'ok'" sub="偏差≥15%连续两周（RES-016）" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 12px">
      <div class="panel">
        <div class="panel-title">技能检索（RES-002 · 角色 + 技能匹配）</div>
        <div class="crow">
          <el-input v-model="skillForm.role" size="small" style="width: 130px" placeholder="角色" />
          <el-input v-model="skillForm.skills" size="small" style="flex: 1" placeholder="技能（逗号分隔）" />
          <el-button size="small" type="primary" @click="doSearch">检索</el-button>
        </div>
        <div v-for="c in store.skillSearchResult" :key="c.id" class="crow">
          <span class="mono">{{ c.name }}</span>
          <span class="dim">{{ c.role }}</span>
          <span v-for="s in c.skills" :key="s" class="tag">{{ s }}</span>
          <span class="tag ok">匹配 {{ c.matchCount }}</span>
        </div>
        <el-empty v-if="!store.skillSearchResult.length" description="输入角色与技能后检索" :image-size="44" />
      </div>

      <div class="panel">
        <div class="panel-title">派工承诺（RES-009 · 承诺即进基线，变更须重审）</div>
        <div v-for="c in store.assignmentCommitments" :key="c.id" class="crow">
          <span class="mono">{{ c.role }}</span>
          <span>{{ c.resourceId }} {{ c.committedHours }}h</span>
          <span class="tag" :class="c.status === '已承诺' ? 'ok' : 'cond'">{{ c.status }}</span>
        </div>
        <el-empty v-if="!store.assignmentCommitments.length" description="暂无派工承诺" :image-size="44" />
      </div>

      <div class="panel">
        <div class="panel-title">工时回填（RES-013 · 剩余 = 计划 − 实际）</div>
        <div v-for="h in store.hourBackfills" :key="h.id" class="crow">
          <span class="mono">{{ h.taskId }}</span>
          <span>计划 {{ h.plannedHours }} / 实际 {{ h.actualHours }} / 剩余 {{ h.remainingHours }}</span>
          <span v-if="h.varianceNote" class="tag cond">{{ h.varianceNote }}</span>
        </div>
        <el-empty v-if="!store.hourBackfills.length" description="暂无回填记录" :image-size="44" />
      </div>

      <div class="panel">
        <div class="panel-title">外部产能与效率（RES-015/016）</div>
        <div v-for="e in store.externalDeviation" :key="e.id" class="crow">
          <span class="mono">{{ e.supplierName }}</span>
          <span class="dim">{{ e.role }}</span>
          <span>{{ e.actualDelivery }}/{{ e.committedCapacity }}h</span>
          <span class="tag" :class="e.dev.ok ? 'ok' : 'fail'">{{ e.dev.note }}</span>
        </div>
        <div class="crow" style="margin-top: 6px">
          <span class="mono">效率系数</span>
          <span v-for="d in store.effortDeviations" :key="d.id" class="tag">{{ d.week }}: {{ d.efficiencyFactor }}</span>
          <span class="tag" :class="store.effortStale ? 'fail' : 'ok'">{{ store.effortStale ? '估算已失效，须回写' : '估算有效' }}</span>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start; gap: 12px; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">资源费率（RES-011 · 生效期切换 / 历史不变）</div>
        <el-table :data="store.resourceRates" size="small">
          <el-table-column prop="role" label="角色" width="110" />
          <el-table-column prop="rate" label="单价" width="80" />
          <el-table-column prop="currency" label="币种" width="70" />
          <el-table-column prop="effectiveFrom" label="生效起" width="100" />
          <el-table-column prop="effectiveTo" label="生效止" min-width="90"><template #default="{ row }">{{ row.effectiveTo || '至今' }}</template></el-table-column>
        </el-table>
        <div class="src-note">费率变更后历史实际按当时费率结算，不追溯已结算期间。</div>
      </div>

      <div class="panel">
        <div class="panel-title">情景副本（RES-010 · 隔离 + 选定后回写）</div>
        <div class="crow">
          <el-input v-model="scenarioName" size="small" style="flex: 1" placeholder="情景名称" />
          <el-button size="small" type="primary" @click="createSc">新建情景</el-button>
        </div>
        <div v-for="s in store.resourceScenarios" :key="s.id" class="crow">
          <span class="mono">{{ s.name }}</span>
          <span class="tag" :class="s.status === '已选定' ? 'ok' : 'dim'">{{ s.status }}</span>
          <el-button v-if="s.status !== '已选定'" link size="small" type="primary" @click="store.pickScenario(s.id)">选定</el-button>
        </div>
        <el-empty v-if="!store.resourceScenarios.length" description="暂无情景" :image-size="44" />
      </div>
    </div>

    <el-dialog v-model="applyVisible" title="新建跨节点资源共享申请" width="480px">
      <el-form label-width="90px" size="small">
        <el-form-item label="来源节点"><el-input v-model="applyForm.fromNodeId" placeholder="NODE-1" /></el-form-item>
        <el-form-item label="目标节点"><el-input v-model="applyForm.toNodeId" placeholder="NODE-2" /></el-form-item>
        <el-form-item label="资源">
          <el-select v-model="applyForm.resourceId" style="width: 100%" placeholder="选择资源成员" @change="onPickResource">
            <el-option v-for="m in store.resourcePool" :key="m.id" :value="m.id" :label="`${m.name}（${m.role}）`" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期"><el-input v-model="applyForm.startAt" placeholder="2026-11-01" /></el-form-item>
        <el-form-item label="到期日期"><el-input v-model="applyForm.expireAt" placeholder="2026-11-15" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="applyVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitApply">登记申请</el-button>
      </template>
    </el-dialog>
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
const applyVisible = ref(false)
const applyForm = reactive({ fromNodeId: 'NODE-1', toNodeId: 'NODE-2', resourceId: '', resourceName: '', startAt: '', expireAt: '' })
const skillForm = reactive({ role: '', skills: '' })
const scenarioName = ref('')

const availableCount = computed(() => store.resourcePool.filter((p) => p.available).length)
const activeShares = computed(() => store.activeShareRelations)
const pendingShares = computed(() => store.resourceShares.filter((s) => s.status === '待审批'))

function doSearch() {
  const skills = skillForm.skills.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  store.searchBySkill(skillForm.role.trim(), skills)
}

function createSc() {
  if (!scenarioName.value.trim()) return
  store.addResourceScenario(scenarioName.value.trim(), [])
  scenarioName.value = ''
}

function isShared(resourceId: string): boolean {
  return activeShares.value.some((s) => s.resourceId === resourceId)
}

function shareTagClass(status: string): string {
  return ({ 草稿: 'dim', 待审批: 'cond', 已生效: 'ok', 已拒绝: 'fail', 已释放: 'fail' } as Record<string, string>)[status] || ''
}

function openApply() {
  applyForm.resourceId = ''
  applyForm.resourceName = ''
  applyForm.startAt = ''
  applyForm.expireAt = ''
  applyVisible.value = true
}

function onPickResource(id: string) {
  const m = store.resourcePool.find((x) => x.id === id)
  applyForm.resourceName = m?.name ?? ''
}

function submitApply() {
  const ok = store.addShareApply({ ...applyForm })
  if (ok) applyVisible.value = false
}
</script>

<style scoped>
.rrow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 12.5px; flex-wrap: wrap; }
</style>
