<template>
  <div class="pb-8">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">标签管理</h1>
      <AdminKumoButton variant="primary"
        type="button"
        @click="openCreateModal"
      >
        <Icon name="fa6-solid:plus" aria-hidden="true" />
        添加标签
      </AdminKumoButton>
    </div>

    <section class="mb-6 rounded-xl bg-white p-4 shadow dark:bg-zinc-800" aria-label="标签筛选">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="relative w-full max-w-xl">
          <input
            v-model="searchInput"
            type="search"
            maxlength="100"
            placeholder="搜索中文名、别名、VNDB 英文名或 gID..."
            class="admin-input w-full pl-10"
            @input="onSearch"
          />
          <Icon name="fa6-solid:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        </div>

        <div class="grid w-full grid-cols-3 rounded-lg bg-gray-100 p-1 dark:bg-zinc-700 lg:w-auto" role="group" aria-label="归档状态">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            class="min-w-0 rounded-md px-3 py-1.5 text-sm transition"
            :class="statusFilter === option.value
              ? 'bg-white font-medium text-gray-900 shadow-sm dark:bg-zinc-600 dark:text-white'
              : 'text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'"
            :aria-pressed="statusFilter === option.value"
            @click="setStatusFilter(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="selectedIds.length"
      class="mb-6 flex flex-col gap-3 rounded-xl bg-white p-4 shadow dark:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between"
      aria-label="批量操作"
    >
      <div class="text-sm text-gray-500 dark:text-gray-400">
        已选择 {{ selectedIds.length }} 个标签
        <span v-if="selectedActiveIds.length && selectedArchivedIds.length">
          （使用中 {{ selectedActiveIds.length }}，已归档 {{ selectedArchivedIds.length }}）
        </span>
      </div>
      <div class="flex flex-wrap gap-2">
        <AdminKumoButton variant="danger" size="toolbar"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchSetPolicy('isNsfw', true)"
        >
          <Icon :name="batchAction === 'set-nsfw' ? 'fa6-solid:spinner' : 'fa6-solid:triangle-exclamation'" />
          设为 R18
        </AdminKumoButton>
        <AdminKumoButton variant="secondary" size="toolbar"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchSetPolicy('isNsfw', false)"
        >
          <Icon :name="batchAction === 'unset-nsfw' ? 'fa6-solid:spinner' : 'fa6-solid:shield'" />
          取消 R18
        </AdminKumoButton>
        <AdminKumoButton variant="secondary" size="toolbar"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchSetPolicy('displayTier', 'SECONDARY')"
        >
          <Icon :name="batchAction === 'set-secondary' ? 'fa6-solid:spinner' : 'fa6-solid:tags'" />
          设为副标签
        </AdminKumoButton>
        <AdminKumoButton variant="secondary" size="toolbar"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchSetPolicy('displayTier', 'PRIMARY')"
        >
          <Icon :name="batchAction === 'set-primary' ? 'fa6-solid:spinner' : 'fa6-solid:tag'" />
          设为主标签
        </AdminKumoButton>
        <AdminKumoButton variant="secondary" size="toolbar"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchRandomizeColors"
        >
          <Icon :name="batchAction === 'random-color' ? 'fa6-solid:spinner' : 'fa6-solid:dice'" />
          随机颜色（{{ selectedIds.length }}）
        </AdminKumoButton>
        <AdminKumoButton variant="secondary" size="toolbar"
          v-if="selectedArchivedIds.length"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchRestore"
        >
          <Icon :name="batchAction === 'restore' ? 'fa6-solid:spinner' : 'fa6-solid:rotate-left'" />
          恢复选中（{{ selectedArchivedIds.length }}）
        </AdminKumoButton>
        <AdminKumoButton variant="danger" size="toolbar"
          v-if="selectedActiveIds.length"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchArchive"
        >
          <Icon :name="batchAction === 'archive' ? 'fa6-solid:spinner' : 'fa6-solid:box-archive'" />
          归档选中（{{ selectedActiveIds.length }}）
        </AdminKumoButton>
        <AdminKumoButton variant="danger" size="toolbar"
          v-if="isAdmin && selectedArchivedIds.length"
          type="button"
          :disabled="Boolean(batchAction)"
          @click="batchPurge"
        >
          <Icon :name="batchAction === 'purge' ? 'fa6-solid:spinner' : 'fa6-solid:trash-can'" />
          彻底删除（{{ selectedArchivedIds.length }}）
        </AdminKumoButton>
      </div>
    </section>

    <section
      class="overflow-hidden rounded-xl bg-white shadow dark:bg-zinc-800"
      :aria-busy="tagsPending"
      aria-label="标签列表"
    >
      <div
        class="hidden border-b bg-gray-50 px-4 py-3 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-700 lg:grid lg:grid-cols-[2rem_minmax(0,2fr)_minmax(0,1.7fr)_minmax(0,1fr)_4.5rem_6.5rem_13rem] lg:items-center lg:gap-3"
      >
        <span title="系统标签不可批量操作">
          <input
            type="checkbox"
            class="rounded"
            :checked="allSelected"
            :indeterminate="someSelected"
            :disabled="tagsPending || !selectablePageItems.length"
            aria-label="选择本页可操作标签"
            @change="toggleAll"
          />
        </span>
        <span>中文规范名</span>
        <span>VNDB 映射</span>
        <span>属性</span>
        <span>游戏数</span>
        <span>状态</span>
        <span class="text-right">操作</span>
      </div>

      <div v-if="tagsPending && !pageItems.length" class="flex items-center justify-center gap-2 py-14 text-sm text-gray-500">
        <Icon name="fa6-solid:spinner" aria-hidden="true" />
        正在加载标签...
      </div>

      <div v-else-if="tagsError" class="py-14 text-center">
        <p class="mb-3 text-sm text-red-500">标签列表加载失败</p>
        <AdminKumoButton variant="secondary" size="toolbar"
          type="button"
          @click="refresh()"
        >
          <Icon name="fa6-solid:rotate-right"  aria-hidden="true" />重试
        </AdminKumoButton>
      </div>

      <div v-else-if="pageItems.length" class="divide-y dark:divide-zinc-700">
        <article
          v-for="tag in pageItems"
          :key="tag.id"
          class="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 p-4 transition hover:bg-gray-50 dark:hover:bg-zinc-700/40 lg:grid-cols-[2rem_minmax(0,2fr)_minmax(0,1.7fr)_minmax(0,1fr)_4.5rem_6.5rem_13rem] lg:items-center lg:gap-3"
          :class="{
            'bg-gray-50/60 dark:bg-zinc-900/20': tag.archivedAt,
            'opacity-60': tagsPending,
          }"
        >
          <span :title="tag.isSystem ? '系统标签不可勾选' : undefined">
            <input
              type="checkbox"
              class="rounded"
              :checked="selectedIds.includes(tag.id)"
              :disabled="tag.isSystem || tagsPending"
              :aria-label="tag.isSystem ? `系统标签 ${tag.name} 不可勾选` : `选择标签 ${tag.name}`"
              @change="toggleSelect(tag)"
            />
          </span>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="break-all font-medium">{{ tag.name }}</span>
              <span
                v-if="tag.isSystem"
                class="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] leading-none text-gray-500 dark:border-zinc-600 dark:text-gray-400"
              >系统</span>
              <span
                v-if="tag.isNsfw"
                class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-red-600 dark:bg-red-900/30 dark:text-red-400"
              >NSFW</span>
              <span
                v-if="tag.displayTier === 'SECONDARY'"
                class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              >副标签</span>
            </div>
            <div
              v-if="tag.aliases.length"
              class="mt-1.5 flex min-w-0 flex-wrap gap-1"
              :title="tag.aliases.map(alias => alias.name).join('、')"
            >
              <span
                v-for="alias in tag.aliases.slice(0, 3)"
                :key="alias.id"
                class="max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-zinc-700 dark:text-gray-400"
              >{{ alias.name }}</span>
              <span v-if="tag.aliases.length > 3" class="text-xs text-gray-400">+{{ tag.aliases.length - 3 }}</span>
            </div>
            <p
              v-if="tag.description"
              class="mt-1.5 line-clamp-2 break-words text-xs text-gray-500 dark:text-gray-400"
              :title="tag.description"
            >
              {{ tag.description }}
            </p>
          </div>

          <div class="col-start-2 min-w-0 lg:col-auto">
            <div class="mb-1 text-xs font-medium text-gray-400 lg:hidden">VNDB 映射</div>
            <div
              v-if="tag.vndbTags.length"
              class="space-y-1"
              :title="formatVndbMappings(tag)"
            >
              <div
                v-for="vndbTag in tag.vndbTags.slice(0, 3)"
                :key="vndbTag.id"
                class="flex min-w-0 items-baseline gap-1.5 text-xs"
              >
                <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">{{ vndbTag.nameEn }}</span>
                <code class="shrink-0 text-gray-400">{{ vndbTag.id }}</code>
              </div>
              <span v-if="tag.vndbTags.length > 3" class="text-xs text-gray-400">另有 {{ tag.vndbTags.length - 3 }} 项</span>
            </div>
            <span v-else class="text-sm text-gray-300 dark:text-zinc-600">-</span>
          </div>

          <div class="col-start-2 flex min-w-0 flex-wrap items-center gap-2 lg:col-auto">
            <span class="text-xs font-medium text-gray-400 lg:hidden">属性</span>
            <span
              class="h-5 w-5 shrink-0 rounded border border-black/10"
              :style="{ backgroundColor: tag.color || '#6b7280' }"
              aria-hidden="true"
            ></span>
            <code class="truncate text-xs text-gray-500">{{ tag.color || '-' }}</code>
          </div>

          <div class="col-start-2 text-sm lg:col-auto">
            <span class="mr-1 text-xs font-medium text-gray-400 lg:hidden">游戏数</span>
            {{ tag.gamesCount }}
          </div>

          <div class="col-start-2 lg:col-auto">
            <span
              v-if="tag.archivedAt"
              class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-zinc-700 dark:text-gray-300"
            >
              <Icon name="fa6-solid:box-archive" aria-hidden="true" />已归档
            </span>
            <span v-else class="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Icon name="fa6-solid:circle-check" aria-hidden="true" />使用中
            </span>
          </div>

          <div class="col-start-2 flex flex-wrap items-center gap-3 lg:col-auto lg:justify-end">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-sm text-blue-500 transition hover:text-blue-600"
              :disabled="tagsPending || isTagActing(tag.id)"
              @click="editTag(tag)"
            >
              <Icon name="fa6-solid:pen" aria-hidden="true" />编辑
            </button>
            <button
              v-if="tag.archivedAt"
              type="button"
              class="inline-flex items-center gap-1 text-sm text-green-600 transition hover:text-green-700 disabled:opacity-50 dark:text-green-400"
              :disabled="tagsPending || isTagActing(tag.id)"
              @click="restoreTag(tag)"
            >
              <Icon :name="isTagActing(tag.id) ? 'fa6-solid:spinner' : 'fa6-solid:rotate-left'" />恢复
            </button>
            <button
              v-if="tag.archivedAt && isAdmin && !tag.isSystem"
              type="button"
              class="inline-flex items-center gap-1 text-sm text-red-600 transition hover:text-red-700 disabled:opacity-50 dark:text-red-400"
              :disabled="tagsPending || isTagActing(tag.id)"
              @click="purgeTag(tag)"
            >
              <Icon :name="isTagActing(tag.id) ? 'fa6-solid:spinner' : 'fa6-solid:trash-can'" />彻底删除
            </button>
            <button
              v-if="!tag.archivedAt && !tag.isSystem"
              type="button"
              class="inline-flex items-center gap-1 text-sm text-red-500 transition hover:text-red-600 disabled:opacity-50"
              :disabled="tagsPending || isTagActing(tag.id)"
              @click="archiveTag(tag)"
            >
              <Icon :name="isTagActing(tag.id) ? 'fa6-solid:spinner' : 'fa6-solid:box-archive'" />归档
            </button>
          </div>
        </article>
      </div>

      <div v-else class="py-14 text-center text-sm text-gray-500">
        {{ emptyMessage }}
      </div>
    </section>

    <div
      v-if="tagsData?.pagination && tagsData.pagination.totalPages > 1"
      class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="text-sm text-gray-500 dark:text-gray-400">
        共 {{ tagsData.pagination.total }} 个标签，第 {{ tagsData.pagination.page }} / {{ tagsData.pagination.totalPages }} 页
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <button
          type="button"
          :disabled="page <= 1 || tagsPending"
          class="flex h-8 w-9 items-center justify-center rounded-lg border text-sm transition hover:bg-gray-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-700"
          aria-label="上一页"
          @click="goToPage(page - 1)"
        >
          <Icon name="fa6-solid:chevron-left" aria-hidden="true" />
        </button>
        <template v-for="(paginationPage, index) in paginationPages" :key="`${paginationPage}-${index}`">
          <span v-if="paginationPage === '...'" class="px-2 text-gray-400">...</span>
          <button
            v-else
            type="button"
            class="h-8 min-w-9 rounded-lg border px-2 text-sm transition"
            :class="paginationPage === page
              ? 'border-transparent bg-gray-800 text-white dark:bg-zinc-600'
              : 'hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-700'"
            :aria-label="`第 ${paginationPage} 页`"
            :aria-current="paginationPage === page ? 'page' : undefined"
            @click="goToPage(paginationPage)"
          >
            {{ paginationPage }}
          </button>
        </template>
        <button
          type="button"
          :disabled="page >= tagsData.pagination.totalPages || tagsPending"
          class="flex h-8 w-9 items-center justify-center rounded-lg border text-sm transition hover:bg-gray-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-700"
          aria-label="下一页"
          @click="goToPage(page + 1)"
        >
          <Icon name="fa6-solid:chevron-right" aria-hidden="true" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"
          tabindex="-1"
          @click.self="closeModal"
          @keydown.esc="closeModal"
        >
          <div
            class="modal-content mx-auto my-6 w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-zinc-800"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="modalTitleId"
          >
            <div class="flex items-center justify-between border-b p-4 dark:border-zinc-700">
              <div class="flex min-w-0 items-center gap-2">
                <h2 :id="modalTitleId" class="truncate font-semibold">{{ editingTag ? '编辑标签' : '添加标签' }}</h2>
                <span
                  v-if="editingTag?.isSystem"
                  class="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:border-zinc-600"
                >系统</span>
              </div>
              <button
                type="button"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-zinc-700"
                :disabled="saveLoading"
                aria-label="关闭"
                @click="closeModal"
              >
                <Icon name="fa6-solid:xmark" aria-hidden="true" />
              </button>
            </div>

            <form class="space-y-4 p-4" @submit.prevent="handleSubmit">
              <div>
                <label for="tag-name" class="mb-1 block text-sm font-medium">中文规范名 *</label>
                <input
                  id="tag-name"
                  ref="nameInputRef"
                  v-model="form.name"
                  type="text"
                  maxlength="100"
                  required
                  :disabled="Boolean(editingTag?.isSystem)"
                  class="admin-input w-full"
                />
                <p v-if="editingTag?.isSystem" class="mt-1 text-xs text-gray-500">系统规则依赖该规范名，不能修改</p>
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between gap-2">
                  <label for="tag-aliases" class="text-sm font-medium">中文别名</label>
                  <span class="text-xs text-gray-400">{{ parsedAliases.length }} / 30</span>
                </div>
                <textarea
                  id="tag-aliases"
                  v-model="form.aliasesText"
                  rows="4"
                  maxlength="3029"
                  placeholder="每行一个别名"
                  class="admin-textarea w-full resize-y"
                ></textarea>
              </div>

              <div v-if="editingTag">
                <div class="mb-1 text-sm font-medium">已映射的 VNDB 标签</div>
                <div
                  v-if="editingTag.vndbTags.length"
                  class="max-h-32 divide-y overflow-y-auto rounded-lg border dark:divide-zinc-700 dark:border-zinc-600"
                >
                  <div
                    v-for="vndbTag in editingTag.vndbTags"
                    :key="vndbTag.id"
                    class="flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span class="min-w-0 break-words">{{ vndbTag.nameEn }}</span>
                    <code class="shrink-0 text-xs text-gray-400">{{ vndbTag.id }}</code>
                  </div>
                </div>
                <p v-else class="rounded-lg border border-dashed px-3 py-2 text-sm text-gray-400 dark:border-zinc-600">暂无 VNDB 映射</p>
              </div>

              <div>
                <label for="tag-color" class="mb-1 block text-sm font-medium">颜色</label>
                <div class="flex items-center gap-2">
                  <input
                    v-model="form.color"
                    type="color"
                    class="h-10 w-10 shrink-0 cursor-pointer rounded"
                    aria-label="选择标签颜色"
                  />
                  <input
                    id="tag-color"
                    v-model="form.color"
                    type="text"
                    maxlength="7"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    class="admin-input min-w-0 flex-1 font-mono"
                    placeholder="#6b7280"
                  />
                  <button
                    type="button"
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition hover:bg-gray-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
                    title="随机颜色"
                    aria-label="随机颜色"
                    @click="randomColor"
                  >
                    <Icon name="fa6-solid:dice" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label for="tag-description" class="mb-1 block text-sm font-medium">描述</label>
                <textarea
                  id="tag-description"
                  v-model="form.description"
                  class="admin-textarea w-full resize-y"
                  rows="3"
                ></textarea>
              </div>

              <fieldset class="space-y-3 rounded-lg border p-3 dark:border-zinc-600">
                <legend class="px-1 text-sm font-medium">标签属性</legend>
                <label class="flex cursor-pointer items-start gap-2">
                  <input
                    v-model="form.isNsfw"
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-800 focus:ring-gray-400"
                  />
                  <span>
                    <span class="block text-sm">标记为 R18</span>
                    <span class="block text-xs text-gray-500">SFW 模式下不显示此标签</span>
                  </span>
                </label>
                <label
                  v-if="editingTag"
                  class="flex items-start gap-2"
                  :class="editingTag.vndbTags.length ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'"
                >
                  <input
                    v-model="form.isSecondary"
                    type="checkbox"
                    :disabled="!editingTag.vndbTags.length"
                    class="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-800 focus:ring-gray-400"
                  />
                  <span>
                    <span class="block text-sm">标记为副标签</span>
                    <span class="block text-xs text-gray-500">同步设置该中文标签下的 VNDB 映射</span>
                  </span>
                </label>
              </fieldset>

              <div class="flex justify-end gap-3 pt-2">
                <AdminKumoButton variant="secondary"
                  type="button"
                  :disabled="saveLoading"
                  @click="closeModal"
                >
                  取消
                </AdminKumoButton>
                <AdminKumoButton variant="primary"
                  type="submit"
                  :disabled="saveLoading"
                >
                  <Icon name="fa6-solid:spinner" v-if="saveLoading"  aria-hidden="true" />
                  {{ saveLoading ? '保存中...' : '保存' }}
                </AdminKumoButton>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { generateRandomTagColor } from '~/utils/random-tag-color'
