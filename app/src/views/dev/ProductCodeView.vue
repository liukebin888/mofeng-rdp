<template>
  <div>
    <PageHeader title="产品型号编制" desc="产品型号编制办法（CJQW0106 B1）——正式发布产品及客户命名编号及管理方法。12 位六段式编码 + 六大字典 + 零件号申请命名表" />

    <el-tabs v-model="activeTab" type="border-card">
      <!-- ① 编码规则 -->
      <el-tab-pane label="① 编码规则" name="rule">
        <div class="panel">
          <div class="panel-title">一、编制规定</div>
          <p class="lead">正常项目产品编码共 <b>12 位固定代码</b> 表示产品型号，分为六个部分。</p>
          <div class="code-demo">
            <div class="seg" v-for="s in segDemo" :key="s.key">
              <div class="seg-code">{{ s.code }}</div>
              <div class="seg-label">{{ s.label }}</div>
            </div>
          </div>

          <el-table :data="segmentRules" size="small" border style="margin-top: 12px">
            <el-table-column prop="key" label="段" width="60" />
            <el-table-column prop="name" label="代码段" width="150" />
            <el-table-column prop="len" label="位数" width="70" />
            <el-table-column prop="rule" label="编制规则" min-width="380" />
          </el-table>

          <div class="panel-title" style="margin-top: 20px">二、机动总成编码（子总成 / 保供 / 工程变更）</div>
          <p class="lead">复杂系统产品因体积较大或条件限制，无法以单独个体形式在内部管理时，进行内部分解产生的编码。前 8 位（a+b+c+d）与所属总成一致，后 4 位为流水码。</p>
          <el-table :data="aggRules" size="small" border>
            <el-table-column prop="name" label="编码方式" width="220" />
            <el-table-column prop="range" label="流水码范围" width="160" />
            <el-table-column prop="label" label="说明" min-width="360" />
          </el-table>
        </div>

        <div class="panel" style="margin-top: 12px">
          <div class="panel-title">三、编码原则</div>
          <ul class="principle">
            <li>① 变种车型与基础车型同一代码，例如上海大众途观（Tiguan）/途观 FL/途观 NF 使用同一车型代码。</li>
            <li>② 一个客户零件号对应一个内部零件号。</li>
            <li>③ 技术特征代码优先顺序由右向左（由难到易）表示，当一个产品有多个技术特征时，附表 3 中的字母优先取右侧。</li>
          </ul>
        </div>

        <div class="panel" style="margin-top: 12px">
          <div class="panel-title">四、应用举例</div>
          <el-table :data="examples" size="small" border>
            <el-table-column prop="code" label="产品型号" width="150" />
            <el-table-column prop="desc" label="含义" min-width="420" />
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ② 顾客编码 -->
      <el-tab-pane label="② 顾客编码" name="customer">
        <div class="toolbar">
          <el-input v-model="custKw" placeholder="搜索顾客名称/简称/英文缩写/编码" clearable style="width: 320px" />
          <span class="count">共 {{ filteredCustomers.length }} 条</span>
        </div>
        <el-table :data="filteredCustomers" size="small" border height="520">
          <el-table-column prop="code" label="编码" width="80" fixed />
          <el-table-column prop="name" label="顾客名称" min-width="260" />
          <el-table-column prop="short" label="客户简称" width="120" />
          <el-table-column prop="eng" label="英文缩写" width="110" />
          <el-table-column prop="brand" label="汽车品牌" min-width="280" />
        </el-table>
      </el-tab-pane>

      <!-- ③ 车型代码 -->
      <el-tab-pane label="③ 车型代码" name="vehicle">
        <div class="toolbar">
          <el-input v-model="vehKw" placeholder="搜索主机厂/车型/代号" clearable style="width: 320px" />
          <span class="count">共 {{ filteredVehicles.length }} 条</span>
        </div>
        <el-table :data="filteredVehicles" size="small" border height="520">
          <el-table-column prop="host" label="主机厂" min-width="240" />
          <el-table-column prop="code" label="代号" width="90" />
          <el-table-column prop="name" label="车型" min-width="300" />
        </el-table>
      </el-tab-pane>

      <!-- ④ 产品类型 -->
      <el-tab-pane label="④ 产品类型" name="ptype">
        <div class="toolbar">
          <el-input v-model="ptypeKw" placeholder="搜索产品名称/又名/代码" clearable style="width: 320px" />
          <span class="count">共 {{ filteredPTypes.length }} 条</span>
        </div>
        <el-table :data="filteredPTypes" size="small" border height="520">
          <el-table-column prop="code" label="代码" width="80" fixed />
          <el-table-column prop="name" label="产品名称" min-width="360" />
          <el-table-column prop="alias" label="又名" min-width="200" />
        </el-table>
      </el-tab-pane>

      <!-- ⑤ 型号生成 -->
      <el-tab-pane label="⑤ 型号生成" name="build">
        <div class="panel">
          <div class="panel-title">正常项目产品型号生成（12 位六段式）</div>
          <el-form label-width="140px" style="max-width: 640px; margin-top: 12px">
            <el-form-item label="a 顾客代码（2位）">
              <el-select v-model="seg.customer" filterable placeholder="选择顾客" style="width: 240px">
                <el-option v-for="c in CUSTOMER_CODES" :key="c.code" :label="`${c.code} ${c.short || c.name}`" :value="c.code" />
              </el-select>
              <el-input v-model="seg.customer" style="width: 120px; margin-left: 8px" placeholder="或手输" />
            </el-form-item>
            <el-form-item label="b 车型代码（2位）">
              <el-input v-model="seg.vehicle" style="width: 160px" placeholder="如 0Z" />
            </el-form-item>
            <el-form-item label="c 产品类型代码（2位）">
              <el-select v-model="seg.productType" filterable placeholder="选择产品类型" style="width: 240px">
                <el-option v-for="p in PRODUCT_TYPE_CODES" :key="p.code" :label="`${p.code} ${p.name}`" :value="p.code" />
              </el-select>
              <el-input v-model="seg.productType" style="width: 120px; margin-left: 8px" placeholder="或手输" />
            </el-form-item>
            <el-form-item label="d 配置变形代码（2位）">
              <el-input v-model="seg.variant" style="width: 160px" placeholder="AA/BA/CA" />
              <span class="hint">无变形 AA，第一次变形 BA，第二次 CA</span>
            </el-form-item>
            <el-form-item label="e 技术特征代码（3位）">
              <el-input v-model="seg.feature" style="width: 160px" placeholder="如 NLA" />
              <span class="hint">第1位电子/第2位结构/第3位平台</span>
            </el-form-item>
            <el-form-item label="f 生产基地代码（1位）">
              <el-radio-group v-model="seg.base">
                <el-radio label="A">A 温州</el-radio>
                <el-radio label="B">B 巴西</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>

          <div class="result" :class="buildResult.ok ? 'ok' : 'fail'">
            <template v-if="buildResult.ok">
              <div class="result-code">{{ buildResult.code }}</div>
              <div class="result-note">型号生成成功</div>
            </template>
            <template v-else>
              <div class="result-note">请完善六段代码</div>
              <ul v-if="buildResult.errors?.length" class="err-list">
                <li v-for="(e, i) in buildResult.errors" :key="i">{{ e }}</li>
              </ul>
            </template>
          </div>
        </div>
      </el-tab-pane>

      <!-- ⑥ 机动总成编码汇总 -->
      <el-tab-pane label="⑥ 机动总成汇总" name="agg">
        <div class="toolbar">
          <el-input v-model="aggKw" placeholder="搜索编码/子总成名称" clearable style="width: 320px" />
          <span class="count">共 {{ filteredAgg.length }} 条</span>
        </div>
        <el-table :data="filteredAgg" size="small" border height="520">
          <el-table-column prop="no" label="序号" width="70" />
          <el-table-column prop="code" label="内部子总成编码" width="170" fixed />
          <el-table-column prop="name" label="子总成名称" min-width="220" />
          <el-table-column prop="date" label="登记日期" width="110" />
          <el-table-column prop="note" label="说明" min-width="160" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import {
  CUSTOMER_CODES,
  VEHICLE_CODES,
  PRODUCT_TYPE_CODES,
  AGG_CODES,
} from '@/domain/productCodeData'
import { buildProductCode, AGG_CODE_RANGES } from '@/domain/productCode'

