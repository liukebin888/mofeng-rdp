package com.mofeng.rdp.infrastructure.cache;

import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.Optional;

/**
 * Redis 会话存储实现（基础设施层，B2-1）。
 *
 * <p>无状态应用 + Redis 会话共享（ARC-017：任取 1 节点下线业务不中断）。
 * 会话键前缀 session: 隔离，只做读写编排。</p>
 */
public final class RedisSessionStore implements SessionStore {

    private static final String PREFIX = "session:";

    private final StringRedisTemplate redis;

    public RedisSessionStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public void put(String sessionId, String userId, long ttlSeconds) {
        redis.opsForValue().set(PREFIX + sessionId, userId, Duration.ofSeconds(ttlSeconds));
    }

    @Override
    public Optional<String> getUserId(String sessionId) {
        return Optional.ofNullable(redis.opsForValue().get(PREFIX + sessionId));
    }

    @Override
    public void invalidate(String sessionId) {
        redis.delete(PREFIX + sessionId);
    }

    @Override
    public void refresh(String sessionId, long ttlSeconds) {
        redis.expire(PREFIX + sessionId, Duration.ofSeconds(ttlSeconds));
    }
}
