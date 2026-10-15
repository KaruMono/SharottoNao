import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

const schema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) })

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const { ids } = schema.parse(await readBody(event))
  const result = await prisma.tag.updateMany({
    where: { id: { in: [...new Set(ids)] } },
    data: { archivedAt: null },
  })
  await Promise.all([invalidateGameCaches(), invalidateCache('game:*'), invalidateCache('tags:*')])
  return { success: true, restoredCount: result.count }
})
