package com.mofeng.rdp.infrastructure.persistence.baseline;

import com.mofeng.rdp.domain.baseline.BaselineEngine;

import java.util.List;
import java.util.Map;

/**
 * 基线哈希链仓库接口（ARC-008）。
 *
 * <p>基础设施层以接口方式被应用层调用。基线组装/冻结/校验复用领域层
 * {@link BaselineEngine}（纯函数），本接口负责持久化编排。</p>
 */
public interface BaselineRepository {

    /** 组装基线：逐项 row_hash + manifest_hash，落基线表 + 基线项表（同事务）。 */
    BaselineEngine.Baseline build(String tenantId, String projectId, String no, String type,
                                  List<BaselineEngine.ItemInput> items, String createdBy);

    /** 冻结基线：生成签名与时间，之后整行不可改（BAS-002）。 */
    BaselineEngine.Baseline freeze(String tenantId, String projectId, String no, String actor);

    /** 加载基线（含全部基线项）。 */
    BaselineEngine.Baseline load(String tenantId, String projectId, String no);

    /** 校验基线：逐项比对快照哈希，返回不一致清单（BAS-003）。 */
    BaselineEngine.VerifyResult verify(String tenantId, String projectId, String no,
                                       Map<String, Map<String, Object>> currentSnapshots);

    /** 替代：冻结基线由新基线经 replacedBy 替代（BAS-002）。 */
    void replace(String tenantId, String projectId, String prevNo, Long nextId);
}
