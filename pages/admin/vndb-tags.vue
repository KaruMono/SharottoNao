<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">VNDB 标签映射</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          共 {{ tagData?.stats.total ?? 0 }} 个 VNDB 标签
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
        :disabled="pending"
        title="刷新标签列表"
        aria-label="刷新标签列表"
        @click="refreshList"
      >
        <Icon name="fa6-solid:rotate-right" :class="{ 'fa-spin': pending }" />
      </button>
    </div>

    <!-- 状态统计 -->
    <div class="grid grid-cols-2 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-800 dark:ring-zinc-700 lg:grid-cols-4">
      <button
        v-for="stat in statItems"
        :key="stat.key"
        type="button"
        class="flex min-h-[76px] items-center gap-3 border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400 dark:border-zinc-700 dark:hover:bg-zinc-700/60"
        :class="[
          stat.borderClass,
          statusFilter === stat.filter ? 'bg-gray-50 dark:bg-zinc-700/70' : '',
        ]"
        :aria-pressed="statusFilter === stat.filter"
        @click="setStatusFilter(stat.filter)"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" :class="stat.iconClass">
          <FaIcon :icon="stat.icon" />
        </span>
        <span class="min-w-0">
          <span class="block text-xs text-gray-500 dark:text-gray-400">{{ stat.label }}</span>
          <span class="mt-0.5 block text-xl font-semibold tabular-nums">{{ stat.value }}</span>
        </span>
      </button>
    </div>

    <!-- 筛选 -->
    <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-800 dark:ring-zinc-700">
      <div class="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px] xl:grid-cols-[minmax(220px,1fr)_170px_170px_170px]">
        <label class="relative block">
          <span class="sr-only">搜索 VNDB 标签</span>
          <Icon name="fa6-solid:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
          <input
            v-model="searchInput"
            type="search"
            class="admin-input w-full pl-9 pr-9"
            placeholder="搜索英文名、gID 或中文标签"
            @input="scheduleSearch"
          />
          <button
            v-if="searchInput"
            type="button"
            class="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-600 dark:hover:text-gray-200"
            title="清空搜索"
            aria-label="清空搜索"
            @click="clearSearch"
          >
            <Icon name="fa6-solid:xmark" />
          </button>
        </label>

        <label class="block">
          <span class="sr-only">映射状态</span>
          <AdminSelect aria-label="映射状态"
            v-model="statusFilter"
            class="w-full"
          >
            <option value="">全部状态</option>
            <option value="PENDING">待处理</option>
            <option value="MAPPED">已映射</option>
            <option value="IGNORED">已忽略</option>
          </AdminSelect>
        </label>

        <label class="block">
          <span class="sr-only">展示层级</span>
          <AdminSelect aria-label="展示层级"
            v-model="displayTierFilter"
            class="w-full"
          >
            <option value="">全部展示层级</option>
            <option value="PRIMARY">仅主标签</option>
            <option value="SECONDARY">仅副标签</option>
          </AdminSelect>
        </label>

        <label class="block">
          <span class="sr-only">成人标签筛选</span>
          <AdminSelect aria-label="成人标签筛选"
            v-model="nsfwFilter"
            class="w-full"
          >
            <option value="">全部内容级别</option>
            <option value="true">仅 R18</option>
            <option value="false">仅非 R18</option>
          </AdminSelect>
        </label>
      </div>
    </div>

    <!-- 请求失败 -->
    <div
      v-if="error && !tagData"
      class="rounded-lg border border-red-200 bg-red-50 px-5 py-10 text-center dark:border-red-900/60 dark:bg-red-950/20"
      role="alert"
    >
      <Icon name="fa6-solid:triangle-exclamation" class="text-2xl text-red-500" />
      <p class="mt-3 font-medium text-red-700 dark:text-red-300">标签列表加载失败</p>
      <p class="mt-1 text-sm text-red-600/80 dark:text-red-400">{{ fetchErrorMessage }}</p>
      <AdminKumoButton variant="danger" size="toolbar"
        type="button"
        class="mt-4"
        @click="refreshList"
      >
        <Icon name="fa6-solid:rotate-right" />重试
      </AdminKumoButton>
    </div>

    <div
      v-if="error && tagData"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
      role="alert"
    >
      <span><Icon name="fa6-solid:triangle-exclamation" class="mr-1.5" />{{ fetchErrorMessage }}</span>
      <button type="button" class="font-medium hover:underline" @click="refreshList">重新加载</button>
    </div>

    <!-- 标签列表 -->
    <div
      v-if="!error || tagData"
      class="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-800 dark:ring-zinc-700"
      :aria-busy="pending"
    >
      <div class="tag-grid tag-grid-header border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-medium text-gray-500 dark:border-zinc-700 dark:bg-zinc-700/70 dark:text-gray-400">
        <span>VNDB 标签</span>
        <span>中文映射</span>
        <span>游戏数</span>
        <span>标签策略</span>
        <span class="sr-only">操作</span>
      </div>

      <div v-if="pending && !tagData" class="flex min-h-[260px] items-center justify-center text-gray-400">
        <Icon name="fa6-solid:spinner" class="fa-spin text-2xl" />
        <span class="ml-2 text-sm">正在加载</span>
      </div>

      <div v-else-if="!items.length" class="min-h-[260px] px-4 py-16 text-center text-gray-500 dark:text-gray-400">
        <Icon name="fa6-solid:tags" class="text-3xl text-gray-300 dark:text-zinc-600" />
        <p class="mt-3 text-sm">没有符合条件的 VNDB 标签</p>
        <button
          v-if="hasFilters"
          type="button"
          class="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
          @click="resetFilters"
        >
          清除筛选
        </button>
      </div>

      <div v-else class="relative divide-y divide-gray-100 dark:divide-zinc-700" :class="{ 'pointer-events-none opacity-60': pending }">
        <article v-for="item in items" :key="item.id" class="transition-colors hover:bg-gray-50/60 dark:hover:bg-zinc-700/20">
          <div class="tag-grid px-4 py-3.5">
            <div class="tag-cell-identity min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate font-medium" :title="item.nameEn">{{ item.nameEn }}</span>
                <span :class="statusBadgeClass(item.status)" class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium">
                  {{ statusLabel(item.status) }}
                </span>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                <code class="font-mono">{{ item.id }}</code>
                <span aria-hidden="true">·</span>
                <span>最近同步 {{ formatDate(item.lastSeenAt) }}</span>
              </div>
            </div>

            <div class="tag-cell-mapping min-w-0">
              <div v-if="item.status === 'MAPPED' && item.tag" class="flex min-w-0 items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                  :style="{ backgroundColor: item.tag.color || '#6b7280' }"
                ></span>
                <span class="truncate text-sm font-medium" :title="item.tag.name">{{ item.tag.name }}</span>
                <span v-if="item.tag.archivedAt" class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-zinc-700 dark:text-gray-400">已归档</span>
              </div>
              <span v-else-if="item.status === 'IGNORED'" class="text-sm text-gray-400">不参与站内标签</span>
              <span v-else class="text-sm text-orange-600 dark:text-orange-400">等待中文映射</span>
            </div>

            <div class="tag-cell-games flex items-center gap-1.5 text-sm tabular-nums text-gray-600 dark:text-gray-300">
              <Icon name="fa6-solid:gamepad" class="text-xs text-gray-400" />
              <span class="lg:hidden">关联</span>
              <span>{{ item.gamesCount }}</span>
            </div>

            <div class="tag-cell-policy flex flex-wrap items-center gap-1.5">
              <span
                v-if="item.displayTier === 'SECONDARY'"
                class="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              >副标签</span>
              <span
                v-if="item.isNsfw"
                class="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
              >R18</span>
              <span
                v-if="item.affectsGameNsfw"
                class="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              >影响游戏</span>
              <span
                v-if="item.displayTier !== 'SECONDARY' && !item.isNsfw && !item.affectsGameNsfw"
                class="text-sm text-gray-300 dark:text-zinc-600"
              >-</span>
            </div>

            <div class="tag-cell-action flex justify-end">
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-zinc-700 dark:hover:text-white"
                :class="{ 'bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-white': editingId === item.id }"
                :title="editingId === item.id ? '收起配置' : '配置映射'"
                :aria-label="editingId === item.id ? '收起配置' : '配置映射'"
                :aria-expanded="editingId === item.id"
                :disabled="Boolean(savingId)"
                @click="toggleEditor(item)"
              >
                <Icon :name="editingId === item.id ? 'fa6-solid:chevron-up' : 'fa6-solid:pen-to-square'" />
              </button>
            </div>
          </div>

          <Transition name="editor">
            <form
              v-if="editingId === item.id"
              class="border-t border-gray-200 bg-gray-50/90 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/45"
              @submit.prevent="saveMapping(item)"
            >
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="grid w-full grid-cols-3 rounded-lg border border-gray-200 bg-white p-1 dark:border-zinc-600 dark:bg-zinc-800 sm:w-auto sm:min-w-[380px]">
                  <button
                    v-for="mode in mappingModes"
                    :key="mode.value"
                    type="button"
                    class="h-8 rounded-md px-2 text-sm transition"
                    :class="editor.mode === mode.value
                      ? 'bg-gray-800 text-white shadow-sm dark:bg-zinc-600'
                      : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'"
                    @click="editor.mode = mode.value"
                  >
                    <FaIcon :icon="mode.icon" class="mr-1.5" />{{ mode.label }}
                  </button>
                </div>

                <button
                  v-if="item.status !== 'PENDING'"
                  type="button"
                  class="text-sm text-gray-500 transition hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400"
                  :disabled="savingId === item.id"
                  @click="resetMapping(item)"
                >
                  <Icon name="fa6-solid:arrow-rotate-left" class="mr-1.5" />重置为待处理
                </button>
              </div>

              <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div class="min-w-0">
                  <!-- 映射已有标签 -->
                  <div v-if="editor.mode === 'map'">
                    <label class="mb-1.5 block text-sm font-medium">中文标签</label>
                    <div
                      v-if="item.tag?.archivedAt"
                      class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300"
                    >
                      <Icon name="fa6-solid:box-archive" class="mr-1.5" />当前中文标签已归档，请重新选择
                    </div>
                    <div v-if="editor.selectedTag" class="mb-2 flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900/60 dark:bg-green-950/20">
                      <div class="flex min-w-0 items-center gap-2">
                        <span
                          class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                          :style="{ backgroundColor: editor.selectedTag.color || '#6b7280' }"
                        ></span>
                        <span class="truncate text-sm font-medium">{{ editor.selectedTag.name }}</span>
                        <span v-if="editor.selectedTag.isNsfw" class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">NSFW</span>
                      </div>
                      <button
                        type="button"
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-white hover:text-red-500 dark:hover:bg-zinc-800"
                        title="取消选择"
                        aria-label="取消选择"
                        @click="clearSelectedTag"
                      >
                        <Icon name="fa6-solid:xmark" />
                      </button>
                    </div>
                    <div class="relative">
                      <Icon name="fa6-solid:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
                      <input
                        v-model="tagSearchInput"
                        type="search"
                        class="admin-input w-full pl-9 pr-9"
                        placeholder="输入中文名、别名或 VNDB 英文名"
                        autocomplete="off"
                        @input="scheduleTagSearch"
                        @keydown.enter.prevent
                        @keydown.esc="clearTagSearch"
                      />
                      <Icon name="fa6-solid:spinner" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" v-if="tagSearchLoading" />
                    </div>

                    <div v-if="tagSearchInput.trim()" class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-zinc-600 dark:bg-zinc-800">
                      <div v-if="tagSearchError" class="flex items-center justify-between gap-3 px-3 py-3 text-sm text-red-500">
                        <span><Icon name="fa6-solid:circle-exclamation" class="mr-1.5" />{{ tagSearchError }}</span>
                        <button type="button" class="shrink-0 text-blue-600 hover:underline dark:text-blue-400" @click="retryTagSearch">
                          重试
                        </button>
                      </div>
                      <template v-else>
                        <button
                          v-for="tag in tagSearchResults"
                          :key="tag.id"
                          type="button"
                          class="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-700"
                          @click="selectTag(tag)"
                        >
                          <span
                            class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                            :style="{ backgroundColor: tag.color || '#6b7280' }"
                          ></span>
                          <span class="min-w-0 flex-1">
                            <span class="block truncate font-medium">{{ tag.name }}</span>
                            <span v-if="tag.vndbTags?.length" class="block truncate text-xs text-gray-400">
                              {{ tag.vndbTags.map(source => source.nameEn).join('、') }}
                            </span>
                          </span>
                          <span v-if="tag.isNsfw" class="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">NSFW</span>
                        </button>
                        <div v-if="!tagSearchLoading && !tagSearchResults.length" class="px-3 py-4 text-center text-sm text-gray-400">
                          未找到可映射的中文标签
                        </div>
                      </template>
                    </div>
                  </div>

                  <!-- 创建中文标签 -->
                  <div v-else-if="editor.mode === 'create'" class="grid gap-3 sm:grid-cols-2">
                    <label class="block sm:col-span-2">
                      <span class="mb-1.5 block text-sm font-medium">中文名 <span class="text-red-500">*</span></span>
                      <input
                        v-model.trim="editor.createName"
                        type="text"
                        maxlength="100"
                        class="admin-input w-full"
                        placeholder="输入站内显示的中文标签名"
                      />
                    </label>
                    <div class="block">
                      <label for="vndb-tag-create-color" class="mb-1.5 block text-sm font-medium">颜色</label>
                      <div class="flex items-center gap-2">
                        <span class="admin-input-group min-w-0 flex-1">
                          <input v-model="editor.createColor" type="color" class="h-8 w-8 shrink-0 cursor-pointer border-0 bg-transparent p-0" title="选择标签颜色" aria-label="选择标签颜色" />
                          <input
                            id="vndb-tag-create-color"
                            v-model.trim="editor.createColor"
                            type="text"
                            maxlength="7"
                            class="admin-input min-w-0 flex-1"
                            placeholder="#6b7280"
                          />
                        </span>
                        <button
                          type="button"
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
                          title="随机颜色"
                          aria-label="随机颜色"
                          @click="randomCreateColor"
                        >
                          <Icon name="fa6-solid:dice" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <label class="block">
                      <span class="mb-1.5 block text-sm font-medium">别名</span>
                      <input
                        v-model="editor.createAliases"
                        type="text"
                        class="admin-input w-full"
                        placeholder="多个别名用逗号分隔"
                      />
                    </label>
                    <label class="block sm:col-span-2">
                      <span class="mb-1.5 block text-sm font-medium">描述</span>
                      <textarea
                        v-model.trim="editor.createDescription"
                        rows="2"
                        class="admin-textarea w-full resize-y"
                        placeholder="可选"
                      ></textarea>
                    </label>
                  </div>

                  <!-- 忽略 -->
                  <div v-else class="flex items-start gap-3 py-1">
                    <Icon name="fa6-solid:eye-slash" class="mt-0.5 w-5 text-center text-gray-400" />
                    <div>
                      <p class="text-sm font-medium">忽略 {{ item.nameEn }}</p>
                      <p class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">该 VNDB 标签不会生成站内游戏标签；原始关联数据仍会保留。</p>
                    </div>
                  </div>
                </div>

                <aside class="border-t border-gray-200 pt-4 dark:border-zinc-700 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <!-- 展示层级 -->
                  <fieldset :disabled="editor.mode === 'ignore'">
                    <legend class="text-sm font-medium">展示层级</legend>
                    <div
                      class="mt-2 grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1 transition dark:border-zinc-600 dark:bg-zinc-800"
                      :class="{ 'opacity-50': editor.mode === 'ignore' }"
                    >
                      <label
                        v-for="tier in displayTierOptions"
                        :key="tier.value"
                        class="flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm transition focus-within:ring-2 focus-within:ring-gray-400 focus-within:ring-offset-1 dark:focus-within:ring-zinc-400 dark:focus-within:ring-offset-zinc-800"
                        :class="[
                          editor.displayTier === tier.value
                            ? 'bg-gray-800 text-white shadow-sm dark:bg-zinc-600'
                            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700',
                          editor.mode === 'ignore' ? 'cursor-not-allowed' : 'cursor-pointer',
                        ]"
                      >
                        <input
                          v-model="editor.displayTier"
                          type="radio"
                          name="vndb-tag-display-tier"
                          :value="tier.value"
                          class="sr-only"
                        />
                        <FaIcon :icon="tier.icon" aria-hidden="true" />
                        <span>{{ tier.label }}</span>
                      </label>
                    </div>
                  </fieldset>

                  <!-- 内容策略 -->
                  <section class="mt-4 border-t border-gray-200 pt-4 dark:border-zinc-700" aria-labelledby="vndb-content-policy-heading">
                    <h3 id="vndb-content-policy-heading" class="text-sm font-medium">内容策略</h3>
                    <div class="mt-1">
                      <label class="flex cursor-pointer items-start gap-3 py-2">
                        <input
                          v-model="editor.isNsfw"
                          type="checkbox"
                          class="mt-0.5 rounded border-gray-300 dark:border-zinc-600"
                        />
                        <span>
                          <span class="block text-sm font-medium">R18 标签</span>
                          <span class="mt-0.5 block text-xs text-gray-400">前台 SFW 模式下隐藏</span>
                        </span>
                      </label>
                      <label class="flex cursor-pointer items-start gap-3 py-2">
                        <input
                          v-model="editor.affectsGameNsfw"
                          type="checkbox"
                          class="mt-0.5 rounded border-gray-300 dark:border-zinc-600"
                        />
                        <span>
                          <span class="block text-sm font-medium">影响游戏 NSFW</span>
                          <span class="mt-0.5 block text-xs text-gray-400">命中时标记游戏内容级别</span>
                        </span>
                      </label>
                    </div>
                  </section>
                </aside>
              </div>

              <p v-if="editorError" class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                <Icon name="fa6-solid:circle-exclamation" class="mr-1" />{{ editorError }}
              </p>

              <div class="mt-4 flex items-center justify-end gap-2 border-t border-gray-200 pt-4 dark:border-zinc-700">
                <AdminKumoButton variant="secondary"
                  type="button"
                  :disabled="savingId === item.id"
                  @click="closeEditor"
                >
                  取消
                </AdminKumoButton>
                <AdminKumoButton variant="primary"
                  type="submit"
                  class="min-w-[104px]"
                  :disabled="savingId === item.id"
                >
                  <Icon name="fa6-solid:spinner"  v-if="savingId === item.id" />
                  <Icon name="fa6-solid:check"  v-else />
                  {{ savingId === item.id ? '保存中' : saveButtonLabel }}
                </AdminKumoButton>
              </div>
            </form>
          </Transition>
        </article>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        第 {{ pagination.page }} / {{ pagination.totalPages }} 页，共 {{ pagination.total }} 项
      </p>
      <div class="hidden sm:block">
        <Pagination admin :current="page" :total="pagination.totalPages" @change="changePage" />
      </div>
      <div class="flex w-full items-center justify-between gap-3 sm:hidden">
        <button
          type="button"
          class="h-9 w-9 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800"
          :disabled="page <= 1"
          title="上一页"
          aria-label="上一页"
          @click="changePage(page - 1)"
        >
          <Icon name="fa6-solid:chevron-left" />
        </button>
        <span class="text-sm tabular-nums text-gray-500 dark:text-gray-400">{{ page }} / {{ pagination.totalPages }}</span>
        <button
          type="button"
          class="h-9 w-9 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800"
          :disabled="page >= pagination.totalPages"
          title="下一页"
          aria-label="下一页"
          @click="changePage(page + 1)"
        >
          <Icon name="fa6-solid:chevron-right" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { generateRandomTagColor } from '~/utils/random-tag-color'

