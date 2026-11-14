// 本文件由 APQP活动及输出物清单1030.xls 解析自动生成（59 活动 / 175 输出物）
// 阶段映射：CG0/CG1→P1, CG2→P2, CG3→P3, CG4/CG5→P4, CG6/CG7→P5

import type { PlanLevel } from './fourLevelPlan'

/** 输出物属性：流程 / 文档 / 明细 / 3D数据 / 样件 / SAP信息 等（开放字符串） */
export type ApqpDeliverableAttr = string

/** 单条输出物/文件（挂在 APQP 活动节点下） */
export interface ApqpDeliverable {
  /** 输出物名称 */
  name: string
  /** 主导部门 */
  dept: string
  /** 负责人/角色 */
  owner: string
  /** 输出物属性 */
  attr: string
  /** 当前存档位置 */
  currentLoc: string
  /** 之后在哪里管理 */
  futureLoc: string
  /** 完成时间要求 */
  deadline: string
  /** 备注 */
  remark: string
}

/** APQP 质量门（CG）定义 */
export interface ApqpGate {
  code: string
  name: string
  /** 归属阶段 */
  phase: string
  order: number
}

/** 单个 APQP 活动节点（带输出物清单） */
export interface ApqpDeliverableNode {
  id: string
  /** 归属阶段 P1~P5 */
  phase: string
  /** 归属质量门 CG0~CG7 */
  gateCode: string
  /** 活动序号（清单原序号 1~59） */
  seq: number
  /** 活动名称 */
  name: string
  /** 层级：活动为 L3 控制级 */
  level: PlanLevel
  /** 输出物清单 */
  deliverables: ApqpDeliverable[]
  order: number
}

export const CG_GATES: ApqpGate[] = [
  { code: 'CG0', name: '前期交流', phase: 'P1', order: 1 },
  { code: 'CG1', name: '项目启动', phase: 'P1', order: 2 },
  { code: 'CG2', name: '工程发布', phase: 'P2', order: 3 },
  { code: 'CG3', name: '首次样件', phase: 'P3', order: 4 },
  { code: 'CG4', name: '工程认可', phase: 'P4', order: 5 },
  { code: 'CG5', name: '过程认可', phase: 'P4', order: 6 },
  { code: 'CG6', name: '生产件批准', phase: 'P5', order: 7 },
  { code: 'CG7', name: '项目验收', phase: 'P5', order: 8 }
]

