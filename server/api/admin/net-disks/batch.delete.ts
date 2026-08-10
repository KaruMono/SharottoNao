import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []

  if (!ids.length) {
    throw createError({ statusCode: 400, message: '请选择要删除的网盘类型' })
  }

  const items = await prisma.netDiskType.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  const resourceCounts = await prisma.resource.groupBy({
    by: ['netDiskTypeId'],
    where: { netDiskTypeId: { in: ids } },
    _count: { netDiskTypeId: true },
  })
  const countMap = new Map(resourceCounts.map(item => [item.netDiskTypeId, item._count.netDiskTypeId]))
  const deletable = items.filter(item => !countMap.get(item.id))
  const failed = items
    .filter(item => countMap.get(item.id))
    .map(item => ({ id: item.id, name: item.name, reason: `有 ${countMap.get(item.id)} 个资源` }))

  if (deletable.length) {
    await prisma.netDiskType.deleteMany({ where: { id: { in: deletable.map(item => item.id) } } })
  }

  return { success: true, deletedCount: deletable.length, failed }
})
