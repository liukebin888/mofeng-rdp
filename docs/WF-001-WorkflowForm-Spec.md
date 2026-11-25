# 统一工作流单据接入规范（WF-001）

> 本文规定「新增 / 保存 / 关闭 / 提交」四按钮统一工作流解决方案的接入约定。
> 所有新的任务、计划、申请、立项等工作流**必须**采用本方案，四个按钮缺一不可（用户硬约束）。

## 1. 目标与原则

研发项目管理中的申请/批准工作，统一走同一条交互闭环：

```
新增（打开已有模板） → 编辑 → 保存（草稿，可关闭续编） → 关闭（退出编辑） → 提交（审批）
```

| 按钮 | 语义 | 状态影响 | 草稿影响 |
|------|------|----------|----------|
| 新增 | 打开已有流程模板生成空白单据；已有草稿则载入续编 | 进入「草稿」 | 无（复用已有草稿） |
| 保存 | 把当前编辑内容写入草稿（跨端可续写） | 保持「草稿」 | 写入/覆盖草稿 |
| 关闭 | 退出编辑视图 | 保持「草稿」 | 保留草稿（不删除） |
| 提交 | 跑提交前校验 → 启动审批流程实例 | 草稿 → 审批中 | 提交后自动清除 |

## 2. 三层结构（单一权威分层）

```
视图层  WorkflowFormShell.vue   —— 四按钮工具栏 + 状态徽章 + 阻断提示（通用壳，零业务逻辑）
   │        ↓ 通过 slot 注入业务表单
引擎层  workflowForm.ts        —— 单据状态机 + 草稿键 + 提交校验（纯函数，唯一权威规则）
   │        ↓ 复用既有引擎
复用层  flowEngine.ts（流程定义/实例） + draftEngine.ts（草稿） + store.submitWorkflowForm（提交闭环）
```

## 3. 接入步骤（以「立项申请」为范例）

### 3.1 准备流程模板（seed 已有则跳过）

在 `data/seed.ts` 的 `flowDefinitions` 里定义流程模板（含 `formFields` 与审批节点序列）。
立项申请复用既有 `DEF-PRE-3`（市场总监审核 → 八部门会签 → 总经理批准）。

### 3.2 业务视图接入四按钮壳

```vue
<template>
  <PageHeader title="xxx申请">
    <template #actions>
      <WorkflowFormShell
        :form="wfForm"
        :blockers="wfBlockers"
        :dirty="dirty"
        @new="wfNew" @save="wfSave" @close="wfClose" @submit="wfSubmit"
      />
    </template>
  </PageHeader>
  <!-- 未新建时展示空态；已新建时展示业务表单 -->
</template>
```

### 3.3 实现四个动作

```ts
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === 'DEF-XXX')
  if (!def) { store.notify('error', '模板不存在'); return }
  const draft = store.data.drafts?.find((d) =>
    d.userId === store.currentUser.id && d.objectType === 'xxx申请' && d.id === objectId)
  wfForm.value = newWorkflowForm({ def, objectType: 'xxx申请', objectId, content: draft?.content })
  if (draft?.content) hydrate(draft.content)   // 续编
  dirty.value = false
}

function wfSave() {
  if (!wfForm.value) return
  const content = serialize()                   // 业务字段 → JSON
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('xxx申请', wfForm.value.id, content)
  dirty.value = false
}

function wfClose() {
  wfForm.value = null                          // 草稿保留
  dirty.value = false
}

function wfSubmit() {
  if (!wfForm.value) return
  const blockers: string[] = collectBlockers() // 业务 gate 校验
  if (blockers.length) { wfBlockers.value = blockers; store.notify('error', blockers.join('；')); return }
  wfForm.value = saveWorkflowForm(wfForm.value, serialize())
  const ok = store.submitWorkflowForm(wfForm.value, `${wfForm.value.title}：${title}`, formData)
  if (ok) { dirty.value = false; wfBlockers.value = [] }
}
```

### 3.4 登记草稿对象类型

在 `domain/types.ts` 的 `DraftObjectType` 联合类型中登记该单据类型（如 `'立项申请'`）。

## 4. 硬约束（务必遵守）

1. **四按钮缺一不可**：任何工作流不得省略「新增/保存/关闭/提交」中的任一按钮。
2. **新增 = 打开模板**：新增动作必须基于已有流程模板（`FlowDefinition`）生成，不得硬编码表单。
3. **保存/关闭可中断续编**：编辑过程中随时可保存、可关闭，关闭不丢草稿（草稿跨端可续写，POR-007）。
4. **提交才启动审批**：只有「提交」才调用 `submitWorkflowForm` 走 `startFlow` 进入审批链；保存/关闭绝不触发审批实例。
5. **提交前校验不可绕过**：业务 gate（如分级判定、关联校验）在提交动作内强制拦截，阻断项必须回显（`blockers`）。
6. **状态机 fail-closed**：非草稿态禁止保存/提交（`canDo` 返回 false），未知动作一律拒绝。

