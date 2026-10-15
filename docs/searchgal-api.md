# SearchGal 站间游戏搜索 API

供 SearchGal **服务端**并发调用，返回 Charlotte 有合格资源的游戏标题和详情页路径。密钥不得传给浏览器。此接口不返回下载地址、提取码、解压密码、内部备注或用户信息。

## 配置

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NUXT_SEARCHGAL_API_KEY` | 空字符串 | 专用搜索密钥，至少 32 个 UTF-8 字节；未配置、过短、请求未携带或不匹配均返回 401 |
| `NUXT_SEARCHGAL_INCLUDE_NSFW` | `false` | `true` 时搜索 SFW 和 NSFW；否则仅搜索 `isNsfw=false` |
| `REDIS_URL` | 空字符串 | 可选；配置后复用现有 Redis 结果缓存及分布式限流 |

前两项属于服务端私有 `runtimeConfig`，在运行时由环境变量注入，不读取构建时的密钥默认值，不进入 `public` 配置。字符串 `"false"` 不会启用 NSFW；布尔值 `true` 或字符串 `"true"`（忽略首尾空白与大小写）才启用。修改环境变量后重启服务。

生成独立随机密钥（32 个随机字节编码为 64 个十六进制字符）：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

将输出通过生产环境的密钥管理或进程管理器配置为 `NUXT_SEARCHGAL_API_KEY`，并安全交给 SearchGal 服务端。不要提交密钥、写入构建产物或请求日志。**不要与 `NUXT_PRIVATE_API_KEY` 共用同一个值**：搜索接口不回退到原有私有密钥，也不使用登录 Cookie；搜索密钥不授予原有 `/api/integration/games/{vndbId}` 完整资源接口的权限。

为了让 SearchGal 搜索全部 Galgame，部署时设置：

```dotenv
NUXT_SEARCHGAL_INCLUDE_NSFW=true
```

开启后，SearchGal 可以向其用户展示 R18 游戏的标题和详情页路径。用户访问 Charlotte 的游戏详情和下载功能时，仍遵守现有权限规则。请求参数不能覆盖服务器的内容范围。

## 请求与响应

```http
GET /api/integration/search?q=千恋&limit=12
X-API-Key: <专用搜索密钥>
Accept: application/json
```

仅支持 `q`、`limit`，不支持分页、全量导出或自定义排序；其他参数和重复参数返回 400。

| 参数 | 规则 |
| --- | --- |
| `q` | 必填字符串；trim 后为 1～100 个 Unicode 码点，禁止空字符 U+0000 |
| `limit` | 可选十进制整数，默认 12，范围 1～20；小数、负数、科学计数法、空值均不接受 |

`curl` 示例（POSIX shell；运行时环境变量已配置，不把真实密钥写进命令）：

```bash
curl --get 'https://your-charlotte.example/api/integration/search' \
  --data-urlencode 'q=千恋' \
  --data-urlencode 'limit=12' \
  --header "X-API-Key: ${NUXT_SEARCHGAL_API_KEY}" \
  --header 'Accept: application/json'