const activeTab = ref('rule')

const segDemo = [
  { key: 'a', code: 'XX', label: '顾客代码' },
  { key: 'b', code: 'XX', label: '车型代码' },
  { key: 'c', code: 'XX', label: '产品类型代码' },
  { key: 'd', code: 'XX', label: '配置变形代码' },
  { key: 'e', code: 'XXX', label: '技术特征代码' },
  { key: 'f', code: 'X', label: '生产基地代码' },
]

const segmentRules = [
  { key: 'a', name: '顾客代码', len: '2 位', rule: '固定 2 位数字或字母。原 1 位客户升级为 2 位（第 1 位补 0）；新增客户用 2 位大写字母；ES 为未立项前瞻项目顾客编码。见附表 1。' },
  { key: 'b', name: '车型代码', len: '2 位', rule: '数字 + 大写字母（O、I、J、V 除外），数字为 0 时不可省略。见附表 2。' },
  { key: 'c', name: '产品类型代码', len: '2 位', rule: '数字 + 大写字母（O、I、J、V 除外），数字为 0 时不可省略。通过产品名称或又名选择。见附表 3。' },
  { key: 'd', name: '配置变形代码', len: '2 位', rule: '大写字母。无变形 AA，第一次变形 BA，第二次 CA，依次类推。' },
  { key: 'e', name: '技术特征代码', len: '3 位', rule: '数字或大写字母。第 1 位电子相关、第 2 位结构、第 3 位产品平台预定义。见附表 3/附表 4。' },
  { key: 'f', name: '生产基地代码', len: '1 位', rule: '大写字母。A = 温州，B = 巴西。' },
]

