package com.mofeng.rdp.domain.search;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 全文检索引擎（DOC-008 / COM-011）。
 *
 * <p>命中定位 + 相似度分组（避免同一规范出现五个版本）。
 * 纯函数、零框架依赖，是「全文检索判定」的单一权威来源。</p>
 *
 * 迁移自 app/src/domain/docEngine.ts 的 searchDocs。
 */
public final class SearchEngine {

    private SearchEngine() {
    }

    /** 可检索文档（最小字段集）。 */
    public static final class Doc {
        public final String name;
        public final String code;
        public final String discipline;
        public final List<String> comments;

        public Doc(String name, String code, String discipline, List<String> comments) {
            this.name = name == null ? "" : name;
            this.code = code == null ? "" : code;
            this.discipline = discipline == null ? "" : discipline;
            this.comments = comments == null ? new ArrayList<>() : comments;
        }
    }

    /** 命中结果（文档 + 命中字段）。 */
    public static final class Hit {
        public final Doc doc;
        public final List<String> fields;

        public Hit(Doc doc, List<String> fields) {
            this.doc = doc;
            this.fields = fields;
        }
    }

    /** 检索结果（命中列表 + 相似度分组）。 */
    public static final class SearchResult {
        public final List<Hit> hits;
        public final List<List<Doc>> dupGroups;

        public SearchResult(List<Hit> hits, List<List<Doc>> dupGroups) {
            this.hits = hits;
            this.dupGroups = dupGroups;
        }
    }

    /**
     * 全文检索（DOC-008）：命中定位 + 相似度分组。
     *
     * @param docs  待检索文档列表
     * @param query 查询串（trim 后小写匹配）
     */
    public static SearchResult searchDocs(List<Doc> docs, String query) {
        String q = query == null ? "" : query.trim().toLowerCase();
        List<Hit> hits = new ArrayList<>();
        List<List<Doc>> dupGroups = new ArrayList<>();
        if (q.isEmpty()) {
            return new SearchResult(hits, dupGroups);
        }

        for (Doc d : docs) {
            List<String> fields = new ArrayList<>();
            if (d.name.toLowerCase().contains(q)) fields.add("name");
            if (d.code.toLowerCase().contains(q)) fields.add("code");
            if (d.discipline.toLowerCase().contains(q)) fields.add("discipline");
            for (String c : d.comments) {
                if (c != null && c.toLowerCase().contains(q)) {
                    fields.add("comment");
                    break; // 任一评论命中即计入 comment 字段
                }
            }
            if (!fields.isEmpty()) {
                hits.add(new Hit(d, fields));
            }
        }

        // 相似度分组：同名（去空白+小写规范化）多版本 → 重复提示（DOC-008）
        Map<String, List<Doc>> byName = new LinkedHashMap<>();
        for (Doc d : docs) {
            String key = d.name.replaceAll("\\s+", "").toLowerCase();
            byName.computeIfAbsent(key, k -> new ArrayList<>()).add(d);
        }
        for (List<Doc> g : byName.values()) {
            if (g.size() > 1) dupGroups.add(g);
        }
        return new SearchResult(hits, dupGroups);
    }
}
