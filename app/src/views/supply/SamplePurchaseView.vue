<template>
  <div>
    <PageHeader title="样件采购管理" desc="样件采购管理：试制样件采购需求、下单、到货验收与入库跟踪">
      <template #actions>
        <el-button size="small" type="primary" @click="onAdd">新增样件采购</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="样件采购单" :value="orders.length" unit="单" />
      <KpiCard label="待下单" :value="pendingOrder" unit="单" />
      <KpiCard label="已到货" :value="received" unit="单" />
      <KpiCard label="待验收" :value="pendingAccept" unit="单" :zone="pendingAccept ? 'warn' : 'ok'" />
    </div>

    <div class="panel">
      <div class="panel-title">样件采购清单</div>
      <el-table :data="orders" size="small" empty-text="暂无样件采购单">
        <el-table-column prop="code" label="采购单号" width="140" />
        <el-table-column prop="part" label="样件名称" min-width="160" />
        <el-table-column prop="supplier" label="供应商" min-width="140" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column prop="date" label="需求日期" width="110" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'

const store = useAppStore()

// 空白模板：样件采购数据由用户新增填写，暂不预置演示数据
const orders = computed(() => [] as Array<{ code: string; part: string; supplier: string; status: string; date: string }>)
const pendingOrder = computed(() => orders.value.filter((o) => o.status === '待下单').length)
const received = computed(() => orders.value.filter((o) => o.status === '已到货').length)
const pendingAccept = computed(() => orders.value.filter((o) => o.status === '待验收').length)

function onAdd() {
  store.notify('info', '样件采购新增功能待配置，请先明确字段与审批流程')
}
</script>

<style scoped>
</style>
