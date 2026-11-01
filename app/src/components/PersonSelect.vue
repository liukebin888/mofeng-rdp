<template>
  <div class="person-select">
    <el-autocomplete
      :model-value="modelValue"
      :placeholder="placeholder"
      :fetch-suggestions="fetchSuggestions"
      :trigger-on-focus="false"
      clearable
      style="width: 100%"
      @select="onSelect"
      @input="onInput"
      @clear="onClear"
    >
      <template #default="{ item }">
        <div class="sugg">
          <span class="sugg-name">{{ item.name }}</span>
          <span class="sugg-initials mono">{{ item.initials }}</span>
          <span v-if="item.dept" class="sugg-meta">{{ item.dept }}</span>
          <span v-if="item.post" class="sugg-meta">{{ item.post }}</span>
        </div>
      </template>
    </el-autocomplete>

    <!-- 选中后自动带入的人员信息（部门 / 岗位 / 角色） -->
    <div v-if="resolved" class="resolved">
      <span v-if="resolved.dept" class="chip">部门：{{ resolved.dept }}</span>
      <span v-if="resolved.post" class="chip">岗位：{{ resolved.post }}</span>
      <span v-if="resolved.roleName" class="chip">角色：{{ resolved.roleName }}</span>
      <span v-if="resolved.account" class="chip mono">账号：{{ resolved.account }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/app'
import { searchPersons, pinyinInitials, type PersonCandidate } from '@/domain/personSearch'
import { primaryMembership, membershipsOf, pathOf } from '@/domain/org'
import type { OrgMembership } from '@/domain/types'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  { placeholder: '输入姓名或首拼（如 zlq）' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'select', person: PersonCandidate & { id: string }): void
}>()

const store = useAppStore()

/** 根据 userId 推导主职部门（组织路径末级节点名）与岗位（postLevel） */
function resolvePerson(u: { id: string; name: string }): PersonCandidate & { id: string } {
  const memberships = store.orgMemberships as OrgMembership[]
  const primary = primaryMembership(memberships, u.id) ?? membershipsOf(memberships, u.id)[0]
  let dept = ''
  let post = ''
  if (primary) {
    post = primary.postLevel
    const path = pathOf(store.orgNodes, primary.orgId)
    const leaf = path[path.length - 1]
    dept = leaf?.name ?? primary.orgId
  }
  const seedUser = store.users.find((x) => x.id === u.id)
  return {
    id: u.id,
    name: u.name,
    initials: pinyinInitials(u.name),
    dept: dept || seedUser?.dept,
    post,
    roleName: seedUser?.roleName,
    account: seedUser?.account
  }
}

/** 输入联想：姓名 / 首拼 搜索，并附带部门岗位提示 */
function fetchSuggestions(query: string, cb: (items: PersonCandidate[]) => void) {
  const hits = searchPersons(store.users, query)
  const enriched = hits.map((h) => {
    const full = resolvePerson(h)
    return { ...h, dept: full.dept, post: full.post }
  })
  cb(enriched)
}

/** 选中后：回填姓名 + 上报完整人员信息，触发外部「自动带入」 */
function onSelect(item: PersonCandidate) {
  emit('update:modelValue', item.name)
  emit('select', resolvePerson(item))
}

function onInput(v: string) {
  emit('update:modelValue', v)
}

function onClear() {
  emit('update:modelValue', '')
  emit('select', { id: '', name: '', initials: '' })
}

/** 当前姓名对应的已带入信息（用于展示已选人员） */
const resolved = computed(() => {
  if (!props.modelValue) return null
  const u = store.users.find((x) => x.name === props.modelValue)
  return u ? resolvePerson(u) : null
})
</script>

<style scoped>
.person-select { width: 100%; }
.sugg { display: flex; gap: 8px; align-items: center; }
.sugg-name { font-weight: 600; color: var(--text-1); }
.sugg-initials { font-size: 11px; color: var(--text-3); background: var(--bg-2, #1c2b44); padding: 0 5px; border-radius: 4px; }
.sugg-meta { font-size: 11px; color: var(--text-3); }
.resolved { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.chip {
  font-size: 11px; color: #7dd3fc; background: rgba(125, 211, 252, 0.12);
  padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(125, 211, 252, 0.25);
}
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>
