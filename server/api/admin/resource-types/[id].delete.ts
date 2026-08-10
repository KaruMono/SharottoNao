import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的ID',
    })
  }

  // 检查是否有资源使用此类型
  const resourcesCount = await prisma.resource.count({
    where: { typeId: id },
  })

  if (resourcesCount > 0) {
    throw createError({
      statusCode: 400,
      message: `该类型下有 ${resourcesCount} 个资源，无法删除`,
    })
  }

  await prisma.resourceType.delete({
    where: { id },
  })

  return { success: true, message: '删除成功' }
})
