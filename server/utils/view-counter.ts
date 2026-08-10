import { getRedisClient } from './redis'
import prisma from './prisma'

const SYNC_INTERVAL = 60 * 1000 // 60 秒同步一次
const VIEW_COUNT_PREFIX = 'viewcount:game:'
let syncTimer: ReturnType<typeof setInterval> | null = null

export function clearSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

/**
 * 增加游戏浏览量（Redis 累积，不阻塞响应）
 */
export async function incrementViewCount(gameId: number): Promise<void> {
  const redis = await getRedisClient()
  if (!redis) {
    // Redis 不可用，直接更新数据库（降级）
    prisma.game.update({
      where: { id: gameId },
      data: { viewCount: { increment: 1 } },
    }).catch(err => console.error('View count update error:', err))
    return
  }

  try {
    await redis.incr(`${VIEW_COUNT_PREFIX}${gameId}`)
    ensureSyncTimer()
  } catch (error) {
    console.error('Redis view count error:', error)
  }
}

/**
 * 确保同步定时器运行
 */
function ensureSyncTimer() {
  if (syncTimer) return
  syncTimer = setInterval(syncViewCounts, SYNC_INTERVAL)
  if (syncTimer.unref) syncTimer.unref()
}

/**
 * 将 Redis 中累积的浏览量批量同步到数据库
 */
export async function syncViewCounts(): Promise<void> {
  const redis = await getRedisClient()
  if (!redis) return

  try {
    // 用 SCAN 游标迭代获取所有浏览量键，避免 KEYS 阻塞 Redis
    const keys: string[] = []
    for await (const key of redis.scanIterator({ MATCH: `${VIEW_COUNT_PREFIX}*`, COUNT: 200 })) {
      keys.push(key)
    }
    if (keys.length === 0) return

    // 批量读取并清零
    for (const key of keys) {
      const gameId = parseInt(key.replace(VIEW_COUNT_PREFIX, ''))
      if (isNaN(gameId)) continue

      // 原子性获取并删除
      const count = await redis.getDel(key)
      if (!count || parseInt(count) === 0) continue

      // 批量更新数据库
      await prisma.game.update({
        where: { id: gameId },
        data: { viewCount: { increment: parseInt(count) } },
      }).catch(err => {
        // 如果更新失败，把计数放回 Redis
        console.error(`Sync view count for game ${gameId} failed:`, err)
        redis.incrBy(key, parseInt(count)).catch(() => {})
      })
    }
  } catch (error) {
    console.error('Sync view counts error:', error)
  }
}
