import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      companies: {
        include: {
          company: {
            select: { id: true, name: true, nameOriginal: true },
          },
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      staff: {
        include: {
          staff: true,
        },
      },
      screenshots: {
        orderBy: { sortOrder: 'asc' },
      },
      series: {
        select: { id: true, name: true, nameOriginal: true },
      },
    },
  })

  if (!game) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  return {
    ...game,
    seriesId: game.seriesId,
    series: game.series,
    companies: game.companies.map(gc => ({
      companyId: gc.companyId,
      role: gc.role,
      company: gc.company,
    })),
    tags: game.tags.map(t => ({
      id: t.tag.id,
      tagId: t.tagId,
      name: t.tag.name,
    })),
    staff: game.staff.map(s => ({
      role: s.role,
      staffId: s.staffId,
      staff: s.staff,
      characterName: s.characterName,
    })),
  }
})
