/**
 * 数据迁移脚本：将 SiteConfig 表的数据迁移到 Setting 表
 * 运行方式：npx tsx scripts/migrate-siteconfig.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始迁移 SiteConfig 数据到 Setting 表...')

  try {
    // 获取所有 SiteConfig 数据
    const siteConfigs = await prisma.siteConfig.findMany()
    console.log(`找到 ${siteConfigs.length} 条 SiteConfig 记录`)

    for (const config of siteConfigs) {
      // 使用 upsert 避免重复
      await prisma.setting.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: { key: config.key, value: config.value },
      })
      console.log(`  迁移: ${config.key}`)
    }

    console.log('迁移完成！')
    console.log('注意：确认迁移成功后，可以安全删除 SiteConfig 表')
  } catch (error) {
    console.error('迁移失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
