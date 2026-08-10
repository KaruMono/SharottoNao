import prisma from './prisma'

/**
 * 根据图片URL标记图片为已使用
 * @param url 图片URL
 * @param gameId 可选的游戏ID关联
 */
export async function markImageAsUsed(url: string | null | undefined, gameId?: number | null): Promise<void> {
  if (!url) return

  try {
    // 从URL中提取路径
    // URL可能是 /uploads/images/xxx.webp 或 https://cdn.xxx.com/images/xxx.webp
    let path = url
    
    // 处理本地路径
    if (url.startsWith('/uploads/')) {
      path = url.replace('/uploads/', '')
    }
    // 处理CDN URL - 提取最后的路径部分
    else if (url.includes('://')) {
      const urlObj = new URL(url)
      path = urlObj.pathname.replace(/^\//, '')
    }

    await prisma.image.updateMany({
      where: {
        OR: [
          { url },
          { path },
        ],
      },
      data: {
        isUsed: true,
        ...(gameId ? { gameId } : {}),
      },
    })
  } catch (error) {
    console.error('标记图片使用状态失败:', error)
  }
}

/**
 * 批量标记图片为已使用
 * @param urls 图片URL数组
 * @param gameId 可选的游戏ID关联
 */
export async function markImagesAsUsed(urls: (string | null | undefined)[], gameId?: number | null): Promise<void> {
  const validUrls = urls.filter((url): url is string => !!url)
  await Promise.all(validUrls.map(url => markImageAsUsed(url, gameId)))
}

/**
 * 标记图片为未使用
 * @param url 图片URL
 */
export async function markImageAsUnused(url: string | null | undefined): Promise<void> {
  if (!url) return

  try {
    let path = url
    if (url.startsWith('/uploads/')) {
      path = url.replace('/uploads/', '')
    } else if (url.includes('://')) {
      const urlObj = new URL(url)
      path = urlObj.pathname.replace(/^\//, '')
    }

    await prisma.image.updateMany({
      where: {
        OR: [
          { url },
          { path },
        ],
      },
      data: {
        isUsed: false,
        gameId: null,
      },
    })
  } catch (error) {
    console.error('标记图片未使用状态失败:', error)
  }
}

/**
 * 扫描数据库中所有使用图片的地方，更新isUsed状态
 * 用于修复历史数据或定期同步
 */
export async function syncAllImageUsageStatus(): Promise<{ updated: number; errors: number }> {
  let updated = 0
  let errors = 0

  try {
    // 先将所有图片标记为未使用
    await prisma.image.updateMany({
      data: { isUsed: false, gameId: null },
    })

    // 1. 游戏封面图
    const gamesWithCover = await prisma.game.findMany({
      where: { coverImage: { not: null } },
      select: { id: true, coverImage: true },
    })
    for (const game of gamesWithCover) {
      try {
        await markImageAsUsed(game.coverImage, game.id)
        updated++
      } catch { errors++ }
    }

    // 2. 游戏横幅图
    const gamesWithBanner = await prisma.game.findMany({
      where: { bannerImage: { not: null } },
      select: { id: true, bannerImage: true },
    })
    for (const game of gamesWithBanner) {
      try {
        await markImageAsUsed(game.bannerImage, game.id)
        updated++
      } catch { errors++ }
    }

    // 3. 游戏截图
    const screenshots = await prisma.screenshot.findMany({
      select: { url: true, gameId: true },
    })
    for (const screenshot of screenshots) {
      try {
        await markImageAsUsed(screenshot.url, screenshot.gameId)
        updated++
      } catch { errors++ }
    }

    // 4. 用户头像
    const usersWithAvatar = await prisma.user.findMany({
      where: { avatar: { not: null } },
      select: { avatar: true },
    })
    for (const user of usersWithAvatar) {
      try {
        await markImageAsUsed(user.avatar)
        updated++
      } catch { errors++ }
    }

    // 5. 公司Logo
    const companiesWithLogo = await prisma.company.findMany({
      where: { logo: { not: null } },
      select: { logo: true },
    })
    for (const company of companiesWithLogo) {
      try {
        await markImageAsUsed(company.logo)
        updated++
      } catch { errors++ }
    }

    // 6. Staff头像
    const staffWithAvatar = await prisma.staff.findMany({
      where: { avatar: { not: null } },
      select: { avatar: true },
    })
    for (const staff of staffWithAvatar) {
      try {
        await markImageAsUsed(staff.avatar)
        updated++
      } catch { errors++ }
    }

    // 7. 友情链接Logo
    const friendLinksWithLogo = await prisma.friendLink.findMany({
      where: { logo: { not: null } },
      select: { logo: true },
    })
    for (const link of friendLinksWithLogo) {
      try {
        await markImageAsUsed(link.logo)
        updated++
      } catch { errors++ }
    }

    // 8. 表情包图片
    const emojis = await prisma.emoji.findMany({
      select: { url: true },
    })
    for (const emoji of emojis) {
      try {
        await markImageAsUsed(emoji.url)
        updated++
      } catch { errors++ }
    }

    // 9. 工具图标
    const toolsWithIcon = await prisma.tool.findMany({
      where: { icon: { not: null } },
      select: { icon: true },
    })
    for (const tool of toolsWithIcon) {
      try {
        await markImageAsUsed(tool.icon)
        updated++
      } catch { errors++ }
    }

    // 10. 广告图片
    const ads = await prisma.advertisement.findMany({
      select: { imageUrl: true },
    })
    for (const ad of ads) {
      try {
        await markImageAsUsed(ad.imageUrl)
        updated++
      } catch { errors++ }
    }

    // 11. 攻略内容中的图片
    const guides = await prisma.guide.findMany({
      select: { content: true },
    })
    const imgSrcRegex = /<img[^>]+src="([^"]+)"/g
    for (const guide of guides) {
      let match: RegExpExecArray | null
      while ((match = imgSrcRegex.exec(guide.content)) !== null) {
        try {
          await markImageAsUsed(match[1])
          updated++
        } catch { errors++ }
      }
    }

  } catch (error) {
    console.error('同步图片使用状态失败:', error)
    throw error
  }

  return { updated, errors }
}
