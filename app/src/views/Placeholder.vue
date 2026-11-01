<template>
  <div>
    <PageHeader :title="String(route.meta.title || '')" :desc="String(route.meta.desc || '')" />
    <div class="panel">
      <div class="panel-title">本页计划批次：{{ route.meta.batch }}</div>
      <p class="muted" style="line-height: 1.9">
        该二级页已在路由中注册（SOLUTION 11.3-c：未实现的页面不隐藏，避免用户以为功能缺失），
        本期按 R1 优先级先交付管控闭环必需页面。此页计划于 <b>{{ route.meta.batch }}</b> 批次实现，当前展示的是页面定位与承接需求。
      </p>
      <div class="hr" />
      <div class="grid grid-2">
        <div>
          <div class="panel-title">页面定位</div>
          <div class="src-note">
            一级菜单：{{ route.meta.groupTitle }}<br />
            二级页面：{{ route.meta.title }}<br />
            说明：{{ route.meta.desc || '—' }}
          </div>
        </div>
        <div>
          <div class="panel-title">已实现替代入口</div>
          <div class="src-note">
            本期可在同级已交付页面完成主要动作；数据口径与权限与本页一致（同源同权限）。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
const route = useRoute()
</script>
