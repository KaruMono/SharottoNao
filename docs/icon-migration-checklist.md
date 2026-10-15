# 图标迁移检查清单

## 📋 迁移步骤

### 阶段 1: 准备工作
- [ ] 安装 @nuxt/icon 依赖
  ```bash
  npm install @nuxt/icon
  ```
- [ ] 安装 FontAwesome iconify 包
  ```bash
  npm install -D @iconify-json/fa6-solid @iconify-json/fa6-regular @iconify-json/fa6-brands
  ```
- [ ] 确认 scripts/generate-icon-list.mjs 已创建
- [ ] 确认 lib/icon.ts 已创建
- [ ] 确认 components/FaIcon.vue 已创建

### 阶段 2: 配置更新
- [ ] 在 package.json 添加 `"icons": "node scripts/generate-icon-list.mjs"` script
- [ ] 运行 `npm run icons` 生成图标列表
- [ ] 更新 nuxt.config.ts 添加图标配置：
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
        collections: ICON_COLLECTIONS
      },
      clientBundle: {
        icons: ICON_NAMES,
        scan: false
      }
    },
  })
  ```

### 阶段 3: 代码迁移（渐进式）

#### 方案 A: 使用 FaIcon 兼容层（快速）
保持现有代码不变，只需确保 FaIcon 组件正常工作：
```vue
<!-- 旧代码保持不变 -->
<i class="fa-solid fa-heart"></i>

<!-- 或者批量替换为 -->
<FaIcon icon="fa-solid fa-heart" />
```

#### 方案 B: 完全迁移到 Icon 组件（推荐）
逐步替换为原生 Icon 组件：
```vue
<!-- 之前 -->
<i class="fa-solid fa-heart"></i>

<!-- 之后 -->
<Icon name="fa6-solid:heart" />
```

查找替换正则表达式：
```regex
查找: <i class="(fa-(?:solid|regular|brands)) fa-([a-z0-9-]+)"[^>]*></i>
替换: <Icon name="fa6-$1:$2" />
```

### 阶段 4: 清理
- [ ] 确认所有图标正常显示
- [ ] 从 nuxt.config.ts 移除 FontAwesome CSS 导入：
  ```typescript
  // 删除这些行
  css: [
    '@fortawesome/fontawesome-free/css/fontawesome.min.css',
    '@fortawesome/fontawesome-free/css/solid.min.css',
    '@fortawesome/fontawesome-free/css/regular.min.css',
    '@fortawesome/fontawesome-free/css/brands.min.css',
  ],
  ```
- [ ] 卸载 FontAwesome 依赖
  ```bash
  npm uninstall @fortawesome/fontawesome-free
  ```
- [ ] 运行构建测试
  ```bash
  npm run build
  npm run preview
  ```
- [ ] 检查 bundle 大小变化
  ```bash
  # 查看 .output/public/_nuxt/ 目录大小
  du -sh .output/public/_nuxt/
  ```

### 阶段 5: 验证
- [ ] 首页图标显示正常
- [ ] 深色/浅色模式切换图标正常
- [ ] 所有页面图标无缺失
- [ ] Lighthouse 性能分数提升
- [ ] 网络面板确认不再加载 FA CSS 文件

## 📊 预期收益

### 文件大小对比
```
之前（FontAwesome CSS）:
- fontawesome.min.css: ~70KB
- solid.min.css: ~700KB
- regular.min.css: ~30KB
- brands.min.css: ~100KB
总计: ~900KB (未压缩) / ~250KB (gzip)

之后（@nuxt/icon）:
- 图标内联在 JS bundle: ~20-50KB (仅使用的图标)
节省: ~200KB (gzip) / ~850KB (未压缩)
```

### 性能提升
- 首屏加载时间: -0.5~1s (3G 网络)
- HTTP 请求数: -4 个
- Lighthouse 性能分数: +5~10 分
- 渲染阻塞资源: -4 个

## 🔧 常见问题

### Q: 如何添加新图标？
A: 在代码中直接使用 `<Icon name="fa6-solid:new-icon" />`，然后运行 `npm run icons` 重新扫描。

### Q: 动态图标名怎么办？
A: 将它们添加到 `scripts/generate-icon-list.mjs` 的 `MANUAL_ICONS` 数组中。

### Q: 如何查找可用的图标？
A: 访问 https://icon-sets.iconify.design/fa6-solid/ 搜索图标。

### Q: 图标颜色怎么控制？
A: SVG 图标继承 CSS 的 `color` 属性：
```vue
<Icon name="fa6-solid:heart" class="text-red-500" />
<Icon name="fa6-solid:star" style="color: gold" />
```

### Q: 图标大小怎么设置？
A: 使用 `size` 属性或 CSS：
```vue
<Icon name="fa6-solid:heart" size="24" />
<Icon name="fa6-solid:star" class="text-2xl" />
```

## 🎯 回滚计划

如果迁移出现问题，可以快速回滚：

1. 恢复 nuxt.config.ts 中的 FontAwesome CSS 导入
2. 重新安装 `@fortawesome/fontawesome-free`
3. 移除 `@nuxt/icon` 模块配置
4. 运行 `npm run build`

## 📝 注意事项

- ⚠️ FontAwesome v6 在 Iconify 中的前缀是 `fa6-`，不是 `fa-`
- ⚠️ 某些 FA 专业版图标在免费版 iconify 包中不可用
- ⚠️ 动态加载的图标需要预先添加到 MANUAL_ICONS 列表
- ⚠️ 迁移期间保持 FaIcon 兼容层，方便渐进式替换

## 🔗 相关文档

- [Nuxt Icon 文档](https://nuxt.com/modules/icon)
- [Iconify 图标搜索](https://icon-sets.iconify.design/)
- [FontAwesome 6 Iconify 集合](https://icon-sets.iconify.design/fa6-solid/)
