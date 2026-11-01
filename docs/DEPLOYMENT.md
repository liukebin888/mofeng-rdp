# MOFENG-RDP 部署手册

本文覆盖 MOFENG-RDP（汽车零部件研发项目管理平台）从开发到生产的完整部署链路。

## 架构概览

```
┌─────────────┐   /api/* 反向代理   ┌──────────────────┐
│  前端 nginx  │ ──────────────────▶ │ 后端 Node 服务    │
│  (静态 dist) │                     │ (server/index.js) │
│   :8080/80   │                     │   :8787           │
└─────────────┘                     └──────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  数据卷 mofeng-data │
                                    │  state-*.json      │
                                    │  audit-*.json      │
                                    └───────────────────┘
```

- **前端**：Vue3 + Vite 构建的纯静态站点（`app/dist/`），nginx 托管 + SPA 路由回退。
- **后端**：Node.js 零依赖单进程服务（`server/index.js`），提供 `/api/state`、`/api/audit` 等 REST 接口。
- **存储**：单文档 JSON 文件（按租户分文件），原子写，无数据库依赖。

## 一、本地开发

### 前端

```bash
cd app
npm install
npm run dev          # http://127.0.0.1:5178
```

### 后端

```bash
node server/index.js  # http://127.0.0.1:8787，可用 PORT 覆盖
```

### 门禁校验（提交前必跑）

```bash
cd app
npx vue-tsc --noEmit                        # 1. 类型检查
npx vitest run --no-file-parallelism        # 2. 单元测试
npx vite build                              # 3. 构建
npm run smoke                               # 4. 冒烟（placeholder 0 / bad 0）
npm run e2e                                 # 5. 端到端
```

## 二、生产部署方式一：Docker Compose（推荐，一键编排）

前置：已安装 Docker + Docker Compose。

```bash
# 在项目根目录执行
docker compose up -d --build
```

- 前端：http://localhost:8080
- 后端：经 nginx `/api` 反向代理，不直接暴露宿主机端口
- 数据：持久化于命名卷 `mofeng-data`（容器重建不丢）

常用运维命令：

```bash
docker compose ps              # 查看容器状态
docker compose logs -f         # 跟踪日志
docker compose down            # 停止（保留数据卷）
docker compose down -v         # 停止并删除数据卷（⚠️ 会丢数据）
```

### 数据备份

```bash
# 备份数据卷内容（state + audit）
docker run --rm -v mofeng-rdp_mofeng-data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/mofeng-data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 三、生产部署方式二：分步 Docker 部署

### 后端

```bash
docker build -t mofeng-rdp-server ./server
docker run -d --name mofeng-server \
  -p 8787:8787 \
  -v mofeng-data:/app/data \
  mofeng-rdp-server