type MappingStatus = 'PENDING' | 'MAPPED' | 'IGNORED'
type MappingMode = 'map' | 'create' | 'ignore'
type DisplayTier = 'PRIMARY' | 'SECONDARY'

interface MappedTag {
  id: number
  name: string
  slug?: string | null
  color?: string | null
  isNsfw?: boolean
  isSystem?: boolean
  archivedAt?: string | null
  vndbTags?: Array<{ id: string; nameEn: string }>
}

interface VndbTagItem {
  id: string
  nameEn: string
  status: MappingStatus
  isNsfw: boolean
  affectsGameNsfw: boolean
  displayTier: DisplayTier
  tagId: number | null
  tag?: MappedTag | null
  gamesCount: number
  lastSeenAt: string
}

interface VndbTagResponse {
  items: VndbTagItem[]
  stats: {
    total: number
    pending: number
    mapped: number
    ignored: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface EditorState {
  mode: MappingMode
  selectedTag: MappedTag | null
  createName: string
  createDescription: string
  createColor: string
  createAliases: string
  displayTier: DisplayTier
  isNsfw: boolean
  affectsGameNsfw: boolean
}

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const route = useRoute()

function parseMappingStatus(value: unknown): MappingStatus | '' {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate === 'PENDING' || candidate === 'MAPPED' || candidate === 'IGNORED' ? candidate : ''
}

function parseDisplayTier(value: unknown): DisplayTier | '' {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate === 'PRIMARY' || candidate === 'SECONDARY' ? candidate : ''
}

const page = ref(1)
const limit = 30
const searchInput = ref('')
const search = ref('')
const statusFilter = ref<MappingStatus | ''>(parseMappingStatus(route.query.status))
const displayTierFilter = ref<DisplayTier | ''>(parseDisplayTier(route.query.displayTier))
const nsfwFilter = ref<'' | 'true' | 'false'>('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

const query = computed(() => ({
  page: page.value,
  limit,
  search: search.value || undefined,
  status: statusFilter.value || undefined,
  displayTier: displayTierFilter.value || undefined,
  isNsfw: nsfwFilter.value || undefined,
}))

const {
  data: tagData,
  pending,
  error,
  refresh,
} = await useAuthFetch<VndbTagResponse>('/api/admin/vndb-tags', {
  key: 'admin-vndb-tags',
  query,
  watch: [page, search, statusFilter, displayTierFilter, nsfwFilter],
})

const items = computed(() => tagData.value?.items ?? [])
const pagination = computed(() => tagData.value?.pagination ?? {
  page: page.value,
  limit,
  total: 0,
  totalPages: 1,
})
const hasFilters = computed(() => Boolean(search.value || statusFilter.value || displayTierFilter.value || nsfwFilter.value))

const statItems = computed(() => [
  {
    key: 'total',
    label: '全部标签',
    value: tagData.value?.stats.total ?? 0,
    filter: '' as const,
    icon: 'fa6-solid:tags',
    iconClass: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    borderClass: 'border-r border-b lg:border-b-0',
  },
  {
    key: 'pending',
    label: '待处理',
    value: tagData.value?.stats.pending ?? 0,
    filter: 'PENDING' as const,
    icon: 'fa6-solid:clock',
    iconClass: 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
    borderClass: 'border-b lg:border-r lg:border-b-0',
  },
  {
    key: 'mapped',
    label: '已映射',
    value: tagData.value?.stats.mapped ?? 0,
    filter: 'MAPPED' as const,
    icon: 'fa6-solid:link',
    iconClass: 'bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-300',
    borderClass: 'border-r lg:border-r',
  },
  {
    key: 'ignored',
    label: '已忽略',
    value: tagData.value?.stats.ignored ?? 0,
    filter: 'IGNORED' as const,
    icon: 'fa6-solid:eye-slash',
    iconClass: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300',
    borderClass: '',
  },
])

const mappingModes: Array<{ value: MappingMode; label: string; icon: string }> = [
  { value: 'map', label: '映射已有', icon: 'fa6-solid:link' },
  { value: 'create', label: '新建中文', icon: 'fa6-solid:plus' },
  { value: 'ignore', label: '忽略', icon: 'fa6-solid:eye-slash' },
]

const displayTierOptions: Array<{ value: DisplayTier; label: string; icon: string }> = [
  { value: 'PRIMARY', label: '主标签', icon: 'fa6-solid:tag' },
  { value: 'SECONDARY', label: '副标签', icon: 'fa6-solid:tags' },
]

function freshEditor(): EditorState {
  return {
    mode: 'map',
    selectedTag: null,
    createName: '',
    createDescription: '',
    createColor: '#6b7280',
    createAliases: '',
    displayTier: 'PRIMARY',
    isNsfw: false,
    affectsGameNsfw: false,
  }
}

const editingId = ref<string | null>(null)
const savingId = ref<string | null>(null)
const editor = reactive<EditorState>(freshEditor())
const editorError = ref('')
const tagSearchInput = ref('')
const tagSearchResults = ref<MappedTag[]>([])
const tagSearchLoading = ref(false)
const tagSearchError = ref('')
let tagSearchTimer: ReturnType<typeof setTimeout> | undefined
let tagSearchSequence = 0

const saveButtonLabel = computed(() => ({
  map: '保存映射',
  create: '创建并映射',
  ignore: '确认忽略',
})[editor.mode])

const fetchErrorMessage = computed(() => getErrorMessage(error.value, '请稍后重试'))

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = searchInput.value.trim()
    page.value = 1
  }, 300)
}

function clearSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchInput.value = ''
  search.value = ''
  page.value = 1
}

function setStatusFilter(filter: MappingStatus | '') {
  statusFilter.value = statusFilter.value === filter && filter !== '' ? '' : filter
}

function resetFilters() {
  clearSearch()
  statusFilter.value = ''
  displayTierFilter.value = ''
  nsfwFilter.value = ''
}

function changePage(nextPage: number) {
  page.value = nextPage
  editingId.value = null
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function refreshList() {
  await refresh()
}

function toggleEditor(item: VndbTagItem) {
  if (editingId.value === item.id) {
    closeEditor()
    return
  }

  Object.assign(editor, freshEditor(), {
    mode: item.status === 'IGNORED' ? 'ignore' : 'map',
    selectedTag: item.tag && !item.tag.archivedAt ? { ...item.tag } : null,
    displayTier: item.displayTier,
    isNsfw: item.isNsfw,
    affectsGameNsfw: item.affectsGameNsfw,
  })
  editingId.value = item.id
  editorError.value = ''
  clearTagSearch()
}

function closeEditor() {
  editingId.value = null
  editorError.value = ''
  clearTagSearch()
}

function clearSelectedTag() {
  editor.selectedTag = null
}

function clearTagSearch() {
  if (tagSearchTimer) clearTimeout(tagSearchTimer)
  tagSearchSequence++
  tagSearchInput.value = ''
  tagSearchResults.value = []
  tagSearchLoading.value = false
  tagSearchError.value = ''
}

function scheduleTagSearch() {
  if (tagSearchTimer) clearTimeout(tagSearchTimer)
  const sequence = ++tagSearchSequence
  const term = tagSearchInput.value.trim()
  tagSearchResults.value = []
  tagSearchError.value = ''
  if (!term) {
    tagSearchLoading.value = false
    return
  }
  tagSearchLoading.value = true
  tagSearchTimer = setTimeout(() => searchTags(term, sequence), 250)
}

async function searchTags(term: string, sequence = ++tagSearchSequence) {
  tagSearchLoading.value = true
  tagSearchError.value = ''
  try {
    const result = await authFetch<MappedTag[]>('/api/admin/tags/autocomplete', {
      query: { search: term, limit: 15 },
    })
    if (sequence === tagSearchSequence && term === tagSearchInput.value.trim()) {
      tagSearchResults.value = result
    }
  } catch (requestError) {
    if (sequence === tagSearchSequence) {
      tagSearchResults.value = []
      tagSearchError.value = getErrorMessage(requestError, '中文标签搜索失败')
    }
  } finally {
    if (sequence === tagSearchSequence) tagSearchLoading.value = false
  }
}

function retryTagSearch() {
  if (tagSearchTimer) clearTimeout(tagSearchTimer)
  const term = tagSearchInput.value.trim()
  if (!term) return
  searchTags(term)
}

function selectTag(tag: MappedTag) {
  editor.selectedTag = tag
  clearTagSearch()
}

function parseAliases(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/).map(alias => alias.trim()).filter(Boolean))]
}

function validHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function randomCreateColor() {
  editor.createColor = generateRandomTagColor()
}

async function saveMapping(item: VndbTagItem) {
  editorError.value = ''
  const mode = editor.mode
  let body: Record<string, unknown>

  if (mode === 'map') {
    if (!editor.selectedTag) {
      editorError.value = '请选择要映射的中文标签'
      return
    }
    body = {
      action: 'map',
      tagId: editor.selectedTag.id,
      displayTier: editor.displayTier,
      isNsfw: editor.isNsfw,
      affectsGameNsfw: editor.affectsGameNsfw,
    }
  } else if (mode === 'create') {
    if (!editor.createName) {
      editorError.value = '请输入中文标签名'
      return
    }
    if (editor.createColor && !validHexColor(editor.createColor)) {
      editorError.value = '颜色必须是 #RRGGBB 格式'
      return
    }
    body = {
      action: 'create',
      name: editor.createName,
      description: editor.createDescription || undefined,
      color: editor.createColor || undefined,
      aliases: parseAliases(editor.createAliases),
      displayTier: editor.displayTier,
      isNsfw: editor.isNsfw,
      affectsGameNsfw: editor.affectsGameNsfw,
    }
  } else {
    body = {
      action: 'ignore',
      displayTier: editor.displayTier,
      isNsfw: editor.isNsfw,
      affectsGameNsfw: editor.affectsGameNsfw,
    }
  }

  savingId.value = item.id
  try {
    await authFetch(`/api/admin/vndb-tags/${encodeURIComponent(item.id)}/mapping`, {
      method: 'PUT',
      body,
    })
    const successMessage = mode === 'map'
      ? '映射已保存'
      : mode === 'create'
        ? '中文标签已创建并完成映射'
        : 'VNDB 标签已忽略'
    closeEditor()
    toast.success(successMessage)
    await refreshAfterMutation()
  } catch (requestError) {
    editorError.value = getErrorMessage(requestError, '保存失败')
    toast.error(editorError.value)
  } finally {
    savingId.value = null
  }
}

