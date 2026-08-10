import { isEffectivelyEmptyHtml } from './html'

/**
 * 计算“可安全清理的空壳评论”ID 集合。
 *
 * 规则与评论读取接口（games/[id].get、comments.get）的过滤逻辑保持一致：
 * - 空回复：直接可删。
 * - 空的顶级评论：仅当其没有任何“非空回复”时才可删；
 *   若仍挂着有效回复则必须保留——因为顶级评论物理删除会级联删除其全部回复
 *   （schema 中 parent 关系为 onDelete: Cascade），删掉会误伤有效回复。
 *
 * 传入的评论列表应为“未软删除”的评论（deletedAt = null）。
 */
export function computeDeletableEmptyCommentIds(
  comments: Array<{ id: number; content: string; parentId: number | null }>,
): Set<number> {
  const repliesByParent = new Map<number, Array<{ id: number; content: string }>>()
  for (const c of comments) {
    if (c.parentId != null) {
      const arr = repliesByParent.get(c.parentId) ?? []
      arr.push({ id: c.id, content: c.content })
      repliesByParent.set(c.parentId, arr)
    }
  }

  const deletable = new Set<number>()
  for (const c of comments) {
    if (!isEffectivelyEmptyHtml(c.content)) continue

    // 空回复直接可删
    if (c.parentId != null) {
      deletable.add(c.id)
      continue
    }

    // 空的顶级评论：有非空回复则保留，否则可删
    const replies = repliesByParent.get(c.id) ?? []
    const hasNonEmptyReply = replies.some(r => !isEffectivelyEmptyHtml(r.content))
    if (!hasNonEmptyReply) {
      deletable.add(c.id)
    }
  }

  return deletable
}