```

### 前端

```bash
# 在项目根目录执行（多阶段构建：先 vite 构建，再 nginx 托管）
docker build -f deploy/Dockerfile.web -t mofeng-rdp-web .
docker run -d --name mofeng-web -p 8080:80 mofeng-rdp-web
```

## 四、生产部署方式三：裸机（无 Docker）

### 前端

```bash
cd app
npm install
npm run build          # 产物在 app/dist/
```

将 `app/dist/` 交给任意静态服务器托管（nginx / caddy / Node 静态服务），并配置 SPA 路由回退与 `/api` 反向代理。nginx 配置参考 `deploy/nginx.conf`。

### 后端

```bash
node server/index.js   # 建议用 pm2/systemd 守护
```

pm2 示例：

```bash
npm install -g pm2
pm2 start server/index.js --name mofeng-server
pm2 save && pm2 startup
```

## 五、HTTPS 与反向代理

生产环境建议在 nginx 前再加一层 HTTPS 反向代理（或直接改造 `deploy/nginx.conf`），示例（Caddy 更省事）：

```caddy
mofeng.example.com {
    reverse_proxy /api/* 127.0.0.1:8787
    root * /srv/mofeng/dist
    try_files {path} /index.html
    encode gzip
}
```

## 五·一、国密 TLS 网关（SEC-012 部署方案）

### 背景与边界

SRS 第 23 章明确「国密网关位置：**平台边界，统一卸载与卸载后再加密**」——国密 TLS 属**部署/网关层**职责，而非应用代码层。本平台后端为 Node.js 零依赖实现，Node 内置 `crypto` 不支持 SM2/SM3/SM4 国密套件，故**不在应用代码内自造国密**（自造既不安全也不合规），而是由边界网关卸载国密 TLS、向内以受控内网明文/标准 TLS 转发。

### 推荐架构：国密网关（GMGW）卸载

```
客户端（SM2/SM3/SM4 国密套件）
      │  TLS 1.3 + 国密套件（SM2 证书 / SM3 签名 / SM4 加密）
      ▼
┌─────────────────────────────┐
│  国密网关（平台边界）         │   ● 国密证书（SM2 双证书：签名 + 加密）
│  Nginx + 国密模块 / 商用密码机 │   ● 与客户密码机对接（跨域链路 SM2/SM3）
│  ── TLS 终止（卸载）          │   ● 密钥分级管理 + 轮换
└──────────────┬──────────────┘
               │  内网受控链路（可标准 TLS 或内网明文，视等保定级）
               ▼
      nginx 反向代理 → 后端 127.0.0.1:8787（应用层不变）
```

### 国密套件要求（AC-24 判据）

| 项 | 要求 | 判据 |
|---|---|---|
| 密钥协商 | SM2（签名 + 加密双证书） | 链路协商仅国密套件，无 RSA/AES 回落 |
| 签名/摘要 | SM3 | 证书链与算法符合国密 |
| 传输加密 | SM4 | 协议扫描无弱套件（TLS1.2 以下 0 个） |
| 密钥管理 | 分级 + 轮换，密钥不入库 | 密钥与数据物理分离（NFR-010） |

### 落地选项（三选一，对应 SOLUTION D-01 部署形态）

1. **Nginx + 国密模块（推荐，零应用改造）**：编译 `tongsuo`（铜锁，蚂蚁开源 OpenSSL 国密分支）或使用商业国密网关，在 `deploy/nginx.conf` 前端加一层国密 TLS 终止；后端 `index.js` 完全不动。
2. **商用密码机/国密网关硬件**：等保三级/密评场景推荐，密钥托管在密码机内，平台仅做内网转发。
3. **云厂商国密 TLS 能力**：若部署在支持国密的云（如部分云负载均衡已支持 SM2/SM3/SM4 套件），直接启用，无需自建。

### 应用层配套（已落地，v1.0.14）

国密传输由网关负责，但**应用层补齐了可自证的合规配套**：

- **合规证据台账**（`domain/compliance.ts`）：等保三级/密评/国密/数据分类分级四类测评的结构化证据链，C-30 由 flag 静态登记改为证据链驱动判定，到期未重评自动 FAIL（杜绝虚假闭环）。
- **口令加盐哈希**（`domain/password.ts`）：PBKDF2 风格 12 万轮迭代 + 独立随机盐 + 恒等时间比较，满足 AC-24「口令哈希不可逆且加盐」。
- **敏感字段加密存储**（`domain/cipher.ts`）：字段级可逆加密，密钥仅存 `keyId` 引用（密钥与数据分离），满足 AC-24「明文敏感字段 0 条」（SEC-013 基础）。

### 待办（外部依赖，非代码阻塞）

- 等保三级测评机构、密评机构预约（SOLUTION D-07，R1 第 8 周前）。
- 国密网关选型（选项 1/2/3）与部署形态（D-01）由需求方拍板后实施。

## 六、环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端服务端口 | `8787` |
| `HOST` | 后端绑定地址 | `127.0.0.1`（容器内 `0.0.0.0`） |

## 七、安全与合规要点

- **数据卷持久化**：`server/data/` 已加入 `.gitignore` 与 `.dockerignore`，不入库、不进镜像，仅通过数据卷持久化。
- **非 root 运行**：后端镜像以 `mofeng` 用户运行，降低攻击面。
- **审计链**：`audit-*.json` 由服务端权威重算哈希链（append-only），勿手工编辑。
- **租户隔离**：多租户按 `x-tenant-id` 请求头分文件隔离，伪造租户返回 403。
- **密钥不入库**：`.env`、`*.pem`、`*.key` 均已排除。
