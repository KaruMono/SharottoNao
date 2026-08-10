import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUnused } from '~/server/utils/image'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []

  if (!ids.length) {
    throw createError({ statusCode: 400, message: '请选择要删除的会社' })
  }

  const companies = await prisma.company.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, logo: true },
  })

  const relationCounts = await prisma.gameCompany.groupBy({
    by: ['companyId'],
    where: { companyId: { in: ids } },
    _count: { companyId: true },
  })
  const relationMap = new Map(relationCounts.map(item => [item.companyId, item._count.companyId]))
  const deletable = companies.filter(company => !relationMap.get(company.id))
  const failed = companies
    .filter(company => relationMap.get(company.id))
    .map(company => ({ id: company.id, name: company.name, reason: `有 ${relationMap.get(company.id)} 个游戏条目` }))

  if (deletable.length) {
    await prisma.company.deleteMany({ where: { id: { in: deletable.map(company => company.id) } } })
    await Promise.all(deletable.filter(company => company.logo).map(company => markImageAsUnused(company.logo!)))
  }

  return { success: true, deletedCount: deletable.length, failed }
})
