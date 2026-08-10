<template>
  <NuxtLink 
    :to="`/games/${game.id}`"
    :target="openInNewTab ? '_blank' : undefined"
    class="bg-white dark:bg-zinc-800 rounded-lg md:rounded-xl overflow-hidden shadow hover:shadow-xl hover:scale-[1.04] transition-all duration-200 ease-out group"
  >
    <div class="relative bg-gray-100 dark:bg-zinc-700">
      <img 
        v-if="game.coverImage"
        :src="game.coverImage" 
        :alt="game.title"
        class="w-full aspect-[3/4] object-cover"
        :loading="eager ? 'eager' : 'lazy'"
        :decoding="eager ? 'sync' : 'async'"
        :fetchpriority="eager ? 'high' : 'low'"
      />
      <div 
        v-else
        class="w-full aspect-[3/4] flex items-center justify-center bg-gray-200 dark:bg-zinc-700"
      >
        <i class="fa-solid fa-gamepad text-3xl md:text-4xl text-gray-400 dark:text-zinc-500"></i>
      </div>
      <!-- NSFW标记 -->
      <div 
        v-if="game.isNsfw" 
        class="absolute top-1 right-1 md:top-2 md:right-2 px-1 md:px-1.5 py-0.5 bg-red-500 text-white text-[10px] md:text-xs rounded font-medium"
      >
        NSFW
      </div>
    </div>
    <div class="p-1.5 md:p-2 text-xs md:text-sm text-center truncate group-hover:text-gray-600 dark:group-hover:text-gray-300">
      {{ game.title }}
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
interface Game {
  id: number
  title: string
  coverImage?: string | null
  isNsfw?: boolean
}

defineProps<{
  game: Game
  eager?: boolean
}>()

const { openInNewTab } = useOpenInNewTab()
</script>
