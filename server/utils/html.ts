/**
 * HTML 清理工具
 * 使用 sanitize-html 库清理用户提交的 HTML 内容，防止 XSS 攻击
 */
import sanitize from 'sanitize-html'

const sanitizeOptions: sanitize.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'class'],
    img: ['src', 'alt', 'class', 'style', 'width', 'height'],
    span: ['class', 'style'],
    div: ['class', 'style'],
    pre: ['class'],
    code: ['class'],
    p: ['class', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowedStyles: {
    '*': {
      'width': [/^\d+(\.\d+)?(px|em|rem|%)$/i, /^auto$/i],
      'height': [/^\d+(\.\d+)?(px|em|rem|%)$/i, /^auto$/i],
      'vertical-align': [/^(baseline|sub|super|text-top|text-bottom|middle|top|bottom)$/i],
      'display': [/^(inline|inline-block|block)$/i],
      'text-align': [/^(left|right|center|justify)$/i],
    },
  },
  // 不要移除空白字符
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
  // 自动给外链加 noopener noreferrer
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.href && !attribs.href.startsWith('/') && !attribs.href.startsWith('#')) {
        attribs.target = '_blank'
        attribs.rel = 'noopener noreferrer'
      }
      return { tagName, attribs }
    },
  },
}

/**
 * 清理 HTML 内容，防止 XSS
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return sanitize(html, sanitizeOptions)
}

/**
 * 从 HTML 提取纯文本
 */
export function stripHtml(html: string): string {
  if (!html) return ''
  return sanitize(html, { allowedTags: [], allowedAttributes: {} }).trim()
}

/**
 * 判断 HTML 内容是否“实质为空”
 * 富文本编辑器在无内容时会产出 <p></p> 之类的空标签，
 * 这类内容长度非零但没有任何可见内容，若入库会渲染成只有头像/用户名的空评论。
 * 含有图片（如表情）或表情标记 [emoji:...] 或任意非空白文本时视为非空。
 */
export function isEffectivelyEmptyHtml(html: string | null | undefined): boolean {
  if (!html) return true
  // 图片（含表情图片）视为有内容
  if (/<img\b/i.test(html)) return false
  // 表情标记视为有内容
  if (/\[emoji:[^\]]+\]/i.test(html)) return false
  // 去除标签后，将 &nbsp; 等空白实体归一化，再判断是否有可见文本
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(?:32|160);/g, ' ')
    .replace(/\s+/g, '')
    .trim()
  return text.length === 0
}

/**
 * 验证 HTML 内容
 */
export function validateHtml(html: string): { valid: boolean; error?: string } {
  if (!html) return { valid: true }
  
  // 检查长度
  if (html.length > 100000) {
    return { valid: false, error: '内容过长，请控制在 100000 字符以内' }
  }
  
  return { valid: true }
}
