import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import type { MessageType } from '@prisma/client'

const preferenceSchema = z.object({
  COMMENT_REPLY: z.boolean().default(true),
  COMMENT_LIKE: z.boolean().default(true),
  MENTION: z.boolean().default(true),
  RESOURCE_APPROVED: z.boolean().default(true),
  RESOURCE_REJECTED: z.boolean().default(true),
  RESOURCE_HEALTH: z.boolean().default(true),
  EDIT_APPROVED: z.boolean().default(true),
  EDIT_REJECTED: z.boolean().default(true),
  FOLLOWING_ACTIVITY: z.boolean().default(true),
  FAVORITE_GAME_UPDATE: z.boolean().default(true),
  SYSTEM: z.boolean().default(true),
})

const schema = z.object({
  preferences: preferenceSchema.partial(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { preferences } = schema.parse(body)

  const entries = Object.entries(preferences) as [MessageType, boolean][]

  await Promise.all(
    entries.map(([messageType, emailEnabled]) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_messageType: { userId: user.id, messageType },
        },
        update: { emailEnabled },
        create: { userId: user.id, messageType, emailEnabled },
      }),
    ),
  )

  return { success: true }
})
