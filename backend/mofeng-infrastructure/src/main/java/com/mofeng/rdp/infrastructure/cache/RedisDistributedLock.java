package com.mofeng.rdp.infrastructure.cache;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

import java.time.Duration;
import java.util.Collections;
import java.util.Optional;

/**
 * Redis 分布式锁实现（基础设施层，B2-3）。
 *
 * <p>基于 SET NX EX + Lua 原子释放（token 校验防误删他人锁）。
 * 锁语义（幂等判定）由领域层负责，此处只做获取/释放编排。</p>
 */
public final class RedisDistributedLock implements DistributedLock {

    private static final DefaultRedisScript<Long> UNLOCK_SCRIPT = new DefaultRedisScript<>(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        Long.class);

    private final StringRedisTemplate redis;

    public RedisDistributedLock(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public boolean tryLock(String key, String token, long ttlSec) {
        Boolean ok = redis.opsForValue().setIfAbsent(key, token, Duration.ofSeconds(ttlSec));
        return Boolean.TRUE.equals(ok);
    }

    @Override
    public boolean unlock(String key, String token) {
        Long result = redis.execute(UNLOCK_SCRIPT, Collections.singletonList(key), token);
        return result != null && result == 1L;
    }
}
