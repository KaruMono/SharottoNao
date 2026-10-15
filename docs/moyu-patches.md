# moyu.moe 补丁集成

契约来源：[moyu 补丁面](https://developer.nextmoe.dev/docs/moyu)、[接入指南](https://developer.nextmoe.dev/docs/moyu-patches)、[OpenAPI](https://developer.nextmoe.dev/specs/moyu-openapi.yaml)。本模块按 2026-09-19 读取的 v2 文档实现。

## 配置

在 [NextMoe 控制台](https://developer.nextmoe.dev/dashboard) 创建应用和 `nmk_` 应用密钥，无需任何 scope。在服务端运行环境设置：

```dotenv
NUXT_NEXTMOE_API_KEY=nmk_live_<YOUR_KEY>
```

开发环境可放在 `.env`，生产环境由进程管理器注入，修改后重启服务。配置属于 Nuxt 私有 `runtimeConfig.nextmoeApiKey`，默认值留空，不写入公开配置或构建时的密钥默认值。未配置时，补丁标签显示“补丁服务尚未启用”，其他游戏功能可正常使用。

## 数据流程

1. 打开游戏详情的补丁标签时，请求站内 `GET /api/games/{id}/moyu-patches`，携带当前用户的站内认证。
2. 服务端检查游戏是否存在、是否已删除及 NSFW 权限，再读取游戏关联的 VNDB ID。
3. 使用服务端应用密钥请求 `GET https://api.nextmoe.dev/v2/moyu/patches?refs=vndb:v4145&include=resources,publisher&nsfw=false`。允许 NSFW 的用户传 `nsfw=true`。`refs` 是批量反查，不传 `cursor` 或 `sort`；附带的 `resources` 为该补丁页的资源数组。
4. 返回匹配的所有补丁页，界面展示其资源。`items: []` / `missing` 表示正常未命中，缺少 VNDB 关联单独返回 `status: missing_vndb`。新接口返回的所有 ID 都保持字符串，不混用站内 ID、补丁 ID、VNDB ID 与 catalog ID。
5. 下载按钮使用资源的 `web_url`。本模块不获取下载直链、提取码、解压密码，也不从补丁面获取游戏名、封面等 catalog 数据；游戏详情继续使用站内已有数据。`note` 以文本展示 Markdown 源码，不直接注入 HTML。

旧 `/api/hikari` 调用、站内 `/hikari-patches` 路由及相关旧类型已移除，站内页面使用 `/moyu-patches`。

## 缓存与错误

- 每个进程的客户端缓存最多 200 个查询，成功结果（包括未命中）缓存 5 分钟。同一查询并发合并；缓存按 VNDB 和 NSFW 条件隔离，密钥变更时重建客户端。
- 过期后发送原样的 `If-None-Match`；上游 `304` 复用缓存响应体。未命中缓存的错误不伪装成空列表。
- 上游 `401` 转为站内 `503 CREDENTIAL_ERROR`；`429` 根据 RFC 9457 的 `code` 区分速率限制与日配额，保留 `Retry-After`。客户端按该间隔暂停新的上游请求，页面显示重试倒计时。上游网络错误、异常数据、其他错误及超时分别提示失败，禁止自动即时重试。
- 上游数据可以共享缓存，但站内端点包含用户内容权限判断，因此站内响应为 `private, no-store`，不会通过公共 CDN 缓存用户结果。
- UI 在切换游戏或登录状态、内容偏好变动时取消旧请求并清空结果；空结果在切换标签时不会重复请求，失败可以手动重试。

## 验证

```bash
npx vitest run server/utils/__tests__/moyu-client.test.ts server/utils/__tests__/moyu-api.test.ts utils/__tests__/moyu-patches.test.ts
npm run typecheck
```

真实接口验收需要配置有效应用密钥，然后在一个已关联 VNDB 的游戏详情页打开补丁标签。未配置密钥时，单元测试使用模拟响应验证契约，不会请求外部补丁服务。
