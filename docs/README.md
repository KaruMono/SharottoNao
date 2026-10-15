# Charlotte 优化资源索引

本目录包含从 kun-galgame-forum 项目学习到的 Nuxt 优化指南和工具。

## 📚 文档导航

### 站间集成

- **[SearchGal 搜索 API](./searchgal-api.md)** - 专用密钥、SFW／R18 搜索摘要与接入示例
- **[站间私有资源 API](./private-api.md)** - 原有 VNDB ID 完整资源查询

### 🚀 快速开始
- **[快速开始：图标优化](./quick-start-icon-migration.md)** - 30分钟快速实施指南（推荐从这里开始）

### 📖 详细指南
- **[Nuxt 优化指南](./nuxt-optimization-guide.md)** - 完整的优化方案和技术细节
- **[图标迁移检查清单](./icon-migration-checklist.md)** - 详细的迁移步骤和注意事项
- **[优化总结](./optimization-summary.md)** - 所有优化点的汇总和对比分析

## 🛠️ 工具和脚本

### 已创建的文件
```
Charlotte/
├── scripts/
│   └── generate-icon-list.mjs        # 自动扫描图标使用情况
├── lib/
│   └── icon.ts                       # 图标列表存储（自动生成）
├── components/
│   └── FaIcon.vue                    # FontAwesome 兼容层
└── docs/
    ├── quick-start-icon-migration.md # 快速开始指南
    ├── nuxt-optimization-guide.md    # 完整优化指南
    ├── icon-migration-checklist.md   # 迁移检查清单
    ├── optimization-summary.md       # 优化总结
    └── README.md                     # 本文件
```

## 🎯 优化优先级

### 🔴 高优先级（立即实施）
1. **图标优化** - 迁移到 @nuxt/icon
   - 节省：~200KB (gzip)
   - 工作量：1-2天
   - 文档：[快速开始指南](./quick-start-icon-migration.md)

### 🟡 中优先级（本月内）
2. **添加 sitemap 模块** - 改善 SEO
3. **实验性功能优化** - scanPageMeta + typescriptPlugin
4. **Chunk 分割策略改进** - 优化 Vite 配置

### 🟢 低优先级（观望）
5. **Tailwind v4 升级** - 等待稳定版
6. **Monorepo 架构** - 仅在需要时考虑

## 📊 预期收益

### 图标优化（实施后）
- 减少首屏加载：~200KB (gzip)
- 减少 HTTP 请求：-4 个
- 提升 Lighthouse 分数：+5~10 分
- 减少渲染阻塞资源：-4 个

### 总体优化（全部实施后）
- 首屏加载时间：⬇️ 1-2s (3G 网络)
- Bundle 体积：⬇️ ~20-30%
- Lighthouse 分数：⬆️ +10-15 分

## 🚀 快速命令

```bash
# 1. 安装依赖
npm install @nuxt/icon
npm install -D @iconify-json/fa6-solid @iconify-json/fa6-regular @iconify-json/fa6-brands

# 2. 添加 script（手动编辑 package.json）
# "icons": "node scripts/generate-icon-list.mjs"

# 3. 扫描图标
npm run icons

# 4. 更新配置（参考快速开始指南）

# 5. 测试
npm run dev

# 6. 构建
npm run build
npm run preview
```

## 📈 实施路线图

### 第一阶段：图标优化（1-2天）
- [ ] Day 1 上午：安装依赖和配置
- [ ] Day 1 下午：批量替换代码
- [ ] Day 2 上午：测试和修复问题
- [ ] Day 2 下午：清理和验证

### 第二阶段：其他优化（1周）
- [ ] 添加 sitemap 模块
- [ ] 配置实验性功能
- [ ] 优化 chunk 分割
- [ ] 性能测试和调优

### 第三阶段：长期优化（按需）
- [ ] 监控 Tailwind v4 稳定性
- [ ] 评估 Monorepo 必要性
- [ ] 持续性能优化

## 🔍 学习来源

### kun-galgame-forum 项目分析
- **项目地址**：`D:\MyProject\Charlotte\kun-galgame-forum-master`
- **Nuxt 版本**：4.4.7
- **关键特性**：
  - 使用 @nuxt/icon v2 + 自动扫描
  - Monorepo 架构（pnpm workspaces）
  - Tailwind CSS v4
  - 完善的 sitemap 配置
  - 实验性功能启用

### GitHub Issue 参考
- **Issue #26565**：动态模块导入失败问题
- **Charlotte 的解决方案**：资源恢复机制（已实现）

## ✅ Charlotte 的优势

Charlotte 在以下方面已经做得比 kun-galgame 更好：

1. ✅ **资源恢复机制** - 自动处理 chunk 加载失败
2. ✅ **更完善的缓存策略** - routeRules 配置更全面
3. ✅ **Redis 支持** - 可选的分布式缓存
4. ✅ **S3 存储支持** - 云存储集成
5. ✅ **2FA 认证** - 更安全的用户认证

## 🆘 需要帮助？

### 常见问题
- 图标不显示？查看 [快速开始指南 - Q&A](./quick-start-icon-migration.md#常见问题快速解答)
- 迁移遇到问题？查看 [迁移检查清单](./icon-migration-checklist.md#常见问题)
- 想了解技术细节？查看 [完整优化指南](./nuxt-optimization-guide.md)

### 有用的资源
- [Nuxt Icon 官方文档](https://nuxt.com/modules/icon)
- [Iconify 图标搜索](https://icon-sets.iconify.design/)
- [Nuxt Performance 最佳实践](https://nuxt.com/docs/guide/concepts/rendering#performance)

## 📝 更新日志

- **2026-08-25**：创建所有优化文档和工具
  - 添加图标扫描脚本
  - 添加 FaIcon 兼容层
  - 完成优化指南文档
  - 创建快速开始指南

---

**开始优化吧！** 🚀 建议从 [快速开始指南](./quick-start-icon-migration.md) 开始。
