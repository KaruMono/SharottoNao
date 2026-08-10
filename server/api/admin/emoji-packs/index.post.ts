import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const body = await readBody(event)
  const data = schema.parse(body)

  const pack = await prisma.emojiPack.create({
    data,
  })

  return pack
})
