import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { computeDeletableEmptyCommentIds } from '~/server/utils/empty-comments'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '请选择要清理的评论'),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const body = await readBody(event)
  const { ids } = schema.parse(body)

  // 服务端重新计算“可清理集合”，只删除既在请求列表中、又确实可安全清理的评论，
  // 避免前端传入任意 ID 或数据在查询后发生变化导致误删有效评论。
  const comments = await prisma.comment.findMany({
    where: { deletedAt: null },
    select: { id: true, content: true, parentId: true, gameId: true },
  })
  const deletableIds = computeDeletableEmptyCommentIds(comments)

  const requested = new Set(ids)
  const toDelete = comments.filter(c => requested.has(c.id) && deletableIds.has(c.id))
  const deleteIds = toDelete.map(c => c.id)
  const affectedGameIds = [...new Set(toDelete.map(c => c.gameId))]

  if (deleteIds.length === 0) {
    return { success: true, count: 0, message: '没有可清理的空壳评论' }
  }

  // 物理删除（会级联删除其点赞/举报等关联数据）。
  const result = await prisma.comment.deleteMany({
    where: { id: { in: deleteIds } },
  })

  // 失效相关游戏缓存及用户缓存
  for (const gameId of affectedGameIds) {
    invalidateGameCaches(gameId).catch(() => {})
  }
  invalidateCache('user:*').catch(() => {})

  await logAdminOperation({
    adminId: admin.id,
    action: 'PURGE_EMPTY_COMMENTS',
    targetType: 'Comment',
    content: `永久删除空壳评论 ${result.count} 条（内容实质为空）`,
  })

  return {
    success: true,
    count: result.count,
    message: `已永久删除 ${result.count} 条空壳评论`,
  }
})
