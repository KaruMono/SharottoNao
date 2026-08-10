import prisma from '~/server/utils/prisma'
import { requireAuth, getAuthUser } from '~/server/utils/auth'
import { getSetting } from '~/server/utils/settings'

const DEFAULT_DAILY_LIMIT = 10

export default defineEventHandler(async (event) => {
  const downloadVisibility = await getSetting('download_visibility') ?? 'login_required'
  const alwaysShow = downloadVisibility === 'always_show'

  // always_show 模式：允许未登录访问（看到资源信息但无法下载）
  // login_required 模式：严格要求登录
  const user = alwaysShow ? await getAuthUser(event) : await requireAuth(event)

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的资源ID' })
  }

  const resource = await prisma.resource.findUnique({
    where: { id, deletedAt: null, status: 'APPROVED', game: { deletedAt: null } },
    include: {
      type: true,
      netDiskType: true,
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
  })

  if (!resource) {
    throw createError({ statusCode: 404, message: '资源不存在' })
  }

  const gameTitle = resource.game.titleZhHans || resource.game.titleZhHant || resource.game.titleJa || resource.game.titleEn || ''
  const { url, ...safeResource } = resource

  // 未登录访客（always_show 模式）：直接返回资源信息，但不允许下载
  if (!user) {
    return {
      resource: {
        ...safeResource,
        game: { id: resource.game.id, title: gameTitle },
      },
      dailyLimit: DEFAULT_DAILY_LIMIT,
      todayCount: 0,
      canDownload: false,
      requireLogin: true,
    }
  }

  const isUnlimited = user.role === 'ADMIN' || user.unlimitedDownload

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

  const canDownload = isUnlimited || todayCount < dailyLimit

  return {
    resource: {
      ...safeResource,
      game: { id: resource.game.id, title: gameTitle },
    },
    dailyLimit: isUnlimited ? -1 : dailyLimit,
    todayCount,
    canDownload,
    requireLogin: false,
  }
})
