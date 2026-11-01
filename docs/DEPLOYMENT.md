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
