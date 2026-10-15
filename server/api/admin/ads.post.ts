import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed } from '~/server/utils/image'
import { invalidateAdsCache } from '~/server/utils/ad-cache'

const schema = z.object({
  name: z.string().min(1).max(100),
  slot: z.string().min(1).max(50),
  icon: z.string().max(100).optional().nullable(),
  imageUrl: z.string().min(1).max(500),
  linkUrl: z.string().min(1).max(500),
  enabled: z.boolean().default(true),
  showOnMobile: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const ad = await prisma.advertisement.create({
    data: {
      ...data,
      icon: data.icon || null,
    } as any,
  })
  await markImageAsUsed(ad.imageUrl)
  await invalidateAdsCache(ad.slot)
  return { success: true, ad }
})
