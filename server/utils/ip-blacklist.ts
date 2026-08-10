import type { H3Event } from 'h3'
import prisma from '~/server/utils/prisma'
import { getClientIp } from '~/server/utils/rate-limit'

/**
 * 检查某个 IP 是否在黑名单中
 */
export async function isIpBlacklisted(ip: string): Promise<boolean> {
  if (!ip || ip === 'unknown') return false
  const entry = await prisma.ipBlacklist.findUnique({ where: { ip } })
  return !!entry
}

/**
 * 从请求中获取 IP 并检查是否在黑名单中
 */
export async function checkIpBlacklist(event: H3Event): Promise<void> {
  const ip = getClientIp(event)
  const blocked = await isIpBlacklisted(ip)
  if (blocked) {
    throw createError({
      statusCode: 400,
      message: '注册失败，请检查您的信息是否填写正确',
    })
  }
}

/**
 * 将一个 IP 加入黑名单
 */
export async function addIpToBlacklist(ip: string, createdBy: number, reason?: string): Promise<void> {
  if (!ip || ip === 'unknown') return
  await prisma.ipBlacklist.upsert({
    where: { ip },
    create: { ip, createdBy, reason: reason || null },
    update: { reason: reason || undefined },
  })
}
