# MOFENG-RDP 后端（Java / Spring Boot 模块化单体）

> 阶段 B 工程骨架。技术栈按 SRS ARC-021 锁定：JDK 17、Spring Boot 3.2.5、MySQL 8.0、Redis 6+、Elasticsearch 8.x、Kafka 3.x。

## 模块划分（SRS ARC-001 四层架构）

| 模块 | 层 | 职责 | 依赖约束 |
|---|---|---|---|
| `mofeng-domain` | 领域层 | 受控对象、状态机、规则判定、追溯与基线语义 | **仅 JDK 与领域自身**，禁 Spring/MyBatis/HTTP/JPA |
| `mofeng-application` | 应用层 | 用例编排、事务边界、权限校验入口 | 可依赖领域层与基础设施层，禁承载领域规则 |
| `mofeng-infrastructure` | 基础设施层 | 持久化、缓存、检索、消息、外部适配 | 接口被上层调用，禁反向调领域逻辑 |
| `mofeng-boot` | 启动模块 | 模块化单体组装入口 | 组装 application + infrastructure |

## 构建方式（本机无 JDK/Maven，用 Docker 容器构建）

```bash
# 编译 + 跑全部测试（含 ArchUnit 架构守护）
docker run --rm \
  -v "$PWD":/usr/src/mymaven \
  -v maven-repo:/root/.m2 \
  -w /usr/src/mymaven \
  maven:3.9-eclipse-temurin-17 mvn -B clean test

# Windows Git Bash 需禁用路径转换：
# MSYS_NO_PATHCONV=1 docker run --rm -v "F:/WorkBuddy/2026-10-31-19-11-31/backend":/usr/src/mymaven ...
```

## 领域层纯净性守护（ArchUnit）

`mofeng-domain/src/test/.../DomainLayerArchitectureTest.java` 在 `mvn test` 阶段强制以下规则，命中即构建失败：

1. 领域层禁依赖 Spring Framework
2. 领域层禁依赖 MyBatis / MyBatis-Plus
3. 领域层禁依赖 HTTP 传输（jakarta/javax servlet、apache http）
4. 领域层禁依赖 JPA / Hibernate
5. 领域层只允许依赖 JDK 与领域自身（白名单收口）

## 领域规则迁移判据

前端 TS 纯函数引擎（`app/src/domain/*.ts`，70 引擎 / 744 例测试）是业务规则的**唯一权威**。Java 领域层以「通过同一套测试用例」为迁移完成判据，禁止出现两套规则各说各话。首个迁移样本：`ControlledObject`（对应 ARC-004 受控对象五要素）。
