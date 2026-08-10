import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUnused } from '~/server/utils/image'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的ID',
    })
  }

  // 获取友情链接信息以便标记图片为未使用
  const link = await prisma.friendLink.findUnique({
    where: { id },
  })

  if (link) {
    await prisma.friendLink.delete({
      where: { id },
    })
    
    // 标记Logo图片为未使用
    if (link.logo) {
      await markImageAsUnused(link.logo)
    }
  }

  return { success: true, message: '删除成功' }
})
