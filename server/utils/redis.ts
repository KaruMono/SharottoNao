import { createClient, type RedisClientType } from 'redis'

type RedisGlobal = typeof globalThis & {
  __redisClient?: RedisClientType
}

let redisClient: RedisClientType | null = null
// 连接中的 Promise，用于并发首连去重，避免同时创建多个连接
let connectingPromise: Promise<RedisClientType | null> | null = null

/**
 * 获取 Redis 客户端实例
 * 如果 Redis 未配置或连接失败，返回 null（降级为无缓存模式）
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  const config = useRuntimeConfig()

  // 如果未配置 Redis URL，返回 null
  if (!config.redisUrl) {
    return null
  }

  // 如果已有连接，直接返回
  if (redisClient?.isOpen) {
    return redisClient
  }

  // 已有连接正在建立中，复用同一个 Promise
  if (connectingPromise) {
    return connectingPromise
  }

  connectingPromise = (async () => {
    try {
      const client: RedisClientType = createClient({
        url: config.redisUrl,
      })

      client.on('error', (err) => {
        console.error('Redis Client Error:', err)
      })

      await client.connect()
      console.log('✅ Redis connected')
      redisClient = client
      // 挂载到 globalThis，让 build close hook 能断开连接
      ;(globalThis as RedisGlobal).__redisClient = client
      return client
    } catch (error) {
      console.warn('⚠️ Redis connection failed, running without cache:', error)
      return null
    } finally {
      connectingPromise = null
    }
  })()

  return connectingPromise
}

/**
 * 缓存包装器 - 自动处理缓存读取和写入
 * @param key 缓存键
 * @param fetcher 数据获取函数
 * @param ttl 缓存时间（秒），默认 60 秒
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  const redis = await getRedisClient()

  // 如果 Redis 不可用，直接执行查询
  if (!redis) {
    return fetcher()
  }

  try {
    // 尝试从缓存读取
    const cached = await redis.get(key)
    if (cached) {
      return JSON.parse(cached) as T
    }

    // 缓存未命中，执行查询
    const data = await fetcher()

    // 写入缓存（异步，不阻塞响应）
    redis.setEx(key, ttl, JSON.stringify(data)).catch((err) => {
      console.error('Redis setEx error:', err)
    })

    return data
  } catch (error) {
    console.error('Redis cache error:', error)
    // 降级：直接执行查询
    return fetcher()
  }
}

/**
 * 删除缓存
 * @param pattern 缓存键模式，支持通配符 *
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const redis = await getRedisClient()
  if (!redis) return

  try {
    if (pattern.includes('*')) {
      // 通配符删除：用 SCAN 游标迭代，避免 KEYS 阻塞 Redis 主线程
      const batch: string[] = []
      for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 200 })) {
        batch.push(key)
        if (batch.length >= 200) {
          await redis.del(batch.splice(0))
        }
      }
      if (batch.length > 0) {
        await redis.del(batch)
      }
    } else {
      await redis.del(pattern)
    }
  } catch (error) {
    console.error('Redis invalidate error:', error)
  }
}

// 预定义的缓存键
export const CacheKeys = {
  HOME_DATA: (nsfwMode: string) => `home:${nsfwMode}`,
  GAME_DETAIL: (id: number) => `game:${id}`,
  GAME_LIST: (params: string) => `games:${params}`,
  TAGS: 'tags:all',
  HOT_SEARCHES: 'hot-searches',
  SITE_SETTINGS: 'site:settings',
  SEARCH: (q: string, type: string, nsfwMode: string) => `search:${q}:${type}:${nsfwMode}`,
  SUGGESTIONS: (q: string, nsfwMode: string) => `suggest:${q}:${nsfwMode}`,
}

/**
 * 清除与游戏相关的所有缓存（游戏增删改后调用）
 */
export async function invalidateGameCaches(gameId?: number): Promise<void> {
  await Promise.all([
    invalidateCache('home:*'),
    invalidateCache('search:*'),
    invalidateCache('suggest:*'),
    invalidateCache('games:*'),
    invalidateCache('calendar:*'),
    invalidateCache('leaderboard:*'),
    gameId ? invalidateCache(`game:${gameId}`) : Promise.resolve(),
  ])
}

// 预定义的 TTL（秒）
export const CacheTTL = {
  SHORT: 60,        // 1 分钟 - 首页、列表
  MEDIUM: 300,      // 5 分钟 - 游戏详情
  LONG: 3600,       // 1 小时 - 标签、设置
  DAY: 86400,       // 1 天 - 静态内容
}
