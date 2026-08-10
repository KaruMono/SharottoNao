import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的会社ID',
    })
  }

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameOriginal: true,
      nameIndex: true,
      aliases: true,
      logo: true,
      description: true,
      foundedYear: true,
      website: true,
      parentId: true,
      parent: {
        select: { id: true, name: true },
      },
      createdAt: true,
      updatedAt: true,
      creatorId: true,
      creator: {
        select: { id: true, username: true },
      },
      _count: {
        select: {
          games: { where: { game: { deletedAt: null } } },
        },
      },
    },
  })

  if (!company) {
    throw createError({
      statusCode: 404,
      message: '会社不存在',
    })
  }

  return {
    ...company,
    gamesCount: company._count.games,
  }
})
