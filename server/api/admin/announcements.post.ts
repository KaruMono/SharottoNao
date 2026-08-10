import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  content: z.string().min(1).max(1000),
  isActive: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const announcement = await prisma.announcement.create({
    data,
  })

  return announcement
})
