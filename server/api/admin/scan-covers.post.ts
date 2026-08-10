import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { promises as fs } from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // 获取所有有 vndbId 的游戏（包括无封面和 placeholder 封面）
  const games = await prisma.game.findMany({
    select: {
      id: true,
      titleZhHans: true,
      titleJa: true,
      titleEn: true,
      coverImage: true,
      vndbId: true,
    },
  })

  const config = useRuntimeConfig()
  const broken: Array<{
    id: number
    title: string
    coverImage: string | null
    vndbId: string | null
    reason: string
  }> = []

  for (const game of games) {
    const title = game.titleZhHans || game.titleJa || game.titleEn || `#${game.id}`

    // 无封面或 placeholder
    if (!game.coverImage || game.coverImage === '/images/placeholder.png') {
      broken.push({ id: game.id, title, coverImage: game.coverImage, vndbId: game.vndbId, reason: '无封面' })
      continue
    }

    try {
      if (game.coverImage.startsWith('/uploads/')) {
        // 本地文件：检查文件是否存在
        const localPath = path.join(process.cwd(), config.localUploadPath, game.coverImage.replace('/uploads/', ''))
        try {
          await fs.access(localPath)
        } catch {
          broken.push({ id: game.id, title, coverImage: game.coverImage, vndbId: game.vndbId, reason: '本地文件不存在' })
        }
      } else if (game.coverImage.startsWith('http')) {
        // 远程 URL：HEAD 请求检查
        const resp = await fetch(game.coverImage, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
        if (!resp.ok) {
          broken.push({ id: game.id, title, coverImage: game.coverImage, vndbId: game.vndbId, reason: `HTTP ${resp.status}` })
        }
      }
    } catch (err: any) {
      broken.push({ id: game.id, title, coverImage: game.coverImage, vndbId: game.vndbId, reason: err.message || '请求超时' })
    }
  }

  return { total: games.length, broken }
})
