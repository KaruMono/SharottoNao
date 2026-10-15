import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 检查数据库中的外部图片链接...\n')

  // 检查游戏封面
  const gamesWithExternalCovers = await prisma.game.findMany({
    where: {
      coverImage: {
        contains: 'vndb.org'
      }
    },
    select: {
      id: true,
      titleZhHans: true,
      titleJa: true,
      titleEn: true,
      coverImage: true
    }
  })

  console.log(`📦 游戏封面: 找到 ${gamesWithExternalCovers.length} 个外部链接`)
  gamesWithExternalCovers.forEach(game => {
    const title = game.titleZhHans || game.titleJa || game.titleEn || 'Unknown'
    console.log(`  - ID: ${game.id}, 标题: ${title}`)
    console.log(`    链接: ${game.coverImage}`)
  })

  // 检查游戏横幅
  const gamesWithExternalBanners = await prisma.game.findMany({
    where: {
      bannerImage: {
        contains: 'vndb.org'
      }
    },
    select: {
      id: true,
      titleZhHans: true,
      titleJa: true,
      titleEn: true,
      bannerImage: true
    }
  })

  console.log(`\n🎨 游戏横幅: 找到 ${gamesWithExternalBanners.length} 个外部链接`)
  gamesWithExternalBanners.forEach(game => {
    const title = game.titleZhHans || game.titleJa || game.titleEn || 'Unknown'
    console.log(`  - ID: ${game.id}, 标题: ${title}`)
    console.log(`    链接: ${game.bannerImage}`)
  })

  // 检查截图
  const screenshotsWithExternal = await prisma.screenshot.findMany({
    where: {
      url: {
        contains: 'vndb.org'
      }
    },
    select: {
      id: true,
      gameId: true,
      url: true
    }
  })

  console.log(`\n📸 游戏截图: 找到 ${screenshotsWithExternal.length} 个外部链接`)

  // 检查公司 Logo
  const companiesWithExternalLogos = await prisma.company.findMany({
    where: {
      logo: {
        contains: 'vndb.org'
      }
    },
    select: {
      id: true,
      name: true,
      logo: true
    }
  })

  console.log(`\n🏢 公司 Logo: 找到 ${companiesWithExternalLogos.length} 个外部链接`)

  const totalExternal =
    gamesWithExternalCovers.length +
    gamesWithExternalBanners.length +
    screenshotsWithExternal.length +
    companiesWithExternalLogos.length

  console.log(`\n📊 总计: ${totalExternal} 个外部链接`)

  if (totalExternal > 0) {
    console.log(`\n⚠️  警告: 发现外部图片链接！`)
    console.log(`这些图片应该通过导入功能重新下载到本地。`)
    console.log(`\n建议操作:`)
    console.log(`1. 在管理后台使用"扫描并修复封面"功能`)
    console.log(`2. 或使用 /api/upload/from-url 接口批量下载这些图片`)
  } else {
    console.log(`\n✅ 所有图片都已本地化，没有外部链接！`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
