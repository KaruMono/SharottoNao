import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().default(0),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  // 检查名称是否已存在
  const existing = await prisma.resourceType.findUnique({
    where: { name: data.name },
  })

  if (existing) {
    throw createError({
      statusCode: 400,
      message: '该资源类型名称已存在',
    })
  }

  const type = await prisma.resourceType.create({
    data,
  })

  return type
})
