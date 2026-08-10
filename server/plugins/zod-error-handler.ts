import { ZodError } from 'zod'

/**
 * 全局 ZodError 拦截器
 * 将未捕获的 ZodError 转为 400
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    // 过期静态资源请求（构建后旧 hash 文件不存在）转为 404，避免 500 刷屏日志
    const cause = (error as any).cause
    if (
      cause?.code === 'ENOENT' &&
      event?.path &&
      /^\/_nuxt\//.test(event.path)
    ) {
      ;(error as any).statusCode = 404
      ;(error as any).message = 'Not Found'
      ;(error as any).unhandled = false
      return
    }

    if (!(cause instanceof ZodError)) return

    const zodError = cause as ZodError
    const message = zodError.errors
      .map((e) => {
        const path = e.path.join('.')
        return path ? `${path}: ${e.message}` : e.message
      })
      .join('; ')

    ;(error as any).statusCode = 400
    ;(error as any).message = message
    ;(error as any).unhandled = false
  })
})
