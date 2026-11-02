package com.mofeng.rdp.domain.ratelimit;

/**
 * 限流熔断引擎（OPS-004 / INT-008 / TPS-015 / ARC-012）。
 *
 * <p>三类重负载（AI / 报表 / 大文件导出）独立限流 + 熔断状态机。
 * 纯函数、零框架依赖，是「限流熔断判定」的单一权威来源。</p>
 *
 * 迁移自 app/src/domain/opsMonitor.ts 的 rateLimit + circuitBreaker + isCoreBlockedByLoad。
 */
public final class RateLimitEngine {

    private RateLimitEngine() {
    }

    /** 三类重负载。 */
    public enum LoadClass { AI, REPORT, EXPORT }

    /** 限流配置（可配置）。 */
    public static final class RateLimitConfig {
        public final int limit;       // 每窗口允许请求数
        public final int windowSec;   // 窗口秒数

        public RateLimitConfig(int limit, int windowSec) {
            this.limit = limit;
            this.windowSec = windowSec;
        }
    }

    /** 限流状态（可变，窗口滚动）。 */
    public static final class RateLimitState {
        public int count;
        public int windowStart;

        public RateLimitState(int count, int windowStart) {
            this.count = count;
            this.windowStart = windowStart;
        }
    }

    /** 限流判定结果。 */
    public static final class RateLimitVerdict {
        public final boolean allowed;
        public final int retryAfterSec; // 429 重试建议（超限时给出）
        public final String reason;

        RateLimitVerdict(boolean allowed, int retryAfterSec, String reason) {
            this.allowed = allowed;
            this.retryAfterSec = retryAfterSec;
            this.reason = reason;
        }
    }

    /**
     * 三类重负载独立限流（OPS-004 + INT-008 + TPS-015）。
     * 超限返回 429 带重试建议（retryAfterSec ≥1）。
     */
    public static RateLimitVerdict rateLimit(LoadClass cls, RateLimitConfig config,
                                             RateLimitState state, int nowSec) {
        // 窗口滚动：超过窗口则重置计数
        if (nowSec - state.windowStart >= config.windowSec) {
            state.windowStart = nowSec;
            state.count = 0;
        }
        if (state.count >= config.limit) {
            int retryAfterSec = config.windowSec - (nowSec - state.windowStart);
            return new RateLimitVerdict(false, Math.max(1, retryAfterSec), "rate limited (429)");
        }
        state.count += 1;
        return new RateLimitVerdict(true, 0, null);
    }

    // ------------------------------------------------------------------
    // 熔断器（closed → open → halfOpen 三态，ARC-012 恢复时间 ≤60s）
    // ------------------------------------------------------------------

    public enum BreakerState { CLOSED, OPEN, HALF_OPEN }

    public static final class CircuitBreakerConfig {
        public final int failureThreshold; // 连续失败达到此数触发熔断
        public final int cooldownSec;      // 熔断打开后的冷却秒数

        public CircuitBreakerConfig(int failureThreshold, int cooldownSec) {
            this.failureThreshold = failureThreshold;
            this.cooldownSec = cooldownSec;
        }
    }

    public static final class CircuitBreaker {
        public BreakerState state;
        public int consecutiveFailures;
        public int openedAt;

        public CircuitBreaker(BreakerState state, int consecutiveFailures, int openedAt) {
            this.state = state;
            this.consecutiveFailures = consecutiveFailures;
            this.openedAt = openedAt;
        }
    }

    public static final class BreakerVerdict {
        public final BreakerState state;
        public final boolean allowed;

        BreakerVerdict(BreakerState state, boolean allowed) {
            this.state = state;
            this.allowed = allowed;
        }
    }

    /** 记录一次调用结果，驱动熔断状态机（OPS-004 + ARC-012）。 */
    public static BreakerVerdict circuitBreaker(CircuitBreaker breaker, CircuitBreakerConfig config,
                                                boolean success, int nowSec) {
        if (breaker.state == BreakerState.OPEN) {
            // 冷却期满 → 进入半开态（本次调用仅试探进入，不判定成败）
            if (nowSec - breaker.openedAt >= config.cooldownSec) {
                breaker.state = BreakerState.HALF_OPEN;
                breaker.consecutiveFailures = 0;
                return new BreakerVerdict(BreakerState.HALF_OPEN, true);
            }
            return new BreakerVerdict(BreakerState.OPEN, false);
        }
        if (breaker.state == BreakerState.HALF_OPEN) {
            if (success) {
                breaker.state = BreakerState.CLOSED;
                breaker.consecutiveFailures = 0;
                return new BreakerVerdict(BreakerState.CLOSED, true);
            }
            // 半开试探失败 → 重开熔断
            breaker.state = BreakerState.OPEN;
            breaker.openedAt = nowSec;
            return new BreakerVerdict(BreakerState.OPEN, false);
        }
        // CLOSED
        if (!success) {
            breaker.consecutiveFailures += 1;
            if (breaker.consecutiveFailures >= config.failureThreshold) {
                breaker.state = BreakerState.OPEN;
                breaker.openedAt = nowSec;
                return new BreakerVerdict(BreakerState.OPEN, false);
            }
        } else {
            breaker.consecutiveFailures = 0;
        }
        return new BreakerVerdict(BreakerState.CLOSED, true);
    }

    /**
     * 三类重负载是否影响核心审批链路：熔断只隔离重负载，Gate 审批永不受影响（AC-03.1）。
     * 核心审批链路与三类重负载隔离，任何重负载熔断均不阻断核心链路。
     */
    public static boolean isCoreBlockedByLoad() {
        return false;
    }
}
