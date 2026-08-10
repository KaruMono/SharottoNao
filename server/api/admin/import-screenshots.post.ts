import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { uploadImage } from '~/server/utils/storage'
import { markImageAsUsed } from '~/server/utils/image'

const importItemSchema = z.object({
  vndbId: z.string().regex(/^v\d+$/),
  imageUrls: z.array(z.string().url()).min(1).max(10),
})

const schema = z.object({
  items: z.array(importItemSchema).min(1).max(50),
})

async function downloadAndUpload(imageUrl: string): Promise<{
  url: string
  width?: number
  height?: number
  imageId: number
} | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(imageUrl).origin,
      },
    })

    if (!response.ok) {
      console.error(`Failed to download ${imageUrl}: ${response.status}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    if (buffer.length > 15 * 1024 * 1024) {
      console.error(`Image too large: ${imageUrl} (${buffer.length} bytes)`)
      return null
    }

    if (buffer.length < 100) {
      console.error(`Image too small (likely error page): ${imageUrl}`)
      return null
    }

    const result = await uploadImage(buffer, `screenshot-${Date.now()}.webp`, {
      folder: 'screenshots',
    })

    const image = await prisma.image.create({
      data: {
        filename: result.filename,
        originalName: imageUrl.split('/').pop() || 'screenshot.webp',
        path: result.path,
        url: result.url,
        size: result.size,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
      },
    })

    return {
      url: result.url,
      width: result.width,
      height: result.height,
      imageId: image.id,
    }
  } catch (error) {
    console.error(`Error processing ${imageUrl}:`, error)
    return null
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
      message: '数据验证失败: ' + JSON.stringify(e.errors?.slice(0, 3)),
    })
  }

  const results: Array<{
    vndbId: string
    status: 'success' | 'not_found' | 'has_screenshots' | 'error'
    gameId?: number
    screenshotCount?: number
    message?: string
  }> = []

  for (const item of data.items) {
    try {
      const game = await prisma.game.findFirst({
        where: { vndbId: item.vndbId, deletedAt: null },
        include: { screenshots: true },
      })

      if (!game) {
        results.push({
          vndbId: item.vndbId,
          status: 'not_found',
          message: `未找到 VNDB ID 为 ${item.vndbId} 的游戏条目`,
        })
        continue
      }

      if (game.screenshots.length > 0) {
        results.push({
          vndbId: item.vndbId,
          status: 'has_screenshots',
          gameId: game.id,
          screenshotCount: game.screenshots.length,
          message: `游戏已有 ${game.screenshots.length} 张截图，跳过`,
        })
        continue
      }

      const uploadedScreenshots: Array<{ url: string; sortOrder: number }> = []

      for (let i = 0; i < item.imageUrls.length; i++) {
        const uploaded = await downloadAndUpload(item.imageUrls[i])
        if (uploaded) {
          uploadedScreenshots.push({
            url: uploaded.url,
            sortOrder: i,
          })
          await markImageAsUsed(uploaded.url, game.id)
        }
      }

      if (uploadedScreenshots.length > 0) {
        await prisma.screenshot.createMany({
          data: uploadedScreenshots.map(s => ({
            gameId: game.id,
            url: s.url,
            sortOrder: s.sortOrder,
          })),
        })
      }

      results.push({
        vndbId: item.vndbId,
        status: 'success',
        gameId: game.id,
        screenshotCount: uploadedScreenshots.length,
        message: `成功导入 ${uploadedScreenshots.length}/${item.imageUrls.length} 张截图`,
      })
    } catch (error: any) {
      results.push({
        vndbId: item.vndbId,
        status: 'error',
        message: error.message || '未知错误',
      })
    }
  }

  const success = results.filter(r => r.status === 'success').length
  const notFound = results.filter(r => r.status === 'not_found').length
  const hasScreenshots = results.filter(r => r.status === 'has_screenshots').length
  const errors = results.filter(r => r.status === 'error').length
  const totalScreenshots = results.reduce((sum, r) => sum + (r.screenshotCount || 0), 0)

  return {
    summary: {
      total: results.length,
      success,
      notFound,
      hasScreenshots,
      errors,
      totalScreenshots,
    },
    results,
  }
})
