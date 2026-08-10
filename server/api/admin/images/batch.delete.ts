import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { deleteImage } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []

  if (!ids.length) {
    throw createError({ statusCode: 400, message: '请选择要删除的图片' })
  }

  const images = await prisma.image.findMany({ where: { id: { in: ids } } })
  const failed: Array<{ id: number; name: string; reason: string }> = []
  let deletedCount = 0

  for (const image of images) {
    if (image.isUsed) {
      failed.push({ id: image.id, name: image.originalName, reason: '图片正在使用' })
      continue
    }

    try {
      await deleteImage(image.path)
      await prisma.image.delete({ where: { id: image.id } })
      deletedCount++
    } catch {
      failed.push({ id: image.id, name: image.originalName, reason: '删除文件失败' })
    }
  }

  return { success: true, deletedCount, failed }
})
