<template>
  <component :is="tag" v-html="sanitized" />
</template>

<script lang="ts">
// isomorphic-dompurify 的浏览器构建只是 dompurify 的 re-export（<1KB），
// 服务端通过 jsdom 提供 DOM 环境，保证 SSR 输出（评论/攻略内容）同样经过净化
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_STYLE_PROPS = ['width', 'height', 'vertical-align', 'display', 'text-align']

// 全局 hook 在模块作用域只注册一次，避免每个组件实例重复注册导致泄漏
// 为外部链接添加 target="_blank" 和 rel="noopener noreferrer"
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') || ''
    if (href && !href.startsWith('/') && !href.startsWith('#')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  }
  // 过滤 style 属性，只保留允许的 CSS 属性
  if (node.hasAttribute('style')) {
    const style = node.getAttribute('style') || ''
    const filtered = style
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const prop = s.split(':')[0]?.trim().toLowerCase()
        return prop && ALLOWED_STYLE_PROPS.includes(prop)
      })
      .join('; ')
    if (filtered) {
      node.setAttribute('style', filtered)
    } else {
      node.removeAttribute('style')
    }
  }
})

// 保留空段落：为空的 <p> 标签插入 <br>，防止浏览器折叠
// 用 ownerDocument 而非全局 document：服务端（jsdom）没有全局 document
DOMPurify.addHook('afterSanitizeElements', (node) => {
  if (node.nodeName === 'P' && node.childNodes.length === 0) {
    const doc = node.ownerDocument
    if (doc) {
      node.appendChild(doc.createElement('br'))
    }
  }
})
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  content: string
  tag?: string
}>(), {
  tag: 'div',
})

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'span', 'div',
]

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'style',
  'src', 'alt', 'width', 'height',
]

const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

const sanitized = computed(() => {
  if (!props.content) return ''
  // 在 DOMPurify 处理之前，先将空段落转换为含 <br> 的段落
  // 这样 DOMPurify 不会将其视为空元素而可能移除
  const preserved = props.content.replace(/<p(\s[^>]*)?>(\s|<br\s*\/?>|&nbsp;)*<\/p>/gi, '<p><br></p>')
  return DOMPurify.sanitize(preserved, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
  })
})
</script>
