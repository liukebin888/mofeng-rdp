package com.mofeng.rdp.domain.search;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SearchEngineTest {

    private static SearchEngine.Doc doc(String name, String code, String discipline, List<String> comments) {
        return new SearchEngine.Doc(name, code, discipline, comments);
    }

    @Test
    void 空查询返回空结果() {
        SearchEngine.SearchResult r = SearchEngine.searchDocs(
            List.of(doc("规范A", "DOC-001", "结构", List.of())), "   ");
        assertTrue(r.hits.isEmpty());
        assertTrue(r.dupGroups.isEmpty());
    }

    @Test
    void 命中定位字段() {
        List<SearchEngine.Doc> docs = List.of(
            doc("系统需求规范", "REQ-001", "系统", List.of("关于通信的说明")),
            doc("硬件设计", "HW-002", "硬件", List.of()));
        SearchEngine.SearchResult r = SearchEngine.searchDocs(docs, "需求");
        assertEquals(1, r.hits.size());
        assertTrue(r.hits.get(0).fields.contains("name"));

        SearchEngine.SearchResult r2 = SearchEngine.searchDocs(docs, "通信");
        assertEquals(1, r2.hits.size());
        assertTrue(r2.hits.get(0).fields.contains("comment"));
    }

    @Test
    void 多字段命中() {
        List<SearchEngine.Doc> docs = List.of(
            doc("需求规范", "需求-001", "系统", List.of()));
        SearchEngine.SearchResult r = SearchEngine.searchDocs(docs, "需求");
        assertEquals(1, r.hits.size());
        assertTrue(r.hits.get(0).fields.contains("name"));
        assertTrue(r.hits.get(0).fields.contains("code"));
    }

    @Test
    void 相似度分组避免同规范多版本() {
        List<SearchEngine.Doc> docs = List.of(
            doc("系统需求规范", "REQ-001", "系统", List.of()),
            doc("系统需求规范", "REQ-002", "系统", List.of()),
            doc("硬件设计", "HW-001", "硬件", List.of()));
        SearchEngine.SearchResult r = SearchEngine.searchDocs(docs, "系统");
        // 两个同名「系统需求规范」应归为重复组
        assertEquals(1, r.dupGroups.size());
        assertEquals(2, r.dupGroups.get(0).size());
    }
}
