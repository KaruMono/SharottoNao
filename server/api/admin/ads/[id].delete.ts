import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUnused } from '~/server/utils/image'
import { invalidateAdsCache } from '~/server/utils/ad-cache'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) throw createError({ statusCode: 400, message: '无效的ID' })

  const ad = await prisma.advertisement.findUnique({ where: { id }, select: { imageUrl: true, slot: true } })
  await prisma.advertisement.delete({ where: { id } })
  await markImageAsUnused(ad?.imageUrl)
  await invalidateAdsCache(ad?.slot)
  return { success: true }
})
