package com.mofeng.rdp.domain.software;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 软件版本域引擎（VER-001~009、015 / SRS 第 17 章）。
 *
 * 承载 SCI、软件版本对象、变体、分支、差异对比、兼容与回滚、发布双签、软硬件组合基线判据。
 * 关键原则：P-06 变更走单（补丁分支拒新功能）、VER-009 发布双签、VER-008 兼容回滚。
 *
 * 迁移自 app/src/domain/softwareVersion.ts，同一套测试用例验收。
 */
public final class SoftwareEngine {

    private SoftwareEngine() {
    }

    // ------------------------------------------------------------------
    // VER-001 SCI 完整性
    // ------------------------------------------------------------------

    public static final class SciResult {
        public final boolean complete;
        public final List<String> missing;

        SciResult(boolean complete, List<String> missing) {
            this.complete = complete;
            this.missing = missing;
        }
    }

    public static SciResult sciCompleteness(String code, String name, List<String> architectureIds, List<String> securityReqIds) {
        List<String> missing = new ArrayList<>();
        if (code == null || code.isEmpty()) missing.add("code");
        if (name == null || name.isEmpty()) missing.add("name");
        if (architectureIds.size() < 1) missing.add("关联架构 <1");
        if (securityReqIds.size() < 1) missing.add("关联安全需求 <1");
        return new SciResult(missing.isEmpty(), missing);
    }

    // ------------------------------------------------------------------
    // VER-002 版本对象 12 类关联
    // ------------------------------------------------------------------

    public static final List<String> VERSION_RELATED_TYPES = List.of(
        "架构", "安全需求", "测试用例", "缺陷", "ECR", "文档",
        "硬件版本", "样件", "基线", "发布记录", "刷写台账", "召回单");

    public static final class VersionRelationResult {
        public final List<String> allTypes;
        public final List<String> missingTypes;
        public final boolean complete;

        VersionRelationResult(List<String> allTypes, List<String> missingTypes, boolean complete) {
            this.allTypes = allTypes;
            this.missingTypes = missingTypes;
            this.complete = complete;
        }
    }

    /** relatedTypes 为某个 versionId 已关联的类型集合。 */
    public static VersionRelationResult versionRelations(List<String> relatedTypes) {
        List<String> missingTypes = new ArrayList<>();
        for (String t : VERSION_RELATED_TYPES) {
            if (!relatedTypes.contains(t)) missingTypes.add(t);
        }
        return new VersionRelationResult(new ArrayList<>(VERSION_RELATED_TYPES), missingTypes, missingTypes.isEmpty());
    }

    // ------------------------------------------------------------------
    // VER-004 分支管理
    // ------------------------------------------------------------------

    public static final class BranchResult {
        public final boolean allowed;
        public final String reason;

        BranchResult(boolean allowed, String reason) {
            this.allowed = allowed;
            this.reason = reason;
        }
    }

    public static BranchResult branchCommitAllowed(String branchKind, String commitKind) {
        if ("补丁分支".equals(branchKind)) {
            if ("缺陷修复".equals(commitKind)) return new BranchResult(true, "补丁分支缺陷修复可提交");
            return new BranchResult(false, "补丁分支提交「" + commitKind + "」被拒，仅允许缺陷修复（VER-004）");
        }
        return new BranchResult(true, "允许提交");
    }

    // ------------------------------------------------------------------
    // VER-005 变体管理
    // ------------------------------------------------------------------

    public static final class VariantResult {
        public final List<String> same;
        public final Map<String, String[]> different;

        VariantResult(List<String> same, Map<String, String[]> different) {
            this.same = same;
            this.different = different;
        }
    }

    public static VariantResult compareVariants(Map<String, String> a, Map<String, String> b) {
        Map<String, String> keys = new LinkedHashMap<>();
        a.forEach(keys::put);
        b.forEach(keys::put);
        List<String> same = new ArrayList<>();
        Map<String, String[]> different = new LinkedHashMap<>();
        for (String k : keys.keySet()) {
            String av = a.get(k);
            String bv = b.get(k);
            if (java.util.Objects.equals(av, bv)) {
                same.add(k);
            } else {
                different.put(k, new String[]{ av == null ? "(无)" : av, bv == null ? "(无)" : bv });
            }
        }
        return new VariantResult(same, different);
    }

