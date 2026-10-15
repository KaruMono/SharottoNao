# Nuxt 优化指南 - 从 kun-galgame-forum 学习

本文档总结了从 kun-galgame-forum-master 项目学到的 Nuxt 优化机制，以及如何应用到 Charlotte 项目。

## 🎯 关键优化点

### 1. 图标优化 ⭐⭐⭐⭐⭐

#### 问题现状
Charlotte 当前使用 FontAwesome CDN 方式，加载了完整的 CSS 文件：
```typescript
css: [
  '@fortawesome/fontawesome-free/css/fontawesome.min.css',  // ~70KB
  '@fortawesome/fontawesome-free/css/solid.min.css',         // ~700KB
  '@fortawesome/fontawesome-free/css/regular.min.css',       // ~30KB
  '@fortawesome/fontawesome-free/css/brands.min.css',        // ~100KB
]
// 总计: ~900KB+ 未压缩，包含数千个未使用的图标
```

#### kun-galgame 的方案
使用 `@nuxt/icon` + 自动扫描脚本：

**优势：**
- ✅ 只打包实际使用的图标（减少 90%+ 体积）
- ✅ SVG 模式，更清晰、可缩放、支持动态颜色
- ✅ 服务端渲染友好
- ✅ 自动化维护（脚本扫描代码生成图标列表）

**实现步骤：**

1. **安装依赖**
```bash
npm install @nuxt/icon
npm install -D @iconify-json/fa6-solid @iconify-json/fa6-regular @iconify-json/fa6-brands
```

2. **运行图标扫描脚本**
```bash
node scripts/generate-icon-list.mjs
```

3. **更新 nuxt.config.ts**
```typescript
import { ICON_COLLECTIONS, ICON_NAMES } from './lib/icon'

export default defineNuxtConfig({
  modules: [
    '@nuxt/icon',
    // ... 其他模块
  ],
  
  icon: {
    mode: 'svg',
    localApiEndpoint: '/_nuxt_icon',
    serverBundle: {
      collections: ICON_COLLECTIONS  // 只加载需要的图标集合
    },
    clientBundle: {
      icons: ICON_NAMES,  // 明确列出所有图标
      scan: false         // 禁用自动扫描（提升构建性能）
    }
  },
})
```

4. **添加 npm script**
```json
{
  "scripts": {
    "icons": "node scripts/generate-icon-list.mjs"
  }
}
```

5. **迁移组件代码**

**之前：**
```vue
<i class="fa-solid fa-heart"></i>
```

**之后：**
```vue
<Icon name="fa6-solid:heart" />
```

6. **创建兼容层（可选）**

如果有很多地方使用了 FA class，可以创建一个兼容组件：

```vue
<!-- components/FaIcon.vue -->
<template>
  <Icon :name="convertedName" v-bind="$attrs" />
</template>

<script setup lang="ts">
const props = defineProps<{
  icon: string  // 例如: 'fa-solid fa-heart'
}>()

const convertedName = computed(() => {
  const match = props.icon.match(/fa-(solid|regular|brands)\s+fa-([a-z0-9-]+)/)
  if (!match) return ''
  const [, style, icon] = match
  return `fa6-${style}:${icon}`
})
</script>
```

---

### 2. 实验性功能优化

#### kun-galgame 使用的实验性功能

```typescript
experimental: {
  scanPageMeta: true,        // 自动扫描页面元数据
  typescriptPlugin: true,    // TypeScript 编辑器支持
}
```

#### Charlotte 已使用
```typescript
experimental: {
  payloadExtraction: true,   // ✅ 提取页面数据为独立文件
  componentIslands: true,    // ✅ 组件孤岛（选择性水合）
  emitRouteChunkError: 'manual',  // ✅ 手动处理路由块错误
}
```

**建议添加：**
```typescript
experimental: {
  payloadExtraction: true,
  componentIslands: true,
  emitRouteChunkError: 'manual',
  scanPageMeta: true,        // 🆕 添加这个
  typescriptPlugin: true,    // 🆕 添加这个（需要 IDE 支持）
}
```

---

### 3. Route Rules 缓存策略

#### kun-galgame 的配置
```typescript
routeRules: {
  '/emoji/**': { headers: { 'cache-control': 'public, max-age=2592000' } }  // 30天
}
```

#### Charlotte 的配置（已经很好）
```typescript
routeRules: {
  '/images/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  '/uploads/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  '/api/hot-searches': { swr: 300 },
  '/api/site-info': { swr: 300 },
  // ...
}
```

✅ **Charlotte 在这方面做得更全面**

---

### 4. Tailwind CSS v4 优化

#### kun-galgame 使用 Tailwind v4
```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  vite: {
    plugins: [tailwindcss()]
  }
})
```

#### Charlotte 使用 Tailwind v3（通过 @nuxtjs/tailwindcss）
```typescript
modules: [
  '@nuxtjs/tailwindcss',
  // ...
]
```

