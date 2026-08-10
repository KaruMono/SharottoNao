import { z } from 'zod'

const schema = z.object({
  vndbId: z.string().regex(/^v\d+$/i),
  title: z.string().min(1).max(255),
  url: z.string().url().max(1000),
  extractCode: z.string().max(50).nullable().optional(),
  unzipPassword: z.string().max(100).nullable().optional(),
  fileSize: z.string().min(1).max(20).regex(/^[\d.]+[MG]$/i),
  typeId: z.number().int().positive(),
  remark: z.string().max(500).nullable().optional(),
  language: z.enum(['ja', 'en', 'zh-Hans', 'zh-Hant']),
  isMachineTranslated: z.boolean().optional().default(false),
}).strict()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const payload = schema.parse(body)

  return {
    ok: true,
    resourceId: 'test-resource-id',
    message: '测试 API 已收到受限资源同步请求',
    received: payload,
  }
})