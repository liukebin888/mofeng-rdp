package com.mofeng.rdp.infrastructure.cache;

/**
 * 分布式锁（基础设施层，B2-3 升级/幂等场景）。
 *
 * <p>基于 Redis SET NX EX 实现，锁键复用领域层缓存键隔离语义。
 * 只做锁的获取/释放编排，锁语义（幂等判定）由领域层负责。</p>
 */
public interface DistributedLock {

    /**
     * 尝试获取锁。
     *
     * @param key     锁键（须含租户前缀，防跨租户误锁）
     * @param token   持有者令牌（释放时校验，防误删他人锁）
     * @param ttlSec  锁过期秒数（防死锁）
     * @return 是否获取成功
     */
    boolean tryLock(String key, String token, long ttlSec);

    /**
     * 释放锁（仅持有者 token 匹配时释放）。
     *
     * @return 是否成功释放（token 不匹配返回 false，不误删他人锁）
     */
    boolean unlock(String key, String token);
}
