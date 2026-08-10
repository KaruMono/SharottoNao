import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  mode: z.enum(['SFW', 'NSFW', 'ALL']),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { mode } = schema.parse(body)

  await prisma.user.update({
    where: { id: user.id },
    data: { nsfwMode: mode },
  })

  return { success: true, nsfwMode: mode }
})
