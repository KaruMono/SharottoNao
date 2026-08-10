import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { uploadImage } from '~/server/utils/storage'
import { markImageAsUsed } from '~/server/utils/image'

const schema = z.object({
  gameId: z.number(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { gameId } = schema.parse(await readBody(event))

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, vndbId: true, coverImage: true },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '游戏不存在' })
  }

  if (!game.vndbId) {
    throw createError({ statusCode: 400, message: '该游戏没有 VNDB ID，无法自动获取封面' })
  }

  // 从 VNDB API 获取封面 URL
  const vndbResp = await fetch('https://api.vndb.org/kana/vn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: ['id', '=', game.vndbId],
      fields: 'image.url',
    }),
  })

  if (!vndbResp.ok) {
    throw createError({ statusCode: 502, message: 'VNDB API 请求失败' })
  }

  const vndbData = await vndbResp.json()
  if (!vndbData.results?.length || !vndbData.results[0].image?.url) {
    throw createError({ statusCode: 404, message: 'VNDB 上没有封面图片' })
  }

  const imageUrl = vndbData.results[0].image.url

  // 下载图片
  const imgResp = await fetch(imageUrl)
  if (!imgResp.ok) {
    throw createError({ statusCode: 502, message: '下载 VNDB 封面失败' })
  }

  const buffer = Buffer.from(await imgResp.arrayBuffer())

  // 上传并转换为 webp
  const result = await uploadImage(buffer, 'vndb-cover.jpg', { folder: 'covers' })

  // 记录到 Image 表
  const image = await prisma.image.create({
    data: {
      filename: result.filename,
      originalName: `vndb-cover-${Date.now()}.webp`,
      path: result.path,
      url: result.url,
      size: result.size,
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
    },
  })

  // 更新游戏封面
  await prisma.game.update({
    where: { id: gameId },
    data: { coverImage: result.url },
  })

  // 标记新图片为已使用
  await markImageAsUsed(result.url, gameId)

  return {
    success: true,
    gameId,
    newCoverUrl: result.url,
  }
})
