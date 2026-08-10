import { defineNuxtModule } from '@nuxt/kit'
import { resolve } from 'path'

/**
 * 开发模式下忽略 uploads 目录的文件变化
 * 防止图片上传时触发 Vite HMR / Nitro 服务端重载
 * 
 * 生产环境完全不受影响（没有 HMR/watcher）
 */
export default defineNuxtModule({
  meta: {
    name: 'ignore-uploads',
  },
  setup(_options, nuxt) {
    // 只在开发模式下生效
    if (!nuxt.options.dev) return

    const uploadsDir = resolve(nuxt.options.rootDir, 'uploads')

    // 1. 让 Nitro 的 watcher 忽略 uploads
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.watchOptions = nitroConfig.watchOptions || {}
      nitroConfig.watchOptions.ignored = nitroConfig.watchOptions.ignored || []
      if (Array.isArray(nitroConfig.watchOptions.ignored)) {
        nitroConfig.watchOptions.ignored.push(uploadsDir, '**/uploads/**')
      }
    })

    // 2. 让 Vite 的 watcher 忽略 uploads  
    nuxt.hook('vite:extendConfig', (viteConfig) => {
      const server = (viteConfig as { server?: { watch?: { ignored?: string[] } } }).server ?? {}
      const watch = server.watch ?? {}
      const ignored = watch.ignored ?? []
      ignored.push(uploadsDir, '**/uploads/**')
      ;(viteConfig as { server?: { watch?: { ignored?: string[] } } }).server = {
        ...server,
        watch: {
          ...watch,
          ignored,
        },
      }
    })

    // 3. 让 Nuxt builder 自身的 watcher 忽略 uploads
    nuxt.hook('builder:watch', function (this: any, event: string, path: string) {
      if (path.includes('uploads')) {
        // 返回 false 或阻止进一步处理 - 实际上这个 hook 无法阻止
        // 但配合上面的 nitro 和 vite 配置应该能解决
      }
    })

    // 4. 将 uploads 加入 Nuxt 的 ignore 列表
    nuxt.options.ignore = nuxt.options.ignore || []
    nuxt.options.ignore.push('uploads/**', '**/uploads/**')

    console.log('[ignore-uploads] 开发模式已配置忽略 uploads 目录')
  },
})
