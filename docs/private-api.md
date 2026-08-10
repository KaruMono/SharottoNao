# 站间私有 API

此接口用于受信任的站点之间按 VNDB ID 读取 Charlotte 中的游戏和下载资源。接口不会调用 VNDB 远程 API，返回的是本站数据库中的内容。

## 配置密钥

在服务端环境变量中设置 `NUXT_PRIVATE_API_KEY`：

```env
NUXT_PRIVATE_API_KEY=请替换为至少 32 位的随机字符串
```

可以使用以下命令生成密钥：

```bash
openssl rand -base64 32
```

修改环境变量后请重启服务。密钥未配置或少于 32 字节时，接口始终拒绝请求。

## 获取游戏资源

```http
GET /api/integration/games/{vndbId}
X-API-Key: your-private-api-key
Accept: application/json
```

示例：

```bash
curl "https://your-charlotte.example/api/integration/games/v27448" \
  -H "X-API-Key: your-private-api-key"
```

`vndbId` 必须符合 `v` 加数字的格式（大小写均可，服务端会标准化为小写）。

### 成功响应 `200`

```json
{
  "game": {
    "id": 123,
    "vndbId": "v27448",
    "titleEn": "Example Game",
    "titleJa": "ゲーム",
    "titleZhHans": "示例游戏",
    "titleZhHant": null,
    "title": "示例游戏",
    "descriptionEn": "...",
    "descriptionJa": null,
    "descriptionZhHans": "...",
    "descriptionZhHant": null,
    "description": "...",
    "aliases": [],
    "coverImage": "https://...",
    "bannerImage": null,
    "releaseDate": "2024-01-01T00:00:00.000Z",
    "language": ["ja", "zh-Hans"],
    "isNsfw": false,
    "purchaseLinks": [],
    "lengthMinutes": 1200,
    "series": null,
    "creator": { "id": 1, "username": "admin", "avatar": null },
    "companies": [],
    "tags": [],
    "staff": [],
    "screenshots": [],
    "resources": [
      {
        "id": 456,
        "title": "日文原版",
        "url": "https://example.com/download",
        "extractCode": "abc123",
        "unzipPassword": "password",
        "remark": "备注",
        "language": "ja",
        "fileSize": "2.4G",
        "isMachineTranslated": false,
        "downloadCount": 10,
        "healthStatus": "AVAILABLE",
        "healthNote": null,
        "healthCheckedAt": null,
        "issueCount": 0,
        "status": "APPROVED",
        "type": { "id": 1, "name": "本体" },
        "netDiskType": { "id": 1, "name": "百度网盘" },
        "uploader": { "id": 1, "username": "admin", "avatar": null },
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ]
  },
  "meta": {
    "vndbId": "v27448",
    "resourceCount": 1,
    "generatedAt": "2026-08-03T00:00:00.000Z"
  }
}
```

`game` 中保留游戏的多语言字段和关联数据，并额外提供按站内固定优先级（简中 > 繁中 > 日文 > 英文）选择的 `title`、`description`。`resources` 包含所有未软删除资源（包括审核状态），其中 `url`、`extractCode` 和 `unzipPassword` 会原样返回；已软删除的游戏或资源不会返回。

## 错误响应

错误响应统一为：

```json
{ "statusCode": 401, "message": "API key 无效" }
```

| 状态码 | 含义 |
| --- | --- |
| `400` | VNDB ID 格式错误 |
| `401` | 缺少或错误的 `X-API-Key` |
| `404` | 本站没有对应的未删除游戏 |
| `500` | 服务端或数据库错误 |

此接口包含下载凭据，请仅通过 HTTPS 和内网/白名单访问，并将密钥放在调用站点的服务端环境变量中，不要暴露给浏览器端。
