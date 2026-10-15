<template>
  <div class="flex justify-center items-center gap-2">
    <button 
      class="px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed" 
      :disabled="currentPage <= 1"
      @click="emitPageChange(currentPage - 1)"
    >
      <Icon name="fa6-solid:chevron-left" />
    </button>
    
    <template v-for="page in displayedPages" :key="page">
      <span v-if="page === '...'" class="px-2 text-gray-400">...</span>
      <button 
        v-else
        class="px-3 py-2 rounded-lg text-sm font-medium transition"
        :class="page === currentPage 
          ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
          : 'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700'"
        @click="emitPageChange(page as number)"
      >
        {{ page }}
      </button>
    </template>
    
    <button 
      class="px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="currentPage >= totalPages"
      @click="emitPageChange(currentPage + 1)"
    >
      <Icon name="fa6-solid:chevron-right" />
    </button>

    <!-- 跳转输入 -->
    <div v-if="totalPages > 1" class="flex items-center gap-1.5 ml-2">
      <input
        v-model="jumpInput"
        type="text"
        inputmode="numeric"
        :class="admin ? 'admin-input w-12 text-center' : 'w-12 px-2 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-1 focus:ring-gray-400'"
        :placeholder="String(currentPage)"
        @keyup.enter="handleJump"
      />
      <span class="text-xs text-gray-400 whitespace-nowrap">/ {{ totalPages }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  admin?: boolean
  currentPage?: number
  totalPages?: number
  current?: number
  total?: number
}>()

const emit = defineEmits<{
  pageChange: [page: number]
  change: [page: number]
}>()

const currentPage = computed(() => props.currentPage ?? props.current ?? 1)
const totalPages = computed(() => props.totalPages ?? props.total ?? 1)
const jumpInput = ref('')

function emitPageChange(page: number) {
  emit('pageChange', page)
  emit('change', page)
}

function handleJump() {
  const page = parseInt(jumpInput.value)
  if (!isNaN(page) && page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    emitPageChange(page)
  }
  jumpInput.value = ''
}

const displayedPages = computed(() => {
  const pages: (number | string)[] = []
  const current = currentPage.value
  const total = totalPages.value
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)
    
    if (current > 3) {
      pages.push('...')
    }
    
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (current < total - 2) {
      pages.push('...')
    }
    
    pages.push(total)
  }
  
  return pages
})
</script>
