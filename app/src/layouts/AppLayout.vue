<template>
  <el-config-provider :locale="epLocale">
    <div class="shell" :class="'bp-' + bp">
      <!-- 移动端汉堡按钮 -->
      <button v-if="bp === 'mobile'" class="hamburger" @click="drawerOpen = true">☰</button>

      <!-- 移动端抽屉遮罩 -->
      <div v-if="bp === 'mobile' && drawerOpen" class="drawer-mask" @click="drawerOpen = false" />

      <aside class="side" :class="{ 'side-drawer': bp === 'mobile', 'side-collapse': bp === 'tablet', 'side-open': bp === 'mobile' && drawerOpen }">
        <div class="brand">
          <div class="logo">MO</div>
          <div>
            <div class="b1">{{ t('app.brand') }}</div>
            <div class="b2">{{ t('app.brandSub') }}</div>
          </div>
        </div>

        <div class="tenant">
          <span class="tag">{{ store.data.tenant.name }}</span>
          <span class="tag">{{ t('app.tenant') }} {{ store.data.tenant.code }}</span>
          <span class="tag" :class="store.chainOk ? 'ok' : 'fail'">{{ store.chainOk ? t('app.auditChainOk') : t('app.auditChainFail') }}</span>
        </div>

        <el-scrollbar class="menus">
          <div v-for="g in sideMenus" :key="g.key" class="group">
            <div class="ghead" :class="{ active: isGroupActive(g.key) }" @click="toggle(g.key)">
              <span class="gtitle">{{ t('menu.group.' + g.key) }}</span>
              <span class="gcp mono">{{ g.cp }}</span>
              <span class="caret">{{ open.includes(g.key) || isGroupActive(g.key) ? '▾' : '▸' }}</span>
            </div>
            <div v-show="open.includes(g.key) || isGroupActive(g.key)" class="items">
              <div
                v-for="it in g.items"
                :key="it.path"
                class="item"
                :class="{ on: route.path === it.path }"
                @click="go(it.path)"
              >
                <span class="dot" />
                <span class="t">{{ t('menu.item.' + it.path) }}</span>
                <span v-if="it.batch" class="badge">{{ it.batch }}</span>
              </div>
            </div>
          </div>
        </el-scrollbar>

        <div class="foot">
          <div class="dim">SRS V1.4 · 方案 V4.0</div>
          <div class="dim">16 {{ t('app.menuCount') }} / 48 {{ t('app.controlPoints') }}</div>
          <div class="dim" style="margin-top: 4px">
            <span class="tag" :class="store.repoMode === 'rest' ? 'ok' : ''">{{ store.repoMode === 'rest' ? t('app.restPersisted') : t('app.localStorage') }}</span>
          </div>
          <div class="dim" style="margin-top: 4px">
            <span class="tag" :class="store.cacheBadgeInfo.readonly ? 'fail' : 'cond'" :title="store.cacheStamp.cachedAt">
              {{ store.cacheBadgeInfo.label }}
            </span>
          </div>
          <div v-if="store.pendingWrites.length" class="dim" style="margin-top: 4px">
            <span class="tag cond">{{ t('app.pendingWrites') }} {{ store.pendingWrites.length }}</span>
          </div>
        </div>
      </aside>

      <main class="main">
        <div class="worktop">
          <span class="wt-label">{{ t('menu.group.workbench') }}</span>
          <div class="wt-items">
            <button
              v-for="it in workbenchItems"
              :key="it.path"
              class="wt-item"
              :class="{ on: route.path === it.path }"
              @click="go(it.path)"
            >
              <span class="wt-t">{{ t('menu.item.' + it.path) }}</span>
            </button>
          </div>
        </div>

        <div class="top">
          <div class="row" style="gap: 10px">
            <el-select v-model="pid" size="small" style="width: 250px" @change="onProject">
              <el-option v-for="p in store.data.projects" :key="p.id" :value="p.id" :label="`${p.code} · ${p.name}`">
                <span>{{ p.code }} · {{ p.name }}</span>
                <span class="tag" :class="'l' + (p.level || '4').slice(1)" style="margin-left: 8px">{{ t(p.level || '未定级') }}</span>
              </el-option>
            </el-select>
            <span class="tag" :class="'l' + (store.currentProject.level || '4').slice(1)">{{ t(store.currentProject.level || '未定级') }}</span>
            <span class="tag">{{ t(store.currentProject.status) }}</span>
            <span class="tag" :class="healthClass">{{ t(store.currentProject.health) }}灯</span>
          </div>

          <div class="row" style="gap: 10px">
            <span class="dim">{{ t('app.currentIdentity') }}</span>
            <el-select v-model="uid" size="small" style="width: 250px" filterable @change="onUser">
              <el-option v-for="u in store.users" :key="u.id" :value="u.id" :label="`${u.name} · ${u.roleName}`" />
            </el-select>
            <el-button size="small" @click="store.reset()">{{ t('app.resetData') }}</el-button>
            <el-dropdown trigger="click" @command="onLocale">
              <el-button size="small">
                {{ store.locale === 'en-US' ? 'EN' : '中' }}
                <span style="margin-left: 4px">▾</span>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="zh-CN" :disabled="store.locale === 'zh-CN'">中文</el-dropdown-item>
                  <el-dropdown-item command="en-US" :disabled="store.locale === 'en-US'">English</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div class="content">
          <router-view />
        </div>

        <transition name="fade">
          <div v-if="store.toast" class="toast" :class="store.toast.type">{{ store.toast.text }}</div>
        </transition>
      </main>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { MENUS } from '@/router'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { breakpointOf, sideModeOf, type Breakpoint } from '@/domain/mobilePortal'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const open = ref<string[]>(['workbench'])
