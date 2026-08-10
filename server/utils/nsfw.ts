import { getAuthUser } from './auth'
import type { User } from '@prisma/client'
import type { H3Event } from 'h3'

export type NsfwMode = 'SFW' | 'NSFW' | 'ALL'
export type NsfwFilter = { isNsfw?: boolean }

export function resolveNsfwMode(user: Pick<User, 'nsfwMode'> | null): NsfwMode {
  return user?.nsfwMode || 'SFW'
}

export function buildNsfwFilterFromMode(mode: NsfwMode): NsfwFilter {
  if (mode === 'SFW') return { isNsfw: false }
  if (mode === 'NSFW') return { isNsfw: true }
  return {}
}

export function buildNsfwFilterFromUser(user: Pick<User, 'nsfwMode'> | null): NsfwFilter {
  return buildNsfwFilterFromMode(resolveNsfwMode(user))
}

export async function getUserNsfwPreference(event: H3Event): Promise<NsfwMode> {
  const user = await getAuthUser(event)
  return resolveNsfwMode(user)
}

/**
 * 检查用户是否可以查看 NSFW 内容
 * @param event H3 事件对象
 * @returns 是否可以查看 NSFW 内容
 */
export async function canViewNsfw(event: H3Event): Promise<boolean> {
  const mode = await getUserNsfwPreference(event)
  return mode === 'NSFW' || mode === 'ALL'
}

/**
 * 构建 NSFW 过滤条件（用于 Prisma 查询）
 * @param event H3 事件对象
 * @returns Prisma where 条件对象
 */
export async function buildNsfwFilter(event: H3Event): Promise<NsfwFilter> {
  const mode = await getUserNsfwPreference(event)
  return buildNsfwFilterFromMode(mode)
}
