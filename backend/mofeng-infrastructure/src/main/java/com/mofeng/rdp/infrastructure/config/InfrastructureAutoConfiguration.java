package com.mofeng.rdp.infrastructure.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.TenantLineInnerInterceptor;
import com.mofeng.rdp.infrastructure.cache.CacheClient;
import com.mofeng.rdp.infrastructure.cache.DistributedLock;
import com.mofeng.rdp.infrastructure.cache.RedisCacheClient;
import com.mofeng.rdp.infrastructure.cache.RedisDistributedLock;
import com.mofeng.rdp.infrastructure.cache.RedisSessionStore;
import com.mofeng.rdp.infrastructure.cache.SessionStore;
import com.mofeng.rdp.infrastructure.messaging.AsyncTaskQueue;
import com.mofeng.rdp.infrastructure.messaging.EventBus;
import com.mofeng.rdp.infrastructure.messaging.KafkaAsyncTaskQueue;
import com.mofeng.rdp.infrastructure.messaging.KafkaEventBus;
import com.mofeng.rdp.infrastructure.persistence.archive.ArchiveRepository;
import com.mofeng.rdp.infrastructure.persistence.archive.ArchiveRepositoryImpl;
import com.mofeng.rdp.infrastructure.persistence.compliance.ComplianceItemMapper;
import com.mofeng.rdp.infrastructure.persistence.compliance.ComplianceRepository;
import com.mofeng.rdp.infrastructure.persistence.compliance.ComplianceRepositoryImpl;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantLineHandlerImpl;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantMapper;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantRepository;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantRepositoryImpl;
import com.mofeng.rdp.infrastructure.search.ElasticsearchSearchClient;
import com.mofeng.rdp.infrastructure.search.SearchClient;
import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;

/**
 * 基础设施层装配（阶段 C-14 接线）。
 *
 * <p>把阶段 B 落地的 Mapper / 多租户拦截器 / 分页 / 缓存 / 检索 / 消息适配器真正装配进
 * Spring 容器，使后端可真实连接 MySQL/Redis/ES/Kafka 启动。职责边界（ARC-001）：本类只做
 * 「装配」，不做业务判断——多租户隔离由 {@link TenantLineHandlerImpl} 取
 * {@code TenantContextHolder} 附加条件，判定权威始终在领域层。</p>
 *
 * <p>装配点集中于此而非散落各 adapter 源码，保持阶段 B「纯 adapter 类」风格不变：
 * 各实现类无 Spring 注解，由本类统一 @Bean 注册，构造依赖由 Spring 自动注入。</p>
 */
@Configuration
@MapperScan(basePackages = "com.mofeng.rdp.infrastructure.persistence", annotationClass = Mapper.class)
public class InfrastructureAutoConfiguration {

    // ------------------------------------------------------------------
    // MyBatis-Plus
    // ------------------------------------------------------------------

    /**
     * MyBatis-Plus 拦截器链：多租户（共享表模式强制附加 tenant_id）+ 分页。
     * 租户拦截器先于分页拦截器，保证分页 COUNT/limit 在租户过滤后的结果集上执行。
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new TenantLineInnerInterceptor(new TenantLineHandlerImpl()));
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }

    // ------------------------------------------------------------------
    // 缓存 / 会话 / 锁（Redis）
    // ------------------------------------------------------------------

    @Bean
    public CacheClient cacheClient(StringRedisTemplate redis) {
        return new RedisCacheClient(redis);
    }

    @Bean
    public SessionStore sessionStore(StringRedisTemplate redis) {
        return new RedisSessionStore(redis);
    }

    @Bean
    public DistributedLock distributedLock(StringRedisTemplate redis) {
        return new RedisDistributedLock(redis);
    }

    // ------------------------------------------------------------------
    // 检索（Elasticsearch）
    // ------------------------------------------------------------------

    @Bean
    public SearchClient searchClient(ElasticsearchOperations operations) {
        return new ElasticsearchSearchClient(operations);
    }

    // ------------------------------------------------------------------
    // 消息 / 异步任务（Kafka）
    // ------------------------------------------------------------------

    @Bean
    public EventBus eventBus(KafkaTemplate<String, String> kafkaTemplate,
                             @Value("${mofeng.kafka.event-topic:mofeng-events}") String eventTopic) {
        return new KafkaEventBus(kafkaTemplate, eventTopic);
    }

    @Bean
    public AsyncTaskQueue asyncTaskQueue(KafkaTemplate<String, String> kafkaTemplate,
                                         @Value("${mofeng.kafka.task-topic:mofeng-tasks}") String taskTopic) {
        return new KafkaAsyncTaskQueue(kafkaTemplate, taskTopic);
    }

    // ------------------------------------------------------------------
    // 持久化补充装配（租户 / 合规 / 归档）
    // ------------------------------------------------------------------

    @Bean
    public TenantRepository tenantRepository(TenantMapper tenantMapper) {
        return new TenantRepositoryImpl(tenantMapper);
    }

    @Bean
    public ComplianceRepository complianceRepository(ComplianceItemMapper mapper) {
        return new ComplianceRepositoryImpl(mapper);
    }

    @Bean
    public ArchiveRepository archiveRepository() {
        return new ArchiveRepositoryImpl();
    }
}
