<template>
  <div>
    <PageHeader title="ECR / ECN" desc="四维影响评估（软件/硬件/安全/供应链）→ 闭包逐项确认 → ECN 执行验证；任一未确认 ECR 不得关闭（C-16~C-18）">
      <template #actions>
        <el-button size="small" type="primary" :disabled="!ecr" @click="advance">推进流转</el-button>
      </template>
    </PageHeader>

    <div class="grid" style="grid-template-columns: 300px 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">变更单</div>
        <div v-for="e in store.projectEcrs" :key="e.id" class="ecard" :class="{ on: ecr?.id === e.id }" @click="ecr = e">
          <div class="between">
            <b class="mono">{{ e.code }}</b>
            <span class="tag" :class="e.stage === '已关闭' ? 'ok' : 'cond'">{{ te(e.stage) }}</span>
          </div>
          <div class="t">{{ e.title }}</div>
          <div class="dim">闭包 {{ e.closure.filter((c) => c.decision).length }}/{{ e.closure.length }} 已确认<span v-if="e.highRisk" class="tag fail" style="margin-left: 6px">高风险</span></div>
        </div>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">四维影响评估（未评估不得进入审批）</div>
          <div class="grid grid-4">
            <div v-for="i in ecr?.impacts || []" :key="i.dim" class="imp">
              <div class="between"><b>{{ i.dim }}</b><span class="tag" :class="i.assessed ? 'ok' : 'fail'">{{ i.assessed ? '已评估' : '未评估' }}</span></div>
              <div class="dim">{{ i.note }}</div>
            </div>
          </div>
          <div v-if="ecr?.highRisk" class="src-note" style="margin-top: 8px">
            高风险变更（改安全架构 / 换供应商）自动增补审批：{{ requiredApprovers(ecr).join(' → ') }}（CHG-003）
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">
            影响闭包逐项确认（每项须给出结论：修改 / 确认无影响 / 废弃）
            <span class="tag" :class="closure.canClose ? 'ok' : 'fail'">{{ closure.canClose ? '可关闭' : `${closure.unconfirmed.length} 项未确认` }}</span>
          </div>
          <div v-for="c in ecr?.closure || []" :key="c.objId" class="crow">
            <span class="mono">{{ c.objCode }}</span>
            <span class="dim">{{ c.objType }}</span>
            <el-select :model-value="c.decision" size="small" style="width: 130px" placeholder="选择结论" @change="(v: string) => choose(c.objId, v)">
              <el-option value="修改" label="修改" />
              <el-option value="确认无影响" label="确认无影响" />
              <el-option value="废弃" label="废弃" />
            </el-select>
            <el-input :model-value="c.note" size="small" placeholder="理由（必填）" style="flex: 1" @change="(v: string) => choose(c.objId, c.decision, v)" />
            <span class="tag" :class="c.decision ? 'ok' : 'fail'">{{ c.decision || '未确认' }}</span>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">
            ECN 执行验证（C-18：已执行但未验证不得标记完成）
            <span class="tag" :class="ecr?.ecnVerification?.verified ? 'ok' : 'fail'">{{ ecr?.ecnVerification?.verified ? '验证通过' : ecr?.ecnVerification ? '验证不通过' : '未验证' }}</span>
          </div>
          <div class="row">
            <el-input v-model="verifyNote" size="small" placeholder="验证结论说明（必填）" style="flex: 1" />
            <el-button size="small" type="success" :disabled="!verifyNote" @click="verifyEcn(true)">标记验证通过</el-button>
            <el-button size="small" type="warning" :disabled="!verifyNote" @click="verifyEcn(false)">标记验证不通过</el-button>
          </div>
          <div class="hr" />
          <div class="row">
            <el-button size="small" @click="tryClose">尝试关闭 ECR</el-button>
            <span class="dim">{{ closeMsg }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { closureStatus, impactComplete, requiredApprovers, closeEcr } from '@/domain/change'
import type { EcrItem } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const ecr = ref<EcrItem | null>(store.projectEcrs[0] || null)
const closeMsg = ref('')
const verifyNote = ref('')
const closure = computed(() => (ecr.value ? closureStatus(ecr.value) : { total: 0, unconfirmed: [], modified: 0, noImpact: 0, dropped: 0, canClose: false }))
const impacts = computed(() => (ecr.value ? impactComplete(ecr.value) : { ok: true, missing: [] }))

function choose(objId: string, decision: string, note?: string) {
  if (!ecr.value) return
  store.confirmClosure(ecr.value.id, objId, (decision || '') as '' | '修改' | '确认无影响' | '废弃', note || '')
}
function advance() {
  if (!ecr.value) return
  if (!impacts.value.ok) {
    store.notify('error', `C-16：影响评估未完成（缺 ${impacts.value.missing.join('、')}），不得进入审批`)
    return
  }
  store.advanceEcr(ecr.value.id)
}
function verifyEcn(verified: boolean) {
  if (!ecr.value) return
  store.verifyEcn(ecr.value.id, verified, verifyNote.value)
  verifyNote.value = ''
}
function tryClose() {
  if (!ecr.value) return
  const r = closeEcr(ecr.value)
  closeMsg.value = r.message
  if (r.ok) store.advanceEcr(ecr.value.id)
  else {
    store.notify('error', `${r.code}：${r.message}`)
    store.log('UPDATE', 'ECR', ecr.value.id, undefined, undefined, 'DENY')
  }
  return r
}
</script>

<style scoped>
.ecard { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; cursor: pointer; }
.ecard.on { border-color: var(--brand); background: #10203a; }
.t { font-size: 11.5px; color: var(--text-2); margin: 3px 0; line-height: 1.5; }
.dim { color: var(--text-3); font-size: 10.5px; }
.imp { background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; padding: 8px; font-size: 11px; }
.crow { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
</style>
