import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []

  if (!ids.length) {
    throw createError({ statusCode: 400, message: '请选择要删除的资源类型' })
  }

  const types = await prisma.resourceType.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  const resourceCounts = await prisma.resource.groupBy({
    by: ['typeId'],
    where: { typeId: { in: ids } },
    _count: { typeId: true },
  })
  const countMap = new Map(resourceCounts.map(item => [item.typeId, item._count.typeId]))
  const deletable = types.filter(type => !countMap.get(type.id))
  const failed = types
    .filter(type => countMap.get(type.id))
    .map(type => ({ id: type.id, name: type.name, reason: `有 ${countMap.get(type.id)} 个资源` }))

  if (deletable.length) {
    await prisma.resourceType.deleteMany({ where: { id: { in: deletable.map(type => type.id) } } })
  }

  return { success: true, deletedCount: deletable.length, failed }
})