import type {
  AdminTagArchiveResponse,
  AdminTagBatchArchiveResponse,
  AdminTagBatchColorResponse,
  AdminTagBatchPolicyResponse,
  AdminTagBatchRestoreResponse,
  AdminTagItem,
  AdminTagPurgeResponse,
  AdminTagRestoreResponse,
  AdminTagsResponse,
} from '~/types/api'

type TagStatusFilter = 'active' | 'archived' | 'all'
type BatchAction = 'archive' | 'restore' | 'random-color' | 'purge'
  | 'set-nsfw' | 'unset-nsfw' | 'set-secondary' | 'set-primary' | null

const PAGE_SIZE = 20
const ALL_FILTER_CHUNK_SIZE = 200

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const { data: session } = useAuth()
const toast = useToast()
const isAdmin = computed(() => (session.value as { role?: string } | null)?.role === 'ADMIN')

const page = ref(1)
const searchInput = ref('')
const search = ref('')
const statusFilter = ref<TagStatusFilter>('active')
const selectedIds = ref<number[]>([])
const actingIds = ref<number[]>([])
const batchAction = ref<BatchAction>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const statusOptions: Array<{ value: TagStatusFilter; label: string }> = [
  { value: 'active', label: '使用中' },
  { value: 'archived', label: '已归档' },
  { value: 'all', label: '全部' },
]

