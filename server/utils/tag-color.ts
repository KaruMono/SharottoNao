/**
 * 标签自动配色。
 *
 * 色板取自 prisma/seed.ts 里内置标签用的那批颜色，保证自动创建的标签
 * 和手工创建的标签观感一致。
 *
 * 不用随机 HSL：条目页是 `color + '20'` 当背景、`color` 当文字
 * （pages/games/[id]/index.vue），随机色在暗色模式下很容易对比度不足。
 */
const TAG_PALETTE = [
  '#ec4899', // 粉
  '#8b5cf6', // 紫
  '#3b82f6', // 蓝
  '#22c55e', // 绿
  '#f59e0b', // 橙
  '#6b7280', // 灰
  '#14b8a6', // 青
  '#f472b6', // 浅粉
] as const

/**
 * 按标签名取一个稳定的颜色：同名永远同色，不同名尽量分散。
 * 比较时忽略大小写与首尾空白，避免 "NTR" 和 "ntr" 拿到不同颜色。
 */
export function pickTagColor(name: string): string {
  const key = (name || '').trim().toLowerCase()

  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }

  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}