const aggRules = [
  { name: '复杂项目子总成编码', range: '0001 - 0999', label: 'a+b+c+d+g，g 为子总成流水码' },
  { name: '保供方案总成编码（已批准）', range: '1001 - 1199', label: 'a+b+c+d+h，多物料保供且顾客已批准' },
  { name: '保供方案总成编码（未批准）', range: '2001 - 2199', label: 'a+b+c+d+h，多物料保供未获顾客批准' },
  { name: '工程变更总成编码', range: '3001 - 3999', label: 'a+b+c+d+i，一次工程变更增加一次流水码' },
]

const examples = [
  { code: '0B0Z71AANLAA', desc: '一汽大众奥迪 A4L/T88 单电动窗开关，小电流工作拉钩结构，A 平台设计，无变形，温州生产基地。' },
  { code: '0B0Z62BANLAA', desc: '一汽大众奥迪 A4L/T88 后备门开关，小电流工作拉钩结构，A 平台设计，第一次变形，温州生产基地。' },
  { code: 'AC0E16AANCWA', desc: '宝沃车型 S600MCE 前顶灯，无变形，小电流触摸结构，无平台，温州生产基地。' },
  { code: 'AC0E16BANPWA', desc: '宝沃车型 S600MCE 另一个第一次变形配置前顶灯，小电流 PUSH 按压结构，无平台，温州生产基地。' },
  { code: '0Y1Q69AANQAB', desc: '通用 GEM NBHB 车型天窗开关，小电流翘板结构，无变形，A 平台，巴西基地生产。' },
  { code: '0M3B20AA0001', desc: '0M3B20AA 双联屏产品的子总成 0001（仪表屏部分）。' },
  { code: '0B0Z62BA1001', desc: '0B0Z62BA 后备门开关保供方案 1001（新品牌 LED 解决进口管制断货）。' },
]

// 查询
const custKw = ref('')
const vehKw = ref('')
const ptypeKw = ref('')
const aggKw = ref('')

const filteredCustomers = computed(() => {
  const k = custKw.value.trim().toLowerCase()
  if (!k) return CUSTOMER_CODES
  return CUSTOMER_CODES.filter((c) =>
    [c.code, c.name, c.short, c.eng, c.brand].some((f) => f.toLowerCase().includes(k))
  )
})

const filteredVehicles = computed(() => {
  const k = vehKw.value.trim().toLowerCase()
  if (!k) return VEHICLE_CODES
  return VEHICLE_CODES.filter((v) => [v.host, v.code, v.name].some((f) => f.toLowerCase().includes(k)))
})

const filteredPTypes = computed(() => {
  const k = ptypeKw.value.trim().toLowerCase()
  if (!k) return PRODUCT_TYPE_CODES
  return PRODUCT_TYPE_CODES.filter((p) => [p.code, p.name, p.alias].some((f) => f.toLowerCase().includes(k)))
})

const filteredAgg = computed(() => {
  const k = aggKw.value.trim().toLowerCase()
  if (!k) return AGG_CODES
  return AGG_CODES.filter((a) => [a.code, a.name, a.note].some((f) => f.toLowerCase().includes(k)))
})

// 型号生成
const seg = ref({ customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA', feature: 'NLA', base: 'A' })

const buildResult = computed(() => {
  const r = buildProductCode({
    customer: seg.value.customer,
    vehicle: seg.value.vehicle,
    productType: seg.value.productType,
    variant: seg.value.variant,
    feature: seg.value.feature,
    base: seg.value.base,
  })
  return r
})
</script>

<style scoped>
.lead { color: var(--text-2); font-size: 13px; margin: 4px 0 12px; line-height: 1.6; }
.lead b { color: var(--text-1); }
.code-demo {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.seg {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
  text-align: center;
  min-width: 70px;
}
.seg-code { font-size: 18px; font-weight: 700; font-family: ui-monospace, monospace; letter-spacing: 1px; }
.seg-label { font-size: 11px; color: var(--text-3); margin-top: 2px; white-space: nowrap; }
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.count { color: var(--text-3); font-size: 12px; }
.principle { margin: 0; padding-left: 20px; color: var(--text-2); font-size: 13px; line-height: 1.9; }
.hint { color: var(--text-3); font-size: 12px; margin-left: 8px; }
.result { margin-top: 16px; padding: 16px; border-radius: 8px; }
.result.ok { background: #0f2418; border: 1px solid #1d4a2e; }
.result.fail { background: #2a1518; border: 1px solid #5b2230; }
.result-code { font-size: 28px; font-weight: 700; font-family: ui-monospace, monospace; letter-spacing: 2px; color: #8ee6b0; }
.result-note { color: var(--text-2); font-size: 12px; margin-top: 4px; }
.err-list { margin: 8px 0 0; padding-left: 20px; color: #ff9d9d; font-size: 12px; line-height: 1.7; }
</style>
