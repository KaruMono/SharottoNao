import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUnused } from '~/server/utils/image'
import { invalidateCache } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) throw createError({ statusCode: 400, message: '无效的ID' })

  const tool = await prisma.tool.findUnique({ where: { id } })
  if (tool) {
    await prisma.tool.delete({ where: { id } })
    if (tool.icon) await markImageAsUnused(tool.icon)
    await invalidateCache('tools:*')
  }

  return { success: true, message: '删除成功' }
})
