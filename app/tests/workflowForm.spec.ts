/**
 * 统一工作流单据框架（WF-001「新增/保存/关闭/提交」四按钮 + 单据状态机）独立 QA 用例
 * 覆盖：状态机流转 / 四按钮可用性（fail-closed）/ 草稿键一致 / 提交校验 / 与流程实例状态同步
 */
import { describe, expect, it } from 'vitest'
import {
  canDo,
  draftContentFor,
  markSubmitted,
  newWorkflowForm,
  reopenForEdit,
  saveWorkflowForm,
  syncStatusFromFlow,
  validateSubmit,
  workflowFormKey
} from '../src/domain/workflowForm'
import type { FlowDefinition, FlowInstance } from '../src/domain/flowEngine'
import type { FormDraft } from '../src/domain/types'

const def: FlowDefinition = {
  id: 'DEF-PRE-3',
  code: 'FLOW-PRE-3',
  name: '立项申请',
  formFields: [{ key: 'name', label: '项目名称' }],
  startNodeId: 'b1',
  nodes: [
    { id: 'b1', name: '发起', type: 'start' },
    { id: 'b2', name: '市场总监审核', type: 'approve', approverRole: '市场总监' },
    { id: 'b5', name: '结束', type: 'end' }
  ],
  enabled: true,
  version: 1
}

function makeForm() {
  return newWorkflowForm({ def, objectType: '立项申请', objectId: 'PRJ-1', id: 'WF-1' })
}

describe('WF-001 状态机：新增 → 草稿', () => {
  it('newWorkflowForm 生成草稿态单据', () => {
    const f = makeForm()
    expect(f.status).toBe('draft')
    expect(f.defCode).toBe('FLOW-PRE-3')
    expect(f.objectType).toBe('立项申请')
  })

  it('保存不改变状态，仅更新时间与内容', () => {
    const f = makeForm()
    const saved = saveWorkflowForm(f, '{"name":"E15"}', new Date('2026-11-03T10:00:00+08:00'))
    expect(saved.status).toBe('draft')
    expect(saved.content).toBe('{"name":"E15"}')
    expect(saved.updatedAt).toBe(new Date('2026-11-03T10:00:00+08:00').toISOString())
  })
})

describe('WF-001 四按钮可用性（fail-closed：非草稿态禁止保存/提交）', () => {
  it('草稿态：new/save/close/submit 均可用', () => {
    const f = makeForm()
    expect(canDo(f, 'new')).toBe(true)
    expect(canDo(f, 'save')).toBe(true)
    expect(canDo(f, 'close')).toBe(true)
    expect(canDo(f, 'submit')).toBe(true)
  })

  it('已提交态：禁止再次保存/提交（save/submit 关闭）', () => {
    const submitted = markSubmitted(makeForm(), 'F100')
    expect(submitted.status).toBe('submitted')
    expect(canDo(submitted, 'save')).toBe(false)
    expect(canDo(submitted, 'submit')).toBe(false)
    expect(canDo(submitted, 'close')).toBe(true)
  })

  it('已完成态：禁止保存/提交', () => {
    const inst: FlowInstance = {
      id: 'F100', defId: 'DEF-PRE-3', defCode: 'FLOW-PRE-3', title: '立项申请', submitter: '张三',
      form: {}, currentNodeId: 'b5', status: '已完成', passedNodeIds: ['b1', 'b2'], history: [],
      nodeEnteredAt: '2026-11-03T09:00:00+08:00', escalated: false, createdAt: '2026-11-03T09:00:00+08:00', finishedAt: '2026-11-03T10:00:00+08:00'
    }
    const done = syncStatusFromFlow(markSubmitted(makeForm(), 'F100'), inst)
    expect(done.status).toBe('completed')
    expect(canDo(done, 'save')).toBe(false)
    expect(canDo(done, 'submit')).toBe(false)
  })
})

describe('WF-001 草稿键跨端一致', () => {
  it('workflowFormKey 与 draftEngine 键同构', () => {
    expect(workflowFormKey('U1', '立项申请', 'PRJ-1')).toBe('U1:立项申请:PRJ-1')
  })

  it('draftContentFor 命中返回内容，未命中返回 undefined', () => {
    const drafts: FormDraft[] = [
      { id: 'PRJ-1', userId: 'U1', objectType: '立项申请', content: '{"name":"a"}', updatedAt: '', createdAt: '' }
    ]
    expect(draftContentFor(drafts, 'U1', '立项申请', 'PRJ-1')).toBe('{"name":"a"}')
    expect(draftContentFor(drafts, 'U1', '立项申请', 'PRJ-2')).toBeUndefined()
  })
})

describe('WF-001 提交前校验（gate）', () => {
  it('校验通过清空 blockers', () => {
    const f = makeForm()
    const ok = validateSubmit({ ok: true, blockers: [] }, f)
    expect(ok.blockers).toEqual([])
  })

  it('校验不通过附 blockers，且状态仍为草稿', () => {
    const f = makeForm()
    const blocked = validateSubmit({ ok: false, blockers: ['CLS-001：未定级', 'C-02：未关联'] }, f)
    expect(blocked.status).toBe('draft')
    expect(blocked.blockers).toEqual(['CLS-001：未定级', 'C-02：未关联'])
  })
})

describe('WF-001 驳回后重开编辑', () => {
  it('reopenForEdit 回退草稿并清空流程绑定', () => {
    const submitted = markSubmitted(makeForm(), 'F100')
    const reopened = reopenForEdit(submitted)
    expect(reopened.status).toBe('draft')
    expect(reopened.flowInstanceId).toBeUndefined()
  })
})
