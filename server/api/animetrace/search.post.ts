import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import { checkExternalApiRateLimit } from '~/server/utils/rate-limit'

const maxBase64Length = 10 * 1024 * 1024 * 2

const schema = z.object({
  file: z.string().optional(), // Base64 图片数据
  url: z.string().url().optional(), // 图片 URL
  model: z.string().default('animetrace_high_beta'), // 使用最高质量模型
  is_multi: z.boolean().default(true), // 显示多个结果
  ai_detect: z.boolean().default(false), // 不开启 AI 检测
})

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)
  
  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: '参数验证失败',
    })
  }

  // 必须提供 file 或 url 之一
  if (!data.file && !data.url) {
    throw createError({
      statusCode: 400,
      message: '请提供图片文件或图片 URL',
    })
  }

  try {
    // 构建请求体
    const formData = new FormData()
    formData.append('model', data.model)
    formData.append('is_multi', data.is_multi.toString())
    formData.append('ai_detect', data.ai_detect.toString())
    
    if (data.file) {
      // 确保 Base64 数据不包含 data URI 前缀
      const base64Data = data.file.includes(',') ? data.file.split(',')[1] : data.file
      formData.append('base64', base64Data)
      console.log('使用 Base64 数据，长度:', base64Data.length)
    } else if (data.url) {
      formData.append('url', data.url)
      console.log('使用 URL:', data.url)
    }

    console.log('调用 AnimeTrace API，模型:', data.model, '参数:', {
      model: data.model,
      is_multi: data.is_multi,
      ai_detect: data.ai_detect,
      hasBase64: !!data.file,
      hasUrl: !!data.url,
    })

    // 调用 AnimeTrace API
    const response = await fetch('https://api.animetrace.com/v1/search', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()
    
    console.log('AnimeTrace API 完整响应:', {
      status: response.status,
      statusText: response.statusText,
      result: JSON.stringify(result, null, 2),
    })

    // 处理错误状态码
    if (!response.ok) {
      console.error('AnimeTrace API HTTP 错误:', response.status, response.statusText)
      throw createError({
        statusCode: response.status,
        message: `API 请求失败: ${response.statusText}`,
      })
    }

    // 检查是否有错误消息
    if (result.message && result.message !== 'Success' && result.message !== '识别成功') {
      console.error('AnimeTrace API 返回错误消息:', result.message)
      throw createError({
        statusCode: 422,
        message: result.message,
      })
    }

    // 检查业务状态码（code: 0 表示成功）
    if (result.code !== undefined && result.code !== 0 && result.code !== 17720 && result.code !== 200 && result.code !== 17721) {
      const errorMessages: Record<number, string> = {
        17701: '图片大小过大',
        17702: '服务器繁忙，请重试',
        17703: '请求参数不正确',
        17704: 'API 维护中',
        17705: '图片格式不支持',
        17706: '识别无法完成，请重试',
        17707: '内部错误',
        17708: '图片中的人物数量超过限制',
        17722: '图片下载失败',
        17728: '已达到本次使用上限',
        17731: '服务利用人数过多，请重新尝试',
      }
      
      const errorMsg = errorMessages[result.code] || `识别失败 (错误码: ${result.code})`
      console.error('AnimeTrace API 业务错误:', errorMsg, result)
      
      throw createError({
        statusCode: 422,
        message: errorMsg,
      })
    }

    // 成功返回结果
    return result
  } catch (err: any) {
    console.error('AnimeTrace API 调用异常:', err)
    
    if (err.statusCode) {
      throw err
    }
    
    throw createError({
      statusCode: 500,
      message: err.message || '图片识别失败，请重试',
    })
  }
})