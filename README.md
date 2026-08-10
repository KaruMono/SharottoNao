# Charlotte

一个基于 Nuxt 3 的 Galgame 资源数据库系统，支持用户协作编辑、资源分享、评分评论等功能。

## 技术栈

- **框架**: Nuxt 3 (Vue 3 + Nitro)
- **样式**: Tailwind CSS + FontAwesome 图标
- **数据库**: PostgreSQL + Prisma ORM
- **缓存**: Redis（可选，不配置则使用内存缓存）
- **认证**: JWT (jsonwebtoken) + @sidebase/nuxt-auth
- **两步验证**: otplib (TOTP) + qrcode
- **存储**: S3 兼容存储 / 本地文件存储
- **图片处理**: Sharp（自动转换 WebP、压缩）
- **富文本编辑**: Tiptap
- **HTML 净化**: sanitize-html + isomorphic-dompurify（防 XSS）
- **文章系统**: @nuxt/content (Markdown)
- **邮件**: Nodemailer (SMTP)
- **校验**: Zod
- **拼音**: pinyin（会社首字母索引 / slug 生成）
- **暗色模式**: @nuxtjs/color-mode

## 功能特性

### 用户系统
- 邮箱注册登录（SMTP 邮箱验证码 + 图形验证码防机器人）
- 两步验证（TOTP，支持 Google / Microsoft Authenticator 等，扫码绑定）
- 密码重置
- 个人中心（Gravatar / 自定义头像、简介、统计数据）
- 收藏夹（想玩 / 在玩 / 玩过 / 搁置 / 抛弃 五种状态）
- 通知中心通知
- 邮件通知（支持按类型开关）
- 用户关注 + 关注动态流（建条目、评论、评分、攻略、收藏等）
- 私信（会话式，支持图片消息、未读提醒；当前为实验性功能）
- NSFW 内容过滤模式（SFW / NSFW / ALL）

### 游戏条目
- 多语言标题和简介（中文简繁体、日文、英文）
- 游戏截图、封面、Banner
- 标签系统（带颜色）
- 会社管理（开发商/发行商）
- 制作人员（原画、剧本、音乐、声优等）
- 游戏系列
- 评分（1-5 星）+ 评论（支持富文本、回复、点赞）
- 评论中可记录游玩时长
- 下载资源分享（支持多种资源类型、提取密码、解压密码，按域名自动识别网盘类型）
- 资源审核机制
- 资源可用性状态与失效反馈（用户可反馈失效，后台记录健康状态）
- 攻略系统（富文本编辑器）
- 修改历史记录
- 条目修改审核（普通用户提交修改请求，管理员审核）
- 顶一下（每日一次）
- VNDB / Bangumi 外部平台关联
- 购买链接
- 相关作品推荐

### 搜索与发现
- 全站搜索（游戏、会社、标签、制作人员）+ 分页
- 热门搜索
- 以图搜游戏（AnimeTrace，上传截图 AI 识别对应作品）
- 标签浏览
- 会社索引（按首字母）
- 游戏发布日历（含 VNDB 今日 / 本月发布同步）
- 用户贡献排行榜
- 工具下载站（按分类提供工具下载）
- RSS 订阅（游戏、资源、攻略）

### 管理后台
- 仪表盘统计
- 用户管理（角色分配、封禁）
- 游戏条目管理（批量删除、软删除、回收站）
- VNDB 快速导入 / 批量导入游戏
- 批量补全信息、封面扫描修复、截图导入
- Alist 资源扫描
- 标签管理
- 资源类型管理
- 网盘类型管理（按域名识别）
- 资源审核
- 条目修改审核
- 图片管理（自动清理未使用图片）
- 表情包管理
- 游戏系列管理
- 公告管理
- 友情链接管理
- 广告位管理（按位置投放）
- 导航栏配置
- 工具 / 工具分类管理
- 举报处理
- IP 黑名单
- 链接白名单
- 操作日志
- 系统错误日志
- 计划任务查看（过期验证码清理、IndexNow 定时提交）
- 系统维护（残留数据清理、邮箱规范化、机翻资源标签修复等）
- 网站设置（SEO、CDN、Gravatar 镜像、自定义代码注入等）

### 文章系统
- 基于 Markdown 的静态文章（Nuxt Content）
- 分类管理
- 目录导航
- 代码高亮

