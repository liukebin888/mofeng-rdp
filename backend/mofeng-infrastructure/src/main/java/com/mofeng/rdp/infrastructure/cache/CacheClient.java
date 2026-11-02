package com.mofeng.rdp.infrastructure.cache;

import java.util.Optional;

/**
 * 缓存抽象（基础设施层，B2-2 字典/权限缓存）。
 *
 * <p>只做缓存读写编排，键构造复用领域层 {@code TenantEngine.tenantCacheKey}（租户缓存键隔离），
 * 缓存键禁止业务代码手拼（ARC-001 + TEN-004 缓存面隔离）。</p>
 */
public interface CacheClient {

    /** 读取缓存（不存在返回空 Optional）。键须已含租户前缀。 */
    Optional<String> get(String key);

    /** 写入缓存，带过期秒数。 */
    void put(String key, String value, long ttlSeconds);

    /** 删除缓存。 */
    void delete(String key);

    /** 是否存在。 */
    boolean exists(String key);

    /** 设置过期。 */
    void expire(String key, long ttlSeconds);
}
