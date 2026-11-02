package com.mofeng.rdp.domain.ratelimit;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RateLimitEngineTest {

    @Test
    void 窗口内计数未超限允许() {
        RateLimitEngine.RateLimitConfig cfg = new RateLimitEngine.RateLimitConfig(3, 60);
        RateLimitEngine.RateLimitState st = new RateLimitEngine.RateLimitState(0, 1000);
        assertTrue(RateLimitEngine.rateLimit(RateLimitEngine.LoadClass.AI, cfg, st, 1000).allowed);
        assertTrue(RateLimitEngine.rateLimit(RateLimitEngine.LoadClass.AI, cfg, st, 1001).allowed);
        assertTrue(RateLimitEngine.rateLimit(RateLimitEngine.LoadClass.AI, cfg, st, 1002).allowed);
    }

    @Test
    void 超限返回429带重试建议() {
        RateLimitEngine.RateLimitConfig cfg = new RateLimitEngine.RateLimitConfig(2, 60);
        RateLimitEngine.RateLimitState st = new RateLimitEngine.RateLimitState(2, 1000);
        RateLimitEngine.RateLimitVerdict v = RateLimitEngine.rateLimit(RateLimitEngine.LoadClass.AI, cfg, st, 1030);
        assertFalse(v.allowed);
        assertEquals("rate limited (429)", v.reason);
        assertTrue(v.retryAfterSec >= 1);
    }

    @Test
    void 窗口滚动后重置计数() {
        RateLimitEngine.RateLimitConfig cfg = new RateLimitEngine.RateLimitConfig(2, 60);
        RateLimitEngine.RateLimitState st = new RateLimitEngine.RateLimitState(2, 1000);
        // 超过窗口（nowSec - windowStart >= windowSec）→ 重置
        RateLimitEngine.RateLimitVerdict v = RateLimitEngine.rateLimit(RateLimitEngine.LoadClass.REPORT, cfg, st, 1060);
        assertTrue(v.allowed);
        assertEquals(1, st.count);
    }

    @Test
    void 三类重负载独立计数() {
        RateLimitEngine.RateLimitConfig cfg = new RateLimitEngine.RateLimitConfig(1, 60);
        RateLimitEngine.RateLimitState ai = new RateLimitEngine.RateLimitState(0, 0);
        RateLimitEngine.RateLimitState export = new RateLimitEngine.RateLimitState(0, 0);
        assertTrue(RateLimitEngine.rateLimit(RateLimitEngine.LoadClass.AI, cfg, ai, 100).allowed);
        assertTrue(RateLimitEngine.rateLimit(RateLimitEngine.LoadClass.EXPORT, cfg, export, 100).allowed);
    }

    @Test
    void 熔断连续失败触发打开() {
        RateLimitEngine.CircuitBreakerConfig cfg = new RateLimitEngine.CircuitBreakerConfig(3, 60);
        RateLimitEngine.CircuitBreaker br = new RateLimitEngine.CircuitBreaker(
            RateLimitEngine.BreakerState.CLOSED, 0, 0);
        RateLimitEngine.circuitBreaker(br, cfg, false, 100);
        RateLimitEngine.circuitBreaker(br, cfg, false, 101);
        RateLimitEngine.BreakerVerdict v = RateLimitEngine.circuitBreaker(br, cfg, false, 102);
        assertEquals(RateLimitEngine.BreakerState.OPEN, v.state);
        assertFalse(v.allowed);
    }

    @Test
    void 熔断冷却期满进半开再恢复() {
        RateLimitEngine.CircuitBreakerConfig cfg = new RateLimitEngine.CircuitBreakerConfig(2, 60);
        RateLimitEngine.CircuitBreaker br = new RateLimitEngine.CircuitBreaker(
            RateLimitEngine.BreakerState.OPEN, 2, 1000);
        // 冷却期未满（1000+30 < 1060）→ 仍 open 拒绝
        RateLimitEngine.BreakerVerdict v1 = RateLimitEngine.circuitBreaker(br, cfg, true, 1030);
        assertEquals(RateLimitEngine.BreakerState.OPEN, v1.state);
        assertFalse(v1.allowed);
        // 冷却期满（1060-1000 >= 60）→ 半开试探允许
        RateLimitEngine.BreakerVerdict v2 = RateLimitEngine.circuitBreaker(br, cfg, true, 1060);
        assertEquals(RateLimitEngine.BreakerState.HALF_OPEN, v2.state);
        assertTrue(v2.allowed);
        // 半开成功 → 关闭
        RateLimitEngine.BreakerVerdict v3 = RateLimitEngine.circuitBreaker(br, cfg, true, 1061);
        assertEquals(RateLimitEngine.BreakerState.CLOSED, v3.state);
    }

    @Test
    void 核心审批链路不受重负载熔断影响() {
        assertFalse(RateLimitEngine.isCoreBlockedByLoad());
    }
}
