<!--
  FontAwesome 兼容层组件

  用法：
  <FaIcon icon="fa-solid fa-heart" />
  <FaIcon icon="fa-regular fa-star" size="24" />

  迁移到 @nuxt/icon 后，这个组件可以让旧代码继续工作
-->
<template>
  <Icon v-if="iconName" :name="iconName" :class="extraClasses" v-bind="$attrs" />
  <span v-else class="text-red-500" title="无效的图标">⚠️</span>
</template>

<script setup lang="ts">
interface Props {
  icon?: string | null  // 例如: 'fa-solid fa-heart' 或 'fa6-solid:heart'
}

const props = defineProps<Props>()

/**
 * 将 FontAwesome class 转换为 Iconify 名称
 * 'fa-solid fa-heart' -> 'fa6-solid:heart'
 * 'fa-regular fa-star' -> 'fa6-regular:star'
 * 'fa-brands fa-github' -> 'fa6-brands:github'
 */
const ICON_ALIASES: Record<string, string> = {
  'check-circle': 'circle-check',
  'exclamation-circle': 'circle-exclamation',
  'exclamation-triangle': 'triangle-exclamation',
  'external-link': 'arrow-up-right-from-square',
  'external-link-alt': 'arrow-up-right-from-square',
  'info-circle': 'circle-info',
  search: 'magnifying-glass',
  sync: 'arrows-rotate',
  times: 'xmark',
  'times-circle': 'circle-xmark',
  // fa6-solid 不包含 whale，兼容后台保存的旧图标配置。
  whale: 'fish',
}

const parsedIcon = computed(() => {
  const value = props.icon?.trim() || ''
  const tokens = value.split(/\s+/).filter(Boolean)
  const iconifyToken = tokens.find(token => /^(?:i-)?fa6-(solid|regular|brands):[a-z0-9-]+$/.test(token))

  if (iconifyToken) {
    const normalized = iconifyToken.replace(/^i-/, '')
    const match = normalized.match(/^fa6-(solid|regular|brands):([a-z0-9-]+)$/)
    if (match) {
      const [, style, rawName] = match
      return {
        name: `fa6-${style}:${ICON_ALIASES[rawName] || rawName}`,
        descriptorTokens: new Set([iconifyToken]),
      }
    }
  }

  const match = value.match(/fa-(solid|regular|brands|light|duotone|thin)\s+fa-([a-z0-9-]+)/)

  if (!match) {
    if (value) console.warn(`[FaIcon] 无法解析图标: ${value}`)
    return { name: '', descriptorTokens: new Set<string>() }
  }

  const [, style, rawName] = match
  return {
    name: `fa6-${style}:${ICON_ALIASES[rawName] || rawName}`,
    descriptorTokens: new Set([`fa-${style}`, `fa-${rawName}`]),
  }
})

const iconName = computed(() => parsedIcon.value.name)
const extraClasses = computed(() =>
  (props.icon?.trim().split(/\s+/) || [])
    .filter(token => token && !parsedIcon.value.descriptorTokens.has(token)),
)
</script>

<style scoped>
/* 继承父元素的颜色 */
:deep(svg) {
  color: inherit;
}
</style>
