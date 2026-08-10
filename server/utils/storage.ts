import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'

let s3Client: S3Client | null = null

function getS3Client() {
  const config = useRuntimeConfig()
  
  if (!config.s3.enabled) return null
  
  if (s3Client) return s3Client

  s3Client = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
    },
    forcePathStyle: true, // 兼容B2等S3兼容存储
  })

  return s3Client
}

interface UploadResult {
  filename: string
  path: string
  url: string
  size: number
  width?: number
  height?: number
  mimeType: string
}

interface UploadOptions {
  folder?: string
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

// 处理并上传图片
export async function uploadImage(
  buffer: Buffer,
  originalName: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const config = useRuntimeConfig()
  const { folder = 'images', maxWidth = 1920, maxHeight = 1920, quality = 85 } = options

  // 处理图片：转换为webp，限制尺寸
  let image = sharp(buffer)
  const metadata = await image.metadata()

  // 限制最大尺寸
  if ((metadata.width && metadata.width > maxWidth) || (metadata.height && metadata.height > maxHeight)) {
    image = image.resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
  }

  // 转换为webp
  const processedBuffer = await image.webp({ quality }).toBuffer()
  const processedMetadata = await sharp(processedBuffer).metadata()

  // 生成文件名
  const ext = '.webp'
  const filename = `${uuidv4()}${ext}`
  const filePath = `${folder}/${filename}`

  if (config.s3.enabled) {
    // S3 上传
    const client = getS3Client()!
    await client.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: filePath,
      Body: processedBuffer,
      ContentType: 'image/webp',
    }))

    // 构建公开URL
    let url: string
    if (config.s3.publicUrl) {
      // 使用自定义CDN URL（可能不包含存储桶名）
      url = `${config.s3.publicUrl}/${filePath}`
    } else {
      // 使用S3端点
      url = `${config.s3.endpoint}/${config.s3.bucket}/${filePath}`
    }

    return {
      filename,
      path: filePath,
      url,
      size: processedBuffer.length,
      width: processedMetadata.width,
      height: processedMetadata.height,
      mimeType: 'image/webp',
    }
  } else {
    // 本地存储
    const uploadDir = path.join(process.cwd(), config.localUploadPath, folder)
    await fs.mkdir(uploadDir, { recursive: true })
    
    const localPath = path.join(uploadDir, filename)
    await fs.writeFile(localPath, processedBuffer)

    return {
      filename,
      path: filePath,
      url: `/uploads/${filePath}`,
      size: processedBuffer.length,
      width: processedMetadata.width,
      height: processedMetadata.height,
      mimeType: 'image/webp',
    }
  }
}

// 删除图片
export async function deleteImage(filePath: string): Promise<void> {
  const config = useRuntimeConfig()

  if (config.s3.enabled) {
    const client = getS3Client()!
    await client.send(new DeleteObjectCommand({
      Bucket: config.s3.bucket,
      Key: filePath,
    }))
  } else {
    const localPath = path.join(process.cwd(), config.localUploadPath, filePath)
    try {
      await fs.unlink(localPath)
    } catch {
      // 文件不存在则忽略
    }
  }
}

// 生成密码学安全的随机验证码
export function generateVerificationCode(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  const code = (array[0] % 900000) + 100000
  return code.toString()
}