```

配置允许 NSFW 时，成功响应示例：

```json
{
  "items": [
    { "id": 123, "title": "千恋＊万花", "path": "/games/123", "isNsfw": true }
  ]
}
```

无匹配结果返回 `{"items":[]}`。`id` 是 Charlotte 游戏 ID；`title` 由现有 `getDisplayTitle` 按简中、繁中、日文、英文顺序选择；`path` 由服务端根据 ID 生成，固定为 `/games/{id}`。SearchGal 可将 `title` 映射为 `name`，将站点地址与 `path` 拼成详情链接。响应没有分页元数据或完整游戏／资源对象。

## 搜索规则

游戏的 `deletedAt` 必须为 `null`，且至少有一条资源同时满足：

- `deletedAt=null`。
- `status=APPROVED`。
- `healthStatus` 不为 `UNAVAILABLE`；保留 `NEEDS_REVIEW`、`SUSPECTED_BAD`。

关键词不区分大小写地包含匹配四种语言标题、单个别名或合格资源的标题。未审核、已删除、已失效资源的名称不能命中游戏，即使该游戏另有合格资源。`%`、`_`、反斜杠及引号按字面量处理，不能充当 SQL 通配符或语法。别名逐个匹配，不跨数组元素拼接。

排序依次为：游戏标题或别名精确匹配、前缀匹配、包含匹配、仅资源名称匹配。同级按 `viewCount` 降序，再按 `id` 升序。数据库在过滤和去重后排序并应用 `limit`，同一游戏只返回一次；不拉取全部结果在服务端排序。

## 限流与缓存

每次请求先鉴权，再按已认证的固定调用方 `searchgal` 限流，之后才读取结果缓存。所有持有专用密钥的调用共享每 60 秒 120 次额度，不按登录用户或来源 IP 计算；缓存命中也计入额度。超限返回 429 和 `Retry-After: 60`，建议等待 60 秒再重试。限流优先使用 Redis，Redis 不可用时降级为单进程内存限流；多进程部署应配置 Redis 以共享额度。

内部结果缓存复用 `cachedFetch`，TTL 为 60 秒。键前缀为 `search:integration:v1:`，后面用 JSON 数组无歧义地序列化 trim 后的关键词、limit 和 NSFW 范围；保留关键词大小写，大小写不同的查询可以占用不同缓存项。**没有 Redis 时每次直接查询数据库，没有内存结果缓存。**

现有 `invalidateGameCaches` 清理 `search:*`，覆盖本接口所有变体。游戏编辑、删除、恢复，资源添加、编辑、删除、审核、健康状态更新，以及导入、快照撤销、修改请求审核和删除用户时移除资源等相关路径均触发失效。资源同步沿用原有失效调用。直接改数据库不触发应用层失效，需要主动清理 `search:*` 或等待 TTL。浏览计数排序通过短 TTL 刷新。

HTTP 响应设置 `Cache-Control: no-store`，与服务端内部 Redis 缓存分开处理。不要为该接口添加 Nitro SWR、CDN 或反向代理响应缓存。

## 错误

沿用项目 H3 错误响应，调用方以 HTTP 状态码区分失败；错误不携带数据库语句、密钥或原始内部堆栈。

| 状态码 | 含义 |
| --- | --- |
| 400 | 参数非法 |
| 401 | 专用密钥未配置、过短、缺失或不匹配 |
| 429 | 超出调用额度，附带 `Retry-After: 60` |
| 500 | 服务端查询失败；不会伪装成成功的空数组 |

## Cloudflare 与验证

如果线上启用了 Cloudflare 人机质询，需要为 `GET /api/integration/search` 配置适合服务端调用的规则，避免让 SearchGal 收到 HTML 挑战页；可结合固定调用来源限制。保留应用层专用密钥验证和限流，不要在 CDN 层缓存该路径的响应，也不要为整个站点关闭防护。

沿用仓库 Vitest，SQL 测试使用仅开发依赖 `@electric-sql/pglite` 在内存中执行 PostgreSQL，不需要线上数据库，也不修改业务数据库结构：

```bash
npx vitest run server/utils/__tests__/searchgal-api.test.ts server/utils/__tests__/searchgal-search.test.ts server/utils/__tests__/searchgal-cache.test.ts
npm run typecheck
```

SQL 测试覆盖匹配、排序、去重、过滤与转义；接口测试覆盖鉴权、内容开关、参数、缓存前鉴权与限流、异常和字段白名单；缓存测试覆盖真实 `cachedFetch`／`invalidateGameCaches` 的集成行为。PGlite 验证 SQL 语义，不替代上线环境的网络、Prisma 连接、真实 Redis 和 Cloudflare 联调。
