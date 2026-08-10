import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateGameCaches } from '~/server/utils/redis'

const schema = z.object({
  updates: z.array(z.object({
    id: z.number(),
    title: z.string().min(1).optional(),
    fileSize: z.string().max(20).optional(),
    language: z.enum(['ja', 'en', 'zh-Hans', 'zh-Hant']).optional().nullable(),
    isMachineTranslated: z.boolean().optional(),
  })),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const { updates } = schema.parse(body)

  let updated = 0
  const errors: string[] = []
  const changedGameIds = new Set<number>()

  for (const item of updates) {
    try {
      const data: Record<string, unknown> = {}
      if (item.title !== undefined) data.title = item.title
      if (item.fileSize !== undefined) data.fileSize = item.fileSize
      if (item.language !== undefined) data.language = item.language
      if (item.isMachineTranslated !== undefined) data.isMachineTranslated = item.isMachineTranslated

      if (Object.keys(data).length > 0) {
        const resource = await prisma.resource.update({
          where: { id: item.id },
          data,
          select: { gameId: true },
        })
        changedGameIds.add(resource.gameId)
        updated++
      }
    } catch (err: any) {
      errors.push(`资源 #${item.id}: ${err.message}`)
    }
  }

  await Promise.all([...changedGameIds].map(gameId => invalidateGameCaches(gameId)))

  return { updated, errors }
})
