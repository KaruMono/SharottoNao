<template>
  <div ref="rootRef" class="space-y-4" @focusout="handleFocusOut">
    <div v-if="selectedTags.length || pendingNames.length" class="flex flex-wrap gap-2">
      <span
        v-for="tag in selectedTags"
        :key="tag.id"
        class="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
        :style="selectedTagStyle(tag)"
      >
        <span class="min-w-0 break-all">{{ tag.name }}</span>
        <button
          type="button"
          class="ml-0.5 shrink-0 opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          :aria-label="`移除标签 ${tag.name}`"
          @click="removeTag(tag.id)"
        >
          <Icon name="fa6-solid:xmark" class="text-xs" aria-hidden="true" />
        </button>
      </span>

      <span
        v-for="name in pendingNames"
        :key="`new-${name}`"
        class="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-sm font-medium"
        :class="pendingTagClass"
        :title="pendingTagTitle(name)"
      >
        <Icon name="fa6-solid:plus" class="shrink-0 text-xs opacity-70" aria-hidden="true" />
        <span class="min-w-0 break-all">{{ name }}</span>
        <button
          type="button"
          class="ml-0.5 shrink-0 opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          :aria-label="`移除新标签 ${name}`"
          @click="removePendingName(name)"
        >
          <Icon name="fa6-solid:xmark" class="text-xs" aria-hidden="true" />
        </button>
      </span>
    </div>
    <p v-else class="text-sm text-gray-400">暂未添加任何标签</p>

    <div class="relative">
      <div
        :class="appearance === 'admin' ? 'admin-input-group' : 'flex min-h-10 items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700'"
      >
        <Icon name="fa6-solid:magnifying-glass" class="shrink-0 text-sm text-gray-400" aria-hidden="true" />
        <input
          v-model="search"
          type="text"
          maxlength="100"
          autocomplete="off"
          :class="appearance === 'admin' ? 'admin-input min-w-0 flex-1' : 'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder-gray-400'"
          :placeholder="placeholder"
          aria-label="搜索标签"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="showDropdown"
          :aria-controls="listboxId"
          :aria-activedescendant="activeDescendant"
          @focus="handleFocus"
          @input="scheduleSearch"
          @keydown="handleKeydown"
        />
        <Icon name="fa6-solid:spinner" class="shrink-0 text-sm text-gray-400" v-if="loading"
          
          aria-label="正在搜索标签" />
      </div>

      <div
        v-if="showDropdown"
        :id="listboxId"
        role="listbox"
        class="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      >
        <div v-if="loading" class="flex items-center gap-2 px-4 py-3 text-sm text-gray-400" aria-live="polite">
          <Icon name="fa6-solid:spinner" aria-hidden="true" />
          正在搜索标签...
        </div>

        <template v-else-if="searchError">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-500 transition hover:bg-gray-50 dark:hover:bg-zinc-700"
            @click="retrySearch"
          >
            <Icon name="fa6-solid:rotate-right" aria-hidden="true" />
            搜索失败，点击重试
          </button>
        </template>

        <template v-else>
          <button
            v-for="(tag, index) in results"
            :id="`${listboxId}-option-${index}`"
            :key="tag.id"
            type="button"
            role="option"
            :aria-selected="activeIndex === index"
            class="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm transition"
            :class="activeIndex === index ? 'bg-gray-100 dark:bg-zinc-700' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'"
            @mouseenter="activeIndex = index"
            @click="selectTag(tag)"
          >
            <span
              class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: tag.color || '#9ca3af' }"
              aria-hidden="true"
            ></span>
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-1.5">
                <span class="break-all font-medium">{{ tag.name }}</span>
                <span
                  v-if="tag.isNsfw"
                  class="rounded border border-red-200 px-1 py-0.5 text-[10px] leading-none text-red-500 dark:border-red-800"
                >R18</span>
                <span
                  v-if="tag.isSystem"
                  class="rounded border border-gray-200 px-1 py-0.5 text-[10px] leading-none text-gray-500 dark:border-zinc-600"
                >系统</span>
              </span>
              <span v-if="vndbLabel(tag)" class="mt-0.5 block truncate text-xs text-gray-400">
                VNDB: {{ vndbLabel(tag) }}
              </span>
            </span>
            <Icon name="fa6-solid:plus" class="mt-0.5 shrink-0 text-xs text-gray-400" aria-hidden="true" />
          </button>

          <div v-if="results.length && canCreate" class="mx-4 border-t dark:border-zinc-700"></div>
          <button
            v-if="canCreate"
            :id="`${listboxId}-option-${results.length}`"
            type="button"
            role="option"
            :aria-selected="activeIndex === results.length"
            class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-blue-500 transition"
            :class="activeIndex === results.length ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-zinc-700'"
            @mouseenter="activeIndex = results.length"
            @click="createPendingTag"
          >
            <Icon name="fa6-solid:plus" class="shrink-0 text-xs" aria-hidden="true" />
            <span class="min-w-0 break-all">创建新标签「{{ normalizedSearch }}」</span>
            <span class="ml-auto shrink-0 text-xs text-gray-400">{{ createActionHint }}</span>
          </button>

          <div v-if="!results.length && !canCreate" class="px-4 py-3 text-sm text-gray-400" aria-live="polite">
            {{ emptyMessage }}
          </div>
        </template>
      </div>
    </div>

    <p v-if="pendingNames.length" class="text-xs text-gray-400">
      <Icon name="fa6-solid:circle-info" class="mr-1" aria-hidden="true" />{{ pendingHelpText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { useId } from 'vue'

type VndbTagSummary = {
  id: string
  nameEn: string
}

type TagOption = {
  id: number
  name: string
  slug?: string | null
  color?: string | null
  isNsfw?: boolean
  isSystem?: boolean
  vndbTags?: VndbTagSummary[]
}

type CreationMode = 'disabled' | 'immediate' | 'proposal'

const props = withDefaults(defineProps<{
  admin?: boolean
  appearance?: 'default' | 'admin'
  creationMode?: CreationMode
}>(), {
  admin: false,
  appearance: 'default',
  creationMode: 'disabled',
})

const { authFetch } = useAuthRequest()
const selectedTags = defineModel<TagOption[]>({ default: () => [] })
const pendingNames = defineModel<string[]>('pendingNames', { default: () => [] })

const rootRef = ref<HTMLElement | null>(null)
const search = ref('')
const results = ref<TagOption[]>([])
const showDropdown = ref(false)
const loading = ref(false)
const searchError = ref(false)
const settledSearch = ref('')
const activeIndex = ref(-1)
const listboxId = `tag-autocomplete-${useId()}`
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestController: AbortController | undefined
let requestSequence = 0

const normalizedSearch = computed(() => search.value.trim())
const normalizedSearchLower = computed(() => normalizedSearch.value.toLocaleLowerCase())
const optionCount = computed(() => results.value.length + (canCreate.value ? 1 : 0))

const placeholder = computed(() => {
  if (props.creationMode === 'disabled') return '输入中文名、英文名或 VNDB 标签 ID 搜索...'
  return '搜索标签，或直接输入名称创建新标签...'
})

const createActionHint = computed(() => props.creationMode === 'immediate' ? '保存时生效' : '审核后生效')
const pendingHelpText = computed(() => props.creationMode === 'immediate'
  ? '虚线标签为新标签，保存后立即创建并关联'
  : '虚线标签为新标签提案，审核通过后正式生效')
const pendingTagClass = computed(() => props.creationMode === 'immediate'
  ? 'border-blue-400 text-blue-600 dark:text-blue-400'
  : 'border-gray-400 text-gray-600 dark:border-zinc-500 dark:text-zinc-300')

const canCreate = computed(() => {
  if (props.creationMode === 'disabled' || loading.value || searchError.value) return false
  if (!normalizedSearch.value || normalizedSearch.value.length > 100) return false
  if (settledSearch.value !== normalizedSearch.value) return false
  if (selectedTags.value.some(tag => tag.name.toLocaleLowerCase() === normalizedSearchLower.value)) return false
  if (pendingNames.value.some(name => name.toLocaleLowerCase() === normalizedSearchLower.value)) return false
  return !results.value.some(tag => tag.name.toLocaleLowerCase() === normalizedSearchLower.value)
})

const emptyMessage = computed(() => {
  if (selectedTags.value.some(tag => tag.name.toLocaleLowerCase() === normalizedSearchLower.value)
    || pendingNames.value.some(name => name.toLocaleLowerCase() === normalizedSearchLower.value)) {
    return '该标签已添加'
  }
  return '没有找到匹配的标签'
})

const activeDescendant = computed(() => {
  if (!showDropdown.value || activeIndex.value < 0 || activeIndex.value >= optionCount.value) return undefined
  return `${listboxId}-option-${activeIndex.value}`
})

onClickOutside(rootRef, closeDropdown)

watch(() => props.admin, () => {
  if (normalizedSearch.value) runSearch()
})

watch(selectedTags, () => {
  const selectedIds = new Set(selectedTags.value.map(tag => tag.id))
  results.value = results.value.filter(tag => !selectedIds.has(tag.id))
  normalizeActiveIndex()
}, { deep: true })

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  requestController?.abort()
})

