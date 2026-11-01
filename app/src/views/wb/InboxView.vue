<template>
  <div>
    <PageHeader title="我的消息与收件箱" desc="消息已读回执（POR-006）+ 收件箱三类来件（POR-008）+ 我的草稿跨端续写（POR-007）">
      <template #actions>
        <el-button size="small" @click="store.readAllMessages()">全部已读</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="未读消息" :value="store.myUnreadCount" unit="条" :zone="store.myUnreadCount ? 'warn' : 'ok'" hint="已读状态可回执（POR-006）" />
      <KpiCard label="收件箱待处理" :value="pendingInbox.length" unit="件" :zone="pendingInbox.length ? 'warn' : 'ok'" sub="送审件/联系单/决议" />
      <KpiCard label="已超期" :value="overdueInbox.length" unit="件" :zone="overdueInbox.length ? 'danger' : 'ok'" />
      <KpiCard label="我的草稿" :value="store.myDrafts.length" unit="份" :zone="store.myExpiredDrafts.length ? 'warn' : 'ok'" sub="超期仅提示不删除（POR-007）" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1.3fr; align-items: start">
      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">我的消息（点击标记已读）</div>
          <div v-for="m in store.messages.filter((x) => x.userId === store.currentUser.id)" :key="m.id" class="msg" :class="{ unread: !m.read }" @click="store.readMessage(m.id)">
            <div class="between">
              <b>{{ m.title }}</b>
              <span v-if="!m.read" class="dot" />
            </div>
            <div class="muted" style="font-size: 11px; margin-top: 2px">{{ m.content }}</div>
            <div class="muted" style="font-size: 11px; margin-top: 2px">
              {{ te(m.category) }} · {{ fmtTime(m.createdAt) }}<span v-if="m.read"> · 已读 {{ fmtTime(m.readAt) }}</span>
            </div>
          </div>
          <el-empty v-if="!store.messages.filter((x) => x.userId === store.currentUser.id).length" description="暂无消息" :image-size="54" />
        </div>

        <div class="panel">
          <div class="panel-title">我的草稿（跨端续写 POR-007）</div>
          <div v-for="d in store.myDrafts" :key="d.id" class="msg">
            <div class="between">
              <b>{{ d.objectType }}</b>
              <span v-if="store.myExpiredDrafts.some((x) => x.id === d.id)" class="tag warn">已超期</span>
              <el-button link size="small" type="danger" @click="store.removeDraft(d.objectType, d.id)">清除</el-button>
            </div>
            <div class="muted" style="font-size: 11px; margin-top: 2px; word-break: break-all">{{ d.content }}</div>
            <div class="muted" style="font-size: 11px; margin-top: 2px">更新于 {{ fmtTime(d.updatedAt) }}</div>
          </div>
          <el-empty v-if="!store.myDrafts.length" description="暂无草稿" :image-size="54" />
          <div class="muted" style="margin-top: 6px">超期草稿仅提示、不静默删除；提交后自动清除。</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">收件箱（三类来件）</div>
        <el-table :data="store.myInbox" size="small" @selection-change="onSelect">
          <el-table-column type="selection" width="40" :selectable="(row: InboxItem) => row.status === '待处理'" />
          <el-table-column label="类型" width="80">
            <template #default="{ row }"><span class="tag" :class="row.kind === '送审件' ? 'cond' : row.kind === '联系单' ? 'ok' : 'warn'">{{ te(row.kind) }}</span></template>
          </el-table-column>
          <el-table-column prop="title" label="事项" min-width="160" show-overflow-tooltip />
          <el-table-column prop="from" label="发起方" width="120" />
          <el-table-column prop="dueAt" label="期限" width="100"><template #default="{ row }"><span class="mono">{{ row.dueAt }}</span></template></el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <span class="tag" :class="row.status === '已超期' ? 'fail' : row.status === '已答复' ? 'ok' : row.status === '已退回' ? 'warn' : ''">{{ te(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button v-if="row.status === '待处理'" link size="small" @click="approveOne(row.id)">审批</el-button>
              <el-button v-if="row.status === '待处理'" link size="small" @click="rejectOne(row.id)">退回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="between" style="margin-top: 8px">
          <el-button size="small" type="primary" :disabled="!selected.length" @click="batchApprove">批量审批（{{ selected.length }}）</el-button>
          <span class="muted">退回必填意见；批量审批逐条留痕（POR-008）</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import type { InboxItem } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const selected = ref<{ id: string }[]>([])

const pendingInbox = computed(() => store.myInbox.filter((i) => i.status === '待处理'))
const overdueInbox = computed(() => store.myInbox.filter((i) => i.status === '已超期'))

function onSelect(rows: { id: string }[]) {
  selected.value = rows
}

function approveOne(id: string) {
  const n = store.inboxBatchApprove([id])
  if (n) store.notify('success', '已审批，留痕完成')
}

async function rejectOne(id: string) {
  try {
    const { value } = await ElMessageBox.prompt('请输入退回意见', '退回', { inputPlaceholder: '退回必填意见' })
    store.inboxReject(id, value)
  } catch {
    /* 取消 */
  }
}

function batchApprove() {
  const n = store.inboxBatchApprove(selected.value.map((s) => s.id))
  if (n) store.notify('success', `已批量审批 ${n} 件，逐条留痕`)
  selected.value = []
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  return iso.replace('T', ' ').slice(0, 16)
}
</script>

<style scoped>
.msg { padding: 8px 0; border-bottom: 1px dashed var(--line); cursor: pointer; font-size: 12.5px; }
.msg.unread { background: rgba(59, 130, 246, 0.06); padding-left: 6px; border-radius: 4px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--danger); }
.muted { color: var(--text-3); }
</style>
