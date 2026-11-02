package com.mofeng.rdp.domain.project;

import com.mofeng.rdp.domain.ControlledObject;
import com.mofeng.rdp.domain.HashUtil;

/**
 * 项目受控对象（领域层具体子类，SRS ARC-004）。
 *
 * <p>项目是平台上最核心的受控对象之一，继承 {@link ControlledObject} 强制五要素。
 * 承载立项时的分级结果（level）与分级判定留痕（hitRowNo/basis），供后续门禁与追溯引用。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class Project extends ControlledObject<String> {

    /** 分级管控等级（L1~L4），立项时判定。 */
    private final String level;

    /** 分级判定命中行号（留痕，PRJ-020）。 */
    private final int hitRowNo;

    /** 分级判定依据（命中行文本）。 */
    private final String gradingBasis;

    private Project(String id, String level, int hitRowNo, String gradingBasis) {
        super(id);
        this.level = level;
        this.hitRowNo = hitRowNo;
        this.gradingBasis = gradingBasis;
    }

    public String level() { return level; }
    public int hitRowNo() { return hitRowNo; }
    public String gradingBasis() { return gradingBasis; }

    /**
     * 立项装配（应用层编排入口）。
     *
     * <p>五要素装配：状态机=已立项（state setter）、版本=1（构造默认）、
     * 版本元数据=by/at（revise 记录，版本号不递增但记录修订人/时间）、
     * 审计链锚点=ZERO_HASH、权限范围=租户/组织/项目。</p>
     */
    public static Project initiate(String id, String level, int hitRowNo, String gradingBasis,
                                   String tenantId, String orgId, String projectId, String by) {
        Project p = new Project(id, level, hitRowNo, gradingBasis);
        p.state("已立项");
        p.revise("立项", by);           // 记录修订人/时间（版本号从 1 → 2，语义为「立项即一次修订」）
        p.auditChainHash(HashUtil.ZERO_HASH);
        p.tenantId(tenantId);
        p.orgId(orgId);
        p.projectId(projectId);
        return p;
    }
}
