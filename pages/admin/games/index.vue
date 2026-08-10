<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">游戏条目管理</h1>
      <div class="flex items-center gap-3">
        <div class="flex bg-gray-100 dark:bg-zinc-700 rounded-lg p-0.5">
        <button
          @click="activeTab = 'games'; currentPage = 1; searchQuery = ''; updateUrl()"
          class="px-4 py-1.5 rounded-md text-sm font-medium transition"
          :class="activeTab === 'games' ? 'bg-white dark:bg-zinc-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'"
        >
          <i class="fa-solid fa-gamepad mr-1.5"></i>全部游戏
        </button>
        <button
          @click="activeTab = 'trash'; currentPage = 1; searchQuery = ''; updateUrl()"
          class="px-4 py-1.5 rounded-md text-sm font-medium transition"
          :class="activeTab === 'trash' ? 'bg-white dark:bg-zinc-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'"
        >
          <i class="fa-solid fa-trash-can mr-1.5"></i>回收站
          <span v-if="trashData?.pagination?.total" class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 text-white">{{ trashData.pagination.total }}</span>
        </button>
      </div>
      <NuxtLink 
        to="/admin/games/create"
        class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 flex items-center gap-1.5"
      >
        <i class="fa-solid fa-plus"></i>创建条目
      </NuxtLink>
      </div>
    </div>

    <!-- 筛选 -->
    <div v-if="activeTab === 'games'" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="flex flex-wrap items-center gap-4">
        <div class="relative flex-1 min-w-[200px]">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索游戏标题..." 
            class="w-full px-4 py-2 pl-10 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            @keyup.enter="handleSearch"
          />
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>
        <select 
          v-model="nsfwFilter"
          class="px-4 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
          @change="handleFilter"
        >
          <option value="">全部类型</option>
          <option value="false">全年龄</option>
          <option value="true">NSFW</option>
        </select>
        <select 
          v-model="pageSize"
          class="px-4 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
          @change="handlePageSizeChange"
        >
          <option :value="20">20条/页</option>
          <option :value="50">50条/页</option>
          <option :value="100">100条/页</option>
        </select>
        <button
          @click="showAdvanced = !showAdvanced"
          :class="[
            'px-4 py-2 rounded-lg border text-sm transition flex items-center gap-1.5',
            showAdvanced || hasAdvancedFilter
              ? 'bg-gray-800 dark:bg-zinc-600 text-white border-transparent'
              : 'dark:bg-zinc-700 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600'
          ]"
        >
          <i class="fa-solid fa-sliders"></i>
          高级筛选
          <span v-if="advancedFilterCount > 0" class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">{{ advancedFilterCount }}</span>
          <i :class="showAdvanced ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" class="text-xs ml-0.5"></i>
        </button>
      </div>

      <!-- 高级筛选面板 -->
      <Transition name="slide-down">
        <div v-if="showAdvanced" class="mt-4 pt-4 border-t dark:border-zinc-700">
          <div class="flex flex-wrap items-center gap-3">
            <button
              v-for="filter in advancedFilters"
              :key="filter.key"
              :class="[
                'px-3 py-1.5 rounded-lg border text-sm transition',
                filter.active.value
                  ? 'bg-gray-800 dark:bg-zinc-600 text-white border-transparent'
                  : 'dark:bg-zinc-700 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600'
              ]"
              @click="filter.toggle()"
            >
              <i :class="filter.icon" class="mr-1"></i>{{ filter.label }}
            </button>
            <button
              v-if="hasAdvancedFilter"
              class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
              @click="clearAdvancedFilters"
            >
              <i class="fa-solid fa-xmark mr-1"></i>清除筛选
            </button>
          </div>
        </div>
      </Transition>
      
      <!-- 批量操作栏 -->
      <div v-if="selectedIds.length > 0" class="mt-4 pt-4 border-t dark:border-zinc-700">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-medium">已选择 <strong>{{ selectedIds.length }}</strong> 项</span>
          <div class="h-4 w-px bg-gray-300 dark:bg-zinc-600"></div>
          <button 
            @click="showBatchEdit = !showBatchEdit"
            :class="[
              'px-3 py-1.5 text-sm rounded-lg border transition flex items-center gap-1.5',
              showBatchEdit
                ? 'bg-gray-800 dark:bg-zinc-600 text-white border-transparent'
                : 'dark:bg-zinc-700 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600'
            ]"
          >
            <i class="fa-solid fa-pen-to-square"></i>批量编辑
            <i :class="showBatchEdit ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" class="text-xs"></i>
          </button>
          <button 
            @click="batchDelete"
            class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-1.5"
          >
            <i class="fa-solid fa-trash"></i>批量删除
          </button>
          <button 
            @click="clearSelection"
            class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
          >
            取消选择
          </button>
        </div>

        <!-- 批量编辑面板 -->
        <Transition name="slide-down">
          <div v-if="showBatchEdit" class="mt-4 pt-4 border-t dark:border-zinc-700 space-y-4">
            <!-- 设置会社 -->
            <div class="flex flex-wrap items-end gap-3">
              <div class="min-w-[200px]">
                <label class="block text-xs font-medium text-gray-500 mb-1">设置会社</label>
                <div v-if="batchSelectedCompany" class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg text-sm">
                  <span class="font-medium flex-1">{{ batchSelectedCompany.name }}</span>
                  <button type="button" @click="batchSelectedCompany = null; batchCompanyId = null" class="text-gray-400 hover:text-red-500">
                    <i class="fa-solid fa-times text-xs"></i>
                  </button>
                </div>
                <div v-else class="relative">
                  <input
                    v-model="batchCompanySearch"
                    type="text"
                    placeholder="搜索会社名称..."
                    class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    @input="searchBatchCompanies"
                    @focus="showBatchCompanyDropdown = true"
                  />
                  <div
                    v-if="showBatchCompanyDropdown && batchCompanyResults.length"
                    class="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-auto"
                  >
                    <button
                      v-for="c in batchCompanyResults" :key="c.id"
                      type="button"
                      class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-600 text-sm"
                      @click="selectBatchCompany(c)"
                    >
                      <span class="font-medium">{{ c.name }}</span>
                      <span v-if="c.nameOriginal" class="text-gray-500 ml-1.5 text-xs">{{ c.nameOriginal }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <select v-model="batchCompanyRole" class="px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm">
                  <option value="DEVELOPER">开发商</option>
                  <option value="PUBLISHER">发行商</option>
                </select>
              </div>
              <button 
                @click="doBatchSetCompany"
                :disabled="!batchCompanyId || batchLoading"
                class="px-4 py-2 text-sm rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50 transition"
              >
                <i v-if="batchLoading" class="fa-solid fa-spinner fa-spin mr-1"></i>应用
              </button>
            </div>

            <!-- 设置系列 -->
            <div class="flex flex-wrap items-end gap-3">
              <div class="min-w-[200px]">
                <label class="block text-xs font-medium text-gray-500 mb-1">设置系列</label>
                <div class="relative">
                  <input
                    v-if="!batchSelectedSeries"
                    v-model="batchSeriesSearch"
                    type="text"
                    placeholder="搜索系列名称..."
                    class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
                    @input="searchBatchSeries"
                  />
                  <div v-else class="flex items-center gap-2 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm">
                    <span class="truncate">{{ batchSelectedSeries.name }}</span>
                    <button @click="batchSelectedSeries = null" class="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <div v-if="batchSeriesResults.length > 0 && !batchSelectedSeries" class="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button
                      v-for="s in batchSeriesResults"
                      :key="s.id"
                      type="button"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                      @click="batchSelectedSeries = s; batchSeriesSearch = ''; batchSeriesResults = []"
                    >
                      {{ s.name }} <span class="text-gray-400 text-xs">({{ s.gamesCount }})</span>
                    </button>
                  </div>
                </div>
              </div>
              <button 
                @click="doBatchSetSeries"
                :disabled="!batchSelectedSeries || batchLoading"
                class="px-4 py-2 text-sm rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50 transition"
              >
                <i v-if="batchLoading" class="fa-solid fa-spinner fa-spin mr-1"></i>应用
              </button>
              <button 
                @click="doBatchClearSeries"
                :disabled="batchLoading"
                class="px-4 py-2 text-sm rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600 disabled:opacity-50 transition"
              >
                清除系列
              </button>
            </div>

            <!-- 添加/移除标签 -->
            <div class="flex flex-wrap items-end gap-3">
              <div class="min-w-[280px]">
                <label class="block text-xs font-medium text-gray-500 mb-1">标签操作</label>
                <div class="flex flex-wrap gap-1.5 p-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 min-h-[38px]">
                  <span 
                    v-for="tag in batchSelectedTags" 
                    :key="tag.id"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    :style="{ backgroundColor: (tag.color || '#6b7280') + '20', color: tag.color || '#6b7280' }"
                  >
                    {{ tag.name }}
                    <button @click="removeBatchTag(tag.id)" class="hover:opacity-70">
                      <i class="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </span>
                  <input
                    v-model="batchTagSearch"
                    type="text"
                    placeholder="搜索标签..."
                    class="flex-1 min-w-[80px] bg-transparent text-sm outline-none"
                    @input="searchBatchTags"
                  />
                </div>
                <div v-if="batchTagResults.length > 0" class="relative">
                  <div class="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button
                      v-for="t in batchTagResults"
                      :key="t.id"
                      type="button"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center gap-2"
                      @mousedown.prevent="addBatchTag(t)"
                    >
                      <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: t.color || '#6b7280' }"></span>
                      {{ t.name }} <span class="text-gray-400 text-xs">({{ t.gamesCount }})</span>
                    </button>
                  </div>
                </div>
              </div>
              <button 
                @click="doBatchAddTags"
                :disabled="!batchSelectedTags.length || batchLoading"
                class="px-4 py-2 text-sm rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50 transition"
              >
                <i v-if="batchLoading" class="fa-solid fa-spinner fa-spin mr-1"></i>添加标签
              </button>
              <button 
                @click="doBatchRemoveTags"
                :disabled="!batchSelectedTags.length || batchLoading"
                class="px-4 py-2 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition"
              >
                移除标签
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 游戏列表 -->
    <div v-if="activeTab === 'games'" class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left">
              <input 
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                class="rounded border-gray-300 dark:border-zinc-600"
              />
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium">游戏</th>
            <th class="px-4 py-3 text-left text-sm font-medium">会社</th>
            <th class="px-4 py-3 text-left text-sm font-medium">类型</th>
            <th class="px-4 py-3 text-left text-sm font-medium">浏览/资源</th>
            <th class="px-4 py-3 text-left text-sm font-medium">创建者</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="game in gamesData?.items" :key="game.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3">
              <input 
                type="checkbox"
                :checked="selectedIds.includes(game.id)"
                @change="toggleSelect(game.id)"
                class="rounded border-gray-300 dark:border-zinc-600"
              />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <img 
                  v-if="game.coverImage"
                  :src="game.coverImage" 
                  class="w-12 h-16 rounded object-cover"
                />
                <div 
                  v-else
                  class="w-12 h-16 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center"
                >
                  <i class="fa-solid fa-gamepad text-gray-400 dark:text-zinc-500"></i>
                </div>
                <div class="min-w-0 max-w-[260px]">
                  <NuxtLink :to="`/games/${game.id}`" class="font-medium hover:underline line-clamp-2 break-all">
                    {{ game.title }}
                  </NuxtLink>
                  <div v-if="game.titleJa && game.titleJa !== game.title" class="text-xs text-gray-500 truncate">
                    {{ game.titleJa }}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm">
              {{ game.company?.name || '-' }}
            </td>
            <td class="px-4 py-3">
              <span 
                class="px-2 py-1 text-xs rounded font-medium"
                :class="game.isNsfw 
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                  : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'"
              >
                {{ game.isNsfw ? 'NSFW' : '全年龄' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ game.viewCount }} / {{ game.resourcesCount }}
            </td>
            <td class="px-4 py-3 text-sm">
              {{ game.creator?.username }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <NuxtLink 
                  :to="`/games/${game.id}`"
                  target="_blank"
                  class="text-gray-500 hover:text-gray-600 text-sm"
                >
                  查看
                </NuxtLink>
                <NuxtLink 
                  :to="`/admin/games/${game.id}/edit`"
                  class="text-blue-500 hover:text-blue-600 text-sm"
                >
                  编辑
                </NuxtLink>
                <button 
                  @click="deleteGame(game.id, game.title)"
                  class="text-red-500 hover:text-red-600 text-sm"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!gamesData?.items?.length" class="text-center text-gray-500 py-12">
        暂无游戏条目
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="activeTab === 'games'" class="mt-6 flex items-center justify-between">
      <div class="text-sm text-gray-500">
        共 {{ gamesData?.pagination?.total || 0 }} 条
      </div>
      <Pagination 
        v-if="gamesData && gamesData.pagination.totalPages > 1"
        :current-page="currentPage"
        :total-pages="gamesData.pagination.totalPages"
        @page-change="handlePageChange"
      />
    </div>

    <!-- 回收站视图 -->
    <template v-if="activeTab === 'trash'">
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
        <div class="flex flex-wrap items-center gap-4">
          <div class="relative flex-1 min-w-[200px]">
            <input 
              v-model="trashSearch"
              type="text" 
              placeholder="搜索已删除的游戏..." 
              class="w-full px-4 py-2 pl-10 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              @keyup.enter="trashPage = 1"
            />
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          </div>
        </div>

        <div v-if="trashSelectedIds.length > 0" class="mt-4 pt-4 border-t dark:border-zinc-700">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm font-medium">已选择 <strong>{{ trashSelectedIds.length }}</strong> 项</span>
            <div class="h-4 w-px bg-gray-300 dark:bg-zinc-600"></div>
            <button 
              @click="trashBatchRestore"
              :disabled="trashBatchLoading"
              class="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-1.5"
            >
              <i :class="trashBatchLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-rotate-left'"></i>
              批量恢复
            </button>
            <button 
              @click="trashBatchPurge"
              :disabled="trashBatchLoading"
              class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-1.5"
            >
              <i :class="trashBatchLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-fire'"></i>
              彻底删除
            </button>
            <button 
              @click="trashSelectedIds = []"
              class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
            >
              取消选择
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-zinc-700">
            <tr>
              <th class="px-4 py-3 text-left">
                <input type="checkbox" :checked="trashAllSelected" @change="trashToggleAll" class="rounded" />
              </th>
              <th class="px-4 py-3 text-left text-sm font-medium">游戏</th>
              <th class="px-4 py-3 text-left text-sm font-medium">VNDB / Bangumi</th>
              <th class="px-4 py-3 text-left text-sm font-medium">资源/评论</th>
              <th class="px-4 py-3 text-left text-sm font-medium">删除时间</th>
              <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y dark:divide-zinc-700">
            <tr v-for="game in trashData?.items" :key="game.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
              <td class="px-4 py-3">
                <input type="checkbox" :checked="trashSelectedIds.includes(game.id)" @change="trashToggleSelect(game.id)" class="rounded" />
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <img v-if="game.coverImage" :src="game.coverImage" class="w-12 h-16 rounded object-cover opacity-60" />
                  <div v-else class="w-12 h-16 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                    <i class="fa-solid fa-gamepad text-xs text-gray-400"></i>
                  </div>
                  <div class="min-w-0 max-w-[260px]">
                    <div class="font-medium line-clamp-2 break-all text-gray-500">{{ game.title }}</div>
                    <div class="text-xs text-gray-400">ID: {{ game.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">
                <div v-if="game.vndbId">VNDB: {{ game.vndbId }}</div>
                <div v-if="game.bangumiId">BGM: {{ game.bangumiId }}</div>
                <span v-if="!game.vndbId && !game.bangumiId">-</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ game.resourcesCount }} / {{ game.commentsCount }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ game.deletedAt ? formatDate(game.deletedAt) : '-' }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button @click="trashRestore(game)" class="text-green-500 hover:text-green-600 text-sm">
                    <i class="fa-solid fa-rotate-left mr-1"></i>恢复
                  </button>
                  <button @click="trashPurge(game)" class="text-red-500 hover:text-red-600 text-sm">
                    <i class="fa-solid fa-fire mr-1"></i>彻底删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!trashData?.items?.length" class="flex flex-col items-center justify-center text-gray-500 py-12">
          <i class="fa-solid fa-trash-can text-2xl mb-2 text-gray-300 dark:text-zinc-600"></i>
          <span class="text-sm">回收站为空</span>
        </div>
      </div>

      <div class="mt-6 flex items-center justify-between">
        <div class="text-sm text-gray-500">共 {{ trashData?.pagination?.total || 0 }} 条</div>
        <Pagination 
          v-if="trashData && trashData.pagination.totalPages > 1"
          :current-page="trashPage"
          :total-pages="trashData.pagination.totalPages"
          @page-change="trashPage = $event"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { AdminGameItem, ListResponse } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

const activeTab = ref<'games' | 'trash'>(route.query.tab === 'trash' ? 'trash' : 'games')

// 基础筛选
const searchQuery = ref(route.query.search as string || '')
const nsfwFilter = ref(route.query.isNsfw as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const pageSize = ref(parseInt(route.query.limit as string) || 20)

// 高级筛选
const showAdvanced = ref(false)
const noResourcesFilter = ref(route.query.noResources === 'true')
const missingCoverFilter = ref(route.query.missingCover === 'true')
const missingDescriptionFilter = ref(route.query.missingDescription === 'true')
const noTagsFilter = ref(route.query.noTags === 'true')
const missingExternalIdsFilter = ref(route.query.missingExternalIds === 'true')
const noVndbFilter = ref(route.query.noVndb === 'true')
const noBangumiFilter = ref(route.query.noBangumi === 'true')
const noScreenshotsFilter = ref(route.query.noScreenshots === 'true')
const duplicateResourcesFilter = ref(route.query.duplicateResources === 'true')
const noZhTitleFilter = ref(route.query.noZhTitle === 'true')
const noZhDescFilter = ref(route.query.noZhDesc === 'true')
const hasMachineTranslationFilter = ref(route.query.hasMachineTranslation === 'true')

const advancedFilters = [
  { key: 'missingCover', label: '缺封面', icon: 'fa-solid fa-image', active: missingCoverFilter, toggle: () => { missingCoverFilter.value = !missingCoverFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'missingDescription', label: '缺简介', icon: 'fa-solid fa-align-left', active: missingDescriptionFilter, toggle: () => { missingDescriptionFilter.value = !missingDescriptionFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'noTags', label: '无标签', icon: 'fa-solid fa-tags', active: noTagsFilter, toggle: () => { noTagsFilter.value = !noTagsFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'missingExternalIds', label: '缺 VNDB/Bangumi', icon: 'fa-solid fa-link-slash', active: missingExternalIdsFilter, toggle: () => { missingExternalIdsFilter.value = !missingExternalIdsFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'noResources', label: '无可用资源', icon: 'fa-solid fa-box-open', active: noResourcesFilter, toggle: () => { noResourcesFilter.value = !noResourcesFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'noVndb', label: '无VNDB', icon: 'fa-solid fa-link-slash', active: noVndbFilter, toggle: () => { noVndbFilter.value = !noVndbFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'noBangumi', label: '无Bangumi', icon: 'fa-solid fa-link-slash', active: noBangumiFilter, toggle: () => { noBangumiFilter.value = !noBangumiFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'noScreenshots', label: '无截图', icon: 'fa-solid fa-images', active: noScreenshotsFilter, toggle: () => { noScreenshotsFilter.value = !noScreenshotsFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'duplicateResources', label: '重复资源', icon: 'fa-solid fa-clone', active: duplicateResourcesFilter, toggle: () => { duplicateResourcesFilter.value = !duplicateResourcesFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'noZhTitle', label: '无中文名', icon: 'fa-solid fa-font', active: noZhTitleFilter, toggle: () => { noZhTitleFilter.value = !noZhTitleFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'noZhDesc', label: '无中文简介', icon: 'fa-solid fa-align-left', active: noZhDescFilter, toggle: () => { noZhDescFilter.value = !noZhDescFilter.value; currentPage.value = 1; updateUrl() } },
  { key: 'hasMachineTranslation', label: '有机翻资源', icon: 'fa-solid fa-language', active: hasMachineTranslationFilter, toggle: () => { hasMachineTranslationFilter.value = !hasMachineTranslationFilter.value; currentPage.value = 1; updateUrl() } },
]

const hasAdvancedFilter = computed(() => advancedFilters.some(f => f.active.value))
const advancedFilterCount = computed(() => advancedFilters.filter(f => f.active.value).length)

if (hasAdvancedFilter.value) {
  showAdvanced.value = true
}

function clearAdvancedFilters() {
  noResourcesFilter.value = false
  missingCoverFilter.value = false
  missingDescriptionFilter.value = false
  noTagsFilter.value = false
  missingExternalIdsFilter.value = false
  noVndbFilter.value = false
  hasMachineTranslationFilter.value = false
  noBangumiFilter.value = false
  noScreenshotsFilter.value = false
  duplicateResourcesFilter.value = false
  noZhTitleFilter.value = false
  noZhDescFilter.value = false
  currentPage.value = 1
  updateUrl()
}

// 选择 & 批量操作
const selectedIds = ref<number[]>([])
const showBatchEdit = ref(false)
const batchLoading = ref(false)

// 批量编辑 - 会社
const batchCompanyId = ref<number | null>(null)
const batchCompanyRole = ref<'DEVELOPER' | 'PUBLISHER'>('DEVELOPER')
const batchCompanySearch = ref('')
const batchCompanyResults = ref<any[]>([])
const batchSelectedCompany = ref<{ id: number; name: string } | null>(null)
const showBatchCompanyDropdown = ref(false)
let batchCompanyTimer: ReturnType<typeof setTimeout>

// 批量编辑 - 系列
const batchSeriesSearch = ref('')
const batchSeriesResults = ref<{ id: number; name: string; gamesCount: number }[]>([])
const batchSelectedSeries = ref<{ id: number; name: string } | null>(null)
let batchSeriesTimer: ReturnType<typeof setTimeout>

// 批量编辑 - 标签
const batchTagSearch = ref('')
const batchTagResults = ref<{ id: number; name: string; color: string | null; gamesCount: number }[]>([])
const batchSelectedTags = ref<{ id: number; name: string; color: string | null }[]>([])
let batchTagTimer: ReturnType<typeof setTimeout>

// 搜索批量会社
function searchBatchCompanies() {
  showBatchCompanyDropdown.value = true
  clearTimeout(batchCompanyTimer)
  const q = batchCompanySearch.value.trim()
  if (!q) { batchCompanyResults.value = []; return }
  batchCompanyTimer = setTimeout(async () => {
    try {
      const data = await $fetch<any>('/api/companies', { query: { search: q, limit: 10 } })
      batchCompanyResults.value = data.items || []
    } catch { batchCompanyResults.value = [] }
  }, 300)
}

function selectBatchCompany(c: any) {
  batchSelectedCompany.value = { id: c.id, name: c.name }
  batchCompanyId.value = c.id
  batchCompanySearch.value = ''
  batchCompanyResults.value = []
  showBatchCompanyDropdown.value = false
}

// 数据
const { data: gamesData, refresh } = await useAuthFetch<ListResponse<AdminGameItem>>('/api/admin/games', {
  key: 'admin-games-list',
  query: computed(() => ({
    page: currentPage.value,
    limit: pageSize.value,
    search: searchQuery.value || undefined,
    isNsfw: nsfwFilter.value || undefined,
    noResources: noResourcesFilter.value ? 'true' : undefined,
    missingCover: missingCoverFilter.value ? 'true' : undefined,
    missingDescription: missingDescriptionFilter.value ? 'true' : undefined,
    noTags: noTagsFilter.value ? 'true' : undefined,
    missingExternalIds: missingExternalIdsFilter.value ? 'true' : undefined,
    noVndb: noVndbFilter.value ? 'true' : undefined,
    noBangumi: noBangumiFilter.value ? 'true' : undefined,
    noScreenshots: noScreenshotsFilter.value ? 'true' : undefined,
    duplicateResources: duplicateResourcesFilter.value ? 'true' : undefined,
    noZhTitle: noZhTitleFilter.value ? 'true' : undefined,
    noZhDesc: noZhDescFilter.value ? 'true' : undefined,
  })),
})

// 选择逻辑
const isAllSelected = computed(() => {
  if (!gamesData.value?.items?.length) return false
  return gamesData.value.items.every((g: any) => selectedIds.value.includes(g.id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = gamesData.value?.items?.map((g: any) => g.id) || []
  }
}

function toggleSelect(id: number) {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function clearSelection() {
  selectedIds.value = []
  showBatchEdit.value = false
}

// 搜索系列
function searchBatchSeries() {
  clearTimeout(batchSeriesTimer)
  const q = batchSeriesSearch.value.trim()
  if (!q) { batchSeriesResults.value = []; return }
  batchSeriesTimer = setTimeout(async () => {
    try {
      batchSeriesResults.value = await $fetch<any[]>('/api/series/search', { query: { q, limit: 10 } })
    } catch { batchSeriesResults.value = [] }
  }, 300)
}

// 搜索标签
function searchBatchTags() {
  clearTimeout(batchTagTimer)
  const q = batchTagSearch.value.trim()
  if (!q) { batchTagResults.value = []; return }
  batchTagTimer = setTimeout(async () => {
    try {
      const data = await $fetch<any>('/api/tags', { query: { search: q, limit: 20 } })
      batchTagResults.value = (data.items || []).filter((t: any) => !batchSelectedTags.value.some(s => s.id === t.id))
    } catch { batchTagResults.value = [] }
  }, 300)
}

function addBatchTag(tag: { id: number; name: string; color: string | null }) {
  if (!batchSelectedTags.value.some(t => t.id === tag.id)) {
    batchSelectedTags.value.push(tag)
  }
  batchTagSearch.value = ''
  batchTagResults.value = []
}

function removeBatchTag(id: number) {
  batchSelectedTags.value = batchSelectedTags.value.filter(t => t.id !== id)
}

// 批量操作执行
async function doBatchSetCompany() {
  if (!batchCompanyId.value) return
  batchLoading.value = true
  try {
    const res = await authFetch<any>('/api/admin/games/batch', {
      method: 'PUT',
      body: { ids: selectedIds.value, action: 'setCompany', companyId: batchCompanyId.value, companyRole: batchCompanyRole.value },
    })
    toast.success(res.message)
    await refresh()
  } catch (e: any) { toast.error(e.data?.message || '操作失败') }
  finally { batchLoading.value = false }
}

async function doBatchSetSeries() {
  if (!batchSelectedSeries.value) return
  batchLoading.value = true
  try {
    const res = await authFetch<any>('/api/admin/games/batch', {
      method: 'PUT',
      body: { ids: selectedIds.value, action: 'setSeries', seriesId: batchSelectedSeries.value.id },
    })
    toast.success(res.message)
    await refresh()
  } catch (e: any) { toast.error(e.data?.message || '操作失败') }
  finally { batchLoading.value = false }
}

async function doBatchClearSeries() {
  if (!confirm('确定要清除选中游戏的系列设置吗？')) return
  batchLoading.value = true
  try {
    const res = await authFetch<any>('/api/admin/games/batch', {
      method: 'PUT',
      body: { ids: selectedIds.value, action: 'setSeries', seriesId: null },
    })
    toast.success(res.message)
    await refresh()
  } catch (e: any) { toast.error(e.data?.message || '操作失败') }
  finally { batchLoading.value = false }
}

async function doBatchAddTags() {
  if (!batchSelectedTags.value.length) return
  batchLoading.value = true
  try {
    const res = await authFetch<any>('/api/admin/games/batch', {
      method: 'PUT',
      body: { ids: selectedIds.value, action: 'addTags', tagIds: batchSelectedTags.value.map(t => t.id) },
    })
    toast.success(res.message)
    await refresh()
  } catch (e: any) { toast.error(e.data?.message || '操作失败') }
  finally { batchLoading.value = false }
}

async function doBatchRemoveTags() {
  if (!batchSelectedTags.value.length) return
  if (!confirm('确定要从选中游戏移除这些标签吗？')) return
  batchLoading.value = true
  try {
    const res = await authFetch<any>('/api/admin/games/batch', {
      method: 'PUT',
      body: { ids: selectedIds.value, action: 'removeTags', tagIds: batchSelectedTags.value.map(t => t.id) },
    })
    toast.success(res.message)
    await refresh()
  } catch (e: any) { toast.error(e.data?.message || '操作失败') }
  finally { batchLoading.value = false }
}

async function batchDelete() {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个游戏吗？此操作不可撤销。`)) return
  try {
    await authFetch('/api/admin/games/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value },
    })
    await refresh()
    toast.success(`已删除 ${selectedIds.value.length} 个游戏`)
    selectedIds.value = []
    showBatchEdit.value = false
  } catch (error: any) {
    toast.error(error.data?.message || '批量删除失败')
  }
}

// 导航
function handleSearch() {
  currentPage.value = 1
  updateUrl()
}

function handleFilter() {
  currentPage.value = 1
  updateUrl()
}

function handlePageSizeChange() {
  currentPage.value = 1
  updateUrl()
}

function handlePageChange(page: number) {
  currentPage.value = page
  updateUrl()
}

function updateUrl() {
  router.push({
    query: {
      ...(activeTab.value === 'trash' && { tab: 'trash' }),
      ...(activeTab.value === 'games' && searchQuery.value && { search: searchQuery.value }),
      ...(activeTab.value === 'games' && nsfwFilter.value && { isNsfw: nsfwFilter.value }),
      ...(activeTab.value === 'games' && pageSize.value !== 20 && { limit: pageSize.value }),
      ...(activeTab.value === 'games' && noResourcesFilter.value && { noResources: 'true' }),
      ...(activeTab.value === 'games' && missingCoverFilter.value && { missingCover: 'true' }),
      ...(activeTab.value === 'games' && missingDescriptionFilter.value && { missingDescription: 'true' }),
      ...(activeTab.value === 'games' && noTagsFilter.value && { noTags: 'true' }),
      ...(activeTab.value === 'games' && missingExternalIdsFilter.value && { missingExternalIds: 'true' }),
      ...(activeTab.value === 'games' && noVndbFilter.value && { noVndb: 'true' }),
      ...(activeTab.value === 'games' && noBangumiFilter.value && { noBangumi: 'true' }),
      ...(activeTab.value === 'games' && noScreenshotsFilter.value && { noScreenshots: 'true' }),
      ...(activeTab.value === 'games' && duplicateResourcesFilter.value && { duplicateResources: 'true' }),
      ...(activeTab.value === 'games' && noZhTitleFilter.value && { noZhTitle: 'true' }),
      ...(activeTab.value === 'games' && noZhDescFilter.value && { noZhDesc: 'true' }),
      ...(activeTab.value === 'games' && hasMachineTranslationFilter.value && { hasMachineTranslation: 'true' }),
      ...(activeTab.value === 'games' && currentPage.value > 1 && { page: currentPage.value }),
    },
  })
}

async function deleteGame(id: number, title: string) {
  if (!confirm(`确定要删除游戏「${title}」吗？此操作不可撤销。`)) return
  try {
    await authFetch(`/api/admin/games/${id}`, { method: 'DELETE' })
    await refresh()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

// ===== 回收站 =====
const trashSearch = ref('')
const trashPage = ref(1)
const trashSelectedIds = ref<number[]>([])
const trashBatchLoading = ref(false)

const { data: trashData, refresh: refreshTrash } = await useAuthFetch<ListResponse<AdminGameItem>>('/api/admin/games/trash', {
  key: 'admin-games-trash',
  query: computed(() => ({
    page: trashPage.value,
    limit: 20,
    search: trashSearch.value || undefined,
  })),
})

const trashAllSelected = computed(() => {
  if (!trashData.value?.items?.length) return false
  return trashData.value.items.every((g: any) => trashSelectedIds.value.includes(g.id))
})

function trashToggleAll() {
  if (trashAllSelected.value) {
    trashSelectedIds.value = []
  } else {
    trashSelectedIds.value = trashData.value?.items?.map((g: any) => g.id) || []
  }
}

function trashToggleSelect(id: number) {
  const idx = trashSelectedIds.value.indexOf(id)
  if (idx > -1) trashSelectedIds.value.splice(idx, 1)
  else trashSelectedIds.value.push(id)
}

async function trashRestore(game: any) {
  if (!confirm(`确定要恢复游戏「${game.title}」吗？`)) return
  try {
    await authFetch(`/api/admin/games/${game.id}/restore`, { method: 'POST' })
    toast.success('恢复成功')
    await refreshTrash()
  } catch (e: any) { toast.error(e.data?.message || '恢复失败') }
}

async function trashPurge(game: any) {
  if (!confirm(`确定要彻底删除游戏「${game.title}」吗？\n\n此操作将删除该游戏的所有关联数据，且不可恢复！`)) return
  try {
    await authFetch(`/api/admin/games/${game.id}/purge`, { method: 'DELETE' })
    toast.success('已彻底删除')
    await refreshTrash()
  } catch (e: any) { toast.error(e.data?.message || '删除失败') }
}

async function trashBatchRestore() {
  if (!confirm(`确定要恢复选中的 ${trashSelectedIds.value.length} 个游戏吗？`)) return
  trashBatchLoading.value = true
  try {
    const res = await authFetch<any>('/api/admin/games/trash-batch', {
      method: 'POST',
      body: { ids: trashSelectedIds.value, action: 'restore' },
    })
    toast.success(res.message)
    trashSelectedIds.value = []
    await refreshTrash()
  } catch (e: any) { toast.error(e.data?.message || '批量恢复失败') }
  finally { trashBatchLoading.value = false }
}

async function trashBatchPurge() {
  if (!confirm(`确定要彻底删除选中的 ${trashSelectedIds.value.length} 个游戏吗？\n\n此操作不可恢复！`)) return
  trashBatchLoading.value = true
  try {
    const res = await authFetch<any>('/api/admin/games/trash-batch', {
      method: 'POST',
      body: { ids: trashSelectedIds.value, action: 'purge' },
    })
    toast.success(res.message)
    trashSelectedIds.value = []
    await refreshTrash()
  } catch (e: any) { toast.error(e.data?.message || '批量删除失败') }
  finally { trashBatchLoading.value = false }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `游戏条目管理 - ${siteName.value} 管理后台`),
})
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
