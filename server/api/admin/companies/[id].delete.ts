import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUnused } from '~/server/utils/image'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的会社ID',
    })
  }

  // 检查是否有游戏关联
  const gamesCount = await prisma.gameCompany.count({
    where: { companyId: id },
  })

  if (gamesCount > 0) {
    throw createError({
      statusCode: 400,
      message: `该会社下有 ${gamesCount} 个游戏条目，无法删除`,
    })
  }

  // 获取公司信息以便标记Logo为未使用
  const company = await prisma.company.findUnique({
    where: { id },
  })

  if (company) {
    await prisma.company.delete({
      where: { id },
    })
    
    // 标记Logo图片为未使用
    if (company.logo) {
      await markImageAsUnused(company.logo)
    }
  }

  return { success: true, message: '删除成功' }
})
