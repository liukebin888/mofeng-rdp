package com.mofeng.rdp.infrastructure.persistence.controlled;

import com.mofeng.rdp.domain.ControlledObject;

import java.util.List;

/**
 * 受控对象统一基表仓库接口（ARC-004）。
 *
 * <p>承载五要素（状态机/版本/基线绑定/审计/权限范围）的统一持久化。
 * 入库前强制齐全性校验（缺一不得入库），五要素齐全性规则复用领域层
 * {@link ControlledObject#checkCompleteness()}。</p>
 */
public interface ControlledObjectRepository {

    /** 入库：五要素齐全性校验通过才写库，缺一抛 {@link IncompleteControlledObjectError}。 */
    void insert(ControlledObject<?> obj, String objectType);

    /** 冻结：设置基线并置只读（复用领域层 freeze）。 */
    void freeze(String tenantId, String objectType, String objectId, String baselineId);

    /** 加载指定对象的五要素元数据。 */
    ControlledObjectEntity load(String tenantId, String objectType, String objectId);

    /** 按项目查询受控对象清单。 */
    List<ControlledObjectEntity> listByProject(String tenantId, String projectId);

    /** 五要素不齐全异常（ARC-004：缺一不得入库）。 */
    final class IncompleteControlledObjectError extends RuntimeException {
        public IncompleteControlledObjectError(String objectType, List<String> missing) {
            super("受控对象[" + objectType + "]五要素不齐全，拒绝入库；缺失：" + String.join("、", missing));
        }
    }
}
