/**
 * 是否为主实例（PM2 cluster 模式下只有 instance 0 返回 true）
 * 用于保证定时任务在多实例部署时只执行一次
 * 非 PM2 环境（开发模式等）NODE_APP_INSTANCE 未定义，视为主实例
 */
export function isPrimaryInstance(): boolean {
  const instance = process.env.NODE_APP_INSTANCE
  return instance === undefined || instance === '0'
}
