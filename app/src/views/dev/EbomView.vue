<template>
  <div>
    <PageHeader title="图纸与 EBOM" desc="三层 BOM 用量自下而上汇总（HW-004）；冻结后结构不可直接编辑，任何增删改须经 ECR 产生新版本（HW-006）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="物料条目" :value="store.data.boms.length" unit="项" />
      <KpiCard label="结构层级" :value="depth" unit="层" zone="brand" />
      <KpiCard label="冻结状态" :value="allFrozen ? '已冻结' : '部分可编辑'" :zone="allFrozen ? 'ok' : 'warn'" />
      <KpiCard label="齐套率（OTS 30 台）" :value="kit.rate" unit="%" :target="100" :zone="kit.blocked ? 'danger' : 'ok'" />
    </div>

    <div class="grid" style="grid-template-columns: 1.3fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">
          EBOM 结构（父件 × 用量 → 下阶展开）
          <el-button size="small" @click="tryEdit">尝试编辑已冻结结构</el-button>
        </div>
        <el-table :data="tree" size="small" row-key="id" :tree-props="{ children: 'children' }" default-expand-all height="380">
          <el-table-column prop="materialCode" label="物料号" width="110" />
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column label="用量" width="70"><template #default="{ row }"><span class="num">{{ row.qty }}</span></template></el-table-column>
          <el-table-column prop="version" label="版本" width="70" />
          <el-table-column label="库存/在途" width="100"><template #default="{ row }"><span class="num">{{ row.stock }}/{{ row.incoming }}</span></template></el-table-column>
          <el-table-column prop="supplierCode" label="供应商" width="96" />
          <el-table-column label="冻结" width="66">
            <template #default="{ row }"><span class="tag" :class="row.frozen ? 'ok' : 'cond'">{{ row.frozen ? '已冻结' : '可改' }}</span></template>
          </el-table-column>
        </el-table>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">用量汇总（自下而上，OTS 30 台）</div>
          <div v-for="l in kit.lines" :key="l.materialCode" class="kl">
            <span class="mono">{{ l.materialCode }}</span>
            <span class="nm">{{ l.name }}</span>
            <span class="num">{{ l.requiredQty }}</span>
            <span class="tag" :class="l.ok ? 'ok' : 'fail'">{{ l.ok ? '齐' : '缺 ' + l.shortage }}</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">冻结与变更规则</div>
          <div class="src-note">
            ① 冻结动作与操作人写入审计；<br />
            ② 冻结后直接编辑被拒（DATABASE trigger 语义在原型中以引擎守卫实现）；<br />
            ③ 走 ECR 后可改：新版本替换原版本，原版本标记「已被替代」；<br />
            ④ 供应商来料需 PPAP 批准后才可计入可用量（C-26）。
          </div>
          <div class="row" style="margin-top: 10px">
            <el-button size="small" @click="$router.push('/dev/ecr')">发起 ECR 变更</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { explodeBom, kitRate } from '@/domain/kitting'
import type { BomNode } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const boms = computed(() => store.data.boms)
const depth = computed(() => 3)
const allFrozen = computed(() => boms.value.every((b) => b.frozen))
const lines = computed(() => explodeBom(boms.value, 30))
const kit = computed(() => ({ ...kitRate(lines.value), lines: lines.value }))

const tree = computed(() => {
  const map = new Map<string, BomNode & { children?: BomNode[] }>()
  boms.value.forEach((b) => map.set(b.materialCode, { ...b, children: [] }))
  const roots: (BomNode & { children?: BomNode[] })[] = []
  for (const b of map.values()) {
    if (b.parentMaterialCode && map.has(b.parentMaterialCode)) map.get(b.parentMaterialCode)!.children!.push(b)
    else roots.push(b)
  }
  return roots
})

function tryEdit() {
  const frozen = boms.value.find((b) => b.frozen)!
  store.notify('error', `EBOM ${frozen.materialCode} 已冻结：直接编辑被拒绝，请走 ECR（HW-006）`)
  store.log('UPDATE', 'EBOM', frozen.materialCode, undefined, undefined, 'DENY')
}
</script>

<style scoped>
.kl { display: grid; grid-template-columns: 84px 1fr 50px 60px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.nm { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
