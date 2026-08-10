import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { getDisplayTitle } from '~/server/utils/game'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  const [editRequests, resources] = await Promise.all([
    // 获取用户的条目修改请求
    prisma.gameEditRequest.findMany({
      where: { userId: user.id },
      include: {
        game: {
          select: {
            id: true,
            titleEn: true,
            titleJa: true,
            titleZhHans: true,
            titleZhHant: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // 获取用户上传的资源
    prisma.resource.findMany({
      where: { 
        uploaderId: user.id,
        deletedAt: null,
      },
      include: {
        game: {
          select: {
            id: true,
            titleEn: true,
            titleJa: true,
            titleZhHans: true,
            titleZhHant: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])
  
  return {
    editRequests: editRequests.map(r => ({
      ...r,
      game: r.game ? { ...r.game, title: getDisplayTitle(r.game) } : null,
    })),
    resources: resources.map(r => ({
      ...r,
      game: r.game ? { ...r.game, title: getDisplayTitle(r.game) } : null,
    })),
  }
})
