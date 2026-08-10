import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getDisplayDescription, getDisplayTitle } from '~/server/utils/game'
import { requirePrivateApiKey } from '~/server/utils/private-api'

const vndbIdSchema = z.string().regex(/^v\d+$/i)

export default defineEventHandler(async (event) => {
  requirePrivateApiKey(event)
  setHeader(event, 'cache-control', 'no-store')

  const rawVndbId = getRouterParam(event, 'vndbId') || ''
  const parsed = vndbIdSchema.safeParse(rawVndbId)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'VNDB ID 格式错误，应为 v 开头加数字，如 v27448',
    })
  }

  const vndbId = rawVndbId.toLowerCase()
  const game = await prisma.game.findFirst({
    where: { vndbId, deletedAt: null },
    include: {
      series: {
        select: { id: true, name: true, nameOriginal: true, description: true },
      },
      creator: {
        select: { id: true, username: true, avatar: true },
      },
      companies: {
        include: {
          company: true,
        },
      },
      tags: {
        include: { tag: true },
      },
      staff: {
        include: { staff: true },
      },
      screenshots: {
        orderBy: { sortOrder: 'asc' },
      },
      resources: {
        where: { deletedAt: null },
        include: {
          type: true,
          netDiskType: true,
          uploader: {
            select: { id: true, username: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '未找到对应的游戏' })
  }

  return {
    game: {
      ...game,
      title: getDisplayTitle(game),
      description: getDisplayDescription(game),
      companies: game.companies.map(({ company, role }) => ({
        ...company,
        role,
      })),
      tags: game.tags.map(({ tag }) => tag),
      staff: game.staff.map(({ staff, role, characterName }) => ({
        ...staff,
        role,
        characterName,
      })),
    },
    meta: {
      vndbId,
      resourceCount: game.resources.length,
      generatedAt: new Date().toISOString(),
    },
  }
})