    // ------------------------------------------------------------------
    // VER-006 版本快照
    // ------------------------------------------------------------------

    public static BranchResult gate4DeliveryOnSnapshot(boolean frozen) {
        if (frozen) {
            return new BranchResult(true, "版本处于快照（冻结）状态，Gate4 交付被拦截（VER-006）");
        }
        return new BranchResult(false, "可交付");
    }

    // ------------------------------------------------------------------
    // VER-007 版本差异对比
    // ------------------------------------------------------------------

    public static final class FileEntry {
        public final String path;
        public final String hash;

        public FileEntry(String path, String hash) {
            this.path = path;
            this.hash = hash;
        }
    }

    public static final class VersionDiffResult {
        public final List<String> addedFiles;
        public final List<String> removedFiles;
        public final List<String> modifiedFiles;
        public final List<String> unchangedFiles;

        VersionDiffResult(List<String> addedFiles, List<String> removedFiles,
                          List<String> modifiedFiles, List<String> unchangedFiles) {
            this.addedFiles = addedFiles;
            this.removedFiles = removedFiles;
            this.modifiedFiles = modifiedFiles;
            this.unchangedFiles = unchangedFiles;
        }
    }

    public static VersionDiffResult diffVersions(List<FileEntry> oldFiles, List<FileEntry> newFiles) {
        Map<String, String> oMap = new LinkedHashMap<>();
        for (FileEntry f : oldFiles) oMap.put(f.path, f.hash);
        Map<String, String> nMap = new LinkedHashMap<>();
        for (FileEntry f : newFiles) nMap.put(f.path, f.hash);
        List<String> added = new ArrayList<>();
        List<String> removed = new ArrayList<>();
        List<String> modified = new ArrayList<>();
        List<String> unchanged = new ArrayList<>();
        for (Map.Entry<String, String> e : nMap.entrySet()) {
            if (!oMap.containsKey(e.getKey())) added.add(e.getKey());
            else if (!java.util.Objects.equals(oMap.get(e.getKey()), e.getValue())) modified.add(e.getKey());
            else unchanged.add(e.getKey());
        }
        for (String path : oMap.keySet()) {
            if (!nMap.containsKey(path)) removed.add(path);
        }
        return new VersionDiffResult(added, removed, modified, unchanged);
    }

    // ------------------------------------------------------------------
    // VER-008 兼容与回滚
    // ------------------------------------------------------------------

    public static BranchResult flashingAllowed(
            List<String> hardwareVersions, List<String> busTypes, String rollbackPlan, boolean hasRecord) {
        if (!hasRecord || hardwareVersions.isEmpty() || busTypes.isEmpty()) {
            return new BranchResult(false, "无兼容记录时刷写登记被拒（VER-008）");
        }
        if (rollbackPlan == null || rollbackPlan.isEmpty()) {
            return new BranchResult(false, "缺回滚方案时刷写登记被拒（VER-008）");
        }
        return new BranchResult(true, "允许刷写");
    }

    // ------------------------------------------------------------------
    // VER-009 发布双签
    // ------------------------------------------------------------------

    public static BranchResult releaseSignoffComplete(String rndSignedBy, String qualitySignedBy) {
        boolean rnd = rndSignedBy != null && !rndSignedBy.isEmpty();
        boolean quality = qualitySignedBy != null && !qualitySignedBy.isEmpty();
        if (!rnd && !quality) return new BranchResult(false, "研发与质量均未签署（VER-009）");
        if (!rnd) return new BranchResult(false, "缺研发签署（VER-009）");
        if (!quality) return new BranchResult(false, "缺质量签署（VER-009）");
        return new BranchResult(true, "双签齐全");
    }

    // ------------------------------------------------------------------
    // VER-015 软硬件组合基线互查
    // ------------------------------------------------------------------

    public static final class CombinedBaselineResult {
        public final boolean found;
        public final String peer;

        CombinedBaselineResult(boolean found, String peer) {
            this.found = found;
            this.peer = peer;
        }
    }

    public static CombinedBaselineResult combinedBaselineLookup(
            boolean frozen, String softwareVersionId, String hardwareVersionId, String from) {
        if (!frozen) return new CombinedBaselineResult(false, "未冻结，不可互查");
        if ("software".equals(from)) return new CombinedBaselineResult(true, hardwareVersionId);
        return new CombinedBaselineResult(true, softwareVersionId);
    }
}
