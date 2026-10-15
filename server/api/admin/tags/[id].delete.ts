import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的标签ID',
    })
  }

  const tag = await prisma.tag.findUnique({
    where: { id },
    include: { _count: { select: { games: true, vndbTags: true } } },
  })

  if (!tag) throw createError({ statusCode: 404, message: '标签不存在' })
  if (tag.isSystem) throw createError({ statusCode: 400, message: '系统标签不能归档' })

  await prisma.tag.update({ where: { id }, data: { archivedAt: new Date() } })
  await Promise.all([invalidateGameCaches(), invalidateCache('game:*'), invalidateCache('tags:*')])

  return {
    success: true,
    message: tag._count.games || tag._count.vndbTags ? '标签已归档，现有关联已保留' : '标签已归档',
  }
})
