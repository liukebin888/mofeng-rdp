package com.mofeng.rdp.infrastructure.persistence.controlled;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 受控对象统一基表 Mapper。
 */
@Mapper
public interface ControlledObjectMapper extends BaseMapper<ControlledObjectEntity> {
}
