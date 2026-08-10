import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  url: z.string().url(),
  type: z.enum(['ADD', 'UPDATE', 'DELETE']).optional().default('ADD'),
})

async function submitToIndexNow(siteUrl: string, url: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 规范化 URL：移除片段标识符和尾部斜杠
    let normalizedUrl = url.split('#')[0].replace(/\/+$/, '')
    
    const host = new URL(siteUrl).hostname
    const requestBody = {
      host,
      key: apiKey,
      keyLocation: `${siteUrl}/${apiKey}.txt`,
      urlList: [normalizedUrl],
    }
    
    console.log('IndexNow 请求体:', JSON.stringify(requestBody, null, 2))
    
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    console.log('IndexNow 响应状态:', response.status)
    
    if (response.status === 200 || response.status === 202) {
      return { success: true }
    } else if (response.status === 400) {
      const text = await response.text()
      console.error('IndexNow 400 错误:', text)
      return { success: false, error: '无效的请求格式' }
    } else if (response.status === 403) {
      return { success: false, error: '无效的 API Key' }
    } else if (response.status === 422) {
      const text = await response.text()
      console.error('IndexNow 422 错误:', text)
      return { success: false, error: `无效的 URL: ${text || '请检查 URL 格式和 host 是否匹配'}` }
    } else if (response.status === 429) {
      return { success: false, error: '请求过于频繁' }
    } else {
      const text = await response.text()
      console.error(`IndexNow ${response.status} 错误:`, text)
      return { success: false, error: `HTTP ${response.status}` }
    }
  } catch (err: any) {
    console.error('IndexNow 请求异常:', err)
    return { success: false, error: err.message || '网络请求失败' }
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)

  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: '数据验证失败: URL 格式不正确',
    })
  }

  // 获取设置
  const settings = await prisma.indexNowSetting.findFirst()
  if (!settings) {
    throw createError({
      statusCode: 404,
      message: 'IndexNow 未配置，请先生成 API Key',
    })
  }

  // 检查每日提交限制
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const todayCount = await prisma.indexNowSubmission.count({
    where: {
      submittedAt: {
        gte: today,
      },
      status: 'SUCCESS',
    },
  })

  if (todayCount >= settings.dailyLimit) {
    throw createError({
      statusCode: 429,
      message: `已达到每日提交限制（${settings.dailyLimit} 条），请明天再试`,
    })
  }

  // 获取站点 URL
  const config = useRuntimeConfig()
  let siteUrl = config.public.siteUrl || 'http://localhost:3000'
  
  // 确保 siteUrl 没有尾部斜杠
  siteUrl = siteUrl.replace(/\/+$/, '')
  
  // 验证 URL 是否属于当前站点
  if (!data.url.startsWith(siteUrl)) {
    throw createError({
      statusCode: 400,
      message: `URL 必须以 ${siteUrl} 开头`,
    })
  }

  console.log('IndexNow 提交:', {
    siteUrl,
    url: data.url,
    apiKey: settings.apiKey.substring(0, 8) + '...',
  })

  // 提交到 IndexNow
  const result = await submitToIndexNow(siteUrl, data.url, settings.apiKey)

  // 记录提交历史
  await prisma.indexNowSubmission.create({
    data: {
      url: data.url,
      status: result.success ? 'SUCCESS' : 'FAILED',
      type: data.type,
      errorMessage: result.error || null,
    },
  })

  if (!result.success) {
    throw createError({
      statusCode: 500,
      message: result.error || '提交失败',
    })
  }

  return { success: true }
})
