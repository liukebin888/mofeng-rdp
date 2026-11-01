# MOFENG-RDP 后端服务镜像（Node.js 零依赖）
# 构建：docker build -t mofeng-rdp-server ./server
# 运行：docker run -p 8787:8787 -v mofeng-data:/app/data mofeng-rdp-server

FROM node:20-alpine

# 非 root 运行，降低攻击面
RUN addgroup -S mofeng && adduser -S mofeng -G mofeng

WORKDIR /app

# 仅复制运行所需文件（零第三方依赖，无需 npm install）
COPY --chown=mofeng:mofeng index.js ./
COPY --chown=mofeng:mofeng test-isolation.cjs ./

# 数据目录挂载卷，持久化 state/audit
RUN mkdir -p /app/data && chown -R mofeng:mofeng /app

# 健康检查：探测 /api/health
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

USER mofeng

EXPOSE 8787

# 环境变量：PORT 服务端口、HOST 绑定地址
ENV PORT=8787 HOST=0.0.0.0

CMD ["node", "index.js"]
