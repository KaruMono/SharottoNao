import type { H3Event } from 'h3'
import { z } from 'zod'
import { getSetting } from '~/server/utils/settings'
import { syncPublishedResource } from '~/server/utils/resource-sync'

const languageSchema = z.enum(['ja', 'en', 'zh-Hans', 'zh-Hant'])

const schema = z.object({
  vndbId: z.string().regex(/^v\d+$/i),
  title: z.string().min(1).max(255),
  url: z.string().url().max(1000),
  extractCode: z.string().max(50).nullable().optional(),
  unzipPassword: z.string().max(100).nullable().optional(),
  fileSize: z.string().min(1).max(20).regex(/^[\d.]+[MG]$/i, '文件大小必须以 M 或 G 结尾，如 1.2G、800M'),
  typeId: z.number().int().positive(),
  remark: z.string().max(500).nullable().optional(),
  language: languageSchema,
  isMachineTranslated: z.boolean().optional().default(false),
}).strict()

function getBearerToken(event: H3Event): string | null {
  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}

export default defineEventHandler(async (event) => {
  const expectedToken = await getSetting('resource_sync_token')
  if (!expectedToken) {
    throw createError({ statusCode: 503, message: '资源同步 API 尚未配置发布密钥' })
  }

  const token = getBearerToken(event)
  if (!token || token !== expectedToken) {
    throw createError({ statusCode: 401, message: '资源同步密钥无效' })
  }

  const body = await readBody(event)
  const payload = schema.parse(body)
  const uploaderId = parseInt(await getSetting('resource_sync_uploader_id') || '') || undefined

  return syncPublishedResource(payload, { uploaderId })
})