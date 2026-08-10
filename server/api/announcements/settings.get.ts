import prisma from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const [sidebar, global] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { key: 'announcement_sidebar' } }),
    prisma.siteConfig.findUnique({ where: { key: 'announcement_global' } }),
  ])

  return {
    sidebar: sidebar?.value ? JSON.parse(sidebar.value) : null,
    global: global?.value ? JSON.parse(global.value) : null,
  }
})
