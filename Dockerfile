FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# 只安装 server 运行时依赖（使用淘宝镜像加速）
WORKDIR /app/server
COPY server/package.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --omit=dev --ignore-scripts --no-audit --no-fund && \
    npm cache clean --force

# 拷贝构建产物
COPY server/dist ./dist
COPY web/dist ../web/dist

WORKDIR /app
RUN mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 3520

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3520/ || exit 1

CMD ["node", "server/dist/main.js"]
