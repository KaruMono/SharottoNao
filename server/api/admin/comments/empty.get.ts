import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { computeDeletableEmptyCommentIds } from '~/server/utils/empty-comments'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // 拉取所有未软删除的评论，交给统一逻辑计算可清理的空壳评论
  const comments = await prisma.comment.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      content: true,
      parentId: true,
      createdAt: true,
      gameId: true,
      user: { select: { id: true, username: true } },
      game: {
        select: { id: true, titleZhHans: true, titleZhHant: true, titleJa: true, titleEn: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const deletableIds = computeDeletableEmptyCommentIds(comments)

  const items = comments
    .filter(c => deletableIds.has(c.id))
    .map(c => ({
      id: c.id,
      isReply: c.parentId != null,
      createdAt: c.createdAt,
      username: c.user?.username || '未知用户',
      gameId: c.game.id,
      gameTitle: c.game.titleZhHans || c.game.titleZhHant || c.game.titleJa || c.game.titleEn || `#${c.game.id}`,
    }))

  return {
    total: items.length,
    comments: items,
  }
})
