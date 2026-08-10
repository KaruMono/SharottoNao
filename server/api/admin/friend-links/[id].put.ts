import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed, markImageAsUnused } from '~/server/utils/image'

const schema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(500),
  logo: z.string().max(500).optional().nullable(),
  description: z.string().max(255).optional().nullable(),
  sortOrder: z.number().default(0),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的ID',
    })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  const old = await prisma.friendLink.findUnique({ where: { id } })
  if (!old) {
    throw createError({
      statusCode: 404,
      message: '友情链接不存在',
    })
  }

  const link = await prisma.friendLink.update({
    where: { id },
    data,
  })

  // Logo 变更时更新图片使用状态
  if (old.logo !== data.logo) {
    if (old.logo) await markImageAsUnused(old.logo)
    if (data.logo) await markImageAsUsed(data.logo)
  }

  return link
})