function selectedTagStyle(tag: TagOption) {
  if (!tag.color) return { backgroundColor: 'rgba(107,114,128,0.12)', color: 'inherit' }
  return { backgroundColor: `${tag.color}20`, color: tag.color }
}

function vndbLabel(tag: TagOption) {
  return tag.vndbTags?.map(vndbTag => `${vndbTag.nameEn} (${vndbTag.id})`).join(' / ') || ''
}

function pendingTagTitle(name: string) {
  return props.creationMode === 'immediate'
    ? `新标签「${name}」将在保存时立即创建`
    : `新标签「${name}」将在审核通过后创建`
}

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  requestController?.abort()
  requestSequence += 1
  results.value = []
  settledSearch.value = ''
  searchError.value = false
  activeIndex.value = -1

  if (!normalizedSearch.value) {
    loading.value = false
    showDropdown.value = false
    return
  }

  loading.value = true
  showDropdown.value = true
  const sequence = requestSequence
  searchTimer = setTimeout(() => runSearch(sequence), 275)
}

async function runSearch(sequence = ++requestSequence) {
  const query = normalizedSearch.value
  if (!query) return

  if (searchTimer) clearTimeout(searchTimer)
  requestController?.abort()
  requestController = new AbortController()
  loading.value = true
  searchError.value = false
  showDropdown.value = true

  try {
    const endpoint = props.admin ? '/api/admin/tags/autocomplete' : '/api/tags/autocomplete'
    const data: any = await (authFetch as any)(endpoint, {
      query: { search: query, limit: 15 },
      signal: requestController.signal,
    })

    if (sequence !== requestSequence || query !== normalizedSearch.value) return
    const selectedIds = new Set(selectedTags.value.map(tag => tag.id))
    results.value = data.filter(tag => !selectedIds.has(tag.id))
    settledSearch.value = query
    activeIndex.value = -1
  } catch (error: unknown) {
    if (sequence !== requestSequence || (error instanceof Error && error.name === 'AbortError')) return
    results.value = []
    settledSearch.value = query
    searchError.value = true
    activeIndex.value = -1
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function retrySearch() {
  searchError.value = false
  runSearch()
}

function handleFocus() {
  if (!normalizedSearch.value) return
  showDropdown.value = true
  if (settledSearch.value !== normalizedSearch.value && !loading.value) scheduleSearch()
}

function handleFocusOut() {
  requestAnimationFrame(() => {
    if (!rootRef.value?.contains(document.activeElement)) closeDropdown()
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeDropdown()
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!showDropdown.value) showDropdown.value = true
    if (!optionCount.value) return
    const direction = event.key === 'ArrowDown' ? 1 : -1
    if (activeIndex.value < 0) {
      activeIndex.value = direction > 0 ? 0 : optionCount.value - 1
    } else {
      activeIndex.value = (activeIndex.value + direction + optionCount.value) % optionCount.value
    }
    nextTick(scrollActiveOptionIntoView)
    return
  }

  if (event.key !== 'Enter') return
  event.preventDefault()
  if (loading.value || searchError.value || !normalizedSearch.value) return

  if (activeIndex.value >= 0 && activeIndex.value < results.value.length) {
    selectTag(results.value[activeIndex.value])
    return
  }
  if (activeIndex.value === results.value.length && canCreate.value) {
    createPendingTag()
    return
  }

  const exact = results.value.find(tag => tag.name.toLocaleLowerCase() === normalizedSearchLower.value)
  if (exact) selectTag(exact)
  else if (canCreate.value) createPendingTag()
}

function selectTag(tag: TagOption) {
  if (!selectedTags.value.some(selected => selected.id === tag.id)) {
    selectedTags.value = [...selectedTags.value, tag]
  }
  resetSearch()
}

function createPendingTag() {
  const name = normalizedSearch.value
  if (!canCreate.value || !name) return
  pendingNames.value = [...pendingNames.value, name]
  resetSearch()
}

function removeTag(tagId: number) {
  selectedTags.value = selectedTags.value.filter(tag => tag.id !== tagId)
}

function removePendingName(name: string) {
  pendingNames.value = pendingNames.value.filter(pendingName => pendingName !== name)
}

function resetSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  requestController?.abort()
  requestSequence += 1
  search.value = ''
  results.value = []
  settledSearch.value = ''
  loading.value = false
  searchError.value = false
  activeIndex.value = -1
  showDropdown.value = false
}

function closeDropdown() {
  showDropdown.value = false
  activeIndex.value = -1
}

function normalizeActiveIndex() {
  if (!optionCount.value) activeIndex.value = -1
  else if (activeIndex.value >= optionCount.value) activeIndex.value = optionCount.value - 1
}

function scrollActiveOptionIntoView() {
  if (!activeDescendant.value) return
  document.getElementById(activeDescendant.value)?.scrollIntoView({ block: 'nearest' })
}
</script>
