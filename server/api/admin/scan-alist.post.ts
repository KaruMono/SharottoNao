import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { getSetting } from '~/server/utils/settings'
import { normalizeAlistBaseUrl } from '~/server/utils/alist'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const alistBaseUrl = await getSetting('alist_base_url')
  if (!alistBaseUrl) {
    throw createError({ statusCode: 400, message: '未配置 Alist 地址，请先在网站设置中配置' })
  }

  const normalizedBase = normalizeAlistBaseUrl(alistBaseUrl)

  const resources = await prisma.resource.findMany({
    where: {
      deletedAt: null,
      url: { startsWith: normalizedBase },
    },
    select: {
      id: true,
      title: true,
      url: true,
      fileSize: true,
      language: true,
      game: {
        select: {
          id: true,
          titleZhHans: true,
          titleJa: true,
          titleEn: true,
        },
      },
    },
  })

  return {
    total: resources.length,
    resources: resources.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      fileSize: r.fileSize,
      currentLanguage: r.language,
      gameId: r.game.id,
      gameTitle: r.game.titleZhHans || r.game.titleJa || r.game.titleEn || `#${r.game.id}`,
    })),
  }
})