const {
  data: tagsData,
  pending: tagsPending,
  error: tagsError,
  refresh,
} = await useAsyncData<AdminTagsResponse>(
  'admin-tags-list',
  loadTags,
  {
    watch: [page, search, statusFilter],
    default: () => ({
      items: [],
      pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 },
    }),
  },
)

const pageItems = computed(() => tagsData.value?.items ?? [])
const selectablePageItems = computed(() => pageItems.value.filter(tag => !tag.isSystem))
const allSelected = computed(() => selectablePageItems.value.length > 0
  && selectablePageItems.value.every(tag => selectedIds.value.includes(tag.id)))
const someSelected = computed(() => !allSelected.value
  && selectablePageItems.value.some(tag => selectedIds.value.includes(tag.id)))
const selectedTags = computed(() => pageItems.value.filter(tag => selectedIds.value.includes(tag.id) && !tag.isSystem))
const selectedActiveIds = computed(() => selectedTags.value.filter(tag => !tag.archivedAt).map(tag => tag.id))
const selectedArchivedIds = computed(() => selectedTags.value.filter(tag => Boolean(tag.archivedAt)).map(tag => tag.id))

const emptyMessage = computed(() => {
  if (search.value) return '没有找到匹配的标签'
  if (statusFilter.value === 'archived') return '暂无已归档标签'
  if (statusFilter.value === 'active') return '暂无使用中的标签'
  return '暂无标签'
})