const uid = ref(store.userId)
const pid = ref(store.projectId)

/** 顶部横向导航：工作中心分组；侧栏渲染其余分组 */
const workbenchItems = computed(() => MENUS.find((m) => m.key === 'workbench')?.items ?? [])
const sideMenus = computed(() => MENUS.filter((m) => m.key !== 'workbench'))

/** Element Plus 组件内部文案随语言切换 */
const epLocale = computed(() => (store.locale === 'en-US' ? en : zhCn))

// —— 响应式布局（POR-012：mobile 抽屉 / tablet 折叠 / desktop 常驻）——
const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1600)
const bp = computed<Breakpoint>(() => breakpointOf({ width: vw.value, height: 0 }))
const sideMode = computed(() => sideModeOf(bp.value))
/** 移动端抽屉显隐 */
const drawerOpen = ref(false)
function onResize() {
  vw.value = window.innerWidth
}

onMounted(() => {
  void store.syncFromBackend()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

const isGroupActive = (key: string) => route.path.startsWith(`/${key}`)
const healthClass = computed(() => ({ 绿: 'ok', 黄: 'cond', 红: 'fail', 灰: '' }[store.currentProject.health] || ''))
watch(() => route.path, () => {
  const g = MENUS.find((m) => route.path.startsWith(`/${m.key}`))
  if (g && !open.value.includes(g.key)) open.value = [...open.value, g.key]
  // 移动端导航后自动收起抽屉
  if (bp.value === 'mobile') drawerOpen.value = false
})
function toggle(key: string) {
  open.value = open.value.includes(key) ? open.value.filter((k) => k !== key) : [...open.value, key]
}
function go(path: string) {
  router.push(path)
  if (bp.value === 'mobile') drawerOpen.value = false
}
function onUser(v: string) {
  store.selectUser(v)
}
function onProject(v: string) {
  store.setProject(v)
  store.notify('info', `${t('app.switchProject')}：${store.currentProject.code}`)
}
function onLocale(l: 'zh-CN' | 'en-US') {
  store.setLocale(l)
}
</script>

<style scoped>
.shell { display: grid; grid-template-columns: 244px 1fr; height: 100vh; overflow: hidden; }
.side { background: #080e19; border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
.brand { display: flex; gap: 10px; align-items: center; padding: 14px 14px 10px; }
.logo { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, #2563eb, #22d3ee); color: #04101f; font-weight: 800; font-size: 12px; display: grid; place-items: center; letter-spacing: 0.5px; }
.b1 { font-size: 13.5px; font-weight: 700; }
.b2 { font-size: 10.5px; color: var(--text-3); }
.tenant { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 12px 10px; }
.menus { flex: 1; min-height: 0; padding: 0 8px; }
.group { margin-bottom: 2px; }
.ghead { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 7px; cursor: pointer; color: var(--text-2); }
.ghead:hover { background: #0e1a2b; }
.ghead.active { background: #10203a; color: var(--text-1); }
.gtitle { font-size: 12px; font-weight: 600; flex: 1; }
.gcp { font-size: 9px; color: var(--text-3); }
.caret { font-size: 9px; color: var(--text-3); }
.items { padding: 2px 0 4px 6px; }
.item { display: flex; align-items: center; gap: 7px; padding: 5px 8px; border-radius: 6px; cursor: pointer; color: var(--text-2); font-size: 11.5px; }
.item:hover { background: #0d1a2c; color: var(--text-1); }
.item.on { background: linear-gradient(90deg, #16305a, #10223c); color: #fff; box-shadow: inset 2px 0 0 var(--brand); }
.dot { width: 4px; height: 4px; border-radius: 50%; background: #2d4666; flex: none; }
.item.on .dot { background: var(--brand-2); }
.t { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.badge { font-size: 9px; color: #ffd79a; border: 1px solid #5b3c14; border-radius: 4px; padding: 0 3px; }
.foot { padding: 8px 14px; border-top: 1px solid var(--line-soft); font-size: 10px; }
.main { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--bg-0); }
.worktop { display: flex; align-items: center; gap: 16px; padding: 8px 18px; background: #0a1120; border-bottom: 1px solid var(--line-soft); }
.wt-label { flex: none; font-size: 12px; font-weight: 700; color: var(--brand-2); letter-spacing: 0.5px; }
.wt-items { display: flex; flex-wrap: wrap; gap: 4px; }
.wt-item { border: none; background: transparent; color: var(--text-2); font-size: 12px; padding: 5px 12px; border-radius: 7px; cursor: pointer; white-space: nowrap; }
.wt-item:hover { background: #0e1a2b; color: var(--text-1); }
.wt-item.on { background: linear-gradient(90deg, #16305a, #10223c); color: #fff; box-shadow: inset 0 -2px 0 var(--brand); }
.wt-t { display: inline-block; }
.top { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; border-bottom: 1px solid var(--line); background: #0a1120; }
.dim { color: var(--text-3); font-size: 11px; }
.content { flex: 1; overflow: auto; padding: 16px 18px 40px; }
.toast { position: fixed; right: 22px; bottom: 22px; padding: 10px 14px; border-radius: 8px; font-size: 12px; max-width: 520px; box-shadow: var(--shadow); z-index: 3000; border: 1px solid var(--line); background: var(--bg-2); }
.toast.success { border-color: #1d4a2e; color: #9ae6b4; }
.toast.warning { border-color: #5b3c14; color: #ffd79a; }
.toast.error { border-color: #5b2020; color: #ffb4b4; }
.toast.info { border-color: #1b3d5e; color: #a8d5ff; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* —— 响应式（POR-012）—— */
.hamburger {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 2500;
  background: var(--bg-2);
  color: var(--text-1);
  border: 1px solid var(--line);
  border-radius: 8px;
  width: 36px;
  height: 36px;
  font-size: 16px;
  cursor: pointer;
}
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2400;
}
.bp-mobile .shell { grid-template-columns: 1fr; }
.bp-mobile .hamburger { display: block; }
.bp-mobile .side {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 244px;
  z-index: 2600;
  transform: translateX(-100%);
  transition: transform 0.25s;
}
.bp-mobile .side.side-open { transform: translateX(0); }
.bp-mobile .top { padding-left: 56px; flex-wrap: wrap; row-gap: 8px; }
.bp-mobile .top .row { flex-wrap: wrap; }
.bp-mobile .worktop { padding-left: 56px; }
.bp-tablet .shell { grid-template-columns: 64px 1fr; }
.bp-tablet .side .brand > div:last-child,
.bp-tablet .side .tenant,
.bp-tablet .side .gtitle,
.bp-tablet .side .gcp,
.bp-tablet .side .caret,
.bp-tablet .side .foot,
.bp-tablet .side .items { display: none; }
.bp-tablet .side .brand { justify-content: center; padding: 14px 0 10px; }
</style>
