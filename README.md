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
- 站内信（会话式，支持图片消息、未读提醒；当前为实验性功能）
- NSFW 内容过滤模式（SFW / NSFW / ALL）

### 游戏条目
- 多语言标题和简介（中文简繁体、日文、英文）
- 游戏截图、封面、Banner
- 中文规范标签系统（VNDB 原始标签映射、别名、颜色与 R18 策略）
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
- 标签管理与 VNDB 标签中文映射
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

## 存量 VNDB 标签回填

升级到 VNDB 主标签模型后，先应用数据库迁移，再回填已有游戏。命令默认是 dry-run：会读取数据库并请求 VNDB，但不会写入任何标签数据。

```bash
# 预览全部尚未同步的游戏
pnpm db:backfill-vndb-tags

# 先抽样预览 20 个，再分批写入
pnpm db:backfill-vndb-tags --limit 20
pnpm db:backfill-vndb-tags --limit 20 --apply

# 继续处理所有剩余的未同步游戏
pnpm db:backfill-vndb-tags --batch-size 50 --apply

# 已确认此前没有失败项时，从最后扫描 ID 的下一条续跑
pnpm db:backfill-vndb-tags --after-id 800 --batch-size 50 --apply

# 指定游戏；已有同步记录时用 --force 重新抓取
pnpm db:backfill-vndb-tags --game-id 123 --force --apply
```

脚本使用游戏 ID 游标分页，`--batch-size` 默认每批读取 50 条（最大 500 条），不会把全部存量游戏一次加载进内存；VNDB 请求和写入仍按游戏串行执行，每个游戏使用独立短事务。请求默认间隔 1600ms，可用 `--interval-ms` 调整（最小 250ms）。`--limit` 是整次任务的处理总量上限，不会在每一页重新计算；`--after-id` 只处理 ID 大于指定值的游戏，`--game-id` 只处理一个游戏，`--force` 包含已有 `vndbTagsSyncedAt` 的游戏，只有 `--apply` 会写库。

约 1500 个游戏按默认限流执行的理论下限约为 40 分钟，实际还要加上 VNDB 网络和数据库写入时间，应放在后台任务或稳定的维护终端中运行，不要放进单次 HTTP 请求。脚本会逐批输出进度和最后扫描游标；收到一次 `SIGINT`/`SIGTERM` 时会在当前游戏完成后安全停止。单项失败不会中断其余游戏，失败明细会在末尾汇总并令进程返回非零状态。失败游戏不会写入 `vndbTagsSyncedAt`，正常模式下不带 `--after-id` 直接重跑即可跳过成功项并重新捞取失败项；使用 `--force` 时建议通过 `--game-id` 逐项重试失败项。

回填只保存 VNDB 原始关联并应用后台已经审核的中文映射；未映射标签不会生成站内标签，标记为 R18 的中文标签遵循 SFW 可见性过滤，默认同步策略不应用剧透等级大于 0 的关联。完成后可在 `/admin/vndb-tags` 审核映射。脚本不会根据 VNDB 信号自动修改游戏的 `isNsfw`。`--apply` 只要成功写入至少一个游戏，就会在全部批次结束后用 `REDIS_URL` 建立短连接，统一失效首页、搜索、建议、游戏、日历、排行榜和标签相关缓存并立即断开；未配置 Redis 时会明确跳过，缓存清理失败则报告错误并返回非零状态。

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `NUXT_PUBLIC_SITE_URL` | ✅ | 网站公开 URL，用于认证回调和 SEO |
| `NUXT_AUTH_SECRET` | ✅ | JWT 签名密钥，**必须修改为随机强密码** |
| `NUXT_NEXTMOE_API_KEY` | ❌ | moyu.moe 补丁查询的服务端应用密钥，配置方法见 [补丁集成文档](docs/moyu-patches.md) |
| `NUXT_SEARCHGAL_API_KEY` | ❌ | SearchGal 搜索专用服务端密钥，默认空，至少 32 个 UTF-8 字节，见 [接入文档](docs/searchgal-api.md) |
| `NUXT_SEARCHGAL_INCLUDE_NSFW` | ❌ | 默认 `false`；设为 `true` 时向 SearchGal 提供 R18 标题与详情页路径 |
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
| `CHARLOTTE_LOCK_DIR` | ❌ | 无 Redis 时的共享定时任务锁目录，生产应放在 `shared/.charlotte-locks` |
| `CHARLOTTE_STATIC_ASSET_ROOT` | ❌ | 跨 release 的 `_nuxt` 静态资源根目录，通常由部署脚本注入 |

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

### 非 Docker 的不可变 release 部署（推荐）

直接在在线目录执行 `pnpm build` 会原地替换 `.output`，旧 worker 可能在同一时间读到新旧混合的资源清单，从而出现 JS/CSS 只返回响应头、浏览器报 `ERR_HTTP2_PROTOCOL_ERROR`。生产环境请让每次构建使用独立目录，构建和预检成功后再切换 `current` 软链接。
部署脚本面向 Linux（需要 Bash、GNU `find`/`tar`、`flock`、Node、pnpm、PM2 和 curl；默认 Git 归档还需要 Git），不在 Windows PowerShell 上执行。

