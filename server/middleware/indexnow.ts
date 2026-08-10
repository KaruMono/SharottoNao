import prisma from '../utils/prisma'

/**
 * 处理 IndexNow API Key 验证文件请求
 * 搜索引擎会访问 /{key}.txt 来验证站点所有权
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // 只处理形如 /{32位以上hex字符}.txt 的路径
  if (!/^\/[a-f0-9]{32,}\.txt$/i.test(pathname)) {
    return
  }

  const requestedKey = pathname.slice(1, -4) // 去掉开头 / 和末尾 .txt

  const settings = await prisma.indexNowSetting.findFirst({
    where: { apiKey: requestedKey },
  })
  const config = useRuntimeConfig()
  const fallbackKey = ((config.indexNowKey as string | undefined) || '').trim()

  if (!settings && fallbackKey !== requestedKey) {
    return
  }

  setHeader(event, 'Content-Type', 'text/plain')
  setHeader(event, 'X-Robots-Tag', 'noindex')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  event.node.res.statusCode = 200
  return requestedKey
})
