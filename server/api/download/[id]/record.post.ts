import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { getSetting } from '~/server/utils/settings'
import { parseFileSizeToMb } from '~/server/utils/traffic'

const DEFAULT_DAILY_LIMIT = 10

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的资源ID' })
  }


  const resource = await prisma.resource.findUnique({
    where: { id, deletedAt: null, status: 'APPROVED', game: { deletedAt: null } },
  })

  if (!resource) {
    throw createError({ statusCode: 404, message: '资源不存在' })
  }

  const isUnlimited = user.role === 'ADMIN' || user.unlimitedDownload

  if (!isUnlimited) {
    const limitStr = await getSetting('daily_download_limit')
    const dailyLimit = parseInt(limitStr || '') || DEFAULT_DAILY_LIMIT

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayCount = await prisma.downloadRecord.count({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    })

    if (todayCount >= dailyLimit) {
      throw createError({ statusCode: 429, message: '今日下载次数已达上限' })
    }
  }

  await prisma.downloadRecord.create({
    data: {
      userId: user.id,
      resourceId: id,
      // 快照当时的资源大小，之后资源改大小不影响历史流量统计
      sizeMb: parseFileSizeToMb(resource.fileSize),
    },
  })

  await prisma.resource.update({
    where: { id },
    data: { downloadCount: { increment: 1 } },
  })

  return { success: true, url: resource.url }
})
