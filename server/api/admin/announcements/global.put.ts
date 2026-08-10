import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(2000).optional(),
  buttonText: z.string().max(50).default('我知道了'),
  frequency: z.enum(['once', 'daily', 'always']).default('once'),
  isActive: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const data = schema.parse(body)

  await prisma.siteConfig.upsert({
    where: { key: 'announcement_global' },
    create: {
      key: 'announcement_global',
      value: JSON.stringify(data),
    },
    update: {
      value: JSON.stringify(data),
    },
  })

  return { success: true }
})
