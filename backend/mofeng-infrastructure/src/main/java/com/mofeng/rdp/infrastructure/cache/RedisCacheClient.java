package com.mofeng.rdp.infrastructure.cache;

import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.Optional;

/**
 * Redis 缓存实现（基础设施层，B2-2）。
 *
 * <p>基于 Spring Data Redis，键须已含租户前缀（缓存键隔离在领域层保证）。
 * 只做读写编排，不做业务判断（ARC-001）。</p>
 */
public final class RedisCacheClient implements CacheClient {

    private final StringRedisTemplate redis;

    public RedisCacheClient(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public Optional<String> get(String key) {
        return Optional.ofNullable(redis.opsForValue().get(key));
    }

    @Override
    public void put(String key, String value, long ttlSeconds) {
        redis.opsForValue().set(key, value, Duration.ofSeconds(ttlSeconds));
    }

    @Override
    public void delete(String key) {
        redis.delete(key);
    }

    @Override
    public boolean exists(String key) {
        Boolean b = redis.hasKey(key);
        return Boolean.TRUE.equals(b);
    }

    @Override
    public void expire(String key, long ttlSeconds) {
        redis.expire(key, Duration.ofSeconds(ttlSeconds));
    }
}
