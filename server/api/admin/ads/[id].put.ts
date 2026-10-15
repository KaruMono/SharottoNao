import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed, markImageAsUnused } from '~/server/utils/image'
import { invalidateAdsCache } from '~/server/utils/ad-cache'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  slot: z.string().min(1).max(50).optional(),
  icon: z.string().max(100).optional().nullable(),
  imageUrl: z.string().min(1).max(500).optional(),
  linkUrl: z.string().min(1).max(500).optional(),
  enabled: z.boolean().optional(),
  showOnMobile: z.boolean().optional(),
  openInNewTab: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) throw createError({ statusCode: 400, message: '无效的ID' })

  const body = await readBody(event)
  const data = schema.parse(body)
  const updateData = {
    ...data,
    ...(data.icon !== undefined ? { icon: data.icon || null } : {}),
  }

  const existing = await prisma.advertisement.findUnique({ where: { id }, select: { imageUrl: true, slot: true } })
  const ad = await prisma.advertisement.update({ where: { id }, data: updateData })

  if (data.imageUrl && data.imageUrl !== existing?.imageUrl) {
    await markImageAsUnused(existing?.imageUrl)
    await markImageAsUsed(data.imageUrl)
  }

  await Promise.all([
    invalidateAdsCache(existing?.slot),
    existing?.slot !== ad.slot ? invalidateAdsCache(ad.slot) : Promise.resolve(),
  ])

  return { success: true, ad }
})
