import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { updateMachineTranslationTag } from '~/server/utils/machine-translation-tag'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const resourceId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(resourceId)) {
    throw createError({
      statusCode: 400,
      message: '无效的资源ID',
    })
  }

  // 获取资源
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId, deletedAt: null },
    include: {
      game: { select: { id: true } },
    },
  })

  if (!resource) {
    throw createError({
      statusCode: 404,
      message: '资源不存在',
    })
  }

  // 检查权限：只有上传者或管理员可以删除
  if (resource.uploaderId !== user.id && user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '没有权限删除此资源',
    })
  }

  // 软删除
  await prisma.resource.update({
    where: { id: resourceId },
    data: { deletedAt: new Date() },
  })

  // 如果删除的是机翻资源，更新机器翻译标签
  if (resource.isMachineTranslated) {
    updateMachineTranslationTag(resource.gameId).catch(err => {
      console.error('Failed to update machine translation tag:', err)
    })
  }

  invalidateGameCaches(resource.gameId).catch(() => {})
  invalidateCache('user:*').catch(() => {})

  return { success: true, message: '删除成功' }
})
