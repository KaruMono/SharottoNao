import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  // 找出所有指向已不存在攻略的 activity 记录
  const existingGuideIds = (await prisma.guide.findMany({ select: { id: true } })).map(g => g.id)

  const result = await prisma.activity.deleteMany({
    where: {
      targetType: 'guide',
      ...(existingGuideIds.length > 0
        ? { targetId: { notIn: existingGuideIds } }
        : {}),
    },
  })

  await logAdminOperation({
    adminId: admin.id,
    action: 'CLEANUP_ORPHAN_ACTIVITIES',
    targetType: 'Activity',
    content: `清理孤立 activity 记录 ${result.count} 条（targetType=guide 但攻略已删除）`,
  })

  return {
    success: true,
    count: result.count,
    message: result.count > 0
      ? `已清理 ${result.count} 条孤立动态记录`
      : '没有需要清理的孤立记录',
  }
})
