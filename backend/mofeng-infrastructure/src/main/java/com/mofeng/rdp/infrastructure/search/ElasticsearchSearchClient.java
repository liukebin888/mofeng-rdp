package com.mofeng.rdp.infrastructure.search;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.Criteria;
import org.springframework.data.elasticsearch.core.query.CriteriaQuery;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * ES 检索实现（基础设施层，B3）。
 *
 * <p>基于 Spring Data Elasticsearch，全文检索 + 大列表分页。
 * 只做检索编排，检索判定（命中定位/相似度分组）复用领域层 {@code SearchEngine}。
 * 所有查询强制附加 tenant_id 过滤（租户隔离）。</p>
 */
public final class ElasticsearchSearchClient implements SearchClient {

    private final ElasticsearchOperations operations;

    public ElasticsearchSearchClient(ElasticsearchOperations operations) {
        this.operations = operations;
    }

    @Override
    public List<Map<String, Object>> search(String index, String keyword, String tenantId, int size) {
        // 全文检索：匹配 name/code/discipline/comments，强制 tenant_id 隔离
        Criteria criteria = new Criteria("tenant_id").is(tenantId)
            .and(new Criteria("content").contains(keyword));
        CriteriaQuery query = new CriteriaQuery(criteria, PageRequest.of(0, size));
        SearchHits<Map> hits = operations.search(query, Map.class, IndexCoordinates.of(index));
        return toMaps(hits);
    }

    @Override
    public List<Map<String, Object>> listPage(String index, String tenantId, int offset, int size) {
        Criteria criteria = new Criteria("tenant_id").is(tenantId);
        CriteriaQuery query = new CriteriaQuery(criteria, PageRequest.of(offset / size, size));
        SearchHits<Map> hits = operations.search(query, Map.class, IndexCoordinates.of(index));
        return toMaps(hits);
    }

    @Override
    public void index(String index, String id, Map<String, Object> doc) {
        IndexQuery indexQuery = new IndexQueryBuilder()
            .withId(id)
            .withObject(doc)
            .build();
        operations.index(indexQuery, IndexCoordinates.of(index));
    }

    @Override
    public void delete(String index, String id) {
        operations.delete(id, IndexCoordinates.of(index));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> toMaps(SearchHits<Map> hits) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (SearchHit<Map> hit : hits) {
            out.add(hit.getContent());
        }
        return out;
    }
}
