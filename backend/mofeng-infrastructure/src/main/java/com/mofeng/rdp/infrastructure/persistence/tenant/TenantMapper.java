package com.mofeng.rdp.infrastructure.persistence.tenant;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 租户注册表 Mapper。 */
@Mapper
public interface TenantMapper extends BaseMapper<TenantEntity> {
}
