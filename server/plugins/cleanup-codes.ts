import prisma from '~/server/utils/prisma'
import { isPrimaryInstance } from '~/server/utils/instance'

/**
 * 定期清理过期验证码（每小时执行一次）
 */
export default defineNitroPlugin((nitroApp) => {
  // 多实例部署时只在主实例执行，避免重复清理
  if (!isPrimaryInstance()) return

  const INTERVAL = 60 * 60 * 1000 // 1 小时

  async function cleanup() {
    try {
      const result = await prisma.verificationCode.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      })
      if (result.count > 0) {
        console.log(`[Cleanup] Deleted ${result.count} expired verification codes`)
      }
    } catch (error) {
      console.error('[Cleanup] Failed to clean expired codes:', error)
    }
  }

  const delayTimer = setTimeout(cleanup, 30 * 1000)
  const intervalTimer = setInterval(cleanup, INTERVAL)

  // unref() 确保这些定时器不会阻止进程退出（如 build 预渲染阶段）
  if (delayTimer.unref) delayTimer.unref()
  if (intervalTimer.unref) intervalTimer.unref()

  nitroApp.hooks.hookOnce('close', () => {
    clearTimeout(delayTimer)
    clearInterval(intervalTimer)
  })
})
