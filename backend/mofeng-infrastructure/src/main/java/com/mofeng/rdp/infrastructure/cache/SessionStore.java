package com.mofeng.rdp.infrastructure.cache;

import java.util.Optional;

/**
 * 会话存储（基础设施层，B2-1 无状态应用 + Redis 会话共享）。
 *
 * <p>水平扩容 2 节点起（ARC-017），会话落 Redis 使任取 1 节点下线业务不中断。
 * 只做会话读写编排，会话有效性判定由领域层负责。</p>
 */
public interface SessionStore {

    /** 写会话（TTL 秒）。 */
    void put(String sessionId, String userId, long ttlSeconds);

    /** 读会话（不存在或过期返回空 Optional）。 */
    Optional<String> getUserId(String sessionId);

    /** 失效会话。 */
    void invalidate(String sessionId);

    /** 续期会话。 */
    void refresh(String sessionId, long ttlSeconds);
}
