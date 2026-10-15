import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的标签 ID' })
  }

  const tag = await prisma.tag.findUnique({ where: { id }, select: { id: true } })
  if (!tag) throw createError({ statusCode: 404, message: '标签不存在' })

  await prisma.tag.update({ where: { id }, data: { archivedAt: null } })
  await Promise.all([invalidateGameCaches(), invalidateCache('game:*'), invalidateCache('tags:*')])
  return { success: true, message: '标签已恢复' }
})
