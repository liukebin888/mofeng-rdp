package com.mofeng.rdp.infrastructure.search;

import java.util.List;
import java.util.Map;

/**
 * 检索抽象（基础设施层，B3 ES 全文检索/大列表查询）。
 *
 * <p>只做检索编排，检索判定（命中定位/相似度分组）复用领域层 {@code SearchEngine}。
 * 大列表走 ES，MySQL 走事务明细（NFR-002：大列表 P95≤1s，不做 MySQL 大宽表分页）。</p>
 */
public interface SearchClient {

    /**
     * 全文检索（COM-011）。
     *
     * @param index   索引名（如 requirement/document）
     * @param keyword 查询关键词
     * @param tenantId 租户隔离（结果须归属该租户）
     * @param size    返回条数上限
     * @return 命中文档列表（每条含 id + 命中字段 + 相似度分组由领域层处理）
     */
    List<Map<String, Object>> search(String index, String keyword, String tenantId, int size);

    /**
     * 大列表查询（B3-2）：分页走 ES，避免 MySQL 大宽表分页。
     */
    List<Map<String, Object>> listPage(String index, String tenantId, int offset, int size);

    /** 索引文档（写入时同步 ES）。 */
    void index(String index, String id, Map<String, Object> doc);

    /** 删除索引文档。 */
    void delete(String index, String id);
}