async function resetMapping(item: VndbTagItem) {
  if (!confirm(`确定将「${item.nameEn}」重置为待处理吗？`)) return

  savingId.value = item.id
  editorError.value = ''
  try {
    await authFetch(`/api/admin/vndb-tags/${encodeURIComponent(item.id)}/mapping`, {
      method: 'PUT',
      body: { action: 'reset' },
    })
    closeEditor()
    toast.success('已重置为待处理')
    await refreshAfterMutation()
  } catch (requestError) {
    editorError.value = getErrorMessage(requestError, '重置失败')
    toast.error(editorError.value)
  } finally {
    savingId.value = null
  }
}

async function refreshAfterMutation() {
  await refresh()
  const totalPages = tagData.value?.pagination.totalPages ?? 0
  if (page.value > Math.max(1, totalPages)) {
    page.value = Math.max(1, totalPages)
  }
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as {
    message?: string
    statusMessage?: string
    data?: { message?: string; statusMessage?: string }
  }
  return candidate.data?.message || candidate.data?.statusMessage || candidate.statusMessage || candidate.message || fallback
}

function statusLabel(status: MappingStatus): string {
  return {
    PENDING: '待处理',
    MAPPED: '已映射',
    IGNORED: '已忽略',
  }[status]
}

function statusBadgeClass(status: MappingStatus): string {
  return {
    PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    MAPPED: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    IGNORED: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300',
  }[status]
}

