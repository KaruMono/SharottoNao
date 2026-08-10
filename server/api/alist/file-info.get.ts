import { getSetting } from '~/server/utils/settings'
import {
  fetchAlistApi,
  formatAlistSize,
  normalizeAlistBaseUrl,
  resolveAlistPath,
  type AlistFileInfo,
  type AlistListInfo,
} from '~/server/utils/alist'

async function getDirTotalSize(baseUrl: string, dirPath: string, token: string | null): Promise<number> {
  const data = await fetchAlistApi<AlistListInfo>(baseUrl, token, 'list', {
    path: dirPath,
    per_page: 0,
    refresh: false,
  })

  if (data.code !== 200 || !data.data?.content) return 0

  let total = 0
  for (const item of data.data.content) {
    if (item.is_dir) {
      total += await getDirTotalSize(baseUrl, `${dirPath}/${item.name}`, token)
    } else {
      total += item.size || 0
    }
  }
  return total
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = query.url as string

  if (!url) {
    throw createError({ statusCode: 400, message: '请提供 URL' })
  }

  const alistBaseUrl = await getSetting('alist_base_url')
  if (!alistBaseUrl) {
    throw createError({ statusCode: 400, message: '未配置 Alist 地址' })
  }

  const normalizedBase = normalizeAlistBaseUrl(alistBaseUrl)
  if (!url.startsWith(normalizedBase)) {
    throw createError({ statusCode: 400, message: '该链接不是 Alist 网盘链接' })
  }

  const filePath = resolveAlistPath(url)
  const alistToken = await getSetting('alist_token')

  try {
    const data = await fetchAlistApi<AlistFileInfo>(normalizedBase, alistToken, 'get', { path: filePath })

    if (data.code !== 200 || !data.data) {
      throw createError({ statusCode: 404, message: data.message || '获取文件信息失败' })
    }

    const name = data.data.name
    const isDir = data.data.is_dir
    let sizeBytes = data.data.size || 0

    if (isDir) {
      sizeBytes = await getDirTotalSize(normalizedBase, filePath, alistToken)
    }

    const cleanName = name.replace(/\.(7z|zip|rar|tar\.gz|tar|gz)$/i, '')

    return {
      name: cleanName,
      rawName: name,
      isDir,
      size: sizeBytes,
      sizeFormatted: formatAlistSize(sizeBytes),
    }
  } catch (err: unknown) {
    if (isErrorWithStatusCode(err)) throw err
    const message = err instanceof Error ? err.message : 'Alist API 请求失败'
    throw createError({ statusCode: 502, message })
  }
})

function isErrorWithStatusCode(error: unknown): error is { statusCode: number } {
  return typeof error === 'object' && error !== null && 'statusCode' in error
}
