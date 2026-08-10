import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(100).optional().nullable(),
  domains: z.array(z.string().min(1).max(255)).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  if (data.name) {
    const existing = await prisma.netDiskType.findFirst({
      where: { name: data.name, id: { not: id } },
    })
    if (existing) {
      throw createError({ statusCode: 400, message: '该网盘类型名称已存在' })
    }
  }

  return prisma.netDiskType.update({
    where: { id },
    data: {
      ...data,
      ...(data.icon !== undefined ? { icon: data.icon || null } : {}),
      ...(data.domains !== undefined ? { domains: data.domains.map(domain => domain.trim().toLowerCase()).filter(Boolean) } : {}),
    },
  })
})