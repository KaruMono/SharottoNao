import { ZodError } from 'zod'

/**
 * 全局错误处理中间件
 * 统一处理 Zod 校验错误等，返回友好的错误格式
 */
export default defineEventHandler((event) => {
  // 使用 onError hook 来统一处理错误
  event.node.res.on('error', () => {
    // 静默处理响应流错误
  })
})

/**
 * Zod 错误格式化工具（供 API 端点使用）
 */
export function formatZodError(error: ZodError): string {
  return error.errors
    .map(e => {
      const path = e.path.join('.')
      return path ? `${path}: ${e.message}` : e.message
    })
    .join('; ')
}

/**
 * 安全解析请求体，自动处理 Zod 错误
 */
export async function safeParseBody<T>(
  event: any,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  try {
    const body = await readBody(event)
    return schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw createError({
        statusCode: 400,
        message: formatZodError(error),
      })
    }
    throw error
  }
}

/**
 * 安全解析查询参数，自动处理 Zod 错误
 */
export function safeParseQuery<T>(
  event: any,
  schema: { parse: (data: unknown) => T }
): T {
  try {
    const query = getQuery(event)
    return schema.parse(query)
  } catch (error) {
    if (error instanceof ZodError) {
      throw createError({
        statusCode: 400,
        message: formatZodError(error),
      })
    }
    throw error
  }
}
