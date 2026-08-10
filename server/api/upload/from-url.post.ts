import { requireAuth } from '~/server/utils/auth'
import { uploadImage } from '~/server/utils/storage'
import prisma from '~/server/utils/prisma'
import { checkUploadRateLimit } from '~/server/utils/rate-limit'

const maxRemoteImageSize = 10 * 1024 * 1024

async function readLimitedResponse(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > maxBytes) {
    throw createError({ statusCode: 400, message: '图片大小超过 10MB' })
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxBytes) {
      throw createError({ statusCode: 400, message: '图片大小超过 10MB' })
    }
    return buffer
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      throw createError({ statusCode: 400, message: '图片大小超过 10MB' })
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks)
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await checkUploadRateLimit(event, user.id)

  const body = await readBody(event)
  const { url, folder = 'covers' } = body || {}

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: '请提供图片 URL' })
  }

  const allowedFolders = ['covers', 'images', 'screenshots', 'avatars']
  if (!allowedFolders.includes(folder)) {
    throw createError({ statusCode: 400, message: '不支持的上传目录' })
  }

  // 只允许从可信域名下载
  const allowedDomains = ['t.vndb.org', 's.vndb.org', 'vndb.org']
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    throw createError({ statusCode: 400, message: '无效的 URL' })
  }

  if (!allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
    throw createError({ statusCode: 400, message: '不支持从该域名下载图片' })
  }

  try {
    // 下载图片
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) {
      throw createError({ statusCode: 502, message: '下载图片失败' })
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      throw createError({ statusCode: 400, message: '目标 URL 不是图片' })
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // 限制大小 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      throw createError({ statusCode: 400, message: '图片大小超过 10MB' })
    }

    // 使用现有的 uploadImage 处理并保存
    const result = await uploadImage(buffer, 'vndb-cover.jpg', { folder })

    // 记录到数据库
    const image = await prisma.image.create({
      data: {
        filename: result.filename,
        originalName: `vndb-cover-${Date.now()}.webp`,
        path: result.path,
        url: result.url,
        size: result.size,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
      },
    })

    return {
      id: image.id,
      url: result.url,
      width: result.width,
      height: result.height,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('从 URL 下载图片失败:', error)
    throw createError({ statusCode: 500, message: '下载图片失败，请稍后重试' })
  }
})
