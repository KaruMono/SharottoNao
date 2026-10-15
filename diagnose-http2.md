# HTTP/2 协议错误诊断指南

## 1. 检查是否只在特定环境下发生

在浏览器控制台运行：
```javascript
// 检查是否所有资源都失败，还是偶发
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('_nuxt'))
  .forEach(r => console.log(r.name, r.transferSize))
```

## 2. 验证 HTTP 版本

```bash
# 检查服务器实际使用的协议
curl -I --http2 https://www.sharotto.com/_nuxt/entry.js
curl -I --http1.1 https://www.sharotto.com/_nuxt/entry.js
```

## 3. 测试是否是 HTTP/2 特定问题

在 Chrome 中强制使用 HTTP/1.1：
1. 打开 `chrome://flags/#enable-http2`
2. 禁用 HTTP/2
3. 重启浏览器测试

## 4. 检查 nginx 配置（如果使用）

常见问题配置：
```nginx
# ❌ 问题配置
http2_max_field_size 4k;      # 太小
http2_max_header_size 16k;    # 太小

# ✅ 推荐配置
http2_max_field_size 16k;
http2_max_header_size 32k;
http2_max_concurrent_streams 128;

# 压缩相关
gzip on;
gzip_vary on;
gzip_types text/css application/javascript image/svg+xml;

# 如果使用 brotli
brotli on;
brotli_types text/css application/javascript;
```

## 5. 检查是否是双重压缩问题

```nginx
# 如果 Nuxt 已经压缩（compressPublicAssets: true）
# nginx 不应该再次压缩静态资源

location /_nuxt/ {
    # 不要对已压缩的资源再次压缩
    gzip off;
    brotli off;
}
```

## 6. 清除 CDN 缓存

如果使用 Cloudflare/其他 CDN：
- 清除 `/_nuxt/*` 的缓存
- 检查 CDN 的 HTTP/2 设置

## 7. 检查 Node.js 版本

确保使用 Node.js 18+ LTS 版本，旧版本的 HTTP/2 实现有已知问题。

```bash
node --version  # 应该是 v18.x 或更高
```

## 8. 临时解决方案

如果问题紧急，可以暂时禁用服务器端压缩：
