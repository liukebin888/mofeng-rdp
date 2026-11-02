package com.mofeng.rdp.infrastructure.persistence.compliance;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 合规测评证据 Mapper（基础设施层）。 */
@Mapper
public interface ComplianceItemMapper extends BaseMapper<ComplianceItemEntity> {
}
