import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const data = schema.parse(body)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的ID',
    })
  }

  // 如果修改名称，检查是否已存在
  if (data.name) {
    const existing = await prisma.resourceType.findFirst({
      where: {
        name: data.name,
        id: { not: id },
      },
    })

    if (existing) {
      throw createError({
        statusCode: 400,
        message: '该资源类型名称已存在',
      })
    }
  }

  const type = await prisma.resourceType.update({
    where: { id },
    data,
  })

  return type
})
