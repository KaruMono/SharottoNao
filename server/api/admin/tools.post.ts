import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed } from '~/server/utils/image'
import { safeParseBody } from '~/server/middleware/error-handler'
import { invalidateCache } from '~/server/utils/redis'

const emptyToNull = z.union([z.string(), z.null()]).transform(v => (v === null || v.trim() === '') ? null : v)

const schema = z.object({
  name: z.string().min(1).max(200),
  description: emptyToNull.pipe(z.string().optional().nullable()).optional(),
  icon: emptyToNull.pipe(z.string().max(500).optional().nullable()).optional(),
  version: emptyToNull.pipe(z.string().max(50).optional().nullable()).optional(),
  author: emptyToNull.pipe(z.string().max(100).optional().nullable()).optional(),
  downloadUrl: z.string().url('请输入有效的下载链接').max(1000),
  githubUrl: emptyToNull.pipe(z.string().url('请输入有效的 GitHub 链接').max(500).nullable()).optional(),
  categoryId: z.number().int().positive(),
  sortOrder: z.number().default(0),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const data = await safeParseBody(event, schema)

  const category = await prisma.toolCategory.findUnique({ where: { id: data.categoryId } })
  if (!category) {
    throw createError({ statusCode: 400, message: '分类不存在' })
  }

  const tool = await prisma.tool.create({ data: data as any })

  if (data.icon) {
    await markImageAsUsed(data.icon)
  }

  await invalidateCache('tools:*')

  return tool
})
