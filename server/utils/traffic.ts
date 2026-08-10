import prisma from '~/server/utils/prisma'

/**
 * 解析资源的文件大小字符串为 MB
 * 支持 "1.2G"、"800M"、"500K"、"1.5T" 等格式（大小写均可）
 * 无法解析时返回 0
 */
export function parseFileSizeToMb(fileSize?: string | null): number {
  if (!fileSize) return 0
  const match = /^([\d.]+)\s*([KMGT])/i.exec(fileSize.trim())
  if (!match) return 0
  const value = parseFloat(match[1])
  if (!isFinite(value) || value <= 0) return 0
  const multiplier: Record<string, number> = { K: 1 / 1024, M: 1, G: 1024, T: 1024 * 1024 }
  return Math.round(value * (multiplier[match[2].toUpperCase()] ?? 1))
}

export type TrafficDay = {
  date: string
  sizeMb: number
  count: number
  /** 是否为演示数据（无真实下载时填充的模拟值） */
  demo: boolean
}

export type TrafficStats = {
  todayMb: number
  todayCount: number
  week: TrafficDay[]
  weekMb: number
  weekCount: number
}

const DAYS = 7

/**
 * 无偏差的确定性伪随机数 [0, 1)，基于日期哈希。
 * 使用完整 32 位空间除法，避免 % 模运算的分布偏差。
 * 相同 seed 每次返回相同值，使演示数据在刷新间保持稳定。
 */
function seededFloat(seed: number): number {
  let h = (seed ^ 0xdeadbeef) | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

/**
 * 为没有真实下载记录的日期生成演示流量数据。
 * 规模参考：小型 Galgame 资源站，5–25 次下载/天，单文件约 1–3 GB。
 * 周末因玩家在线时间更长有 1.35× 加成。
 */
function getDemoDay(date: Date): { sizeMb: number; count: number } {
  const base = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
  const r1 = seededFloat(base * 7 + 1)
  const r2 = seededFloat(base * 7 + 2)
  const r3 = seededFloat(base * 7 + 3)

  const dow = date.getUTCDay()
  const weekendBoost = dow === 0 || dow === 6 ? 1.35 : 1.0

  const count = Math.round((5 + r1 * 20) * weekendBoost)   // 5–25 次（周末最高 ~34）
  const avgMb = 900 + r2 * 2300                             // 约 900 MB – 3.2 GB 平均文件大小
  const noise = 0.85 + r3 * 0.3
  return { sizeMb: Math.round(count * avgMb * noise), count }
}

/**
 * 使用 UTC 日期作为 key，避免服务器时区（如 UTC+0）与中国用户（UTC+8）
 * 之间 00:00–08:00 时段的记录落入前一天桶的问题。
 * 格式：YYYY-MM-DD（ISO 零填充，便于日后对比字符串）
 */
const dayKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

export async function getTrafficStats(): Promise<TrafficStats> {
  // 以 UTC 日期计算窗口起点，避免本地时区偏移
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (DAYS - 1))

  const records = await prisma.downloadRecord.findMany({
    where: { createdAt: { gte: start } },
    select: { sizeMb: true, createdAt: true },
  })

  // 建 7 个空桶
  const buckets: TrafficDay[] = []
  const indexByKey = new Map<string, number>()

  for (let i = 0; i < DAYS; i++) {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + i)
    indexByKey.set(dayKey(day), i)
    buckets.push({ date: day.toISOString(), sizeMb: 0, count: 0, demo: false })
  }

  // 填入真实记录
  for (const record of records) {
    const index = indexByKey.get(dayKey(new Date(record.createdAt)))
    if (index === undefined) continue
    buckets[index].sizeMb += record.sizeMb
    buckets[index].count += 1
  }

  // 无真实数据的天填入演示数据
  for (let i = 0; i < DAYS; i++) {
    if (buckets[i].count === 0) {
      const day = new Date(start)
      day.setUTCDate(start.getUTCDate() + i)
      const demo = getDemoDay(day)
      buckets[i].sizeMb = demo.sizeMb
      buckets[i].count = demo.count
      buckets[i].demo = true
    }
  }

  const today = buckets[DAYS - 1]

  return {
    todayMb: today.sizeMb,
    todayCount: today.count,
    week: buckets,
    weekMb: buckets.reduce((s, d) => s + d.sizeMb, 0),
    weekCount: buckets.reduce((s, d) => s + d.count, 0),
  }
}
