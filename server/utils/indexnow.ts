import prisma from './prisma'

type SubmissionType = 'ADD' | 'UPDATE' | 'DELETE'

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
    
    console.log('IndexNow 自动提交请求:', JSON.stringify(requestBody, null, 2))
    
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

export async function submitUrlToIndexNow(url: string, type: SubmissionType = 'ADD') {
  try {
    // 检查是否启用自动提交
    const settings = await prisma.indexNowSetting.findFirst()
    if (!settings || !settings.autoSubmissionEnabled) {
      return
    }

    // 检查每日提交限制
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = await prisma.indexNowSubmission.count({
      where: {
        submittedAt: { gte: today },
        status: 'SUCCESS',
      },
    })
    if (todayCount >= settings.dailyLimit) {
      console.log(`IndexNow 已达每日提交限制（${todayCount}/${settings.dailyLimit}），跳过自动提交: ${url}`)
      return
    }

    // 检查最近 1 分钟内是否已提交相同 URL（避免重复提交）
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    const recentSubmission = await prisma.indexNowSubmission.findFirst({
      where: {
        url,
        submittedAt: {
          gte: oneMinuteAgo,
        },
      },
    })

    if (recentSubmission) {
      return
    }

    // 获取站点 URL
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl || 'http://localhost:3000').replace(/\/+$/, '')

    // 提交到 IndexNow
    const result = await submitToIndexNow(siteUrl, url, settings.apiKey)

    // 记录提交历史
    await prisma.indexNowSubmission.create({
      data: {
        url,
        status: result.success ? 'SUCCESS' : 'FAILED',
        type,
        errorMessage: result.error || null,
      },
    })
  } catch (err) {
    console.error('IndexNow submission failed:', err)
  }
}

function getSiteUrl(): string {
  const config = useRuntimeConfig()
  return (config.public.siteUrl || 'http://localhost:3000').replace(/\/+$/, '')
}

// 提交游戏页面
export async function submitGameToIndexNow(gameId: number, type: SubmissionType = 'ADD') {
  const url = `${getSiteUrl()}/games/${gameId}`
  await submitUrlToIndexNow(url, type)
}

// 提交会社页面
export async function submitCompanyToIndexNow(companyId: number, type: SubmissionType = 'ADD') {
  const url = `${getSiteUrl()}/companies/${companyId}`
  await submitUrlToIndexNow(url, type)
}

// 提交标签页面
export async function submitTagToIndexNow(tagId: number, type: SubmissionType = 'ADD') {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { id: true, slug: true },
  })
  if (!tag) return

  const url = `${getSiteUrl()}/tags/${tag.slug || tag.id}`
  await submitUrlToIndexNow(url, type)
}