export const APQP_DELIVERABLE_NODES: ApqpDeliverableNode[] = [
  {
    id: 'APQ-ACT-1', phase: 'P1', gateCode: 'CG0', seq: 1,
    name: '前期技术交流', level: 'L3', order: 1,
    deliverables: [
      { name: '前期项目技术交流及报价通知', dept: '市场部', owner: '客户经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '' },
      { name: '报价BOM', dept: '市场部', owner: '客户经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '新增，不带价格的报价BOM，后期市场上报价软件，跟报价软件联动' },
      { name: 'TR方案', dept: '市场部', owner: '客户经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '立项书里面附带TR方案' },
    ]
  },
  {
    id: 'APQ-ACT-2', phase: 'P1', gateCode: 'CG0', seq: 2,
    name: '可行性分析', level: 'L3', order: 2,
    deliverables: [
      { name: '可行性分析流程', dept: '市场部', owner: '客户经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '市场部发起OA流程，各部门评审，其中工艺评估制造可行性内容' },
    ]
  },
  {
    id: 'APQ-ACT-3', phase: 'P1', gateCode: 'CG1', seq: 3,
    name: '项目立项', level: 'L3', order: 3,
    deliverables: [
      { name: '顾客技术协议/特殊要求评审单', dept: '市场部', owner: '客户经理', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '链接OA读取，文件不100%输出，需要保留' },
      { name: '项目立项通知书', dept: '市场部', owner: '客户经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-4', phase: 'P1', gateCode: 'CG1', seq: 4,
    name: '项目经理任命', level: 'L3', order: 4,
    deliverables: [
      { name: '项目经理任命书', dept: '项目部', owner: '项目综合科', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: 'APQP等级评估申请，什么级别项目，安排什么项目经理负责' },
    ]
  },
  {
    id: 'APQ-ACT-5', phase: 'P1', gateCode: 'CG1', seq: 5,
    name: '建立项目团队', level: 'L3', order: 5,
    deliverables: [
      { name: '项目团队成员资质评估表', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '体系审核会查，要输出' },
      { name: '项目团队架构图', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '开发任务书体现 项目团队成员清单需要重新讨论并设置。 1，涉及问题提报，以及报警&考核的责任。 2，涉及项目管理软件审批流。' },
    ]
  },
  {
    id: 'APQ-ACT-6', phase: 'P1', gateCode: 'CG1', seq: 6,
    name: '项目启动 （确定项目范围、顾客需求和期望，确定设计目标与可靠性、质量目标）', level: 'L3', order: 6,
    deliverables: [
      { name: '启动会议纪要', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '1,2级一定要开，3,4,5可选（建议是不开会，也要输出基本的会议内容，共享团队）' },
      { name: '项目开发任务书', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '包含质量目标，成员，产品明细，量纲，等信息' },
      { name: '主进度计划', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '' },
      { name: '结构分计划', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '主计划归档后7天内完成', remark: '原名称：新产品设计开发分计划，后续建议改成统一的叫法' },
      { name: '电子分计划', dept: '电子', owner: '电子分项目', attr: '流程', currentLoc: 'AMS', futureLoc: 'AMS', deadline: '', remark: '不同意在AMS系统上，统一在项目管理软件进行，需要专项沟通' },
      { name: '过程策划初始评估表', dept: '工艺', owner: '工艺工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '《开发任务书》下发后7个工作日内完成《过程策划初始评估表》', remark: '链接OA，含工艺四新、新增工装、测试仪、设备、产线、客户特殊要求的评估' },
      { name: '过程开发分计划', dept: '工艺', owner: '工艺分项目', attr: '流程', currentLoc: '工艺共享文档', futureLoc: '项目管理软件', deadline: '在《开发任务书》和《过程策划初始评估表》输出后14个工作日', remark: '具体工装开发计划勤哲系统' },
      { name: '外协外购件开发计划', dept: '采购部', owner: '采购分项目', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '1.需要结构&电子输入初始BOM清单； 2.需采购员、采购总助、结构&电子、SQE、项目审批； 3.建议保留在OA端，归档后数据抓取至项目管理软件保存。' },
      { name: '模具分计划', dept: '模具中心', owner: '模具分项目', attr: '流程', currentLoc: '益模', futureLoc: '项目管理软件', deadline: '', remark: '需要模具BOM清单' },
      { name: '试制计划表', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '产品首次需求时间到---试生产，中间的装样计划和数量，新增，需要固化模板' },
      { name: 'APQP输出物裁剪清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '新增（项目经理），定义好开发等级后制定裁剪' },
      { name: '风险分析报告', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '风险评估范围明确，哪些评估哪些不评估，模具借用评审表（模具，外协外购件，工装） 是不是可以单独一项活动，增加输出物：借用件评审表流程，工装产能评审流程，外协外购件评审流程' },
    ]
  },
  {
    id: 'APQ-ACT-7', phase: 'P1', gateCode: 'CG1', seq: 7,
    name: '质量阀评审', level: 'L3', order: 7,
    deliverables: [
      { name: 'APQP问题清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '各部门提报，动态更新清单，直到CG7结束；' },
      { name: '质量阀', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '上软件捆绑输出物链接，自动评估是否归档；建议质量部负责' },
    ]
  },
  {
    id: 'APQ-ACT-8', phase: 'P2', gateCode: 'CG2', seq: 8,
    name: '功能、需求锁定', level: 'L3', order: 8,
    deliverables: [
      { name: '产品顾客设计输入汇总及评审表-结构设计', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '（客户A面、初版数据、外形图、法律法规等SOR或TR方案）' },
      { name: '需求规格书', dept: '电子', owner: '系统工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-9', phase: 'P2', gateCode: 'CG2', seq: 9,
    name: '特殊特性识别（初始）', level: 'L3', order: 9,
    deliverables: [
      { name: '特殊特性清单（初始）(结构）', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '特性清单+FMEA，体系建议放在项目管理软件编辑上传。需要沟通' },
      { name: '特殊特性清单（初始）(电子）', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '过程特殊特性清单（初始）', dept: '工艺', owner: '工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-10', phase: 'P2', gateCode: 'CG2', seq: 10,
    name: '失效模式分析', level: 'L3', order: 10,
    deliverables: [
      { name: 'DFMEA', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '勤哲', futureLoc: '勤哲', deadline: '', remark: '勤哲确认是否能链接，' },
      { name: 'DFMEA', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: '勤哲', futureLoc: '勤哲', deadline: '', remark: '' },
      { name: 'PFMEA', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-11', phase: 'P2', gateCode: 'CG2', seq: 11,
    name: '设计方案评审', level: 'L3', order: 11,
    deliverables: [
      { name: '设计方案评审（结构部分）', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '3D数据评审前完成', remark: '' },
      { name: '新产品借用件风险评审表(结构部分)', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: 'CG2结束前15天完成', remark: '是否纳入风险评估报告那一栏（分别做模具，产能，外协外购件评估流程发起）' },
    ]
  },
  {
    id: 'APQ-ACT-12', phase: 'P2', gateCode: 'CG2', seq: 12,
    name: '3D数据细化，评审', level: 'L3', order: 12,
    deliverables: [
      { name: '零件3D数据', dept: '结构', owner: '结构工程师', attr: '3D数据', currentLoc: 'PLM', futureLoc: 'PLM', deadline: 'CG2结束前15天完成', remark: '' },
      { name: '模具开发通知单', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: '项目管理软件', deadline: '3D数据归档后', remark: '' },
      { name: '喷漆夹具3D数据', dept: '结构', owner: '结构工程师', attr: '3D数据', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '3D发布15天内完成', remark: '' },
      { name: '喷漆夹具开模通知单', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: '项目管理软件', deadline: '喷漆夹具3D数据归档后', remark: '' },
      { name: '外形检具采购申请表', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
      { name: '产品设计方案&3D数据工艺性审查表', dept: '工艺', owner: '工艺工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '《设计方案评审流程》归档后触发该流程，结构发起的流程，会签评审，节点上不受控' },
      { name: '产品总成数据', dept: '结构', owner: '结构工程师', attr: '3D数据', currentLoc: 'PLM', futureLoc: 'PLM', deadline: 'CG2结束后20天内完成', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-13', phase: 'P2', gateCode: 'CG2', seq: 13,
    name: 'BOM建立', level: 'L3', order: 13,
    deliverables: [
      { name: '结构BOM', dept: '结构', owner: '结构工程师', attr: '明细', currentLoc: 'SAP', futureLoc: 'OA', deadline: 'CG2结束前完成', remark: '初版流程通过 OA 审批，OA 审批办结即同步 SAP，OA 上可分别识别结构、电子、工艺节点是否完成' },
      { name: '电子BOM', dept: '电子', owner: '硬件工程师', attr: '明细', currentLoc: 'SAP', futureLoc: 'OA', deadline: '', remark: 'OA,PLM读取和SAP读取，需要沟通；' },
      { name: 'BOM表审批流程', dept: '工艺', owner: '工艺工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '1.电子OA发起BOM流程（包含结构电子各自的BOM）到工艺SAP 2.SAP勤哲发起BOM阶次调整&工艺路径流程，工艺员提交批完后SAP会调整阶次 3.最终调整后的BOM SAP上传至OA，结构电子工艺再会签确认  电子-SAP发起的OA流程，会签评审，节点上不受控' },
    ]
  },
  {
    id: 'APQ-ACT-14', phase: 'P2', gateCode: 'CG2', seq: 14,
    name: '技术文件发布', level: 'L3', order: 14,
    deliverables: [
      { name: 'GD&T图纸(外形图)', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: 'CG3结束前15天内完成', remark: '' },
      { name: '零件2D图', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '3D发布15天内完成', remark: '' },
      { name: '喷漆/镭雕/移印图', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: 'CG2结束后15天内完成', remark: '' },
      { name: '线路板外形图', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '3D发布7天内完成', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-15', phase: 'P2', gateCode: 'CG2', seq: 15,
    name: '硬件设计开发', level: 'L3', order: 15,
    deliverables: [
      { name: '原理图', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '线路板图', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '产品端口定义', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-16', phase: 'P2', gateCode: 'CG2', seq: 16,
    name: '外协外购件开发', level: 'L3', order: 16,
    deliverables: [
      { name: '新产品专用外协外购件BOM(结构)-初始', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '数据冻结指令后7天内或3D发布前20天完成', remark: '' },
      { name: '新产品外协外购件BOM', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '新零件SOR(结构)', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'PLM', futureLoc: 'OA', deadline: '按外协外购件BOM', remark: 'SOR归档在【PLM】 上，发布是在【OA】上，节点跟踪是在【勤哲】上' },
      { name: '新零件SOR(电子)', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'OA', deadline: '', remark: 'OA读取' },
      { name: '喷漆件SOR释放', dept: '工艺', owner: '喷漆工艺工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: 'CG2+10', remark: '结构要给工艺BOM,图纸，反馈BOM很多延期的，上传在《采购件外协外购件开发需求表》' },
      { name: '生产物料潜在供方准入评审', dept: '采购部', owner: '采购供应商管理员', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
      { name: '《外协外购件供应商招投标评审单》', dept: '采购部', owner: '采购工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '1.需采购员、采购高级经理、质量&结构&模具&电子&计划&采购等总监审核； 2.建议保留在OA端，归档后数据抓取至项目管理软件保存。' },
    ]
  },
  {
    id: 'APQ-ACT-17', phase: 'P2', gateCode: 'CG2', seq: 17,
    name: '软件开发', level: 'L3', order: 17,
    deliverables: [
      { name: '软件需求规格书', dept: '电子', owner: '软件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '软件详细设计说明', dept: '电子', owner: '软件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-18', phase: 'P2', gateCode: 'CG2', seq: 18,
    name: '完成设验证计划', level: 'L3', order: 18,
    deliverables: [
      { name: 'DV大纲', dept: '试验', owner: '实验工程师', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '上传勤哲，想在勤哲上管理' },
      { name: 'PV大纲', dept: '试验', owner: '实验工程师', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-19', phase: 'P2', gateCode: 'CG2', seq: 19,
    name: '匹配件需求', level: 'L3', order: 19,
    deliverables: [
      { name: '产品匹配件需求汇总表', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '接插件，实验要用到的台架，空调，电机（不够全面，需要细化）--流程改善' },
    ]
  },
  {
    id: 'APQ-ACT-20', phase: 'P2', gateCode: 'CG2', seq: 20,
    name: '质量阀评审', level: 'L3', order: 20,
    deliverables: [
      { name: 'APQP问题清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '各部门提报，动态更新清单' },
      { name: '质量阀', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '上软件捆绑输出物链接，自动评估是否归档；' },
    ]
  },
  {
    id: 'APQ-ACT-21', phase: 'P3', gateCode: 'CG3', seq: 21,
    name: '外协外购件定点', level: 'L3', order: 21,
    deliverables: [
      { name: '产品定点通知单', dept: '采购部', owner: '采购工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '1..需采购员发起，供应商管理部审核供应商状态，涉及模具件需触发模具采购申请单，涉及无品号需流转至研发人员，诸总审批； 3.建议保留在OA端，归档后数据抓取至项目管理软件保存。' },
    ]
  },
  {
    id: 'APQ-ACT-22', phase: 'P3', gateCode: 'CG3', seq: 22,
    name: 'BOM单价维护', level: 'L3', order: 22,
    deliverables: [
      { name: 'BOM(采购单价维护)', dept: '采购部', owner: '采购工程师', attr: '明细', currentLoc: 'SAP系统', futureLoc: 'SAP', deadline: '', remark: '抓取代码：zmm029物料解冻检查' },
    ]
  },
  {
    id: 'APQ-ACT-23', phase: 'P3', gateCode: 'CG3', seq: 23,
    name: '特殊特性识别（样品）', level: 'L3', order: 23,
    deliverables: [
      { name: '产品特殊特性清单（结构）', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '3D发布30天内完成', remark: '' },
      { name: '产品特殊特性清单（硬件）', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '过程特殊特性清单（工艺）', dept: '工艺', owner: '工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG4数据-3天', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-24', phase: 'P3', gateCode: 'CG3', seq: 24,
    name: '检验文件释放', level: 'L3', order: 24,
    deliverables: [
      { name: '零件检验文件（外协外购件）', dept: '结构，电子', owner: '结构工程师，硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '外协外购件首次采购到位前', remark: '' },
      { name: '产品技术规范', dept: '结构，电子', owner: '结构工程师，硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '3D发布30天内完成', remark: '' },
      { name: 'PCB检验文件', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '出厂检验规范', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-25', phase: 'P3', gateCode: 'CG3', seq: 25,
    name: '过程设计开发', level: 'L3', order: 25,
    deliverables: [
      { name: '过程设计方案评审', dept: '工艺', owner: '工艺工程师', attr: '流程/文档', currentLoc: '0A流程/PLM归档', futureLoc: 'OA', deadline: '读取CG2数据+20天', remark: '前提：需要出厂检验规范和结构数据锁定  包含DFM检查表、工艺四新评估提报、自动化设计方案、初稿场地平面布置图、策划的生产线平衡率' },
      { name: '工装/测试仪清单', dept: '工艺', owner: '工艺工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '读取CG2数据+20天', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-26', phase: 'P3', gateCode: 'CG3', seq: 26,
    name: '初始工艺文件', level: 'L3', order: 26,
    deliverables: [
      { name: '初始过程流程图', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG2数据+20天', remark: '在PLM系统“(样件阶段)PPAP资料”压缩包文件里面,通用SGM在勤哲' },
      { name: '控制计划（样件）', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG3数据-3天', remark: '在PLM系统“(样件阶段)PPAP资料”压缩包文件里面' },
    ]
  },
  {
    id: 'APQ-ACT-27', phase: 'P3', gateCode: 'CG3', seq: 27,
    name: '自动化产线开发', level: 'L3', order: 27,
    deliverables: [
      { name: '产线与工装工程图', dept: '工艺', owner: '机械设计工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '专线：读取生产线机械设计方案完成时间+20天 非专线：工装/测试仪清单(申请)完成时间+10天', remark: '1.包含装配图 2.产线与工装工程图命名格式：产品型号-A-2D-PDF-工装代码$工装名称-PDF工程图 3.前提：出厂检验规范和结构数据锁定 ，影响产线开发设计，至少提前15~30天，视产品复杂度，影响 产线与工装工程图、产线与工装明细表、生产线主BOM、测试设备接线原理图、工装设备电气图及BOM、测试设备BOM' },
      { name: '生产线主BOM', dept: '工艺', owner: '机械设计工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '1.生产线主BOM命名格式：产品型号-A-BOM-产线代码$产线名称主BOM-明细表' },
      { name: '工装/设备机械BOM', dept: '工艺', owner: '机械设计工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '1.生产线主BOM命名格式：产品型号-A-BOM-产线代码$产线名称主BOM-明细表' },
      { name: '工装/设备电气原理图', dept: '工艺', owner: '电气设计工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '专线：读取电气产线设计方案完成时间+45天 非专线：读取工装测试仪完成时间+10天', remark: '前提：出厂检验规范归档；' },
      { name: '工装/设备电气BOM', dept: '工艺', owner: '电气设计工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '专线：读取电气产线设计方案完成时间+45天 非专线：读取工装测试仪完成时间+11天', remark: '' },
      { name: '工装/设备下位机原理图', dept: '工艺', owner: '电控设计工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '专线：读取电气产线设计方案完成时间+45天 非专线：读取工装测试仪完成时间+12天', remark: '' },
      { name: '工装/设备下位机BOM', dept: '工艺', owner: '电控设计工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '专线：读取电气产线设计方案完成时间+45天 非专线：读取工装测试仪完成时间+13天', remark: '' },
      { name: '机加工工作计划', dept: '工艺', owner: 'CNC/线切割加工经理', attr: '文档', currentLoc: '共享盘', futureLoc: '项目管理软件', deadline: '', remark: '此行写最终整体完成时间；(包含线切割、CNC、电镀、氧化喷砂计划） 项目管理软件进行计划管理、预警/报警' },
      { name: '工装设备产线安装调试计划', dept: '工艺', owner: '电控/电气设计工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '此行写最终整体完成时间； 测试设备下位机软件发布报告、电气控制软件发布报告、产线上位机软件发布报告为计划完成结果；项目管理软件进行计划管理、预警/报警' },
      { name: '工装、设备、产线外协外购件计划（自动化）', dept: '工艺', owner: '机械/电控设计工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '此行写最终整体完成时间；（设备/配件/材料采购申请单） 项目管理软件进行计划管理、预警/报警' },
      { name: '工装、设备、产线外协外购件计划（工艺）', dept: '工艺', owner: '总成工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '此行写最终整体完成时间；（设备/配件/材料采购申请单） 项目管理软件进行计划管理、预警/报警' },
    ]
  },
  {
    id: 'APQ-ACT-28', phase: 'P3', gateCode: 'CG3', seq: 28,
    name: '首次样件任务单及零件物料订单释放', level: 'L3', order: 28,
    deliverables: [
      { name: '新零件风险采购单（结构）', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
      { name: '新零件风险采购单（电子）', dept: '电子', owner: '硬件工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
      { name: '滚动计划', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '' },
      { name: '油漆风险采购单', dept: '工艺', owner: '喷漆工艺工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
      { name: '首次装样任务单', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '任务需要更改流程，后续自动生产任务单完结反馈，跟交付捆绑' },
    ]
  },
  {
    id: 'APQ-ACT-29', phase: 'P3', gateCode: 'CG3', seq: 29,
    name: '模具T0', level: 'L3', order: 29,
    deliverables: [
      { name: '零件T0试模报告', dept: '模具中心', owner: '模具分项目', attr: '文档', currentLoc: '共享盘', futureLoc: '项目管理软件', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-30', phase: 'P3', gateCode: 'CG3', seq: 30,
    name: '外协外购件T0', level: 'L3', order: 30,
    deliverables: [
      { name: '外协外购件样品评价跟踪表', dept: '结构，电子', owner: '结构工程师', attr: '文档', currentLoc: '勤哲', futureLoc: '勤哲', deadline: '', remark: '电镀件首样未使用此流程' },
    ]
  },
  {
    id: 'APQ-ACT-31', phase: 'P3', gateCode: 'CG3', seq: 31,
    name: '首次软件发布', level: 'L3', order: 31,
    deliverables: [
      { name: '软件集成测试报告', dept: '电子', owner: '软件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '基本功能测试报告', dept: '电子', owner: '测试工程师', attr: '流程', currentLoc: 'AMS', futureLoc: 'AMS', deadline: '', remark: '' },
      { name: '软件发布审批通知单', dept: '电子', owner: '软件工程师', attr: '流程', currentLoc: 'AMS', futureLoc: 'AMS', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-32', phase: 'P3', gateCode: 'CG3', seq: 32,
    name: '样品过程文件', level: 'L3', order: 32,
    deliverables: [
      { name: '样件作业指导书(注塑）', dept: '工艺', owner: '注塑工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG3数据-3天', remark: 'SMT、注塑、镭雕、移印、冲压、总成样件作业指导书' },
      { name: '样件作业指导书(冲压）', dept: '工艺', owner: '冲压工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG3数据-3天', remark: 'SMT、注塑、镭雕、移印、冲压、总成样件作业指导书' },
      { name: '样件作业指导书（镭雕/移印）', dept: '工艺', owner: '镭雕/移印工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG3数据-3天', remark: 'SMT、注塑、镭雕、移印、冲压、总成样件作业指导书' },
      { name: '样件作业指导书（SMT)', dept: '工艺', owner: 'SMT工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG3数据-3天', remark: 'SMT、注塑、镭雕、移印、冲压、总成样件作业指导书' },
      { name: '样件作业指导书（总成）', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG3数据-3天', remark: 'SMT、注塑、镭雕、移印、冲压、总成样件作业指导书' },
      { name: '包装方案', dept: '工艺', owner: '包装工程师', attr: '流程/文档', currentLoc: '0A流程/PLM归档', futureLoc: 'OA', deadline: '读取CG4数据', remark: '' },
      { name: '场地平面布置图', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG3数据-3天', remark: '专线有输出签字档的，非专线无' },
    ]
  },
  {
    id: 'APQ-ACT-33', phase: 'P3', gateCode: 'CG3', seq: 33,
    name: '自动化产线开发', level: 'L3', order: 33,
    deliverables: [
      { name: '首台测试仪软件发布报告', dept: '工艺', owner: '电控设计工程师', attr: '流程', currentLoc: 'OA', futureLoc: 'OA', deadline: '读取CG3数据-7天', remark: '自检报告； 前提：样品提前准备5天；' },
    ]
  },
  {
    id: 'APQ-ACT-34', phase: 'P3', gateCode: 'CG3', seq: 34,
    name: '总成首次样件', level: 'L3', order: 34,
    deliverables: [
      { name: '首模件检查表', dept: '结构，电子', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: 'CG3结束后15天内完成（OTS认可主导部门）', remark: '建议增加电子内容，不是所有的产品都出首模件检查表，需要沟通，没有输出物' },
    ]
  },
  {
    id: 'APQ-ACT-35', phase: 'P3', gateCode: 'CG3', seq: 35,
    name: 'DV实验启动', level: 'L3', order: 35,
    deliverables: [
      { name: 'DV实验委托评审流程', dept: '结构，电子，工艺', owner: '结构工程师，硬件工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
      { name: 'DV试验件', dept: '项目部', owner: '项目经理', attr: '样件', currentLoc: '线下', futureLoc: 'SAP', deadline: '', remark: 'SAP入库记录' },
    ]
  },
  {
    id: 'APQ-ACT-36', phase: 'P3', gateCode: 'CG3', seq: 36,
    name: '质量阀评审', level: 'L3', order: 36,
    deliverables: [
      { name: 'APQP问题清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '各部门提报，动态更新清单' },
      { name: '质量阀', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '上软件捆绑输出物链接，自动评估是否归档；' },
    ]
  },
  {
    id: 'APQ-ACT-37', phase: 'P4', gateCode: 'CG4', seq: 37,
    name: '零件认可', level: 'L3', order: 37,
    deliverables: [
      { name: '模具零件确认单（自制件认可）', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '19.117共享', futureLoc: '项目管理软件', deadline: 'CG4结束前完成', remark: '自制件PPAP流程有相关附件' },
      { name: '样品认可报告（外协外购件认可）', dept: '结构，电子', owner: '结构工程师，硬件工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: 'CG4结束前完成', remark: '' },
      { name: '《塑料（冷冲）模具质量、结构验收单》', dept: '模具中心', owner: '模具分项目', attr: '文档', currentLoc: '共享盘', futureLoc: '项目管理软件', deadline: '', remark: '修改文件名称《实物入库凭单》为《塑料（冷冲）模具质量、结构验收单》' },
      { name: '外形检具验收检查清单', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '外形检具采购申请表OA流程触发' },
    ]
  },
  {
    id: 'APQ-ACT-38', phase: 'P4', gateCode: 'CG4', seq: 38,
    name: '硬件认可', level: 'L3', order: 38,
    deliverables: [
      { name: '光强测试报告', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '不同客户要求不同，设计员签字打印后同样件一起给项目，报告客户签完字后给项目保存，样件给项目，项目转交资料室保存' },
      { name: 'PCB认可报告', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '模具主导' },
    ]
  },
  {
    id: 'APQ-ACT-39', phase: 'P4', gateCode: 'CG4', seq: 39,
    name: '软件认可', level: 'L3', order: 39,
    deliverables: [
      { name: '软件冻结发布', dept: '电子', owner: '软件工程师', attr: '流程', currentLoc: 'AMS', futureLoc: 'AMS', deadline: '', remark: '不同客户要求不同，设计员签字打印后同样件一起给项目，报告客户签完字后给项目保存，样件给项目，项目转交资料室保存' },
    ]
  },
  {
    id: 'APQ-ACT-40', phase: 'P4', gateCode: 'CG4', seq: 40,
    name: '产品总成认可', level: 'L3', order: 40,
    deliverables: [
      { name: '外观认可报告', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '各自电脑', futureLoc: '项目管理软件', deadline: '', remark: '不同客户要求不同，设计员签字打印后同样件一起给项目，报告客户签完字后给项目保存，样件给项目，项目转交资料室保存' },
      { name: '光板件认可报告', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '各自电脑', futureLoc: '项目管理软件', deadline: '', remark: '模具主导' },
      { name: '匹配认可报告', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '各自电脑', futureLoc: '项目管理软件', deadline: '', remark: '' },
      { name: '手感认可报告', dept: '结构', owner: '结构工程师', attr: '样件', currentLoc: '总成封样件', futureLoc: '项目管理软件', deadline: '', remark: '不同客户要求不同，设计员签字打印后同样件一起给项目，报告客户签完字后给项目保存，样件给项目，项目转交资料室保存' },
    ]
  },
  {
    id: 'APQ-ACT-41', phase: 'P4', gateCode: 'CG4', seq: 41,
    name: 'DFMEA更新', level: 'L3', order: 41,
    deliverables: [
      { name: 'DFMEA更新(OTS阶段)', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '勤哲/PLM', futureLoc: '勤哲', deadline: '', remark: '' },
      { name: 'DFMEA更新(OTS阶段)', dept: '电子', owner: '硬件工程师', attr: '流程', currentLoc: '勤哲', futureLoc: '勤哲', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-42', phase: 'P4', gateCode: 'CG4', seq: 42,
    name: '设计认可归档', level: 'L3', order: 42,
    deliverables: [
      { name: 'DV（材料尺寸性能）报告', dept: '实验', owner: '实验工程师', attr: '文档', currentLoc: '勤哲', futureLoc: '勤哲', deadline: '', remark: '读取勤哲' },
      { name: '第三方 EMC 测试报告', dept: '电子', owner: '硬件工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '材料类试验报告（ELV,VOC）', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '19.117共享/PLM', futureLoc: 'PLM', deadline: '', remark: '气味 /VOC/材料' },
      { name: 'OTS认可报告(内部认可)', dept: '结构', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: 'CG4结束前完成', remark: '' },
      { name: 'OTS认可报告(电子内部认可)', dept: '电子', owner: '硬件工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-43', phase: 'P4', gateCode: 'CG4', seq: 43,
    name: '客户端设计认可资料编辑提交', level: 'L3', order: 43,
    deliverables: [
      { name: '结构客户端设计认可资料', dept: '结构', owner: '结构工程师', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '各部门提报' },
      { name: '电子客户端设计认可资料', dept: '电子', owner: '系统工程师', attr: '文档', currentLoc: 'PLM', futureLoc: '项目管理软件', deadline: '', remark: '系统工程师转达任务，电子PM协助收集，软硬件测试工程师协助' },
    ]
  },
  {
    id: 'APQ-ACT-44', phase: 'P4', gateCode: 'CG4', seq: 44,
    name: '产线（工装设备）验收', level: 'L3', order: 44,
    deliverables: [
      { name: '机械装配自检报告', dept: '工艺', owner: '机械装配经理', attr: '文档', currentLoc: 'PLM', futureLoc: '项目管理软件', deadline: '专线：读取零件加工完成时间+20天 非专线：读取零件加工完成时间+10天', remark: '工装送检单' },
      { name: '电气装配自检报告', dept: '工艺', owner: '电气装配经理', attr: '文档', currentLoc: 'PLM', futureLoc: '项目管理软件', deadline: '专线：机械装配完成时间+7天 非专线：机械装配完成时间+4天', remark: '工装设备制作检查表' },
      { name: '测试设备下位机软件发布报告', dept: '工艺', owner: '电控设计工程师', attr: '流程', currentLoc: 'OA', futureLoc: 'OA', deadline: '专线：电气装配完成时间+10天 非专线：电气装配完成时间+4天', remark: '有svn路径    设备编号  自检报告  等数据' },
      { name: '电气控制软件发布报告', dept: '工艺', owner: '电气设计工程师', attr: '流程', currentLoc: 'OA', futureLoc: 'OA', deadline: '专线：电气装配完成时间+10天 非专线：电气装配完成时间+4天', remark: '有svn路径    设备编号  自检报告  等数据' },
      { name: '产线上位机软件发布报告', dept: '工艺', owner: '电控设计工程师', attr: '流程', currentLoc: 'OA', futureLoc: 'OA', deadline: '专线：读取电气装配完成时间+15天 非专线：读取电气装配完成时间+7天', remark: '有svn路径    设备编号  自检报告  等数据' },
      { name: '测试设备验收报告、工装验收报告', dept: '工艺', owner: '验收工程师', attr: '文档', currentLoc: 'PLM', futureLoc: '项目管理软件', deadline: 'CG4-7天', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-45', phase: 'P4', gateCode: 'CG4', seq: 45,
    name: '过程文件更新（试生产阶段）', level: 'L3', order: 45,
    deliverables: [
      { name: '控制计划(试生产)', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG4数据-3天', remark: '在PLM系统“(试生产阶段)PPAP资料”压缩包文件里面' },
      { name: '作业指导书(注塑）', dept: '工艺', owner: '注塑工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG5数据-7天', remark: 'SMT、注塑、镭雕、移印、冲压、装配作业指导书，含对应生产辅料的消耗定额' },
      { name: '作业指导书(冲压）', dept: '工艺', owner: '冲压工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG5数据-7天', remark: 'SMT、注塑、镭雕、移印、冲压、装配作业指导书，含对应生产辅料的消耗定额' },
      { name: '作业指导书（镭雕/移印）', dept: '工艺', owner: '镭雕/移印工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG5数据-7天', remark: 'SMT、注塑、镭雕、移印、冲压、装配作业指导书，含对应生产辅料的消耗定额' },
      { name: '作业指导书（SMT)', dept: '工艺', owner: 'SMT工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG5数据-7天', remark: 'SMT、注塑、镭雕、移印、冲压、装配作业指导书，含对应生产辅料的消耗定额' },
      { name: '作业指导书(总成）', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG5数据-7天', remark: 'SMT、注塑、镭雕、移印、冲压、装配作业指导书，含对应生产辅料的消耗定额' },
      { name: '过程流程图', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG4数据-3天', remark: '在PLM系统“(试生产阶段)PPAP资料”压缩包文件里面' },
      { name: 'PFMEA更新', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG4数据-3天', remark: '在PLM系统“(试生产阶段)PPAP资料”压缩包文件里面' },
    ]
  },
  {
    id: 'APQ-ACT-46', phase: 'P4', gateCode: 'CG4', seq: 46,
    name: '质量阀评审', level: 'L3', order: 46,
    deliverables: [
      { name: 'APQP问题清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '各部门提报，动态更新清单' },
      { name: '质量阀', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '上软件捆绑输出物链接，自动评估是否归档；' },
    ]
  },
  {
    id: 'APQ-ACT-47', phase: 'P4', gateCode: 'CG5', seq: 47,
    name: 'PV实验启动', level: 'L3', order: 47,
    deliverables: [
      { name: 'PV实验委托评审流程', dept: '结构，电子，工艺', owner: '结构工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '特殊主机有要求试验，工艺会发起试验流程' },
      { name: 'PV试验件', dept: '项目部', owner: '项目经理', attr: '样件', currentLoc: '样件', futureLoc: 'SAP', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-48', phase: 'P4', gateCode: 'CG5', seq: 48,
    name: '零部件PPAP认可', level: 'L3', order: 48,
    deliverables: [
      { name: '零件提交保证书-供应商', dept: '质量部', owner: '外协质量工程师', attr: '流程', currentLoc: 'OA/PLM', futureLoc: 'SRM', deadline: '', remark: '后期资料在SRM系统管理，链接SRM系统读取' },
      { name: '自制件PPAP认可', dept: '质量部', owner: '注塑质量工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-49', phase: 'P4', gateCode: 'CG5', seq: 49,
    name: '过程验证认可', level: 'L3', order: 49,
    deliverables: [
      { name: '过程认可', dept: '工艺', owner: '工艺分项目', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '读取CG5数据', remark: '含过程能力分析报告、工艺验证报告、验证问题清单、曼宁指数、环境：温湿度、噪音、光照度、粉尘、ESD；一次性合格率、设备能力CMK、生产线平衡率、PPK/CPK、MSA（检测设备）、制造及工艺成本、应力测试报告：各零件及总成的工时定额等； 涉及工程师（含注塑、冲压、镭雕、移印、SMT、总成、验证、项目等）输出物；' },
      { name: '测量系统分析计划', dept: '企管', owner: '计量工程师', attr: '文档', currentLoc: '共享盘', futureLoc: '项目管理软件', deadline: '', remark: '' },
      { name: '开班/换型检查首件单', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '', remark: '' },
      { name: '全新开发产品分配表', dept: '工艺', owner: 'IE工艺工程师', attr: '流程', currentLoc: 'OA', futureLoc: 'OA', deadline: '', remark: '新增，经常是试生产前班组没有分配' },
    ]
  },
  {
    id: 'APQ-ACT-50', phase: 'P4', gateCode: 'CG5', seq: 50,
    name: '过程文件更新（生产阶段）', level: 'L3', order: 50,
    deliverables: [
      { name: '包装方案,实物到位', dept: '工艺', owner: '包装工程师', attr: 'SAP信息', currentLoc: 'SAP', futureLoc: 'OA', deadline: '', remark: '查询SAP系统里面包装库存信息' },
      { name: '控制计划(生产)', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG5数据-3天', remark: '在PLM系统“(生产阶段)PPAP资料”压缩包文件里面' },
      { name: '防错验证主清单', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: '勤哲系统', futureLoc: '勤哲', deadline: '读取CG5数据+15天', remark: '' },
      { name: '过程流程图', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG5数据-3天', remark: '在PLM系统“(生产阶段)PPAP资料”压缩包文件里面' },
      { name: 'PFMEA更新', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM/勤哲系统（通用客户）', futureLoc: 'PLM', deadline: '读取CG5数据-3天', remark: '在PLM系统“(生产阶段)PPAP资料”压缩包文件里面' },
      { name: '过程能力分析表', dept: '工艺', owner: '总成工艺工程师', attr: '文档', currentLoc: 'PLM', futureLoc: 'PLM', deadline: '读取CG6数据', remark: '与过程验证报告一起' },
    ]
  },
  {
    id: 'APQ-ACT-51', phase: 'P4', gateCode: 'CG5', seq: 51,
    name: '质量阀评审', level: 'L3', order: 51,
    deliverables: [
      { name: 'APQP问题清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '各部门提报，动态更新清单' },
      { name: '质量阀', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '上软件捆绑输出物链接，自动评估是否归档；' },
    ]
  },
  {
    id: 'APQ-ACT-52', phase: 'P5', gateCode: 'CG6', seq: 52,
    name: '试生产验证及产线移交', level: 'L3', order: 52,
    deliverables: [
      { name: '试生产(PPV)评审报告', dept: '质量部', owner: '项目质量工程师', attr: '文档', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '链接读取' },
      { name: '产线（非专线）交割清单', dept: '工艺', owner: '工艺分项目', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '试生产后+30天', remark: '需在试生产之后,车间才同意签字' },
    ]
  },
  {
    id: 'APQ-ACT-53', phase: 'P5', gateCode: 'CG6', seq: 53,
    name: '协议签订', level: 'L3', order: 53,
    deliverables: [
      { name: '质量协议', dept: '质量部', owner: '售后质量工程师', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '' },
      { name: '物流协议', dept: '计划物流', owner: '销售计划', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '' },
    ]
  },
  {
    id: 'APQ-ACT-54', phase: 'P5', gateCode: 'CG6', seq: 54,
    name: 'PV报告', level: 'L3', order: 54,
    deliverables: [
      { name: '样品检验报告(PV报告)', dept: '试验', owner: '实验工程师', attr: '文档', currentLoc: '线下', futureLoc: '勤哲', deadline: '', remark: '试验：与DV保持一致，PV报告中部分输出物由试验中心输出' },
    ]
  },
  {
    id: 'APQ-ACT-55', phase: 'P5', gateCode: 'CG6', seq: 55,
    name: '内部总成PPAP资料提交', level: 'L3', order: 55,
    deliverables: [
      { name: '内部PPAP认可报告', dept: '质量部', owner: '项目质量工程师', attr: '流程', currentLoc: 'OA流程', futureLoc: 'OA', deadline: '', remark: '外协零件附PSW，自制件另单独走了，PPAP就只写了结论 ，项目质量发起 需要优化内容太少，没有起到管控目的' },
    ]
  },
  {
    id: 'APQ-ACT-56', phase: 'P5', gateCode: 'CG6', seq: 56,
    name: '客户PPAP资料提交', level: 'L3', order: 56,
    deliverables: [
      { name: '客户PPAP资料', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '制定不同主机厂PPAP清单和模版库，直接调取编辑，质量负责审核' },
    ]
  },
  {
    id: 'APQ-ACT-57', phase: 'P5', gateCode: 'CG6', seq: 57,
    name: '质量阀评审', level: 'L3', order: 57,
    deliverables: [
      { name: 'APQP问题清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '各部门提报，动态更新清单' },
      { name: '质量阀', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '上软件捆绑输出物链接，自动评估是否归档；' },
    ]
  },
  {
    id: 'APQ-ACT-58', phase: 'P5', gateCode: 'CG7', seq: 58,
    name: '项目交接及经验总结', level: 'L3', order: 58,
    deliverables: [
      { name: '项目交接清单', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '线下', futureLoc: '项目管理软件', deadline: '', remark: '固化交接清单模板' },
      { name: '项目总结报告', dept: '项目部', owner: '项目经理', attr: '文档', currentLoc: '共享盘', futureLoc: '项目管理软件', deadline: '', remark: '固化总结报告模版，内容固化' },
    ]
  },
  {
    id: 'APQ-ACT-59', phase: 'P5', gateCode: 'CG7', seq: 59,
    name: '质量阀评审', level: 'L3', order: 59,
    deliverables: [
      { name: '质量阀', dept: '项目部', owner: '项目经理', attr: '流程', currentLoc: 'OA流程', futureLoc: '项目管理软件', deadline: '', remark: '上软件捆绑输出物链接，自动评估是否归档；' },
    ]
  },
]

// —— 查询 ——

export function gateOf(code: string): ApqpGate | null {
  return CG_GATES.find((g) => g.code === code) ?? null
}

export function gatesByPhase(phase: string): ApqpGate[] {
  return CG_GATES.filter((g) => g.phase === phase).sort((a,b) => a.order - b.order)
}

export function nodesByGate(gateCode: string): ApqpDeliverableNode[] {
  return APQP_DELIVERABLE_NODES.filter((n) => n.gateCode === gateCode).sort((a,b) => a.order - b.order)
}

export function deliverableCount(): number {
  return APQP_DELIVERABLE_NODES.reduce((s,n) => s + n.deliverables.length, 0)
}
