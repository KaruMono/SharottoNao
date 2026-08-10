import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

const schema = z.object({
  ids: z.array(z.number()).min(1),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const { ids } = schema.parse(body)

  const result = await prisma.game.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  invalidateGameCaches().catch(() => {})
  invalidateCache('user:*').catch(() => {})

  return { 
    success: true, 
    message: `已删除 ${result.count} 个游戏`,
    count: result.count,
  }
})