## 5. 已接入清单

| 工作流 | 模板 | 状态 |
|--------|------|------|
| 立项申请 | DEF-PRE-3 | ✅ 已接入（`views/presale/ApplyView.vue`） |
| 前期交流申请 | DEF-PRE-1 | ✅ 已接入（`views/presale/PresaleApplyView.vue`） |
| 项目/产品报价 | DEF-PRE-2 | ✅ 已接入（`views/presale/QuoteApplyView.vue`） |
| 技术方案（TR） | DEF-PRE-5 | ✅ 已接入（`views/presale/SchemeView.vue`） |
| 立项评审 | DEF-PRE-4 | ✅ 已接入（自动触发，`views/presale/ProjectReviewView.vue`） |
| 样件评审模板（评审 + 审批 两段式） | DEF-TRIAL-REVIEW | ✅ 已接入（`views/trial/InspectView.vue`，2026-11-24 增量） |
| ECR 审批 | DEF-ECR | ⏸ 待接入 |
| Gate 放行 | DEF-GATE | ⏸ 待接入 |
| 豁免申请 | DEF-EXEMPT | ⏸ 待接入 |
| 工时审核 | DEF-HOUR | ⏸ 待接入 |
| 阶段审批 S1~S6 | DEF-STAGE-S* | ⏸ 待接入 |

### 5.1 样件评审模板接入口径（Q6：提交 = 提交审批，同一动作）

> 增量代号 `mofeng_rdp_sample_review_template_increment`，详见 `docs/DESIGN-SAMPLE-REVIEW-TEMPLATE-2026-11-24.md` v0.3。

| 项 | 约定 |
|---|---|
| 模板 | 就地改造 `DEF-TRIAL-REVIEW`（`id` / `code` / `name` 保持原值，仅改 `nodes` / `formFields` / `version=2`）：`start(sr1) → branch(sr2「阶段一 · 评审结论守卫」，无 defaultNext) → approve(sr3「阶段二 · 提交审批」，研发副总) → end(sr4)` |
| 草稿类型 | `DraftObjectType` 已登记 `'样件评审模板'`（WF-001 §3.4） |
| 四按钮 | 「新增」`createSampleReviewTemplate` → 「保存」`saveSampleReviewTemplate` → 「关闭」`closeSampleReviewTemplate` → 「提交」`submitSampleReviewTemplate`。**「提交」即「提交审批」**（Q6 同一动作）；表单内**不新增第五按钮 / 不引入第二个提交语义**，仅在「提交」按钮旁用新增说明文字写明「提交后进入审批阶段」 |
| 提交 gate | `canSubmitForApproval(r)`：评审项清单全完成 + 汇总结论非空 + 必填字段 + 会签全通过 + 8D 前置（拒收 / 检验不合格，fail-closed）。未通过则 blockers 可见且不启动流程实例 |
| 提交编排 | `validateSubmit` → `submitWorkflowForm`（`startFlow` 于 sr1）→ 对 sr1 调一次冻结引擎 `approveNode`，借 `advanceThroughBranch` + `evalBranch(verdict≠'')` 落到 sr3 → `markSubmitted` → `stageFromFormStatus('submitted') = '审批'` |
| 阶段二 | `approveSampleReviewTemplate` / `rejectSampleReviewTemplate` → `syncTemplateStatusFromFlow` 单向回写；批准经 `canArchive` fail-closed 归档，驳回经 `reopenForReviewRound` 退回阶段一复评（`round+1`） |
| 单一权威 | 页面只消费 `store.sampleReviewTemplateView(id)` → `templateVerdictOf(r)` 的 `stage / editable / canXxx / blockers / progress / sign`，视图不自行拼装状态口径 |
| 冻结边界 | `workflowForm.ts` / `flowEngine.ts` / `sampleReviewEngine.ts` / `repo.ts` 及其单测、`WorkflowFormShell.vue` 均零改动 |

## 6. 测试与验证

- 纯函数单测：`tests/workflowForm.spec.ts`（状态机流转 / 四按钮可用性 / 草稿键一致 / 提交校验 / 驳回重开）。
- 回退验证纪律：提交前校验必须先经「已知违规样本 → 断言拦截」坐实，杜绝零缺陷假阳性（与门禁同源）。
