# xgoatcast 部署指南

## 前置条件

- 服务器安装 Docker 和 Docker Compose
- 开放 3520 端口（或自定义 `PORT`）

## 部署步骤

### 1. 配置环境变量

在服务器项目目录下：

```bash
cp .env.example .env
vim .env
```

必须填写：
| 变量 | 说明 |
|------|------|
| `PUBLIC_DOMAIN` | 对外可访问域名（如 `https://share.example.com`），用于生成长链接 |
| `ADMIN_PASSWORD` | 初始管理员密码（首次启动后建议在后台修改） |
| `AGORA_APP_ID` | 声网 Agora App ID |
| `AGORA_APP_CERTIFICATE` | 声网 Agora App Certificate |
| `KOOK_BOT_TOKEN` | KOOK 机器人 Token |
| `KOOK_WHITELIST_GUILDS` | 允许发起共享的 KOOK 服务器 ID（逗号分隔） |

> 以上凭证也可以在管理后台 `/dashboard` 页面中配置，两者等价。

### 2. 构建（本地）

```bash
npm run build
```

这会在 `server/dist` 和 `web/dist` 下生成构建产物。

### 3. 上传到服务器

通过 VSCode SFTP 插件或 scp 命令上传项目文件到服务器。

### 4. 启动 / 更新

```bash
# 首次启动或代码更新后：重新构建镜像 + 启动容器
docker compose up -d --build
```

### 5. 管理

```bash
# 查看日志
docker compose logs -f

# 重启
docker compose restart

# 停止
docker compose down
```

### 6. 访问

- 管理后台：`http://你的域名:3520/dashboard`
- 共享页：`http://你的域名:3520/share`
- 观看页：`http://你的域名:3520/view`

### 7. 反向代理（推荐）

如果使用 Nginx 反向代理，配置示例：

```nginx
server {
    listen 80;
    server_name share.example.com;

    location / {
        proxy_pass http://127.0.0.1:3520;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 代理（socket.io 需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
