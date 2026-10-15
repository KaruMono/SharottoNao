import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed } from '~/server/utils/image'

const schema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(500),
  logo: z.string().max(500).optional(),
  description: z.string().max(255).optional(),
  sortOrder: z.number().default(0),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const link = await prisma.friendLink.create({
    data: data as any,
  })

  // 标记Logo图片为已使用
  if (data.logo) {
    await markImageAsUsed(data.logo)
  }

  return link
})
