import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import { setSetting, clearSettingsCache } from '~/server/utils/settings'
import { invalidateNavConfigCache } from '~/server/utils/ad-cache'

const navLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(20),
  to: z.string().min(1).max(200),
  icon: z.string().max(100),
  visible: z.boolean(),
  isBuiltin: z.boolean(),
  requireAuth: z.boolean(),
  sortOrder: z.number(),
})

const iconButtonSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(20),
  action: z.string().min(1).max(200),
  icon: z.string().min(1).max(100),
  visible: z.boolean(),
  isBuiltin: z.boolean(),
  requireAuth: z.boolean().optional().default(false),
  sortOrder: z.number(),
})

const footerLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(50),
  url: z.string().min(1).max(500),
  icon: z.string().max(100),
  visible: z.boolean(),
  isBuiltin: z.boolean(),
  openInNewTab: z.boolean(),
  requireAuth: z.boolean().optional().default(false),
  sortOrder: z.number(),
})

const schema = z.object({
  navLinks: z.array(navLinkSchema),
  iconButtons: z.array(iconButtonSchema),
  footerLinks: z.array(footerLinkSchema).optional().default([]),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const config = schema.parse(body)

  await setSetting('navbar_config', JSON.stringify(config))
  clearSettingsCache()
  await invalidateNavConfigCache()

  return { success: true, message: '导航栏配置已保存' }
})
