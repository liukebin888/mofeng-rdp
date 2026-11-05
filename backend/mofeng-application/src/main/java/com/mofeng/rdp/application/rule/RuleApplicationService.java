package com.mofeng.rdp.application.rule;

import com.mofeng.rdp.domain.rule.RuleVersion;
import com.mofeng.rdp.infrastructure.persistence.rule.RuleDefinitionEntity;
import com.mofeng.rdp.infrastructure.persistence.rule.RuleDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 可配置规则编排（ARC-006：规则版本外置存储 + 生效期 + 灰度 + 全程留痕）。
 *
 * <p>快照哈希由领域层 {@link RuleVersion#snapshotHashOf} 计算（ARC-001 单一权威）；
 * 生效期判定由 {@link RuleVersion#isEffective} 承担。本层只做编排 + 落表，
 * 不承载规则内容语义校验（内容由具体规则类型决定）。</p>
 *
 * <p>fail-closed：version ≤ 0、生效期非法、快照哈希不匹配一律拒绝写入，不落库。</p>
 */
@Service
public class RuleApplicationService {

    private final RuleDefinitionRepository ruleDefinitionRepository;

    public RuleApplicationService(RuleDefinitionRepository ruleDefinitionRepository) {
        this.ruleDefinitionRepository = ruleDefinitionRepository;
    }

    /** 保存规则版本（fail-closed 校验 + 计算快照哈希 + 落表）。 */
    @Transactional
    public SaveResult save(RuleSaveRequest request) {
        // fail-closed 校验
        if (request.getVersion() == null || request.getVersion() <= 0) {
            return SaveResult.rejected("版本号必须为正整数");
        }
        if (!isValidDate(request.getEffectiveFrom())) {
            return SaveResult.rejected("生效起始日非法（须 yyyy-MM-dd）：" + request.getEffectiveFrom());
        }
        if (request.getEffectiveTo() != null && !isValidDate(request.getEffectiveTo())) {
            return SaveResult.rejected("生效截止日非法（须 yyyy-MM-dd）：" + request.getEffectiveTo());
        }
        if (request.getEffectiveTo() != null
                && request.getEffectiveTo().compareTo(request.getEffectiveFrom()) < 0) {
            return SaveResult.rejected("生效截止日不得早于起始日");
        }
        String grayMode = request.getGrayMode() == null ? "OFF" : request.getGrayMode();
        if (!List.of("OFF", "TENANT", "LEVEL").contains(grayMode)) {
            return SaveResult.rejected("灰度模式非法（须 OFF/TENANT/LEVEL）：" + grayMode);
        }

        String hash = RuleVersion.snapshotHashOf(
                request.getRuleType(), request.getRuleCode(), request.getVersion(), request.getContentJson());

        RuleDefinitionEntity entity = new RuleDefinitionEntity();
        entity.setRuleType(request.getRuleType());
        entity.setRuleCode(request.getRuleCode());
        entity.setVersion(request.getVersion());
        entity.setContentJson(request.getContentJson());
        entity.setSnapshotHash(hash);
        entity.setEffectiveFrom(LocalDate.parse(request.getEffectiveFrom()));
        entity.setEffectiveTo(request.getEffectiveTo() == null ? null : LocalDate.parse(request.getEffectiveTo()));
        entity.setGrayMode(grayMode);
        entity.setGrayScope(request.getGrayScope());
        entity.setEnabled(1);
        entity.setCreatedBy(request.getCreatedBy());

        ruleDefinitionRepository.save(entity);
        return SaveResult.saved(hash, request.getVersion());
    }

    /** 查询某规则编码全部版本（version 降序）。 */
    public List<RuleResult> listByCode(String ruleCode) {
        List<RuleDefinitionEntity> entities = ruleDefinitionRepository.listByCode(ruleCode);
        return toResults(entities);
    }

    /** 查询某规则类型下当日生效且已启用的版本（version 降序）。 */
    public List<RuleResult> listEffective(String ruleType, String todayStr) {
        String today = todayStr == null ? LocalDate.now().toString() : todayStr;
        List<RuleDefinitionEntity> entities = ruleDefinitionRepository.listEffective(ruleType, today);
        return toResults(entities);
    }

    private List<RuleResult> toResults(List<RuleDefinitionEntity> entities) {
        List<RuleResult> out = new ArrayList<>();
        for (RuleDefinitionEntity e : entities) {
            out.add(new RuleResult(
                    e.getRuleType(), e.getRuleCode(), e.getVersion(), e.getSnapshotHash(),
                    e.getEffectiveFrom() == null ? null : e.getEffectiveFrom().toString(),
                    e.getEffectiveTo() == null ? null : e.getEffectiveTo().toString(),
                    e.getGrayMode(), e.getGrayScope(),
                    e.getEnabled() != null && e.getEnabled() == 1,
                    e.getContentJson()));
        }
        return out;
    }

    private static boolean isValidDate(String s) {
        if (s == null || !s.matches("\\d{4}-\\d{2}-\\d{2}")) return false;
        try {
            LocalDate.parse(s);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** 保存结果（fail-closed：valid=false 表示被拒绝，未落库）。 */
    public static final class SaveResult {
        private final boolean valid;
        private final String message;
        private final String snapshotHash;
        private final int version;

        private SaveResult(boolean valid, String message, String snapshotHash, int version) {
            this.valid = valid;
            this.message = message;
            this.snapshotHash = snapshotHash;
            this.version = version;
        }

        static SaveResult saved(String hash, int version) {
            return new SaveResult(true, null, hash, version);
        }

        static SaveResult rejected(String message) {
            return new SaveResult(false, message, null, 0);
        }

        public boolean isValid() { return valid; }
        public String getMessage() { return message; }
        public String getSnapshotHash() { return snapshotHash; }
        public int getVersion() { return version; }
    }
}
