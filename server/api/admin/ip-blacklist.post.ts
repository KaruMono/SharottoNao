import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  ip: z.string().min(1, 'IP 不能为空').max(50),
  reason: z.string().max(255).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const { ip, reason } = schema.parse(body)

  const entry = await prisma.ipBlacklist.upsert({
    where: { ip },
    create: { ip, reason: reason || null, createdBy: admin.id },
    update: { reason: reason || undefined },
  })

  return { success: true, entry }
})
