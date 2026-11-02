package com.mofeng.rdp.domain.requirement;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 需求域引擎（REQ-001~005、009、010、011、012 / SRS 第 15 章）。
 *
 * 承载安全相关需求的字段齐全率、HARA/TARA 双向关联、标识规则、版本化与受控评审。
 * 关键原则：P-08 证据由责任方产生；REQ-010 评审人不得为提交人（单人批准被拒）。
 *
 * 迁移自 app/src/domain/requirement.ts，同一套测试用例验收。
 */
public final class RequirementEngine {

    private RequirementEngine() {
    }

    // ------------------------------------------------------------------
    // REQ-001/003 字段齐全率
    // ------------------------------------------------------------------

    public static final List<String> REQ_TYPES = List.of("SG", "FSR", "TSR", "HSR");

    public static final List<String> REQ_REQUIRED_FIELDS =
        List.of("code", "title", "type", "asil", "cal", "owner", "verifyMethod");

    public static final class FieldResult {
        public final boolean complete;
        public final List<String> missing;
        public final double rate;

        FieldResult(boolean complete, List<String> missing, double rate) {
            this.complete = complete;
            this.missing = missing;
            this.rate = rate;
        }
    }

    /** 单条字段齐全率。req 为字段名→值映射（null/空字符串视为缺失）。 */
    public static FieldResult fieldCompleteness(java.util.Map<String, Object> req) {
        List<String> missing = new ArrayList<>();
        for (String f : REQ_REQUIRED_FIELDS) {
            Object v = req.get(f);
            if (v == null || "".equals(v)) missing.add(f);
        }
        int total = REQ_REQUIRED_FIELDS.size();
        int present = total - missing.size();
        return new FieldResult(missing.isEmpty(), missing, Math.round((present * 1.0 / total) * 100));
    }

    public static final class BatchResult {
        public final boolean complete;
        public final double rate;
        public final List<String> badIds;

        BatchResult(boolean complete, double rate, List<String> badIds) {
            this.complete = complete;
            this.rate = rate;
            this.badIds = badIds;
        }
    }

    /** 批量字段齐全率。reqs 为 id→字段映射。 */
    public static BatchResult batchCompleteness(java.util.Map<String, java.util.Map<String, Object>> reqs) {
        List<String> badIds = new ArrayList<>();
        for (java.util.Map.Entry<String, java.util.Map<String, Object>> e : reqs.entrySet()) {
            if (!fieldCompleteness(e.getValue()).complete) badIds.add(e.getKey());
        }
        double rate = reqs.isEmpty() ? 100 : Math.round(((reqs.size() - badIds.size()) * 1.0 / reqs.size()) * 100);
        return new BatchResult(badIds.isEmpty(), rate, badIds);
    }

    // ------------------------------------------------------------------
    // REQ-001 HARA 双向关联
    // ------------------------------------------------------------------

    public static final class HaraResult {
        public final boolean complete;
        public final List<String> missing;

        HaraResult(boolean complete, List<String> missing) {
            this.complete = complete;
            this.missing = missing;
        }
    }

    /** forwardReqIds：有 req->hara 链的 reqId；backwardReqIds：有 hara->req 链的 reqId。 */
    public static HaraResult haraBidirectional(List<String> forwardReqIds, List<String> backwardReqIds, List<String> reqIds) {
        Set<String> forward = new LinkedHashSet<>(forwardReqIds);
        Set<String> backward = new LinkedHashSet<>(backwardReqIds);
        List<String> missing = new ArrayList<>();
        for (String id : reqIds) {
            if (!forward.contains(id)) missing.add(id + ":req->hara");
            if (!backward.contains(id)) missing.add(id + ":hara->req");
        }
        return new HaraResult(missing.isEmpty(), missing);
    }

    // ------------------------------------------------------------------
    // REQ-005 TARA 双向可查
    // ------------------------------------------------------------------

    public static final class TaraResult {
        public final boolean complete;
        public final List<String> missing;

        TaraResult(boolean complete, List<String> missing) {
            this.complete = complete;
            this.missing = missing;
        }
    }

    /**
     * secReqs：securityReqId → taraIds；links：securityReqId→taraId 反向链路存在性。
     * links 用 "secId:taraId" 集合表示已存在的反向链路。
     */
    public static TaraResult taraBidirectional(
            java.util.Map<String, List<String>> secReqs, Set<String> links) {
        List<String> missing = new ArrayList<>();
        for (java.util.Map.Entry<String, List<String>> e : secReqs.entrySet()) {
            if (e.getValue().isEmpty()) {
                missing.add(e.getKey() + ":未关联任何 TARA 条目");
                continue;
            }
            for (String taraId : e.getValue()) {
                if (!links.contains(e.getKey() + ":" + taraId)) {
                    missing.add(e.getKey() + ":TARA " + taraId + " 无反向链路");
                }
            }
        }
        return new TaraResult(missing.isEmpty(), missing);
    }

