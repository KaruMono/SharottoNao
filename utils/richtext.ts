/**
 * 判断富文本编辑器内容是否“实质为空”。
 * Tiptap 等编辑器在无内容时会产出 <p></p> 之类的空标签，长度非零但没有可见内容。
 * 用于按钮 disabled 判断，避免提交出只有头像和用户名的空评论。
 * 含图片（含表情图片）、表情标记 [emoji:...] 或任意非空白文本时视为非空。
 */
export function isEmptyRichText(html: string | null | undefined): boolean {
  if (!html) return true
  if (/<img\b/i.test(html)) return false
  if (/\[emoji:[^\]]+\]/i.test(html)) return false
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(?:32|160);/g, ' ')
    .replace(/\s+/g, '')
    .trim()
  return text.length === 0
}
