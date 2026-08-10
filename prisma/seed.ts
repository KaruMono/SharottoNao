import { PrismaClient, UserRole, NsfwMode } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始初始化数据...')

  // 创建管理员账户
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@charlotte.local' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@charlotte.local',
      password: adminPassword,
      role: UserRole.ADMIN,
      nsfwMode: NsfwMode.ALL,
    },
  })
  console.log('✅ 管理员账户已创建:', admin.username)

  // 创建默认资源类型
  const resourceTypes = [
    { name: 'Windows资源', icon: 'fa-brands fa-windows', sortOrder: 1 },
    { name: 'Android资源', icon: 'fa-brands fa-android', sortOrder: 2 },
  ]

  for (const type of resourceTypes) {
    await prisma.resourceType.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    })
  }
  console.log('✅ 默认资源类型已创建')

  // 创建默认网盘类型
  const netDiskTypes = [
    { name: '百度网盘', icon: 'fa-solid fa-cloud', domains: ['pan.baidu.com'], sortOrder: 1 },
    { name: '夸克网盘', icon: 'fa-solid fa-cloud-arrow-down', domains: ['pan.quark.cn', 'drive.quark.cn'], sortOrder: 2 },
    { name: '阿里云盘', icon: 'fa-solid fa-cloud', domains: ['aliyundrive.com', 'alipan.com'], sortOrder: 3 },
    { name: 'Google Drive', icon: 'fa-brands fa-google-drive', domains: ['drive.google.com'], sortOrder: 10 },
    { name: 'OneDrive', icon: 'fa-brands fa-microsoft', domains: ['onedrive.live.com', '1drv.ms'], sortOrder: 11 },
    { name: 'MEGA', icon: 'fa-solid fa-cloud-arrow-down', domains: ['mega.nz'], sortOrder: 12 },
    { name: 'MediaFire', icon: 'fa-solid fa-fire', domains: ['mediafire.com'], sortOrder: 13 },
    { name: 'Pixeldrain', icon: 'fa-solid fa-droplet', domains: ['pixeldrain.com'], sortOrder: 14 },
  ]

  for (const type of netDiskTypes) {
    await prisma.netDiskType.upsert({
      where: { name: type.name },
      update: {
        icon: type.icon,
        domains: type.domains,
        sortOrder: type.sortOrder,
        isActive: true,
      },
      create: type,
    })
  }
  console.log('✅ 默认网盘类型已创建')

  // 创建默认标签
  const defaultTags = [
    { name: '纯爱', color: '#ec4899' },
    { name: 'NTR', color: '#8b5cf6' },
    { name: '催泪', color: '#3b82f6' },
    { name: '校园', color: '#22c55e' },
    { name: '幻想', color: '#f59e0b' },
    { name: '悬疑', color: '#6b7280' },
    { name: '治愈', color: '#14b8a6' },
    { name: '百合', color: '#f472b6' },
    { name: '机器翻译', color: '#ef4444', description: '包含机器翻译资源的游戏' },
  ]

  for (const tag of defaultTags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: tag,
    })
  }
  console.log('✅ 默认标签已创建')

  // 创建默认设置
  const defaultSettings = [
    { key: 'site_name', value: 'Charlotte' },
    { key: 'site_url', value: 'http://localhost:3000' },
    { key: 'site_description', value: 'Galgame 资源数据库' },
    { key: 'site_keywords', value: 'Galgame,Visual Novel,游戏资源' },
    { key: 'favicon', value: '' },
    { key: 'touch_icon', value: '/apple-touch-icon.png' },
    { key: 'cdn_type', value: 'none' }, // none, bootcdn, custom
    { key: 'cdn_url', value: '' },
    { key: 'footer_html', value: '' },
    { key: 'header_scripts', value: '' },
    { key: 'footer_scripts', value: '' },
    { key: 'indexnow_key', value: '' },
    { key: 'resource_sync_token', value: '' },
    { key: 'resource_sync_uploader_id', value: String(admin.id) },
  ]

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }
  console.log('✅ 默认设置已创建')

  // 创建默认公告
  await prisma.announcement.upsert({
    where: { id: 1 },
    update: {},
    create: {
      content: '欢迎来到 Charlotte，本站为 Galgame 条目数据库，支持用户协作编辑。',
      isActive: true,
    },
  })
  console.log('✅ 默认公告已创建')

  console.log('🎉 数据初始化完成！')
  console.log('')
  console.log('📝 管理员账户信息:')
  console.log('   邮箱: admin@charlotte.local')
  console.log('   密码: admin123')
  console.log('')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
