package com.mofeng.rdp.domain.baseline;

import com.mofeng.rdp.domain.HashUtil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 基线引擎（SRS 20.2 / BAS-001~006、附录 B.3）。
 *
 * <p>基线 = 对象版本集合 + 逐项 row_hash + manifest_hash + 冻结签名；冻结后不可变。
 * 与前端 TS 引擎 {@code app/src/domain/baseline.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class BaselineEngine {

    private BaselineEngine() {
    }

    /** 基线冻结后修改异常（BAS-002）。 */
    public static final class BaselineImmutableError extends RuntimeException {
        public BaselineImmutableError(String baselineNo) {
            super("基线 " + baselineNo + " 已冻结，任何修改被拒绝（BASELINE_IMMUTABLE）");
        }
    }

    /** 基线项输入。 */
    public static final class ItemInput {
        private final String objType;
        private final String objId;
        private final int objVersion;
        private final Map<String, Object> snapshot;

        public ItemInput(String objType, String objId, int objVersion, Map<String, Object> snapshot) {
            this.objType = objType;
            this.objId = objId;
            this.objVersion = objVersion;
            this.snapshot = snapshot == null ? Map.of() : new LinkedHashMap<>(snapshot);
        }

        public String objType() { return objType; }
        public String objId() { return objId; }
        public int objVersion() { return objVersion; }
        public Map<String, Object> snapshot() { return snapshot; }
    }

    /** 基线项（含 rowHash）。 */
    public static final class Item {
        private final String objType;
        private final String objId;
        private final int objVersion;
        private final String rowHash;
        private final Map<String, Object> snapshot;

        Item(String objType, String objId, int objVersion, String rowHash, Map<String, Object> snapshot) {
            this.objType = objType;
            this.objId = objId;
            this.objVersion = objVersion;
            this.rowHash = rowHash;
            this.snapshot = snapshot;
        }

        public String objType() { return objType; }
        public String objId() { return objId; }
        public int objVersion() { return objVersion; }
        public String rowHash() { return rowHash; }
        public Map<String, Object> snapshot() { return snapshot; }
    }

    /** 基线。 */
    public static final class Baseline {
        private final String id;
        private final String projectId;
        private final String no;
        private final String type;
        private final String status;
        private final List<Item> items;
        private final String manifestHash;
        private final String frozenAt;
        private final String frozenBy;
        private final String replacedBy;

        Baseline(String id, String projectId, String no, String type, String status,
                 List<Item> items, String manifestHash, String frozenAt, String frozenBy, String replacedBy) {
            this.id = id;
            this.projectId = projectId;
            this.no = no;
            this.type = type;
            this.status = status;
            this.items = List.copyOf(items);
            this.manifestHash = manifestHash;
            this.frozenAt = frozenAt;
            this.frozenBy = frozenBy;
            this.replacedBy = replacedBy;
        }

        public String id() { return id; }
        public String projectId() { return projectId; }
        public String no() { return no; }
        public String type() { return type; }
        public String status() { return status; }
        public List<Item> items() { return items; }
        public String manifestHash() { return manifestHash; }
        public String frozenAt() { return frozenAt; }
        public String frozenBy() { return frozenBy; }
        public String replacedBy() { return replacedBy; }
    }

    /** 校验结果。 */
    public static final class VerifyResult {
        private final boolean ok;
        private final boolean manifestMatch;
        private final String manifestHash;
        private final List<Mismatch> mismatches;

        VerifyResult(boolean ok, boolean manifestMatch, String manifestHash, List<Mismatch> mismatches) {
            this.ok = ok;
            this.manifestMatch = manifestMatch;
            this.manifestHash = manifestHash;
            this.mismatches = List.copyOf(mismatches);
        }

        public boolean ok() { return ok; }
        public boolean manifestMatch() { return manifestMatch; }
        public String manifestHash() { return manifestHash; }
        public List<Mismatch> mismatches() { return mismatches; }
    }

    /** 不一致项（定位到项）。 */
    public static final class Mismatch {
        private final String objType;
        private final String objId;
        private final String expected;
        private final String actual;

        Mismatch(String objType, String objId, String expected, String actual) {
            this.objType = objType;
            this.objId = objId;
            this.expected = expected;
            this.actual = actual;
        }

        public String objType() { return objType; }
        public String objId() { return objId; }
        public String expected() { return expected; }
        public String actual() { return actual; }
    }

    /** 基线类型（九类）。 */
    public static final List<String> BASELINE_TYPES = List.of(
        "需求基线", "设计基线", "软件基线", "硬件基线", "样件基线",
        "测试基线", "交付基线", "成本基线", "文档基线"
    );

    /** 组装基线：逐项 row_hash + 排序 manifest_hash。 */
    public static Baseline buildBaseline(String id, String projectId, String no, String type,
                                         List<ItemInput> items, String frozenBy, String frozenAt) {
        List<Item> built = new ArrayList<>();
        for (ItemInput i : items) {
            Map<String, Object> payload = new TreeMap<>();
            payload.put("type", i.objType());
            payload.put("id", i.objId());
            payload.put("v", i.objVersion());
            payload.put("snap", i.snapshot());
            String rowHash = HashUtil.hashOf(payload);
            built.add(new Item(i.objType(), i.objId(), i.objVersion(), rowHash, i.snapshot()));
        }
        String manifestHash = computeManifest(built);
        String status = frozenBy != null ? "已冻结" : "组建中";
        return new Baseline(id, projectId, no, type, status, built, manifestHash, frozenAt, frozenBy, null);
    }

    private static String computeManifest(List<Item> items) {
        List<String> keys = new ArrayList<>();
        for (Item i : items) {
            keys.add(i.objType() + ":" + i.objId() + ":" + i.objVersion() + ":" + i.rowHash());
        }
        java.util.Collections.sort(keys);
        return HashUtil.hashOf((Object) keys);
    }

    /** 冻结：生成签名与时间，之后整行不可改（BAS-002）。 */
    public static Baseline freeze(Baseline b, String actor, String at) {
        if ("已冻结".equals(b.status())) {
            throw new BaselineImmutableError(b.no());
        }
        return new Baseline(b.id(), b.projectId(), b.no(), b.type(), "已冻结",
            b.items(), b.manifestHash(), at, actor, null);
    }

    /** 冻结后写入/修改基线项一律拒绝（SOD-05）。 */
    public static void guardMutable(Baseline b) {
        if ("已冻结".equals(b.status())) {
            throw new BaselineImmutableError(b.no());
        }
    }

    /** 校验：逐项比对快照哈希，返回定位到项的不一致清单（BAS-003）。 */
    public static VerifyResult verifyBaseline(Baseline b, Map<String, Map<String, Object>> current) {
        List<Mismatch> mismatches = new ArrayList<>();
        for (Item it : b.items()) {
            String key = it.objType() + ":" + it.objId();
            Map<String, Object> now = current.get(key);
            String actual;
            if (now == null) {
                actual = "(对象不存在)";
            } else {
                Map<String, Object> payload = new TreeMap<>();
                payload.put("type", it.objType());
                payload.put("id", it.objId());
                payload.put("v", it.objVersion());
                payload.put("snap", now);
                actual = HashUtil.hashOf(payload);
            }
            if (!actual.equals(it.rowHash())) {
                mismatches.add(new Mismatch(it.objType(), it.objId(), it.rowHash(), actual));
            }
        }
        String manifest = computeManifest(b.items());
        boolean manifestMatch = manifest.equals(b.manifestHash());
        boolean ok = mismatches.isEmpty() && manifestMatch;
        return new VerifyResult(ok, manifestMatch, manifest, mismatches);
    }

    /** 替代：冻结基线只能由新基线经 replacedBy 替代（BAS-002）。 */
    public static Baseline replace(Baseline prev, String nextId) {
        return new Baseline(prev.id(), prev.projectId(), prev.no(), prev.type(), "已被替代",
            prev.items(), prev.manifestHash(), prev.frozenAt(), prev.frozenBy(), nextId);
    }
}
