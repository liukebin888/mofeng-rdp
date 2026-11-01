/**
 * 枚举双语映射表（TEN-013 键位映射方案）
 * 设计约束：数据层中文枚举存储保持不变（零数据迁移、零回退风险）；
 * 本表提供「中文枚举值 → 双语标签」的集中映射，视图层统一走 i18n 的 translateEnum 渲染。
 * 铁律：新增枚举必须同步补映射，未命中的值回退到原文（保证不丢信息、不产生空标签）。
 */

export type Locale = 'zh-CN' | 'en-US'

/** 单个枚举项的映射：key 为数据层存储值（中文），label 为按语言分组的展示文案 */
export interface EnumMap {
  zh: string
  en: string
}

export const ENUM_DICT: Record<string, EnumMap> = {
  // —— 通用状态 ——
  草稿: { zh: '草稿', en: 'Draft' },
  已提交: { zh: '已提交', en: 'Submitted' },
  已审核: { zh: '已审核', en: 'Reviewed' },
  已批准: { zh: '已批准', en: 'Approved' },
  已发布: { zh: '已发布', en: 'Published' },
  已作废: { zh: '已作废', en: 'Obsolete' },
  已归档: { zh: '已归档', en: 'Archived' },
  已关闭: { zh: '已关闭', en: 'Closed' },
  已冻结: { zh: '已冻结', en: 'Frozen' },
  已被替代: { zh: '已被替代', en: 'Superseded' },
  组建中: { zh: '组建中', en: 'Assembling' },
  会签中: { zh: '会签中', en: 'In Sign-off' },
  有效: { zh: '有效', en: 'Effective' },
  已失效: { zh: '已失效', en: 'Expired' },
  进行中: { zh: '进行中', en: 'In Progress' },
  策划中: { zh: '策划中', en: 'Planning' },
  开放: { zh: '开放', en: 'Open' },
  缓解中: { zh: '缓解中', en: 'Mitigating' },
  运行中: { zh: '运行中', en: 'Running' },
  已完成: { zh: '已完成', en: 'Completed' },
  待处理: { zh: '待处理', en: 'Pending' },
  已答复: { zh: '已答复', en: 'Answered' },
  已退回: { zh: '已退回', en: 'Returned' },
  已超期: { zh: '已超期', en: 'Overdue' },
  待执行: { zh: '待执行', en: 'To Execute' },
  执行中: { zh: '执行中', en: 'Executing' },
  已闭环: { zh: '已闭环', en: 'Closed Loop' },
  已召开: { zh: '已召开', en: 'Held' },
  待答复: { zh: '待答复', en: 'Awaiting Reply' },
  交办: { zh: '交办', en: 'Assigned' },
  反馈: { zh: '反馈', en: 'Feedback' },
  复核: { zh: '复核', en: 'Review' },
  已销项: { zh: '已销项', en: 'Closed Out' },
  已生效: { zh: '已生效', en: 'Effective' },
  已拒绝: { zh: '已拒绝', en: 'Rejected' },
  已释放: { zh: '已释放', en: 'Released' },
  待审批: { zh: '待审批', en: 'Pending Approval' },

  // —— 项目状态 / 健康度 ——
  未定级: { zh: '未定级', en: 'Ungraded' },
  绿: { zh: '绿', en: 'Green' },
  黄: { zh: '黄', en: 'Yellow' },
  红: { zh: '红', en: 'Red' },
  灰: { zh: '灰', en: 'Gray' },

  // —— ECR 阶段 ——
  影响评估: { zh: '影响评估', en: 'Impact Assessment' },
  审批中: { zh: '审批中', en: 'In Review' },
  ECN执行: { zh: 'ECN执行', en: 'ECN Execute' },
  ECN验证: { zh: 'ECN验证', en: 'ECN Verify' },
  修改: { zh: '修改', en: 'Modify' },
  确认无影响: { zh: '确认无影响', en: 'No Impact' },
  废弃: { zh: '废弃', en: 'Discard' },

  // —— 需求状态 ——
  评审中: { zh: '评审中', en: 'In Review' },
  已基线化: { zh: '已基线化', en: 'Baselined' },
  变更中: { zh: '变更中', en: 'Changing' },
  已废弃: { zh: '已废弃', en: 'Deprecated' },

  // —— 供应商 / PPAP ——
  未提交: { zh: '未提交', en: 'Not Submitted' },
  审核中: { zh: '审核中', en: 'Under Review' },
  拒收: { zh: '拒收', en: 'Rejected' },
  低: { zh: '低', en: 'Low' },
  中: { zh: '中', en: 'Medium' },
  高: { zh: '高', en: 'High' },
  关键件: { zh: '关键件', en: 'Critical Part' },
  一般件: { zh: '一般件', en: 'Standard Part' },

  // —— 送审类型 ——
  客户: { zh: '客户', en: 'Customer' },
  内部: { zh: '内部', en: 'Internal' },
  供应商: { zh: '供应商', en: 'Supplier' },

  // —— 收件箱类型 ——
  送审件: { zh: '送审件', en: 'Submission' },
  联系单: { zh: '联系单', en: 'Contact Note' },
  决议: { zh: '决议', en: 'Resolution' },
  送审: { zh: '送审', en: 'Submission' },
  督办: { zh: '督办', en: 'Supervision' },
  审批: { zh: '审批', en: 'Approval' },
  系统: { zh: '系统', en: 'System' },

  // —— 决策动作 ——
  延后: { zh: '延后', en: 'Defer' },
  缩减: { zh: '缩减', en: 'Reduce' },
  终止: { zh: '终止', en: 'Terminate' },
  采纳: { zh: '采纳', en: 'Adopt' },

  // —— 日历 ——
  企业: { zh: '企业', en: 'Enterprise' },
  项目: { zh: '项目', en: 'Project' },
  资源: { zh: '资源', en: 'Resource' },
  工作日: { zh: '工作日', en: 'Workday' },
  休息日: { zh: '休息日', en: 'Rest Day' },

  // —— UDF 类型 / 目标 ——
  文本: { zh: '文本', en: 'Text' },
  数字: { zh: '数字', en: 'Number' },
  枚举: { zh: '枚举', en: 'Enum' },
  日期: { zh: '日期', en: 'Date' },
  布尔: { zh: '布尔', en: 'Boolean' },
  WBS: { zh: 'WBS', en: 'WBS' },
  活动: { zh: '活动', en: 'Activity' },
  分配: { zh: '分配', en: 'Assignment' },
  费用: { zh: '费用', en: 'Cost' },

  // —— 草稿对象类型 ——
  变更单: { zh: '变更单', en: 'Change Order' },
  纠偏: { zh: '纠偏', en: 'Deviation' },
  经验: { zh: '经验', en: 'Lesson' },
  工时单: { zh: '工时单', en: 'Timesheet' }
}
