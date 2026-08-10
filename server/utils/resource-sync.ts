import type { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed } from '~/server/utils/image'
import { recordActivity } from '~/server/utils/activity'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { updateMachineTranslationTag } from '~/server/utils/machine-translation-tag'
import { invalidateGameCaches } from '~/server/utils/redis'

const DEFAULT_COVER_IMAGE = '/images/placeholder.png'

type VndbData = {
  vndbId: string
  titleEn?: string | null
  titleJa?: string | null
  titleZhHans?: string | null
  titleZhHant?: string | null
  aliases?: string[]
  descriptionEn?: string | null
  released?: string | null
  coverImage?: string | null
  isNsfw?: boolean
  lengthMinutes?: number | null
  developers?: Array<{ name: string; nameOriginal?: string | null }>
  staff?: Array<{ name: string; nameOriginal?: string | null; role: string; characterName?: string | null }>
}

export type ResourceSyncPayload = {
  vndbId: string
  title: string
  url: string
  typeId: number
  language: 'ja' | 'en' | 'zh-Hans' | 'zh-Hant' | 'ko'
  fileSize: string
  extractCode?: string | null
  unzipPassword?: string | null
  remark?: string | null
  isMachineTranslated?: boolean
}

export type ResourceSyncOptions = {
  uploaderId?: number
}

export type ResourceSyncResult = {
  ok: true
  resourceId: string
  message: string
  gameId: number
  action: 'created' | 'updated'
}

function parseReleaseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

function getNameIndex(name: string): string {
  const firstChar = name.charAt(0).toUpperCase()
  return /[A-Z]/.test(firstChar) ? firstChar : '#'
}

function pickTitle(data: VndbData): string {
  return data.titleZhHans || data.titleZhHant || data.titleJa || data.titleEn || data.vndbId
}

async function fetchVndbData(vndbId: string): Promise<VndbData> {
  return await $fetch<VndbData>(`/api/vndb/${vndbId}`)
}

async function uploadImageFromUrl(url: string): Promise<string | null> {
  try {
    const result = await $fetch<{ url: string }>('/api/upload/from-url', {
      method: 'POST',
      body: { url, folder: 'covers' },
    })
    return result.url
  } catch {
    return null
  }
}

export async function ensureDefaultUploaderId(preferredUploaderId?: number): Promise<number> {
  if (preferredUploaderId) {
    const user = await prisma.user.findUnique({ where: { id: preferredUploaderId, status: 'ACTIVE' } })
    if (user) return user.id
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    orderBy: { id: 'asc' },
  })
  if (!admin) {
    throw createError({ statusCode: 500, message: '未找到可用的资源发布者' })
  }
  return admin.id
}

async function ensureResourceTypeId(typeId: number): Promise<number> {
  const type = await prisma.resourceType.findUnique({ where: { id: typeId } })
  if (!type) {
    throw createError({ statusCode: 400, message: '无效的资源平台' })
  }
  return type.id
}

async function ensureCompany(name: string, creatorId: number): Promise<number> {
  const normalized = name.trim()
  const existing = await prisma.company.findFirst({
    where: {
      OR: [
        { name: normalized },
        { nameOriginal: normalized },
        { aliases: { has: normalized } },
      ],
    },
  })
  if (existing) return existing.id

  const company = await prisma.company.create({
    data: {
      name: normalized,
      nameOriginal: null,
      nameIndex: getNameIndex(normalized),
      aliases: [],
      creatorId,
    },
  })
  return company.id
}

async function attachCompany(gameId: number, companyId: number): Promise<void> {
  await prisma.gameCompany.upsert({
    where: { gameId_companyId: { gameId, companyId } },
    update: {},
    create: { gameId, companyId, role: 'DEVELOPER' },
  })
}

export async function findExistingGame(vndbId: string) {
  return prisma.game.findFirst({ where: { vndbId, deletedAt: null } })
}

