import { createReadStream, lstatSync, realpathSync } from 'node:fs'
import { sep } from 'node:path'
import { resolveUploadFile, resolveUploadRoot } from '~/server/utils/local-storage-path'
import { sendStream, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  
  // 只处理 /uploads 路径
  if (!url.pathname.startsWith('/uploads/')) {
    return
  }

  const config = useRuntimeConfig()
  const pathParam = url.pathname.replace('/uploads/', '')
  
  if (!pathParam) {
    return
  }

  // 安全检查：防止路径遍历攻击
  if (pathParam.includes('..') || pathParam.includes('\\') || pathParam.includes('%2e') || pathParam.includes('%2E')) {
    return
  }

  const filePath = resolveUploadFile(pathParam, config)
  if (!filePath) return

  // 二次校验：确保解析后的路径仍在上传目录内
  const uploadRoot = resolveUploadRoot(config)
  if (!filePath.startsWith(`${uploadRoot}${sep}`) && filePath !== uploadRoot) {
    return
  }

  // Resolve symlinks before serving. Lexical traversal checks alone do not
  // prevent a symlink inside uploads from pointing outside the shared root.
  let realRoot: string
  let realFile: string
  try {
    realRoot = realpathSync(uploadRoot)
    realFile = realpathSync(filePath)
  } catch {
    return
  }
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${sep}`)) return

  // 获取文件信息
  let stat: ReturnType<typeof lstatSync>
  try {
    stat = lstatSync(realFile)
  } catch {
    return
  }
  if (!stat.isFile()) {
    return
  }

  // 根据扩展名设置 Content-Type
  const ext = pathParam.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'webp': 'image/webp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
  }

  const contentType = mimeTypes[ext || ''] || 'application/octet-stream'
  
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Content-Length', stat.size)
  // 文件名为 UUID、内容不可变，可长缓存
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  
  // 阻止其他处理器处理这个请求
  event.node.res.statusCode = 200
  return sendStream(event, createReadStream(realFile))
})
