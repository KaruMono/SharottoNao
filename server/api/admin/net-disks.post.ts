import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(100).optional().nullable(),
  domains: z.array(z.string().min(1).max(255)).default([]),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const existing = await prisma.netDiskType.findUnique({ where: { name: data.name } })
  if (existing) {
    throw createError({ statusCode: 400, message: '该网盘类型名称已存在' })
  }

  return prisma.netDiskType.create({
    data: {
      ...data,
      icon: data.icon || null,
      domains: data.domains.map(domain => domain.trim().toLowerCase()).filter(Boolean),
    },
  })
})