import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const path = event.path

  // 只处理根目录下的 .txt 文件，且文件名看起来像 API key（至少32个字符的字母数字组合）
  const match = path.match(/^\/([a-zA-Z0-9_-]{32,})\.txt$/)
  
  if (!match) {
    return // 不是 IndexNow key 请求，继续正常处理
  }

  const key = match[1]

  // 查询 IndexNow 设置
  const settings = await prisma.indexNowSetting.findFirst({
    where: { apiKey: key },
  })
  const config = useRuntimeConfig()
  const fallbackKey = ((config.indexNowKey as string | undefined) || '').trim()

  if (!settings && fallbackKey !== key) {
    return // key 不存在，返回 404（由默认处理器处理）
  }

  // 返回纯文本格式的 API Key
  setResponseHeader(event, 'Content-Type', 'text/plain')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex')
  
  return key
})
