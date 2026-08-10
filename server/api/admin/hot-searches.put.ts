import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  items: z.array(z.string().max(50)).max(20),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const { items } = schema.parse(body)

  await prisma.siteConfig.upsert({
    where: { key: 'hot_searches' },
    create: {
      key: 'hot_searches',
      value: JSON.stringify(items),
    },
    update: {
      value: JSON.stringify(items),
    },
  })

  return { success: true }
})