const paginationPages = computed(() => {
  const total = tagsData.value?.pagination.totalPages ?? 0
  const current = page.value
  const pages: Array<number | '...'> = []
  if (total <= 7) {
    for (let number = 1; number <= total; number += 1) pages.push(number)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')
    for (let number = Math.max(2, current - 1); number <= Math.min(total - 1, current + 1); number += 1) {
      pages.push(number)
    }
    if (current < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

const showModal = ref(false)
const editingTag = ref<AdminTagItem | null>(null)
const saveLoading = ref(false)
const nameInputRef = ref<HTMLInputElement | null>(null)
const modalTitleId = `tag-modal-title-${useId()}`
const form = reactive({
  name: '',
  aliasesText: '',
  color: '#6b7280',
  description: '',
  isNsfw: false,
  isSecondary: false,
})

const parsedAliases = computed(() => {
  const canonicalName = form.name.trim().toLocaleLowerCase()
  const aliases = new Map<string, string>()
  for (const line of form.aliasesText.split(/\r?\n/)) {
    const alias = line.trim()
    const key = alias.toLocaleLowerCase()
    if (alias && key !== canonicalName && !aliases.has(key)) aliases.set(key, alias)
  }
  return [...aliases.values()]
})

watch([page, search, statusFilter], () => {
  selectedIds.value = []
})

watch(pageItems, (items) => {
  const availableIds = new Set(items.filter(tag => !tag.isSystem).map(tag => tag.id))
  selectedIds.value = selectedIds.value.filter(id => availableIds.has(id))
})

watch(() => tagsData.value?.pagination.totalPages, (totalPages) => {
  const lastPage = Math.max(1, totalPages ?? 0)
  if (page.value > lastPage) page.value = lastPage
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

async function loadTags(): Promise<AdminTagsResponse> {
  if (statusFilter.value !== 'all') {
    return fetchTagPage(statusFilter.value === 'archived', page.value, PAGE_SIZE)
  }
  return loadCombinedTagPage()
}

function fetchTagPage(archived: boolean, requestedPage: number, limit: number) {
  return authFetch<AdminTagsResponse>('/api/admin/tags', {
    query: {
      page: requestedPage,
      limit,
      archived: archived ? 'true' : 'false',
      search: search.value || undefined,
    },
  })
}

async function loadCombinedTagPage(): Promise<AdminTagsResponse> {
  const requiredPerStatus = page.value * PAGE_SIZE
  const chunkSize = Math.min(ALL_FILTER_CHUNK_SIZE, Math.max(PAGE_SIZE, requiredPerStatus))
  const [activeFirst, archivedFirst] = await Promise.all([
    fetchTagPage(false, 1, chunkSize),
    fetchTagPage(true, 1, chunkSize),
  ])

  const activePages = Math.min(activeFirst.pagination.totalPages, Math.ceil(requiredPerStatus / chunkSize))
  const archivedPages = Math.min(archivedFirst.pagination.totalPages, Math.ceil(requiredPerStatus / chunkSize))
  const additionalRequests: Array<Promise<{ archived: boolean; response: AdminTagsResponse }>> = []

  for (let requestedPage = 2; requestedPage <= activePages; requestedPage += 1) {
    additionalRequests.push(fetchTagPage(false, requestedPage, chunkSize)
      .then(response => ({ archived: false, response })))
  }
  for (let requestedPage = 2; requestedPage <= archivedPages; requestedPage += 1) {
    additionalRequests.push(fetchTagPage(true, requestedPage, chunkSize)
      .then(response => ({ archived: true, response })))
  }

  const activeItems = [...activeFirst.items]
  const archivedItems = [...archivedFirst.items]
  const additionalPages = await Promise.all(additionalRequests)
  for (const result of additionalPages) {
    if (result.archived) archivedItems.push(...result.response.items)
    else activeItems.push(...result.response.items)
  }

  const allItems = [...activeItems, ...archivedItems].sort((left, right) => {
    const countDifference = right.gamesCount - left.gamesCount
    if (countDifference) return countDifference
    const nameDifference = left.name.localeCompare(right.name, 'zh-CN')
    return nameDifference || left.id - right.id
  })
  const offset = (page.value - 1) * PAGE_SIZE
  const total = activeFirst.pagination.total + archivedFirst.pagination.total

  return {
    items: allItems.slice(offset, offset + PAGE_SIZE),
    pagination: {
      page: page.value,
      limit: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  }
}

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = searchInput.value.trim()
    page.value = 1
  }, 300)
}

function setStatusFilter(value: TagStatusFilter) {
  if (statusFilter.value === value) return
  statusFilter.value = value
  page.value = 1
}

function goToPage(value: number) {
  const totalPages = tagsData.value?.pagination.totalPages ?? 1
  page.value = Math.min(Math.max(1, value), Math.max(1, totalPages))
}

function toggleAll() {
  const pageIds = selectablePageItems.value.map(tag => tag.id)
  if (allSelected.value) {
    selectedIds.value = selectedIds.value.filter(id => !pageIds.includes(id))
  } else {
    selectedIds.value = [...new Set([...selectedIds.value, ...pageIds])]
  }
}

function toggleSelect(tag: AdminTagItem) {
  if (tag.isSystem) return
  selectedIds.value = selectedIds.value.includes(tag.id)
    ? selectedIds.value.filter(id => id !== tag.id)
    : [...selectedIds.value, tag.id]
}

function isTagActing(id: number) {
  return actingIds.value.includes(id)
}

function formatVndbMappings(tag: AdminTagItem) {
  return tag.vndbTags.map(vndbTag => `${vndbTag.nameEn} (${vndbTag.id})`).join('\n')
}

function openCreateModal() {
  resetForm()
  editingTag.value = null
  showModal.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function editTag(tag: AdminTagItem) {
  editingTag.value = tag
  form.name = tag.name
  form.aliasesText = tag.aliases.map(alias => alias.name).join('\n')
  form.color = tag.color || '#6b7280'
  form.description = tag.description || ''
  form.isNsfw = tag.isNsfw
  form.isSecondary = tag.displayTier === 'SECONDARY'
  showModal.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function closeModal() {
  if (saveLoading.value) return
  showModal.value = false
  editingTag.value = null
  resetForm()
}

function resetForm() {
  form.name = ''
  form.aliasesText = ''
  form.color = '#6b7280'
  form.description = ''
  form.isNsfw = false
  form.isSecondary = false
}

function randomColor() {
  form.color = generateRandomTagColor()
}

async function handleSubmit() {
  const name = form.name.trim()
  if (!name) return
  if (name.length > 100) {
    toast.error('中文规范名不能超过 100 个字符')
    return
  }
  if (parsedAliases.value.length > 30) {
    toast.error('别名最多填写 30 个')
    return
  }
  if (parsedAliases.value.some(alias => alias.length > 100)) {
    toast.error('每个别名不能超过 100 个字符')
    return
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(form.color)) {
    toast.error('颜色必须是六位十六进制色值')
    return
  }

  saveLoading.value = true
  try {
    const body = {
      name,
      aliases: parsedAliases.value,
      color: form.color,
      description: form.description.trim(),
      isNsfw: form.isNsfw,
      ...(editingTag.value && {
        displayTier: form.isSecondary ? 'SECONDARY' as const : 'PRIMARY' as const,
      }),
    }
    if (editingTag.value) {
      await authFetch(`/api/admin/tags/${editingTag.value.id}`, { method: 'PUT', body })
    } else {
      await authFetch('/api/admin/tags', { method: 'POST', body })
    }
    showModal.value = false
    editingTag.value = null
    resetForm()
    await refresh()
    toast.success('保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    saveLoading.value = false
  }
}

async function archiveTag(tag: AdminTagItem) {
  if (tag.isSystem) {
    toast.error('系统标签不能归档')
    return
  }
  if (!confirm(`确定要归档标签「${tag.name}」吗？现有游戏与 VNDB 映射会保留。`)) return

  actingIds.value = [...actingIds.value, tag.id]
  try {
    const result = await authFetch<AdminTagArchiveResponse>(`/api/admin/tags/${tag.id}`, { method: 'DELETE' })
    selectedIds.value = selectedIds.value.filter(id => id !== tag.id)
    await refresh()
    toast.success(result.message)
  } catch (error: any) {
    toast.error(error.data?.message || '归档失败')
  } finally {
    actingIds.value = actingIds.value.filter(id => id !== tag.id)
  }
}

async function restoreTag(tag: AdminTagItem) {
  actingIds.value = [...actingIds.value, tag.id]
  try {
    const result = await authFetch<AdminTagRestoreResponse>(`/api/admin/tags/${tag.id}/restore`, { method: 'POST' })
    selectedIds.value = selectedIds.value.filter(id => id !== tag.id)
    await refresh()
    toast.success(result.message)
  } catch (error: any) {
    toast.error(error.data?.message || '恢复失败')
  } finally {
    actingIds.value = actingIds.value.filter(id => id !== tag.id)
  }
}

async function purgeTag(tag: AdminTagItem) {
  if (!tag.archivedAt || tag.isSystem || !isAdmin.value) return
  const confirmed = confirm(
    `确定要彻底删除归档标签「${tag.name}」吗？\n\n`
    + `将移除 ${tag.gamesCount} 条游戏标签关联，并把 ${tag.vndbTags.length} 个 VNDB 映射重置为待处理。\n`
    + 'VNDB 原始标签及游戏原始关联仍会保留。此操作不可恢复！',
  )
  if (!confirmed) return

  actingIds.value = [...actingIds.value, tag.id]
  try {
    const result = await authFetch<AdminTagPurgeResponse>('/api/admin/tags/actions', {
      method: 'POST',
      body: { action: 'purge', ids: [tag.id] },
    })
    selectedIds.value = selectedIds.value.filter(id => id !== tag.id)
    await refresh()
    toast.success(result.message)
  } catch (error: any) {
    toast.error(error.data?.message || '彻底删除失败')
  } finally {
    actingIds.value = actingIds.value.filter(id => id !== tag.id)
  }
}

async function batchRandomizeColors() {
  const ids = selectedTags.value.map(tag => tag.id)
  if (!ids.length) return

  batchAction.value = 'random-color'
  try {
    const result = await authFetch<AdminTagBatchColorResponse>('/api/admin/tags/actions', {
      method: 'POST',
      body: { action: 'randomize-colors', ids },
    })
    await refresh()
    toast.success(`已为 ${result.updatedCount} 个标签生成随机颜色`)
  } catch (error: any) {
    toast.error(error.data?.message || '批量随机颜色失败')
  } finally {
    batchAction.value = null
  }
}

async function batchSetPolicy(
  field: 'isNsfw' | 'displayTier',
  value: boolean | 'PRIMARY' | 'SECONDARY',
) {
  const ids = selectedTags.value.map(tag => tag.id)
  if (!ids.length) return

  const action: Exclude<BatchAction, null> = field === 'isNsfw'
    ? (value ? 'set-nsfw' : 'unset-nsfw')
    : (value === 'SECONDARY' ? 'set-secondary' : 'set-primary')
  batchAction.value = action
  try {
    const result = await authFetch<AdminTagBatchPolicyResponse>('/api/admin/tags/actions', {
      method: 'POST',
      body: { action: 'set-policy', ids, [field]: value },
    })
    await refresh()

    if (field === 'isNsfw') {
      toast.success(`已将 ${result.updatedCount} 个标签${value ? '设为 R18' : '取消 R18'}`)
    } else if (result.updatedMappings > 0) {
      toast.success(`已将 ${result.updatedCount} 个标签设为${value === 'SECONDARY' ? '副标签' : '主标签'}，更新 ${result.updatedMappings} 个 VNDB 映射`)
    } else {
      toast.success('选中的标签没有 VNDB 映射，展示层级未发生变化')
    }
  } catch (error: any) {
    toast.error(error.data?.message || '批量设置标签属性失败')
  } finally {
    batchAction.value = null
  }
}

async function batchArchive() {
  const ids = selectedActiveIds.value
  if (!ids.length) return
  if (!confirm(`确定要归档选中的 ${ids.length} 个标签吗？现有关联会保留。`)) return

  batchAction.value = 'archive'
  try {
    const result = await authFetch<AdminTagBatchArchiveResponse>('/api/admin/tags/batch', {
      method: 'DELETE',
      body: { ids },
    })
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
    await refresh()
    toast.success(`已归档 ${result.archivedCount} 个标签`)
  } catch (error: any) {
    toast.error(error.data?.message || '批量归档失败')
  } finally {
    batchAction.value = null
  }
}

async function batchRestore() {
  const ids = selectedArchivedIds.value
  if (!ids.length) return

  batchAction.value = 'restore'
  try {
    const result = await authFetch<AdminTagBatchRestoreResponse>('/api/admin/tags/batch/restore', {
      method: 'POST',
      body: { ids },
    })
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
    await refresh()
    toast.success(`已恢复 ${result.restoredCount} 个标签`)
  } catch (error: any) {
    toast.error(error.data?.message || '批量恢复失败')
  } finally {
    batchAction.value = null
  }
}

async function batchPurge() {
  if (!isAdmin.value) return
  const ids = selectedArchivedIds.value
  if (!ids.length) return
  const tags = selectedTags.value.filter(tag => ids.includes(tag.id))
  const gameAssociations = tags.reduce((total, tag) => total + tag.gamesCount, 0)
  const vndbMappings = tags.reduce((total, tag) => total + tag.vndbTags.length, 0)
  const confirmed = confirm(
    `确定要彻底删除选中的 ${ids.length} 个归档标签吗？\n\n`
    + `将移除 ${gameAssociations} 条游戏标签关联，并把 ${vndbMappings} 个 VNDB 映射重置为待处理。\n`
    + 'VNDB 原始标签及游戏原始关联仍会保留。此操作不可恢复！',
  )
  if (!confirmed) return

  batchAction.value = 'purge'
  try {
    const result = await authFetch<AdminTagPurgeResponse>('/api/admin/tags/actions', {
      method: 'POST',
      body: { action: 'purge', ids },
    })
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
    await refresh()
    toast.success(result.message)
  } catch (error: any) {
    toast.error(error.data?.message || '批量彻底删除失败')
  } finally {
    batchAction.value = null
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `标签管理 - ${siteName.value} 管理后台`),
})
</script>
