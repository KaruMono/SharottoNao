import prisma from '~/server/utils/prisma'
import { withDistributedLock } from '~/server/utils/distributed-lock'
import { isPrimaryInstance } from '~/server/utils/instance'

/**
 * 每晚 23:00 后，从最小游戏 ID 开始按顺序提交未提交过的公开游戏页面
 * 每分钟检查一次，确保当天只执行一次
 */
export default defineNitroPlugin((nitroApp) => {
  // 多实例部署时只在主实例执行，避免重复提交
  if (!isPrimaryInstance()) return

  const CHECK_INTERVAL = 60 * 1000 // 每分钟检查一次

  // 记录今天是否已执行过定时提交（内存标记，重启后重置）
  let lastScheduledDate = ''

  async function runScheduledSubmissionLocked() {
    const now = new Date()
    const hour = now.getHours()

    // 只在 23:00 之后执行
    if (hour < 23) return

    // 记录今天日期（YYYY-MM-DD）作为去重标记
    const today = now.toISOString().slice(0, 10)
    if (lastScheduledDate === today) return

    try {
      const settings = await prisma.indexNowSetting.findFirst()
      if (!settings || !settings.autoSubmissionEnabled || !settings.apiKey) return

      // 检查今日已提交数量，若已达限制则跳过
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const todayCount = await prisma.indexNowSubmission.count({
        where: {
          submittedAt: { gte: todayStart },
          status: 'SUCCESS',
        },
      })

      const remaining = settings.dailyLimit - todayCount
      if (remaining <= 0) {
        console.log(`[IndexNow Scheduler] 今日提交已达上限 (${todayCount}/${settings.dailyLimit})，跳过定时提交`)
        lastScheduledDate = today
        return
      }

      // 最多提交 10 个，且不超过剩余配额
      const batchSize = Math.min(10, remaining)

      const config = useRuntimeConfig()
      const siteUrl = (config.public.siteUrl || 'http://localhost:3000').replace(/\/+$/, '')
      const gameUrlPrefix = `${siteUrl}/games/`

      // 已经提交过的游戏页面不再重复提交，包含成功和失败记录
      const submittedGameUrls = await prisma.indexNowSubmission.findMany({
        where: {
          url: {
            startsWith: gameUrlPrefix,
          },
        },
        select: { url: true },
      })
      const submittedUrlSet = new Set(submittedGameUrls.map(item => item.url.replace(/\/+$/, '')))

      const urlList: string[] = []
      let cursorId = 0

      while (urlList.length < batchSize) {
        const games = await prisma.game.findMany({
          where: {
            deletedAt: null,
            isNsfw: false,
            id: { gt: cursorId },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: batchSize * 5,
        })

        if (games.length === 0) break

        for (const game of games) {
          cursorId = game.id
          const url = `${gameUrlPrefix}${game.id}`
          if (submittedUrlSet.has(url)) continue

          urlList.push(url)
          if (urlList.length >= batchSize) break
        }
      }

      if (urlList.length === 0) {
        console.log('[IndexNow Scheduler] 没有可继续提交的公开游戏页面')
        lastScheduledDate = today
        return
      }

      const host = new URL(siteUrl).hostname

      // 批量提交到 IndexNow
      const requestBody = {
        host,
        key: settings.apiKey,
        keyLocation: `${siteUrl}/${settings.apiKey}.txt`,
        urlList,
      }

      console.log(`[IndexNow Scheduler] 定时提交 ${urlList.length} 个游戏页面`)

      const response = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const success = response.status === 200 || response.status === 202
      const errorMessage = success ? null : `HTTP ${response.status}`

      if (!success) {
        console.error(`[IndexNow Scheduler] 提交失败，状态码: ${response.status}`)
      }

      // 记录每条提交历史
      await prisma.indexNowSubmission.createMany({
        data: urlList.map(url => ({
          url,
          status: success ? 'SUCCESS' : 'FAILED',
          type: 'UPDATE',
          errorMessage,
        })),
      })

      console.log(`[IndexNow Scheduler] 定时提交完成，${success ? '成功' : '失败'}`)
    } catch (err) {
      console.error('[IndexNow Scheduler] 定时提交异常:', err)
    }

    // 无论成功失败都标记今天已执行，避免反复重试
    lastScheduledDate = today
  }

  async function runScheduledSubmission() {
    try {
      await withDistributedLock(
        'indexnow-scheduled',
        runScheduledSubmissionLocked,
        { ttlMs: 15 * 60 * 1000 },
      )
    } catch (error) {
      console.error('[IndexNow Scheduler] 分布式锁失败:', error)
    }
  }

  const intervalTimer = setInterval(runScheduledSubmission, CHECK_INTERVAL)
  if (intervalTimer.unref) intervalTimer.unref()

  nitroApp.hooks.hookOnce('close', () => {
    clearInterval(intervalTimer)
  })
})
