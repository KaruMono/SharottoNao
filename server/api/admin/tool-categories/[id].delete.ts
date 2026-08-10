import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) throw createError({ statusCode: 400, message: '无效的ID' })

  const toolCount = await prisma.tool.count({ where: { categoryId: id } })
  if (toolCount > 0) {
    throw createError({ statusCode: 400, message: `该分类下还有 ${toolCount} 个工具，请先删除或移动` })
  }

  await prisma.toolCategory.delete({ where: { id } })
  return { success: true, message: '删除成功' }
})