**Tailwind v4 优势：**
- ⚡ 更快的构建速度（Rust 实现）
- 📦 更小的运行时
- 🎨 更好的 CSS 变量支持
- ⚠️ **注意：** v4 还在 beta，建议等稳定版

---

### 5. Sitemap 优化

#### kun-galgame 的 sitemap 配置
```typescript
sitemap: {
  exclude: ['/admin', '/admin/**', '/auth/**', '/edit/**', '/message', '/message/**', '/report', '/user', '/rss'],
  defaultSitemapsChunkSize: 1000,
  sitemaps: {
    kungal: {
      includeAppSources: true,
      sources: ['/api/__sitemap__/urls'],  // 🔥 动态生成 sitemap
      chunks: true
    }
  },
  cacheMaxAgeSeconds: 60 * 60 * 6,  // 6小时
  defaults: { changefreq: 'daily', priority: 0.7 }
}
```

**建议 Charlotte 添加：**
```bash
npm install @nuxtjs/sitemap
```

---

### 6. 关于 GitHub Issue #26565（动态模块导入失败）

这个 issue 讨论的是 Nuxt 在生产环境中的 **chunk 加载失败** 问题。

#### Charlotte 已有的解决方案 ✅

Charlotte 的 `nuxt.config.ts` 中已经实现了一个非常全面的资源恢复机制：

```typescript
const resourceRecoveryBootstrap = `(function(){
  // 监听加载错误并自动重试
  window.addEventListener('error', function(event){
    if(isCoreResource(event.target)) recover()
  }, true);
  
  // 处理 Vite preload 错误
  window.addEventListener('vite:preloadError', function(event){
    if(event && event.preventDefault) event.preventDefault();
    recover()
  }, true);
  
  // 处理动态导入错误
  window.addEventListener('unhandledrejection', function(event){
    var message = String(reason && reason.message || reason || '').toLowerCase();
    if(message.indexOf('dynamically imported')>=0 || 
       message.indexOf('loading chunk')>=0) recover();
  }, true);
  
  // 检查 build ID 变化并刷新
  checkBuild();
})();
```

**这个方案比 kun-galgame 更先进！** ✅

#### Charlotte 的 chunk 优化策略
```typescript
vite: {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@fortawesome')) return 'vendor-fontawesome'
            if (id.includes('prisma')) return 'vendor-prisma'
            if (id.includes('vue')) return 'vendor-vue'
            if (id.includes('nuxt')) return 'vendor-nuxt'
            return 'vendor-misc'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}
```

✅ **这个策略很好，但可以进一步优化：**

**建议改进：**
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    // 按库分离（小而多的 chunk，HTTP/2 友好）
    if (id.includes('@fortawesome')) return 'vendor-fontawesome'
    if (id.includes('prisma') || id.includes('@prisma')) return 'vendor-prisma'
    if (id.includes('tiptap') || id.includes('@tiptap')) return 'vendor-tiptap'
    if (id.includes('vue') && !id.includes('node_modules/.pnpm/nuxt')) return 'vendor-vue'
    
    // ⚠️ 不要将整个 nuxt 打成一个包，它已经自动分割了
    // if (id.includes('nuxt') || id.includes('@nuxt')) return 'vendor-nuxt'  // 移除这行
    
    // 其他小型依赖打包在一起
    return 'vendor-misc'
  }
}
```

---

## 🎯 优先级建议

### 高优先级（立即实施）
1. **图标优化**：迁移到 `@nuxt/icon`，减少 900KB+ 体积
   - 预计节省：**初始加载 ~700KB**
   - 工作量：中等（需要迁移代码）

### 中优先级（计划实施）
2. **添加 sitemap 模块**：改善 SEO
   - 工作量：小
   
3. **添加实验性功能**：`scanPageMeta` 和 `typescriptPlugin`
   - 工作量：极小

### 低优先级（观望）
4. **Tailwind v4**：等待稳定版本
   - 当前 v3 已经足够好

---

## 📊 预期效果

**实施图标优化后：**
- 初始 bundle 减少：~700KB（gzip 后 ~200KB）
- 首屏加载时间减少：~0.5-1s（3G 网络）
- Lighthouse 性能分数提升：+5-10 分
- HTTP 请求数减少：-4 个（4个 CSS 文件）

---

## 🔗 相关资源

- [@nuxt/icon 文档](https://github.com/nuxt/icon)
- [Iconify 图标搜索](https://icon-sets.iconify.design/)
- [kun-galgame-forum 源码](https://github.com/KUN1007/kun-galgame-nuxt3)
- [Nuxt Issue #26565](https://github.com/nuxt/nuxt/issues/26565)

---

## ✅ 总结

Charlotte 项目在很多方面已经做得很好（资源恢复机制、chunk 分割、缓存策略），但图标优化是最值得立即实施的改进，可以显著减少 bundle 体积和提升加载性能。