目录建议如下（`uploads` 和环境文件不放在 release 内）：

```text
Charlotte/
├── releases/<release-id>/   # 每版完整源码、依赖和 .output，只读
├── shared/
│   ├── .env
│   ├── uploads/              # 本地存储时的永久目录
│   ├── .charlotte-locks/     # 无 Redis 时的跨 release 任务锁
│   └── nuxt-assets/_nuxt/    # 各版本 hash 静态资源的并集
└── current -> releases/<id>
```

#### 已经在线运行的实例迁移

如果当前实例仍由项目根目录的 `.output` 和 PM2 提供服务，不要先执行
`pm2 stop`、`pm2 delete` 或删除 `.output`。先保持旧版本在线，完成下面的一次性迁移；
之后每次发布只需要 `git pull --ff-only` 和 `deploy`。

1. 在生产机确认 PM2 应用名和正式端口：

   ```bash
   cd /opt/1panel/www/project/Charlotte
   pm2 status
   pm2 show charlotte
   ```

   后续命令中的 `CHARLOTTE_APP_NAME` 必须与 `pm2 status` 完全一致，
   `CHARLOTTE_BASE_PORT` 必须是当前 OpenResty 代理的端口。

2. 拉取代码后执行一次自动迁移。它会创建 `shared/`、`releases/`，安全迁移 `.env`、`uploads` 和旧 Nuxt 资源，并把当前 `.output` 建成可回滚的基线；不会停止或重载 PM2：

   ```bash
   chmod 700 deployment/deploy-release.sh
   CHARLOTTE_APP_NAME=charlotte \
   CHARLOTTE_BASE_PORT=3000 \
   CHARLOTTE_CANDIDATE_PORT=3001 \
   bash deployment/deploy-release.sh migrate-existing
   ```

   把 `charlotte`、`3000`、`3001` 替换为实际 PM2 名称、正式端口和空闲候选端口。若共享目录已有不同内容、旧 `.output` 在复制期间发生变化或发现越界软链接，脚本会停止并保留原数据，不会强行覆盖。

3. 迁移输出确认成功后，在不停止旧 PM2 的情况下发布新版本：

   ```bash
   CHARLOTTE_APP_NAME=charlotte \
   CHARLOTTE_BASE_PORT=3000 \
   CHARLOTTE_CANDIDATE_PORT=3001 \
   bash deployment/deploy-release.sh deploy
   ```

   第一次迁移不需要执行数据库迁移；本次修复没有修改 Prisma schema。

4. 确认候选 release 已接管后，再把 OpenResty 的 `/_nuxt/` 和 `/uploads/`
   location 改为 `deployment/openresty.conf.example` 中的共享目录 alias，执行 `openresty -t` 后 reload。

仓库提供了 `deployment/deploy-release.sh`（Linux 生产机上的可执行脚本），它会：

- 在新 release 中执行 `pnpm install --frozen-lockfile --prod=false` 和 `pnpm build`；
- 用独立端口（默认 `3001`）启动候选版本，分别检查 `/api/ready`（数据库和 build ID）、`/api/build-id`（实际加载版本接口）、SSR 首页及代表性 JS/CSS 资源；
- 将 `/_nuxt` hash 资源追加到共享目录，检测同名内容冲突；
- 用原子软链接切换 `current`，再让 PM2 平滑重载正式端口（默认 `3000`）；
- 保留最近版本，支持健康检查失败自动恢复和显式 rollback。

手动创建目录仅用于排查迁移问题；正常首次配置使用上面的 `migrate-existing`：

```bash
mkdir -p /opt/1panel/www/project/Charlotte/shared/{uploads,nuxt-assets/_nuxt,logs}
chmod 700 deployment/deploy-release.sh
```

部署、回滚和清理：

```bash
# 仅首次从根目录 .output 迁移时执行一次
deployment/deploy-release.sh migrate-existing
deployment/deploy-release.sh deploy
deployment/deploy-release.sh rollback <release-id>
deployment/deploy-release.sh cleanup
deployment/deploy-release.sh cleanup-assets
```

脚本默认把仓库根目录当作 `CHARLOTTE_APP_ROOT` 和源码目录，并从当前 Git `HEAD` 建立归档，避免把 `.output`、编辑器文件或其他未跟踪目录带入线上；源码与运行目录分离时，可设置 `CHARLOTTE_SOURCE_ROOT`、`CHARLOTTE_APP_ROOT`、`CHARLOTTE_LEGACY_ROOT`、`CHARLOTTE_ENV_FILE`、`CHARLOTTE_ECOSYSTEM_FILE`。`migrate-existing` 默认从 `CHARLOTTE_LEGACY_ROOT`（默认应用根目录）读取旧 `.output`、`uploads` 和 `.env`。若确实要部署未提交的工作区，显式设置 `CHARLOTTE_SOURCE_MODE=working-tree`。本地存储生产环境不要使用 release 内的 `./uploads`；脚本会自动传入共享目录的绝对路径（默认 `/opt/1panel/www/project/Charlotte/shared/uploads`）。候选端口、正式端口和保留数量分别可通过 `CHARLOTTE_CANDIDATE_PORT`、`CHARLOTTE_BASE_PORT`、`CHARLOTTE_KEEP_RELEASES` 调整。

