package com.mofeng.rdp.domain.audit;

import com.mofeng.rdp.domain.HashUtil;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 审计引擎（SRS 23.3 / SEC-007~009、附录 B.3 audit_log）。
 *
 * <p>七元组留痕 + prev_hash/row_hash 哈希链 + append-only + 链完整性校验。
 * 与前端 TS 引擎 {@code app/src/domain/audit.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class AuditEngine {

    private AuditEngine() {
    }

    /** 11 类审计动作。 */
    public static final List<String> AUDIT_ACTIONS = List.of(
        "CREATE", "UPDATE", "DELETE", "SUBMIT", "APPROVE", "REJECT",
        "RELEASE", "FREEZE", "EXEMPT", "EXPORT", "AI_REVIEW"
    );

    /** append-only 违规异常（SOD-06）。 */
    public static final class AuditImmutableError extends RuntimeException {
        public AuditImmutableError() {
            super("审计日志为 append-only，UPDATE/DELETE 被拒绝（SOD-06）");
        }
    }

    /** 审计条目输入。 */
    public static final class Entry {
        private final String action;
        private final String objType;
        private final String objId;
        private final Object before;
        private final Object after;
        private final String result;

        public Entry(String action, String objType, String objId, Object before, Object after, String result) {
            this.action = action;
            this.objType = objType;
            this.objId = objId;
            this.before = before;
            this.after = after;
            this.result = result == null ? "OK" : result;
        }

        public String action() { return action; }
        public String objType() { return objType; }
        public String objId() { return objId; }
        public Object before() { return before; }
        public Object after() { return after; }
        public String result() { return result; }
    }

    /** 审计留痕行。 */
    public static final class Row {
        private final int seq;
        private final String occurredAt;
        private final String actorId;
        private final String actorName;
        private final String actorRole;
        private final String action;
        private final String objType;
        private final String objId;
        private final Object before;
        private final Object after;
        private final String result;
        private final String tenantId;
        private final String prevHash;
        private final String rowHash;

        Row(int seq, String occurredAt, String actorId, String actorName, String actorRole,
            String action, String objType, String objId, Object before, Object after,
            String result, String tenantId, String prevHash, String rowHash) {
            this.seq = seq;
            this.occurredAt = occurredAt;
            this.actorId = actorId;
            this.actorName = actorName;
            this.actorRole = actorRole;
            this.action = action;
            this.objType = objType;
            this.objId = objId;
            this.before = before;
            this.after = after;
            this.result = result;
            this.tenantId = tenantId;
            this.prevHash = prevHash;
            this.rowHash = rowHash;
        }

        public int seq() { return seq; }
        public String occurredAt() { return occurredAt; }
        public String actorId() { return actorId; }
        public String actorName() { return actorName; }
        public String actorRole() { return actorRole; }
        public String action() { return action; }
        public String objType() { return objType; }
        public String objId() { return objId; }
        public Object before() { return before; }
        public Object after() { return after; }
        public String result() { return result; }
        public String tenantId() { return tenantId; }
        public String prevHash() { return prevHash; }
        public String rowHash() { return rowHash; }
    }

    /** 链校验结果。 */
    public static final class ChainResult {
        private final boolean ok;
        private final Integer brokenAt;
        private final int checked;

        ChainResult(boolean ok, Integer brokenAt, int checked) {
            this.ok = ok;
            this.brokenAt = brokenAt;
            this.checked = checked;
        }

        public boolean ok() { return ok; }
        public Integer brokenAt() { return brokenAt; }
        public int checked() { return checked; }
    }

    /** 字段级 diff。 */
    public static final class FieldDiff {
        private final String field;
        private final String from;
        private final String to;

        FieldDiff(String field, String from, String to) {
            this.field = field;
            this.from = from;
            this.to = to;
        }

        public String field() { return field; }
        public String from() { return from; }
        public String to() { return to; }
    }

    /** 行载荷哈希（七元组 + prev）。 */
    private static String rowPayload(int seq, String at, String actorId, String role,
                                    String action, String objType, String objId,
                                    Object before, Object after, String result, String tenant, String prev) {
        Map<String, Object> payload = new TreeMap<>();
        payload.put("seq", seq);
        payload.put("at", at);
        payload.put("actor", actorId);
        payload.put("role", role);
        payload.put("action", action);
        payload.put("objType", objType);
        payload.put("objId", objId);
        payload.put("before", before);
        payload.put("after", after);
        payload.put("result", result);
        payload.put("tenant", tenant);
        payload.put("prev", prev);
        return HashUtil.hashOf(payload);
    }

    /** 追加审计行（append-only，链式 prevHash）。 */
    public static Row appendAudit(List<Row> rows, Actor actor, Entry entry) {
        String prev = rows.isEmpty() ? HashUtil.ZERO_HASH : rows.get(rows.size() - 1).rowHash();
        int seq = rows.size() + 1;
        String occurredAt = actor.at();
        Row row = new Row(seq, occurredAt, actor.userId(), actor.userName(), actor.roleName(),
            entry.action(), entry.objType(), entry.objId(), entry.before(), entry.after(),
            entry.result(), actor.tenantId(), prev,
            rowPayload(seq, occurredAt, actor.userId(), actor.roleName(), entry.action(),
                entry.objType(), entry.objId(), entry.before(), entry.after(), entry.result(),
                actor.tenantId(), prev));
        rows.add(row);
        return row;
    }

    /** append-only：任何改删请求一律拒绝（SOD-06）。 */
    public static void guardImmutable() {
        throw new AuditImmutableError();
    }

    /** 链完整性校验。 */
    public static ChainResult verifyChain(List<Row> rows) {
        String prev = HashUtil.ZERO_HASH;
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            String expect = rowPayload(r.seq(), r.occurredAt(), r.actorId(), r.actorRole(),
                r.action(), r.objType(), r.objId(), r.before(), r.after(), r.result(),
                r.tenantId(), prev);
            if (!r.prevHash().equals(prev) || !r.rowHash().equals(expect)) {
                return new ChainResult(false, r.seq(), i + 1);
            }
            prev = r.rowHash();
        }
        return new ChainResult(true, null, rows.size());
    }

    /** 审计前后值 diff（字段级，供 UI 展开）。 */
    @SuppressWarnings("unchecked")
    public static List<FieldDiff> diffFields(Object before, Object after) {
        if (before == null || after == null) return List.of();
        if (!(before instanceof Map) || !(after instanceof Map)) return List.of();
        Map<String, Object> b = (Map<String, Object>) before;
        Map<String, Object> a = (Map<String, Object>) after;
        TreeMap<String, Object> keys = new TreeMap<>();
        keys.putAll(b);
        keys.putAll(a);
        List<FieldDiff> diffs = new ArrayList<>();
        for (String k : keys.keySet()) {
            String bv = HashUtil.stableStringify(b.get(k));
            String av = HashUtil.stableStringify(a.get(k));
            if (!bv.equals(av)) {
                diffs.add(new FieldDiff(k, b.get(k) == null ? "—" : String.valueOf(b.get(k)),
                    a.get(k) == null ? "—" : String.valueOf(a.get(k))));
            }
        }
        return diffs;
    }

    /** 审计角色上下文。 */
    public static final class Actor {
        private final String userId;
        private final String userName;
        private final String roleName;
        private final String tenantId;
        private final String at;

        public Actor(String userId, String userName, String roleName, String tenantId, String at) {
            this.userId = userId;
            this.userName = userName;
            this.roleName = roleName;
            this.tenantId = tenantId;
            this.at = at == null ? java.time.Instant.now().toString() : at;
        }

        public String userId() { return userId; }
        public String userName() { return userName; }
        public String roleName() { return roleName; }
        public String tenantId() { return tenantId; }
        public String at() { return at; }
    }
}
