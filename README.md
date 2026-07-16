# XgoatCast · 小羊屏幕共享

基于声网 Agora 与 KOOK 开放平台的屏幕共享机器人。在 KOOK 频道发送关键词即可快速发起屏幕共享，机器人自动推送精美卡片与观看链接，频道成员点击免登录观看。

## 功能

- **关键词触发发起**：在 KOOK 频道发送包含触发词（默认 `屏幕共享` / `共享屏幕`，可在后台或环境变量配置）的消息即可发起，无需斜杠指令
- **鉴权长链接**：仅白名单 KOOK 服务器成员可发起，生成一次性鉴权长链接
- **免登录共享页**：分步权限引导（屏幕 / 系统声音 / 麦克风 / 摄像头），点击「开始共享」才加入声网频道
- **自动推送卡片**：共享成功后自动向频道推送封面图 + 「点击观看」按钮卡片
- **多画质支持**：可选 540p30 ~ 4K30 等多种画质（由 `AGORA_ALLOWED_QUALITIES` 控制）
- **管理后台**：配置声网凭证、KOOK Token、授权服务器白名单、触发词、会话保活参数；手动开放分享；强制结束
- **介绍首页**：访问根路径 `/` 展示软件介绍、GitHub 链接、功能特性与开发者信息（xgoat小羊 / xgoateam@gmail.com），并引导进入管理后台
- **登录防护**：管理后台登录具备按 IP 的失败锁定，连续 5 次失败即锁定 60 秒并随失败次数递增（上限 600 秒），有效防止暴力破解
- **计费控制**：懒加入频道、心跳看门狗、30 秒重连宽限、60 秒无发布者自动结束、Token 1 小时硬过期、beforeunload 主动 leave

## 技术栈

- 后端：Node.js 20 + NestJS 10 + agora-token + socket.io + ws（KOOK 直连）+ @nestjs/schedule（会话看门狗）+ bcryptjs
- 前端：React 18 + Vite 5 + Tailwind CSS + socket.io-client + agora-rtc-sdk-ng
- 存储：JSON 文件（无数据库）
- 部署：Docker 多阶段构建 + docker-compose，监听 3520 端口

## 部署

> **推荐使用 Docker Compose 部署**：一条命令即可完成镜像构建、服务启动与运行，无需在服务器上安装 Node.js 或手动编译前后端。

### Docker Compose 部署（推荐）

前置条件：服务器已安装 Docker 与 Docker Compose，并开放 3520 端口（或自定义 `PORT`）。

1. 上传项目到服务器并进入目录，复制并填写环境变量：
   ```bash
   cp .env.example .env
   vim .env   # 填写下方「环境变量」中的必填项
   ```
2. 构建并启动：
   ```bash
   docker compose up -d --build
   ```
   首次构建约 2–3 分钟（拉取镜像 + 编译前后端），之后启动秒级完成。
3. 管理与访问：
   ```bash
   docker compose logs -f          # 查看日志
   docker compose up -d --build    # 更新 .env 后重启
   docker compose down             # 停止
   ```
   - 介绍首页：`http://你的域名:3520/`（软件介绍、GitHub 链接、开发者信息）
   - 管理后台：`http://你的域名:3520/dashboard`
   - 共享页：`http://你的域名:3520/share`
   - 观看页：`http://你的域名:3520/view`

> 容器已配置健康检查（`/`）与 `restart: unless-stopped`，数据通过 `./data` 卷持久化。

完整部署与 Nginx 反向代理（含 WebSocket 升级、HTTPS）配置见 [DEPLOY.md](./DEPLOY.md)。

可用脚本：

| 脚本 | 说明 |
|------|------|
| `npm run build` | 构建前后端（输出 `server/dist`、`web/dist`） |
| `npm run start` | 以生产模式启动后端（需先 `build`） |

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

| 变量 | 必填 | 说明 |
|------|------|------|
| `PORT` | 否 | 服务端口，默认 `3520` |
| `PUBLIC_DOMAIN` | 是 | 对外可访问域名（如 `https://share.example.com`），用于生成长链接，不带末尾斜杠 |
| `ADMIN_PASSWORD` | 是 | 初始管理员密码，首次启动写入后失效，建议后台修改 |
| `AGORA_APP_ID` | 是 | 声网 Agora App ID |
| `AGORA_APP_CERTIFICATE` | 是 | 声网 Agora App Certificate |
| `AGORA_ALLOWED_QUALITIES` | 否 | 允许画质，逗号分隔（默认 `540p30,720p30,1080p30,1080p60,1440p30,1440p60,4k30`） |
| `KOOK_BOT_TOKEN` | 是 | KOOK 机器人 Token |
| `KOOK_WHITELIST_GUILDS` | 是 | 允许发起共享的 KOOK 服务器 ID，逗号分隔 |
| `KOOK_TRIGGER_WORDS` | 否 | 触发共享的关键词，逗号分隔（默认 `屏幕共享,共享屏幕`），消息包含任意词即触发 |

> 以上声网 / KOOK 凭证也可在管理后台 `/dashboard` 页面配置，二者等价。

## 目录结构

```
XgoatCast/
├── server/            # NestJS 后端（Bot + API + 会话管理）
├── web/               # React 前端（介绍首页/共享页/观看页/管理后台）
├── data/              # 运行时 JSON 配置与记录（Docker 卷挂载，不入库）
├── docker-compose.yml
├── Dockerfile
└── DEPLOY.md          # 详细部署指南
```

## 使用流程

1. 在 KOOK 频道发送包含触发词的消息（如「来个屏幕共享」）
2. 机器人回复卡片，点击「开始共享」按钮打开共享页
3. 在浏览器中授权屏幕采集（需 HTTPS 环境）
4. 共享成功后频道自动收到带「点击观看」按钮的卡片
5. 频道成员点击卡片即可免登录观看
6. 关闭共享页后链接自动失效

## 安全说明

- **切勿提交敏感信息**：`.env`、各 `data/*.json`（含声网凭证、KOOK Token、管理员密码哈希）已被 `.gitignore` 排除，不会进入仓库。仅 `.env.example` 作为空模板入库。
- **部署时注入配置**：服务器上的 `.env` 需单独放置，通过环境变量或 Docker secret 注入，不要执行 `git add .env`。
- **服务器密钥隔离**：本地用于推送 GitHub 的 SSH 密钥与服务器的登录密钥相互独立，服务器的私钥不应添加到 GitHub 账户。

## 致谢

本项目基于以下优秀的开源软件与平台构建，在此向它们的作者与维护者致以感谢：

- **[Agora 声网](https://www.agora.io)** — 提供实时音视频（RTC）能力与 `agora-token` / `agora-rtc-sdk-ng` SDK
- **[KOOK](https://www.kookapp.cn)** — 开放平台，提供机器人消息与卡片能力
- **[NestJS](https://nestjs.com)** — 后端应用框架及其生态（`@nestjs/*`、`@nestjs/schedule`）
- **[React](https://react.dev)** — 前端 UI 框架（Meta 团队）
- **[Vite](https://vitejs.dev)** — 前端构建工具
- **[Tailwind CSS](https://tailwindcss.com)** — 原子化 CSS 框架
- **[Socket.IO](https://socket.io)** — 实时双向通信
- **[TypeScript](https://www.typescriptlang.org)** — 类型系统
- 以及 `ws`、`rxjs`、`bcryptjs`、`class-transformer`、`class-validator`、`react-router-dom`、`lucide-react`、`clsx`、`tailwind-merge` 等开源依赖的作者与贡献者

感谢所有开源贡献者。
