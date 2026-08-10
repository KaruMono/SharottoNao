import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { deleteImage } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const unusedImages = await prisma.image.findMany({
    where: { isUsed: false },
  })

  let deletedCount = 0
  let failedCount = 0

  for (const image of unusedImages) {
    try {
      await deleteImage(image.path)
      
      await prisma.image.delete({
        where: { id: image.id },
      })
      
      deletedCount++
    } catch (error) {
      console.error(`删除图片失败: ${image.path}`, error)
      failedCount++
    }
  }

  return {
    success: true,
    message: `已清理 ${deletedCount} 张未使用的图片${failedCount > 0 ? `，${failedCount} 张清理失败` : ''}`,
    deletedCount,
    failedCount,
  }
})
