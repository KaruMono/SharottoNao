import type { User } from '@prisma/client'
import { resolveNsfwMode, type NsfwMode } from './nsfw'

/**
 * 获取显示标题（优先级：简中 > 繁中 > 日文 > 英文）
 */
export function getDisplayTitle(game: {
  titleEn: string | null
  titleJa: string | null
  titleZhHans: string | null
  titleZhHant: string | null
}): string {
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || ''
}

/**
 * 获取显示简介（优先级：简中 > 繁中 > 日文 > 英文）
 */
export function getDisplayDescription(game: {
  descriptionEn: string | null
  descriptionJa: string | null
  descriptionZhHans: string | null
  descriptionZhHant: string | null
}): string | null {
  return game.descriptionZhHans || game.descriptionZhHant || game.descriptionJa || game.descriptionEn || null
}

/**
 * 获取 NSFW 模式字符串（用于缓存键）
 */
export function getNsfwMode(user: User | null): NsfwMode {
  return resolveNsfwMode(user)
}
