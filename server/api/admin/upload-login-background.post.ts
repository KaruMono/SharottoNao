import { requireAdmin } from '~/server/utils/auth'
import { uploadImage } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const formData = await readMultipartFormData(event)
  const file = formData?.find(field => field.name === 'file')
  if (!file?.data?.length) {
    throw createError({ statusCode: 400, message: '请选择要上传的图片' })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
  if (!file.type || !allowedTypes.includes(file.type)) {
    throw createError({ statusCode: 400, message: '只支持 JPG、PNG、GIF、WebP、AVIF 格式的图片' })
  }
  if (file.data.length > 10 * 1024 * 1024) {
    throw createError({ statusCode: 400, message: '文件大小不能超过 10MB' })
  }

  try {
    // 和站点图标一样独立存储，避免被资源图片的未使用清理任务删除。
    const result = await uploadImage(file.data, file.filename || 'background.jpg', {
      folder: 'login-backgrounds',
    })
    return { url: result.url }
  } catch (error) {
    console.error('上传登录页背景失败:', error)
    throw createError({ statusCode: 500, message: '上传失败，请检查图片后重试' })
  }
})