数据库迁移默认不自动执行；确认 Prisma migration 与旧版本兼容后，可在部署前设置 `CHARLOTTE_RUN_MIGRATIONS=true`。生产迁移应遵循 expand/contract 顺序，避免旧 worker 仍在运行时删除字段或改变必填约束。

OpenResty/Nginx 应把共享 `/_nuxt/` 目录直接作为静态目录（示例见 `deployment/openresty.conf.example`），并只把动态请求代理到 PM2。这样已经打开的旧页面在保留期内仍能取得旧 hash 文件；不要在切换时删除旧静态资源。

修改代理配置后先执行 `openresty -t`（或 `nginx -t`）再 reload，并用 HTTP/1.1、HTTP/2 及 `Accept-Encoding: identity` 各请求一个当前首页引用的 hash 资源，确认状态码为 200 且下载长度大于 0。代理错误日志重点检查 `upstream prematurely closed connection`、`reset` 和 `broken pipe`。

仓库还提供了 `deployment/check-http2.sh` 诊断脚本。它会从首页自动取一个真实的 `/_nuxt/` 资源，分别测试 HTTP/1.1、HTTP/2（当前 `curl` 支持时）以及 gzip、Brotli、identity 三种协商，并检查 `Content-Length`、实际字节数和 Charlotte build 响应头。生产机上可这样运行：

```bash
deployment/check-http2.sh https://your-domain.example
# 可选：同时直连 PM2，快速区分反代问题和 Node 上游问题
CHARLOTTE_DIRECT_URL=http://127.0.0.1:3000 deployment/check-http2.sh https://your-domain.example
```

脚本失败时保留输出中的协议版本、编码和字节数；若直连通过而公网 HTTP/2 失败，优先检查 OpenResty/CDN 的 HTTP/2 或压缩配置；若直连也失败，再检查 PM2 日志、磁盘和进程退出记录。

PM2 配置中的 `kill_timeout` 默认 35 秒，用于等待正在发送的响应和 Nitro 的 Prisma/Redis 清理钩子。不要在在线 `current/.output` 内直接构建；部署脚本失败时不会覆盖当前 release。

部署脚本默认等待 35 秒再做旧 release 清理（可用 `CHARLOTTE_DRAIN_SECONDS` 调整）；不要把它调到小于实际 PM2 `kill_timeout`，除非确认没有长连接或长请求。

切换 release 后不要只执行 `pm2 restart charlotte`，因为它不会重新读取 release 元数据和环境变量；应使用上述部署脚本，或执行 `pm2 startOrReload ecosystem.config.cjs --only charlotte --update-env`。

#### 更新后出现 `Cannot find module .../build-id.get.mjs`

这表示 Nitro 路由表仍引用某个服务端模块，但运行目录里的文件已经不存在，请求尚未进入 `server/api/build-id.get.ts`。如果错误紧接着在线目录里的 `npm run build` / `pnpm build` 出现，通常是 `prebuild` 清空 `.output`、Nuxt 重建产物时旧 PM2 worker 仍在处理请求；构建失败、产物上传不完整或新旧版本混用也会造成同样结果。

先等当前构建结束，并在生产机检查实际运行路径和文件（日志中的 `16` 是 PM2 进程 ID，`charlot` 可能只是截断的应用名）：

```bash
cd /opt/1panel/www/project/Charlotte
pm2 show 16
ls -l .output/server/index.mjs .output/server/chunks/routes/api/build-id.get.mjs
```

如果本次构建已经成功、上述文件存在，而且 PM2 确实运行这个根目录的 `.output`，重载该应用的所有 worker，让它们重新加载同一套构建：

```bash
APP_NAME=charlotte # 替换为 pm2 show 中的完整应用名
pm2 reload "$APP_NAME" --update-env
curl --fail --show-error http://127.0.0.1:3000/api/build-id # 替换为实际正式端口
```

如果文件仍然缺失，单纯重载不能修复：应恢复完整的已知可用产物，或在独立 release 目录完成构建再切换。不要只手动补一个 `.mjs` 文件，它还依赖同一构建的其他 chunks。损坏的旧 `.output` 即使被 `migrate-existing` 复制，也不能视为可靠的回滚版本。

后续按上面的不可变 release 流程发布，避免在 PM2 正在使用的 `.output` 内构建。部署脚本会在候选和正式端口独立检查 `/api/build-id`，因此 `/api/ready` 返回成功也不能掩盖版本接口缺失；只有旧基线的版本接口返回 404 时才允许兼容，500 始终判定失败。回归检查可运行 `bash deployment/tests/deploy-health.test.sh`。

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
pnpm db:backfill-vndb-tags # 预览存量 VNDB 标签回填（加 --apply 写入）
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
