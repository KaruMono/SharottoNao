import { requireAdmin } from '~/server/utils/auth'
import { promises as fs } from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { resolveUploadRoot } from '~/server/utils/local-storage-path'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: '请选择要上传的文件' })
  }

  const file = formData.find(f => f.name === 'file')
  if (!file || !file.data) {
    throw createError({ statusCode: 400, message: '请选择要上传的文件' })
  }

  // 图标允许 ico, png, svg, webp
  const allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml', 'image/webp']
  if (!file.type || !allowedTypes.includes(file.type)) {
    throw createError({ statusCode: 400, message: '只支持 ICO、PNG、SVG、WebP 格式' })
  }

  // 最大 1MB
  if (file.data.length > 1 * 1024 * 1024) {
    throw createError({ statusCode: 400, message: '文件大小不能超过 1MB' })
  }

  const config = useRuntimeConfig()
  const ext = path.extname(file.filename || '').toLowerCase() || getExtFromType(file.type)
  const filename = `${uuidv4()}${ext}`
  const filePath = `icons/${filename}`

  if (config.s3.enabled) {
    const s3 = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      forcePathStyle: true,
    })

    await s3.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: filePath,
      Body: file.data,
      ContentType: file.type,
    }))

    const url = config.s3.publicUrl
      ? `${config.s3.publicUrl}/${filePath}`
      : `${config.s3.endpoint}/${config.s3.bucket}/${filePath}`

    return { url }
  } else {
    const uploadDir = path.join(resolveUploadRoot(config), 'icons')
    await fs.mkdir(uploadDir, { recursive: true })
    await fs.writeFile(path.join(uploadDir, filename), file.data)
    return { url: `/uploads/${filePath}` }
  }
})

function getExtFromType(type: string): string {
  const map: Record<string, string> = {
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'image/png': '.png',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
  }
  return map[type] || '.png'
}
