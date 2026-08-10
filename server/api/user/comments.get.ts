import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

// 获取显示标题
function getDisplayTitle(game: { titleEn: string | null; titleJa: string | null; titleZhHans: string | null; titleZhHant: string | null }): string {
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || ''
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const comments = await prisma.comment.findMany({
    where: { userId: user.id, deletedAt: null, game: { deletedAt: null } },
    include: {
      game: {
        select: {
          id: true,
          titleEn: true,
          titleJa: true,
          titleZhHans: true,
          titleZhHant: true,
          coverImage: true,
        },
      },
      _count: {
        select: { likes: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return comments.map(comment => ({
    ...comment,
    likeCount: comment._count.likes,
    game: {
      ...comment.game,
      title: getDisplayTitle(comment.game),
    },
  }))
})