export async function createGameFromVndb(vndbId: string, creatorId: number, activitySource = 'resource-sync') {
  const vndbData = await fetchVndbData(vndbId)
  const hasTitle = vndbData.titleEn || vndbData.titleJa || vndbData.titleZhHans || vndbData.titleZhHant
  if (!hasTitle) {
    throw createError({ statusCode: 422, message: 'VNDB 条目缺少可用标题，无法自动创建游戏条目' })
  }

  let coverImage = DEFAULT_COVER_IMAGE
  if (vndbData.coverImage) {
    coverImage = await uploadImageFromUrl(vndbData.coverImage) || vndbData.coverImage
  }

  const game = await prisma.game.create({
    data: {
      vndbId: vndbData.vndbId,
      titleEn: vndbData.titleEn || null,
      titleJa: vndbData.titleJa || null,
      titleZhHans: vndbData.titleZhHans || null,
      titleZhHant: vndbData.titleZhHant || null,
      aliases: vndbData.aliases || [],
      descriptionEn: vndbData.descriptionEn || '-',
      descriptionZhHans: null,
      coverImage,
      releaseDate: parseReleaseDate(vndbData.released),
      isNsfw: vndbData.isNsfw || false,
      lengthMinutes: vndbData.lengthMinutes || null,
      creatorId,
    },
  })

  if (coverImage) {
    await markImageAsUsed(coverImage, game.id)
  }

  const developerName = vndbData.developers?.[0]?.name
  if (developerName) {
    const companyId = await ensureCompany(developerName, creatorId)
    await attachCompany(game.id, companyId)
  }

  if (vndbData.staff?.length) {
    for (const staff of vndbData.staff) {
      if (!staff.name) continue
      const existingStaff = await prisma.staff.findFirst({ where: { name: staff.name } })
      const staffRecord = existingStaff || await prisma.staff.create({
        data: { name: staff.name, nameOriginal: staff.nameOriginal || null },
      })
      await prisma.gameStaff.create({
        data: {
          gameId: game.id,
          staffId: staffRecord.id,
          role: staff.role as any,
          characterName: staff.characterName || null,
        },
      }).catch(() => {})
    }
  }

  recordActivity({
    userId: creatorId,
    type: 'CREATE_GAME',
    targetType: 'game',
    targetId: game.id,
    meta: {
      gameTitle: pickTitle(vndbData),
      gameCover: coverImage,
      source: activitySource,
    },
  })

  submitGameToIndexNow(game.id, 'ADD').catch(err => {
    console.error('IndexNow submission failed:', err)
  })

  return game
}

export async function syncPublishedResource(payload: ResourceSyncPayload, options: ResourceSyncOptions = {}): Promise<ResourceSyncResult> {
  const uploaderId = await ensureDefaultUploaderId(options.uploaderId)
  const typeId = await ensureResourceTypeId(payload.typeId)
  const normalizedVndbId = payload.vndbId.toLowerCase()

  const game = await findExistingGame(normalizedVndbId) || await createGameFromVndb(normalizedVndbId, uploaderId)

  const existingResource = await prisma.resource.findFirst({
    where: {
      gameId: game.id,
      typeId,
      deletedAt: null,
      OR: [
        { url: payload.url },
        { title: payload.title },
      ],
    },
    orderBy: { id: 'asc' },
  })

  const data: Prisma.ResourceUncheckedCreateInput = {
    gameId: game.id,
    typeId,
    uploaderId,
    title: payload.title,
    url: payload.url,
    extractCode: payload.extractCode || null,
    unzipPassword: payload.unzipPassword || null,
    remark: payload.remark || null,
    language: payload.language,
    fileSize: payload.fileSize,
    isMachineTranslated: payload.isMachineTranslated || false,
    status: 'APPROVED',
  }

  const resource = existingResource
    ? await prisma.resource.update({ where: { id: existingResource.id }, data })
    : await prisma.resource.create({ data })

  recordActivity({
    userId: uploaderId,
    type: 'EDIT_GAME',
    targetType: 'game',
    targetId: game.id,
    meta: {
      gameTitle: game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || normalizedVndbId,
      action: existingResource ? '同步更新下载资源' : '同步添加下载资源',
      source: 'resource-sync',
    },
  })

  if (payload.isMachineTranslated) {
    updateMachineTranslationTag(game.id).catch(err => {
      console.error('Failed to update machine translation tag:', err)
    })
  }

  invalidateGameCaches(game.id).catch(() => {})

  return {
    ok: true,
    resourceId: String(resource.id),
    gameId: game.id,
    action: existingResource ? 'updated' : 'created',
    message: existingResource ? '资源已同步更新' : '资源已同步创建',
  }
}
