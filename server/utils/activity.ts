import type { ActivityType, Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'

interface RecordActivityParams {
  userId: number
  type: ActivityType
  targetType?: string
  targetId?: number
  meta?: Record<string, unknown>
}

/**
 * 记录用户活动（异步，不阻塞主流程）
 */
export function recordActivity(params: RecordActivityParams): void {
  const { userId, type, targetType, targetId, meta } = params
  prisma.activity.create({
    data: {
      userId,
      type,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      meta: meta === undefined ? undefined : (meta as Prisma.InputJsonValue),
    },
  }).catch((err) => {
    console.error('[activity] 记录活动失败:', err)
  })
}
