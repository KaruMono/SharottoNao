import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'slug 只能包含小写字母、数字和连字符'),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().default(0),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const existing = await prisma.toolCategory.findFirst({
    where: { OR: [{ name: data.name }, { slug: data.slug }] },
  })
  if (existing) {
    throw createError({ statusCode: 400, message: '分类名称或 slug 已存在' })
  }

  const category = await prisma.toolCategory.create({ data })
  return category
})