    // ------------------------------------------------------------------
    // REQ-012 需求标识规则
    // ------------------------------------------------------------------

    public static final class IdGenResult {
        public final List<String> ids;
        public final boolean unique;
        public final boolean compliant;

        IdGenResult(List<String> ids, boolean unique, boolean compliant) {
            this.ids = ids;
            this.unique = unique;
            this.compliant = compliant;
        }
    }

    /** 批量生成需求标识：prefix-序号，无重复、格式合规。 */
    public static IdGenResult generateRequirementIds(String prefix, int start, int count, int width) {
        List<String> ids = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (int i = 0; i < count; i++) {
            int seq = start + i;
            String id = prefix + "-" + padLeft(String.valueOf(seq), width);
            ids.add(id);
            seen.add(id);
        }
        boolean unique = seen.size() == ids.size();
        boolean compliant = true;
        for (String id : ids) {
            String seq = id.substring(prefix.length() + 1);
            if (seq.length() != width || !seq.chars().allMatch(Character::isDigit)) {
                compliant = false;
                break;
            }
        }
        return new IdGenResult(ids, unique, compliant);
    }

    private static String padLeft(String s, int width) {
        if (s.length() >= width) return s;
        StringBuilder sb = new StringBuilder();
        for (int i = s.length(); i < width; i++) sb.append('0');
        sb.append(s);
        return sb.toString();
    }

    // ------------------------------------------------------------------
    // REQ-010 安全评审受控
    // ------------------------------------------------------------------

    public static final class ReviewResult {
        public final boolean pass;
        public final String reason;

        ReviewResult(boolean pass, String reason) {
            this.pass = pass;
            this.reason = reason;
        }
    }

    public static ReviewResult reviewSafetyRequirement(
            String submitter, List<String> reviewers, String safetyManager) {
        if (safetyManager == null || safetyManager.isEmpty()) {
            return new ReviewResult(false, "缺安全经理签署（REQ-010）");
        }
        if (!reviewers.contains(safetyManager)) {
            return new ReviewResult(false, "安全经理未在评审人列表中签署（REQ-010）");
        }
        if (submitter != null && !submitter.isEmpty() && reviewers.size() == 1 && reviewers.get(0).equals(submitter)) {
            return new ReviewResult(false, "单人批准被拒：评审人不得为提交人（REQ-010）");
        }
        if (submitter != null && !submitter.isEmpty() && reviewers.stream().allMatch(r -> r.equals(submitter))) {
            return new ReviewResult(false, "单人批准被拒：评审人不得为提交人（REQ-010）");
        }
        return new ReviewResult(true, "安全评审受控通过");
    }

    // ------------------------------------------------------------------
    // REQ-011 需求废弃审批
    // ------------------------------------------------------------------

    public static final class AbandonResult {
        public final boolean allowed;
        public final String reason;
        public final boolean historyRetained;

        AbandonResult(boolean allowed, String reason, boolean historyRetained) {
            this.allowed = allowed;
            this.reason = reason;
            this.historyRetained = historyRetained;
        }
    }

    public static AbandonResult abandonRequirement(String approver, String reason) {
        if (approver == null || approver.isEmpty()) {
            return new AbandonResult(false, "无审批的删除操作被拒（REQ-011）", true);
        }
        if (reason == null || reason.isEmpty()) {
            return new AbandonResult(false, "缺废弃理由（REQ-011）", true);
        }
        return new AbandonResult(true, "废弃审批通过", true);
    }

    // ------------------------------------------------------------------
    // REQ-009 需求版本化 diff
    // ------------------------------------------------------------------

    public static final class DiffResult {
        public final List<String> added;
        public final List<String> removed;
        public final List<String> unchanged;

        DiffResult(List<String> added, List<String> removed, List<String> unchanged) {
            this.added = added;
            this.removed = removed;
            this.unchanged = unchanged;
        }
    }

    /** 逐行 diff：基于文本行集合差异。 */
    public static DiffResult diffLines(String oldText, String newText) {
        List<String> o = splitLines(oldText);
        List<String> n = splitLines(newText);
        Set<String> oSet = new LinkedHashSet<>(o);
        Set<String> nSet = new LinkedHashSet<>(n);
        List<String> removed = new ArrayList<>();
        List<String> added = new ArrayList<>();
        List<String> unchanged = new ArrayList<>();
        for (String l : o) {
            if (!nSet.contains(l)) removed.add(l);
        }
        for (String l : n) {
            if (!oSet.contains(l)) added.add(l);
        }
        for (String l : o) {
            if (nSet.contains(l)) unchanged.add(l);
        }
        return new DiffResult(added, removed, unchanged);
    }

    private static List<String> splitLines(String text) {
        if (text == null || text.isEmpty()) return new ArrayList<>();
        return new ArrayList<>(List.of(text.split("\n", -1)));
    }
}
