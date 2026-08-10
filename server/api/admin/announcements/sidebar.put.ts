import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  title: z.string().max(100).optional(),
  content: z.string().max(500).optional(),
  isActive: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const data = schema.parse(body)

  await prisma.siteConfig.upsert({
    where: { key: 'announcement_sidebar' },
    create: {
      key: 'announcement_sidebar',
      value: JSON.stringify(data),
    },
    update: {
      value: JSON.stringify(data),
    },
  })

  return { success: true }
})
