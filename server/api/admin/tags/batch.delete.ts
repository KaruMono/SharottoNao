import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []

  if (!ids.length) {
    throw createError({ statusCode: 400, message: '请选择要删除的标签' })
  }

  const result = await prisma.tag.deleteMany({ where: { id: { in: ids } } })
  return { success: true, deletedCount: result.count, failed: [] }
})