function formatDate(value: string): string {
  if (!value) return '-'
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(timestamp)
}

watch([statusFilter, displayTierFilter, nsfwFilter], () => {
  page.value = 1
  closeEditor()
})

watch(items, currentItems => {
  if (editingId.value && !currentItems.some(item => item.id === editingId.value)) {
    closeEditor()
  }
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (tagSearchTimer) clearTimeout(tagSearchTimer)
  tagSearchSequence++
})

const siteName = useSiteName()
useHead({
  title: computed(() => `VNDB 标签映射 - ${siteName.value} 管理后台`),
})
</script>

<style scoped>
.tag-grid {
  display: grid;
  grid-template-columns: minmax(240px, 1.35fr) minmax(170px, 1fr) 76px 138px 36px;
  align-items: center;
  gap: 1rem;
}

.editor-enter-active,
.editor-leave-active {
  overflow: hidden;
  transition: opacity 0.18s ease, max-height 0.22s ease;
}

.editor-enter-from,
.editor-leave-to {
  max-height: 0;
  opacity: 0;
}

.editor-enter-to,
.editor-leave-from {
  max-height: 680px;
  opacity: 1;
}

@media (max-width: 1023px) {
  .tag-grid-header {
    display: none;
  }

  .tag-grid {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.65rem 1rem;
  }

  .tag-cell-identity {
    grid-column: 1;
    grid-row: 1;
  }

  .tag-cell-action {
    grid-column: 2;
    grid-row: 1;
  }

  .tag-cell-mapping {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .tag-cell-games {
    grid-column: 1;
    grid-row: 3;
  }

  .tag-cell-policy {
    grid-column: 2;
    grid-row: 3;
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .editor-enter-active,
  .editor-leave-active {
    transition: none;
  }
}
</style>
