<template>
  <div v-if="groups.length" class="space-y-3">
    <section
      v-for="group in groups"
      :key="group.kind"
      :aria-label="group.label"
      class="space-y-2"
    >
      <div
        class="flex items-center gap-2 text-sm font-medium"
        :class="headingClass[group.kind]"
      >
        <FaIcon :icon="groupIcon[group.kind]" aria-hidden="true" />
        <span>{{ group.label }}</span>
      </div>

      <div class="flex flex-wrap gap-1.5 sm:gap-2 text-xs">
        <NuxtLink
          v-for="tag in group.tags"
          :key="tag.id"
          :to="`/tags/${tag.slug || tag.id}`"
          class="px-2 py-1 rounded bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-800"
          :style="tagStyle(tag.color)"
        >
          {{ tag.name }}
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { GameDetailTag } from '~/types/api'
import { groupGameDetailTags, type GameTagGroupKind } from '~/utils/tag-display-tier'

const props = withDefaults(defineProps<{
  tags?: GameDetailTag[]
}>(), {
  tags: () => [],
})

const groups = computed(() => groupGameDetailTags(props.tags))

const groupIcon: Record<GameTagGroupKind, string> = {
  primary: 'fa-solid fa-tags text-gray-400 dark:text-zinc-500',
  secondary: 'fa-solid fa-tag text-gray-400 dark:text-zinc-500',
  nsfw: 'fa-solid fa-triangle-exclamation text-red-500 dark:text-red-400',
}

const headingClass: Record<GameTagGroupKind, string> = {
  primary: 'text-gray-700 dark:text-zinc-200',
  secondary: 'text-gray-500 dark:text-zinc-400',
  nsfw: 'text-red-700 dark:text-red-300',
}

function tagStyle(color?: string | null) {
  return color
    ? { backgroundColor: `${color}20`, color }
    : undefined
}
</script>
