/* NFR-017 标签整改映射表（可审计资产，非日常脚本）。
 * 为真实取证列出的缺标签表单控件补 aria-label，真实落到 Element Plus 渲染出的原生 input。
 * 严格校验：每个 old 锚点在目标文件中必须恰好出现 1 次，否则整体中止、不写任何文件。
 * 只新增无障碍属性，绝不改动可见文案 / 菜单 / 标题 / 业务逻辑。
 * 幂等保护：已整改项（new 文本已存在）自动跳过，重复运行输出「本次新增 0 处」且不写任何文件。
 * 复跑取证请用 `npm run a11y:evidence`；本文件仅用于追溯「补了哪些控件、补了什么标签」。
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..', 'src')

// [相对路径, 唯一锚点, 替换文本]
const PATCHES = [
  ['components/DataTable.vue',
    `<el-input v-model="kw" placeholder="搜索…" clearable style="width: 200px" />`,
    `<el-input v-model="kw" aria-label="表格搜索" placeholder="搜索…" clearable style="width: 200px" />`],

  ['views/flow/ApprovalsView.vue',
    `<el-select v-model="newDefId" size="small" placeholder="选择流程模板" style="width: 180px; margin-right: 8px">`,
    `<el-select v-model="newDefId" aria-label="选择流程模板" size="small" placeholder="选择流程模板" style="width: 180px; margin-right: 8px">`],

  ['views/presale/PreSaleFlowView.vue',
    `<el-select v-model="selectedProjectId" size="small" placeholder="选择项目/产品" style="width: 260px" filterable>`,
    `<el-select v-model="selectedProjectId" aria-label="选择项目或产品" size="small" placeholder="选择项目/产品" style="width: 260px" filterable>`],

  ['views/plan/DeviationView.vue',
    `<el-input v-model="plan" type="textarea" :rows="3" placeholder="填写纠偏措施（须可回写计划，否则纠偏项不得关闭 C-46）" style="margin-top: 8px" />`,
    `<el-input v-model="plan" aria-label="纠偏措施" type="textarea" :rows="3" placeholder="填写纠偏措施（须可回写计划，否则纠偏项不得关闭 C-46）" style="margin-top: 8px" />`],

  ['views/dev/TraceView.vue',
    `<el-select v-model="source" size="small" style="width: 100%" placeholder="选择变更源对象">`,
    `<el-select v-model="source" aria-label="选择变更源对象" size="small" style="width: 100%" placeholder="选择变更源对象">`],

  ['views/dev/EcrView.vue',
    `<el-select :model-value="c.decision" size="small" style="width: 130px" placeholder="选择结论" @change="(v: string) => choose(c.objId, v)">`,
    `<el-select :model-value="c.decision" aria-label="影响确认结论" size="small" style="width: 130px" placeholder="选择结论" @change="(v: string) => choose(c.objId, v)">`],
  ['views/dev/EcrView.vue',
    `<el-input :model-value="c.note" size="small" placeholder="理由（必填）" style="flex: 1" @change="(v: string) => choose(c.objId, c.decision, v)" />`,
    `<el-input :model-value="c.note" aria-label="确认理由" size="small" placeholder="理由（必填）" style="flex: 1" @change="(v: string) => choose(c.objId, c.decision, v)" />`],
  ['views/dev/EcrView.vue',
    `<el-input v-model="verifyNote" size="small" placeholder="验证结论说明（必填）" style="flex: 1" />`,
    `<el-input v-model="verifyNote" aria-label="验证结论说明" size="small" placeholder="验证结论说明（必填）" style="flex: 1" />`],

  ['views/dev/BaselineView.vue',
    `<el-select v-model="bid" size="small" style="width: 220px">`,
    `<el-select v-model="bid" aria-label="选择基线" size="small" style="width: 220px">`],

  ['views/quality/KnowledgeView.vue',
    `<el-select v-model="q.projectId" size="small" placeholder="项目">`,
    `<el-select v-model="q.projectId" aria-label="检索项目" size="small" placeholder="项目">`],
  ['views/quality/KnowledgeView.vue',
    `<el-select v-model="q.stage" size="small" clearable placeholder="阶段">`,
    `<el-select v-model="q.stage" aria-label="检索阶段" size="small" clearable placeholder="阶段">`],
  ['views/quality/KnowledgeView.vue',
    `<el-select v-model="q.category" size="small" clearable placeholder="问题类型">`,
    `<el-select v-model="q.category" aria-label="检索问题类型" size="small" clearable placeholder="问题类型">`],
  ['views/quality/KnowledgeView.vue',
    `<el-input v-model="q.keyword" size="small" placeholder="关键词检索标题/内容/标签" clearable />`,
    `<el-input v-model="q.keyword" aria-label="经验库关键词检索" size="small" placeholder="关键词检索标题/内容/标签" clearable />`],

  ['views/doc/DocView.vue',
    `<el-input v-model="query" placeholder="全文检索（DOC-008）" size="small" style="width: 200px" clearable @input="onSearch" />`,
    `<el-input v-model="query" aria-label="文档全文检索" placeholder="全文检索（DOC-008）" size="small" style="width: 200px" clearable @input="onSearch" />`],

  ['views/ai/AiChatPanel.vue',
    `<el-switch v-model="withContext" active-text="带当前项目上下文" inactive-text="仅通用问答" size="small" />`,
    `<el-switch v-model="withContext" aria-label="带当前项目上下文" active-text="带当前项目上下文" inactive-text="仅通用问答" size="small" />`],
  ['views/ai/AiChatPanel.vue',
    `<el-input v-model="bindPhone" size="small" clearable class="phone-input" :placeholder="t('ai.bind.phonePh')" />`,
    `<el-input v-model="bindPhone" aria-label="绑定手机号" size="small" clearable class="phone-input" :placeholder="t('ai.bind.phonePh')" />`],
  ['views/ai/AiChatPanel.vue',
    `<el-input v-model="bindCode" size="small" clearable class="code-input" :placeholder="t('ai.bind.codePh')" @keyup.enter="confirmBind" />`,
    `<el-input v-model="bindCode" aria-label="短信验证码" size="small" clearable class="code-input" :placeholder="t('ai.bind.codePh')" @keyup.enter="confirmBind" />`],
  ['views/ai/AiChatPanel.vue',
    `<el-input v-model="sessionKey" :type="showKey ? 'text' : 'password'" size="small" clearable class="key-input" :placeholder="t('ai.bind.keyPh')" @keyup.enter="saveKey" />`,
    `<el-input v-model="sessionKey" aria-label="WorkBuddy API Key" :type="showKey ? 'text' : 'password'" size="small" clearable class="key-input" :placeholder="t('ai.bind.keyPh')" @keyup.enter="saveKey" />`],
  ['views/ai/AiChatPanel.vue',
    `        v-model="draft"\n        type="textarea"`,
    `        v-model="draft"\n        aria-label="AI 提问内容"\n        type="textarea"`],

  ['views/basic/NamingView.vue',
    `<el-switch :model-value="row.enabled" size="small" @change="(v: boolean) => store.toggleNamingRule(row.id, v)" />`,
    `<el-switch :model-value="row.enabled" :aria-label="'启用规则：' + row.name" size="small" @change="(v: boolean) => store.toggleNamingRule(row.id, v)" />`],

  ['views/basic/DeliverableControlView.vue',
    `<el-input v-model="kw" placeholder="搜索部门或输出物名称" clearable style="width: 300px" />`,
    `<el-input v-model="kw" aria-label="搜索部门或输出物名称" placeholder="搜索部门或输出物名称" clearable style="width: 300px" />`],
  ['views/basic/DeliverableControlView.vue',
    `<el-select v-model="selDept" placeholder="选择部门" clearable style="width: 200px" @change="onDeptChange">`,
    `<el-select v-model="selDept" aria-label="选择部门" placeholder="选择部门" clearable style="width: 200px" @change="onDeptChange">`],

  ['views/resource/PoolView.vue',
    `<el-input v-model="skillForm.role" size="small" style="width: 130px" placeholder="角色" />`,
    `<el-input v-model="skillForm.role" aria-label="技能角色" size="small" style="width: 130px" placeholder="角色" />`],
  ['views/resource/PoolView.vue',
    `<el-input v-model="skillForm.skills" size="small" style="flex: 1" placeholder="技能（逗号分隔）" />`,
    `<el-input v-model="skillForm.skills" aria-label="技能列表（逗号分隔）" size="small" style="flex: 1" placeholder="技能（逗号分隔）" />`],
  ['views/resource/PoolView.vue',
    `<el-input v-model="scenarioName" size="small" style="flex: 1" placeholder="情景名称" />`,
    `<el-input v-model="scenarioName" aria-label="情景名称" size="small" style="flex: 1" placeholder="情景名称" />`],

  ['views/system/RejectionPolicyView.vue',
    `              :model-value="row.severity"`,
    `              :model-value="row.severity"\n              :aria-label="'拦截档位：' + row.name"`],
  ['views/system/RejectionPolicyView.vue',
    `                :model-value="String(row.fieldValue)"`,
    `                :model-value="String(row.fieldValue)"\n                :aria-label="'配置字段值：' + row.name"`]
]

// 阶段 1：只读校验。已整改项（new 文本已存在）幂等跳过；其余项锚点必须恰好出现 1 次。
const problems = []
const cache = new Map()
const pending = []
let alreadyApplied = 0
for (const [rel, old, neu] of PATCHES) {
  const abs = path.join(ROOT, rel)
  if (!cache.has(abs)) cache.set(abs, fs.readFileSync(abs, 'utf8'))
  const text = cache.get(abs)
  if (text.includes(neu)) { alreadyApplied++; continue }
  const n = text.split(old).length - 1
  if (n !== 1) problems.push(`${rel} :: 锚点出现 ${n} 次 :: ${old.slice(0, 70)}`)
  pending.push([rel, old, neu])
}
if (problems.length) {
  console.error('校验失败，未写入任何文件：')
  problems.forEach((p) => console.error('  - ' + p))
  process.exit(1)
}

// 阶段 2：按文件累积替换，一次写回（无待改项时不写任何文件）
const writes = new Map()
for (const [rel, old, neu] of pending) {
  const abs = path.join(ROOT, rel)
  if (!writes.has(abs)) writes.set(abs, cache.get(abs))
  writes.set(abs, writes.get(abs).replace(old, neu))
}
for (const [abs, content] of writes) fs.writeFileSync(abs, content, 'utf8')
console.log(`整改映射表：共 ${PATCHES.length} 处，本次新增 ${pending.length} 处（涉及 ${writes.size} 个文件），已整改跳过 ${alreadyApplied} 处`)
if (pending.length === 0) {
  console.log('所有映射项均已应用，未改动任何文件（幂等保护生效）')
  process.exit(0)
}
const byFile = {}
for (const [rel] of PATCHES) byFile[rel] = (byFile[rel] || 0) + 1
for (const [rel, n] of Object.entries(byFile)) console.log('  ' + rel + ' : ' + n)
