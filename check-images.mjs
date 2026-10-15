import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      titleZhHans: true,
      titleJa: true,
      titleEn: true,
      coverImage: true
    },
    take: 15,
    orderBy: { createdAt: 'desc' }
  })

  console.log('最新 15 个游戏的封面图片:')
  games.forEach(g => {
    const title = g.titleZhHans || g.titleJa || g.titleEn || 'Unknown'
    console.log(`ID: ${g.id}, 标题: ${title}`)
    console.log(`封面: ${g.coverImage || '无'}`)

    // 检查是否是外部链接
    if (g.coverImage) {
      if (g.coverImage.includes('vndb.org')) {
        console.log('⚠️  警告: 这是外部链接!')
      } else if (g.coverImage.startsWith('/uploads/')) {
        console.log('✓ 本地图片')
      }
    }
    console.log('---')
  })

  await prisma.$disconnect()
}

main().catch(console.error)