### 其他
- 暗色模式
- 响应式设计（移动端适配）
- 图片自动转 WebP + 压缩
- 弹窗动画
- 安全响应头（X-Frame-Options、X-Content-Type-Options 等）
- 富文本 HTML 净化（sanitize-html + DOMPurify，防 XSS）
- 路径遍历防护
- 速率限制（登录、外部 API 调用等）
- 浏览量统计（IP 防刷）
- IndexNow 搜索引擎推送（自动提交新增/更新的页面）
- Sitemap / Robots.txt

## 环境要求

- Node.js 22+
- PostgreSQL 14+
- pnpm（推荐）
- Redis（可选，推荐生产环境使用）

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并填写配置：

```bash
cp env.example .env
```

各配置项说明见下方「环境变量说明」章节。

### 3. 初始化数据库

```bash
# 推送数据库结构
pnpm db:push

# 运行种子数据（创建管理员账户、默认标签、资源类型等）
pnpm db:seed
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

**默认管理员账户：**
- 邮箱：`admin@charlotte.local`
- 密码：`admin123`

> ⚠️ 请在首次登录后立即修改管理员密码。

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `NUXT_PUBLIC_SITE_URL` | ✅ | 网站公开 URL，用于认证回调和 SEO |
| `NUXT_AUTH_SECRET` | ✅ | JWT 签名密钥，**必须修改为随机强密码** |
| `SMTP_HOST` | ✅ | SMTP 服务器地址 |
| `SMTP_PORT` | ✅ | SMTP 端口（通常 587 或 465） |
| `SMTP_USER` | ✅ | SMTP 用户名 |
| `SMTP_PASS` | ✅ | SMTP 密码 |
| `SMTP_FROM` | ✅ | 发件人地址，格式 `名称 <邮箱>` |
| `SMTP_SECURE` | ❌ | TLS 模式：`auto`（默认）/ `true` / `false` |
| `SMTP_IGNORE_TLS_ERRORS` | ❌ | 是否忽略 TLS 证书错误，默认 `false` |
| `S3_ENABLED` | ❌ | 是否启用 S3 存储，默认 `false` |
| `S3_ENDPOINT` | ❌ | S3 端点 URL |
| `S3_REGION` | ❌ | S3 区域 |
| `S3_BUCKET` | ❌ | S3 存储桶名称 |
| `S3_ACCESS_KEY` | ❌ | S3 Access Key |
| `S3_SECRET_KEY` | ❌ | S3 Secret Key |
| `S3_PUBLIC_URL` | ❌ | S3 公开访问 URL（CDN 反代地址） |
| `LOCAL_UPLOAD_PATH` | ❌ | 本地上传路径，默认 `./uploads` |
| `REDIS_URL` | ❌ | Redis 连接字符串，不配置则使用内存缓存 |

### IndexNow 搜索引擎推送

系统已集成 IndexNow 功能，可以自动向搜索引擎（Bing、Yandex 等）提交新增或更新的页面。

**配置方法：**
1. 访问后台管理页面 `/admin/indexnow`
2. 点击"生成新的 API Key"按钮
3. 开启"自动提交"开关
4. （可选）配置 Bing Webmaster API Key

**自动提交的页面：**
- 游戏条目（创建、更新、审核通过）
- 会社页面（创建、更新）
- 快速导入的游戏

详细说明请参考 [IndexNow 功能文档](docs/indexnow.md)。

## ⚠️ 注意事项

### JWT 密钥（重要）

`NUXT_AUTH_SECRET` 是 JWT Token 的签名密钥，**直接关系到系统安全**：

- **必须**在生产环境中设置为一个足够长的随机字符串（建议 32 位以上）
- **不要**使用默认值或简单字符串
- 修改此密钥后，所有已登录用户的 Token 将立即失效，需要重新登录
- 可以使用 `openssl rand -base64 32` 生成随机密钥

### 密码要求

用户密码要求至少 8 位，且必须同时包含字母和数字。

### 存储配置

- 当 `S3_ENABLED=false` 时，图片上传到本地 `uploads/` 目录
- 本地存储模式下，`uploads/` 目录需要有读写权限
- 生产环境推荐使用 S3 兼容存储（如 Backblaze B2、Cloudflare R2、MinIO 等）
- 如果使用 CDN 反代 S3，将 `S3_PUBLIC_URL` 设置为 CDN 域名

### Redis 配置

- Redis 是可选的，不配置时使用 Nuxt 内置的内存缓存（SWR）
- 生产环境推荐配置 Redis，用于：Token 版本控制（使旧 Token 失效）、浏览量防刷、速率限制等
- 连接格式：`redis://[[username][:password]@][host][:port][/db-number]`

