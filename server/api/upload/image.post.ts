import { requireAuth } from '~/server/utils/auth'
import { uploadImage } from '~/server/utils/storage'
import prisma from '~/server/utils/prisma'
import { checkUploadRateLimit } from '~/server/utils/rate-limit'

const allowedFolders = ['covers', 'images', 'screenshots', 'avatars']

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await checkUploadRateLimit(event, user.id)

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      message: '请选择要上传的文件',
    })
  }

  const file = formData.find(f => f.name === 'file')
  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      message: '请选择要上传的文件',
    })
  }

  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
  if (!file.type || !allowedTypes.includes(file.type)) {
    throw createError({
      statusCode: 400,
      message: '只支持 JPG、PNG、GIF、WebP、AVIF 格式的图片',
    })
  }

  // 检查文件大小（最大10MB）
  const maxSize = 10 * 1024 * 1024
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      message: '文件大小不能超过10MB',
    })
  }

  // 获取额外参数
  const folderField = formData.find(f => f.name === 'folder')
  const folder = folderField?.data.toString() || 'images'
  if (!allowedFolders.includes(folder)) {
    throw createError({
      statusCode: 400,
      message: '不支持的上传目录',
    })
  }
  
  const gameIdField = formData.find(f => f.name === 'gameId')
  const gameId = gameIdField ? parseInt(gameIdField.data.toString()) : null

  try {
    const result = await uploadImage(file.data, file.filename || 'image.jpg', {
      folder,
    })

    // 记录到数据库
    const image = await prisma.image.create({
      data: {
        filename: result.filename,
        originalName: file.filename || 'image.jpg',
        path: result.path,
        url: result.url,
        size: result.size,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
        gameId: gameId && !isNaN(gameId) ? gameId : null,
      },
    })

    return {
      id: image.id,
      url: result.url,
      width: result.width,
      height: result.height,
    }
  } catch (error) {
    console.error('上传图片失败:', error)
    throw createError({
      statusCode: 500,
      message: '上传失败，请稍后再试',
    })
  }
})
