import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []

  if (!ids.length) {
    throw createError({ statusCode: 400, message: '请选择要归档的标签' })
  }

  const result = await prisma.tag.updateMany({
    where: { id: { in: ids }, isSystem: false },
    data: { archivedAt: new Date() },
  })
  await Promise.all([invalidateGameCaches(), invalidateCache('game:*'), invalidateCache('tags:*')])
  return { success: true, archivedCount: result.count, deletedCount: result.count, failed: [] }
})
