import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // 找出所有含大写字母的邮箱
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  })

  const toUpdate = users.filter(u => u.email !== u.email.toLowerCase())

  if (toUpdate.length === 0) {
    return { count: 0, message: '所有邮箱已是小写，无需处理' }
  }

  // 逐条更新（防止唯一键冲突时能精确报错）
  let updated = 0
  const skipped: string[] = []

  for (const u of toUpdate) {
    const normalized = u.email.toLowerCase()
    // 检查小写版本是否已被其他账号占用
    const conflict = await prisma.user.findFirst({
      where: { email: normalized, id: { not: u.id } },
    })
    if (conflict) {
      skipped.push(u.email)
      continue
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { email: normalized },
    })
    updated++
  }

  const parts: string[] = [`成功转换 ${updated} 个邮箱为小写`]
  if (skipped.length > 0) {
    parts.push(`${skipped.length} 个因小写版本已被占用而跳过：${skipped.join('、')}`)
  }

  return { count: updated, skipped: skipped.length, message: parts.join('；') }
})