### SMTP 邮件

- 注册、密码重置、通知推送都依赖 SMTP 邮件服务
- 如果 SMTP 配置不正确，用户将无法注册
- 常用服务：QQ 邮箱、网易邮箱、Mailgun、SendGrid、Resend 等

### 数据库

- 使用 PostgreSQL，不支持 MySQL / SQLite
- `pnpm db:push` 用于开发环境快速同步 schema
- 生产环境建议使用 `pnpm db:migrate` 进行版本化迁移
- `pnpm db:studio` 可以打开 Prisma Studio 可视化管理数据

## 生产部署

### 构建

```bash
pnpm build
```

### 使用 PM2 运行（推荐）

项目已内置 PM2 配置文件 `ecosystem.config.cjs`：

```bash
# 安装 PM2（全局）
npm install -g pm2

# 启动
pnpm start

# 其他常用命令
pnpm stop       # 停止
pnpm restart    # 重启
pnpm reload     # 零停机重载
pnpm logs       # 查看日志
pnpm status     # 查看状态

# 设置开机自启
pm2 startup
pm2 save
```

默认监听 3000 端口，可在 `ecosystem.config.cjs` 中修改 `PORT`。

### 直接运行（不使用 PM2）

```bash
node .output/server/index.mjs
```

### Docker 部署

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### 反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 部署检查清单

- [ ] 修改 `NUXT_AUTH_SECRET` 为随机强密码
- [ ] 修改默认管理员密码
- [ ] 配置正确的 `NUXT_PUBLIC_SITE_URL`
- [ ] 配置 SMTP 邮件服务
- [ ] 配置存储方案（S3 或确保本地 uploads 目录可写）
- [ ] 推荐配置 Redis
- [ ] 配置 HTTPS（通过反向代理）
- [ ] 确保 `uploads/` 目录不在版本控制中

## 目录结构

```
charlotte/
├── components/          # Vue 组件
├── composables/         # 组合式函数
├── content/             # Markdown 文章（Nuxt Content）
│   └── posts/           # 按分类组织
├── layouts/             # 布局组件（default、admin）
├── middleware/           # 路由中间件
├── pages/               # 页面
│   ├── admin/           # 管理后台
│   ├── companies/       # 会社页面
│   ├── games/           # 游戏详情、编辑、攻略
│   ├── posts/           # 文章页面
│   ├── tags/            # 标签页面
│   └── user/            # 用户主页
├── prisma/              # Prisma 配置
│   ├── schema.prisma    # 数据库模型定义
│   └── seed.ts          # 种子数据
├── public/              # 静态资源
├── server/              # 服务端代码
│   ├── api/             # API 端点
│   ├── middleware/       # 服务端中间件
│   ├── routes/          # RSS、Sitemap、Robots.txt 等
│   └── utils/           # 工具函数（认证、邮件、存储等）
├── uploads/             # 本地上传文件（gitignore）
├── nuxt.config.ts       # Nuxt 配置
└── tailwind.config.js   # Tailwind 配置
```

## 常用命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm preview      # 预览生产构建
pnpm start        # PM2 启动生产服务
pnpm stop         # PM2 停止服务
pnpm restart      # PM2 重启服务
pnpm reload       # PM2 零停机重载
pnpm logs         # PM2 查看日志
pnpm status       # PM2 查看状态
pnpm db:push      # 同步数据库 schema（开发用）
pnpm db:migrate   # 数据库迁移（生产用）
pnpm db:studio    # 打开 Prisma Studio
pnpm db:seed      # 运行种子数据
```

## 文章系统

在 `content/posts/` 目录下创建 Markdown 文件：

```markdown
---
title: 文章标题
description: 文章描述
banner: /images/banner.jpg
date: 2026-01-01
userId: 1
---

文章正文内容...
```

- 按文件夹分类组织
- 支持代码高亮和目录导航
- 构建时自动生成静态页面

## 许可证

MIT
