# ===== 构建阶段 =====
FROM node:20-alpine AS builder
WORKDIR /app

# 安装所有依赖（含 devDependencies）
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci --ignore-scripts --no-audit --no-fund

# 拷贝源码并构建
COPY server/ server/
COPY web/ web/
RUN npm run build

# ===== 生产阶段 =====
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# 只安装 server 运行时依赖
WORKDIR /app/server
COPY server/package.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --omit=dev --ignore-scripts --no-audit --no-fund && \
    npm cache clean --force

# 拷贝构建产物
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/web/dist ../web/dist

WORKDIR /app
RUN mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 3520

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3520/ || exit 1

CMD ["node", "server/dist/main.js"]
