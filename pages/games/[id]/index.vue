<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6 pt-[11px] md:pt-[19px]">
    <div v-if="game" class="space-y-4 md:space-y-0 md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">

      <!-- 移动端：封面+标题+操作按钮 -->
      <div class="md:hidden">
        <div class="flex gap-4">
          <div class="w-28 flex-shrink-0">
            <div class="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
              <img 
                v-if="game.coverImage"
                :src="game.coverImage" 
                :alt="game.title"
                class="w-full aspect-[3/4] object-cover"
                fetchpriority="high"
              />
              <div 
                v-else
                class="w-full aspect-[3/4] flex items-center justify-center bg-gray-200 dark:bg-zinc-700"
              >
                <Icon name="fa6-solid:gamepad" class="text-3xl text-gray-400 dark:text-zinc-500" />
              </div>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <h1 class="text-lg font-semibold">{{ game.title }}</h1>
              <span v-if="game.isNsfw" class="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded font-medium">NSFW</span>
            </div>
            <div v-if="subtitleNames" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
              {{ subtitleNames }}
            </div>
            <!-- 评分 -->
            <div class="flex items-center gap-2 mb-2">
              <div class="flex text-sm">
                <Icon
                  v-for="i in 5"
                  :key="i"
                  :name="i <= Math.round(game.avgRating || 0) ? 'fa6-solid:star' : 'fa6-regular:star'"
                  class="text-gray-800 dark:text-gray-200"
                />
              </div>
              <span class="text-sm font-semibold">{{ game.avgRating || '-' }}</span>
              <span class="text-xs text-gray-500">({{ game.ratingCount }})</span>
            </div>
            <!-- 基本信息 -->
            <div v-if="hasSidebarBasicInfo" class="text-xs text-gray-500 space-y-0.5">
              <div v-if="developers.length">
                <span>厂商：</span>{{ developers.map(d => d.name).join('、') }}
              </div>
              <div v-if="game.releaseDate">
                <span>发布：</span>{{ formatDate(game.releaseDate) }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 移动端操作按钮 -->
        <div
          class="grid items-center gap-2 mt-3"
          :class="isAdmin ? 'grid-cols-4' : 'grid-cols-3'"
        >
          <ClientOnly>
          <div class="relative min-w-0" ref="favoriteDropdownMobileRef">
            <button
              @click="showFavoriteDropdown = !showFavoriteDropdown"
              class="w-full h-10 px-2 py-2 rounded-lg border text-sm flex items-center justify-center gap-1.5 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm transition-colors min-w-0"
              :class="isLoggedIn && game.isFavorited
                ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                : 'border-gray-300 dark:border-zinc-600'"
            >
              <FaIcon :icon="favoriteIcon" />
              <span class="truncate">{{ mobileFavoriteLabel }}</span>
            </button>
            <Transition name="dropdown">
              <div
                v-if="showFavoriteDropdown"
                class="absolute left-0 mt-1 w-36 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-600 py-1 z-30 text-sm"
              >
                <button
                  v-for="opt in favoriteOptions"
                  :key="opt.status"
                  @click="setFavoriteStatus(opt.status)"
                  class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-left"
                  :class="isLoggedIn && game.favoriteStatus === opt.status ? 'text-red-500 font-medium' : 'text-gray-700 dark:text-gray-300'"
                >
                  <FaIcon :icon="opt.icon" class="w-4 text-center" />
                  {{ opt.label }}
                </button>
                <div v-if="isLoggedIn && game.isFavorited" class="border-t border-gray-100 dark:border-zinc-700 mt-1 pt-1">
                  <button
                    @click="setFavoriteStatus(null)"
                    class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-left text-gray-400 hover:text-red-500"
                  >
                    <Icon name="fa6-solid:trash-can" class="w-4 text-center text-xs" />
                    取消收藏
                  </button>
                </div>
              </div>
            </Transition>
          </div>
          </ClientOnly>
          <NuxtLink 
            :to="`/games/${game.id}/guides`"
            class="h-10 px-2 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm flex items-center justify-center gap-1.5 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm min-w-0"
          >
            <Icon name="fa6-solid:book" /><span class="truncate">攻略</span>
          </NuxtLink>
          <NuxtLink 
            v-if="canEdit"
            :to="`/games/${game.id}/edit`"
            class="h-10 px-2 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm flex items-center justify-center gap-1.5 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm min-w-0"
          >
            <Icon name="fa6-solid:pen" /><span class="truncate">编辑</span>
          </NuxtLink>
          <NuxtLink 
            v-if="isAdmin"
            :to="`/admin/games/${game.id}/edit`"
            class="h-10 px-2 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm flex items-center justify-center gap-1.5 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm min-w-0"
          >
            <Icon name="fa6-solid:screwdriver-wrench" /><span class="truncate">管理</span>
          </NuxtLink>
        </div>
      </div>

      <!-- 左栏：封面 + 基本信息 (桌面端) -->
      <aside class="hidden md:block space-y-4">
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <img 
            v-if="game.coverImage"
            :src="game.coverImage" 
            :alt="game.title"
            class="w-full aspect-[3/4] object-cover"
            fetchpriority="high"
          />
          <div 
            v-else
            class="w-full aspect-[3/4] flex items-center justify-center bg-gray-200 dark:bg-zinc-700"
          >
            <Icon name="fa6-solid:gamepad" class="text-4xl text-gray-400 dark:text-zinc-500" />
          </div>
        </div>

        <!-- 评分区域 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
          <div class="text-sm font-medium mb-3 flex items-center gap-2">
            <Icon name="fa6-solid:star" class="text-gray-400" />评分
          </div>
          <div class="flex items-center gap-2 mb-2">
            <div class="flex text-xl">
              <Icon
                v-for="i in 5"
                :key="i"
                :name="i <= Math.round(game.avgRating || 0) ? 'fa6-solid:star' : 'fa6-regular:star'"
                class="text-gray-800 dark:text-gray-200"
              />
            </div>
            <span class="text-xl font-semibold">{{ game.avgRating || '-' }}</span>
          </div>
          <div class="text-xs text-gray-500">{{ game.ratingCount }} 人评价</div>
        </div>

        <div v-if="hasSidebarBasicInfo" class="bg-white dark:bg-zinc-800 rounded-xl p-4 text-sm space-y-2 shadow">
          <!-- 开发商 -->
          <div v-if="developers.length">
            <span class="text-gray-500">厂商：</span>
            <template v-for="(dev, idx) in developers" :key="dev.id">
              <NuxtLink :to="`/companies/${dev.id}`" class="hover:underline">{{ dev.name }}</NuxtLink>
              <span v-if="idx < developers.length - 1">、</span>
            </template>
          </div>
          <!-- 发行商 -->
          <div v-if="publishers.length">
            <span class="text-gray-500">发行：</span>
            <template v-for="(pub, idx) in publishers" :key="pub.id">
              <NuxtLink :to="`/companies/${pub.id}`" class="hover:underline">{{ pub.name }}</NuxtLink>
              <span v-if="idx < publishers.length - 1">、</span>
            </template>
          </div>
          <div v-if="game.releaseDate">
            <span class="text-gray-500">发布：</span>{{ formatDate(game.releaseDate) }}
          </div>
          <div v-if="game.language?.length">
            <span class="text-gray-500">语言：</span>{{ game.language.join(' / ') }}
          </div>
        </div>

        <div v-if="game.tags?.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
          <GameTagGroups :tags="game.tags" />
        </div>

        <!-- 制作人员 -->
        <div v-if="staffByRole && Object.keys(staffByRole).length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
          <div class="text-sm font-medium mb-3 flex items-center gap-2">
            <Icon name="fa6-solid:users" class="text-gray-400" />制作人员
          </div>
          <div class="text-sm space-y-2">
            <div v-for="(staffList, role) in staffByRole" :key="role">
              <div class="text-xs text-gray-500 mb-1">{{ roleLabels[role] || role }}</div>
              <div class="flex flex-wrap items-center gap-x-0.5 text-gray-700 dark:text-gray-300">
                <template v-for="(s, i) in staffList" :key="s.staffId || i">
                  <NuxtLink
                    :to="{ path: '/search', query: { q: s.staff?.name || s.name, type: 'staff' } }"
                    class="hover:text-gray-900 dark:hover:text-white hover:underline underline-offset-2 transition-colors"
                  >{{ s.staff?.name || s.name }}</NuxtLink>
                  <span v-if="i < staffList.length - 1">、</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 同系列游戏 -->
        <div v-if="game.series || game.seriesGames?.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
          <div class="text-sm font-medium mb-3 flex items-center gap-2">
            <Icon name="fa6-solid:layer-group" class="text-gray-400" />
            <span v-if="game.series">{{ game.series.name }}</span>
            <span v-else>同系列作品</span>
          </div>
          <div v-if="game.seriesGames?.length" class="space-y-3">
            <NuxtLink 
              v-for="seriesGame in game.seriesGames" 
              :key="seriesGame.id"
              :to="`/games/${seriesGame.id}`" 
              class="flex items-center gap-3 group"
            >
              <img 
                v-if="seriesGame.coverImage"
                :src="seriesGame.coverImage" 
                :alt="seriesGame.title"
                class="w-12 h-16 rounded object-cover"
                loading="lazy"
              />
              <div 
                v-else
                class="w-12 h-16 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0"
              >
                <Icon name="fa6-solid:gamepad" class="text-gray-400 dark:text-zinc-500" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate group-hover:text-gray-600 dark:group-hover:text-gray-300 transition">
                  {{ seriesGame.title }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ seriesGame.releaseDate ? new Date(seriesGame.releaseDate).getFullYear() : '' }}
                </div>
              </div>
            </NuxtLink>
            <!-- 查看更多按钮 -->
            <NuxtLink 
              v-if="game.series"
              :to="`/series/${game.series.id}`"
              class="block text-center py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700/50 rounded-lg transition"
            >
              查看更多 <Icon name="fa6-solid:chevron-right" class="text-xs ml-1" />
            </NuxtLink>
          </div>
          <div v-else class="text-sm text-gray-500">
            暂无其他同系列作品
          </div>
        </div>

        <!-- 相关作品推荐 -->
        <div v-if="game.relatedGames?.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
          <div class="text-sm font-medium mb-3 flex items-center gap-2">
            <Icon name="fa6-solid:heart" class="text-gray-400" />相关推荐
          </div>
          <div class="space-y-3">
            <NuxtLink 
              v-for="related in game.relatedGames" 
              :key="related.id"
              :to="`/games/${related.id}`" 
              class="flex items-center gap-3 group"
            >
              <img 
                v-if="related.coverImage"
                :src="related.coverImage" 
                :alt="related.title"
                class="w-12 h-16 rounded object-cover"
                loading="lazy"
              />
              <div 
                v-else
                class="w-12 h-16 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0"
              >
                <Icon name="fa6-solid:gamepad" class="text-gray-400 dark:text-zinc-500" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate group-hover:text-gray-600 dark:group-hover:text-gray-300 transition">
                  {{ related.title }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ related.company?.name }} · {{ related.releaseDate ? new Date(related.releaseDate).getFullYear() : '' }}
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- 左栏底部广告 -->
        <button
          @click="openHistoryModal"
          class="w-full flex items-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl shadow text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
        >
          <Icon name="fa6-solid:clock-rotate-left" />
          <span>编辑历史</span>
          <Icon name="fa6-solid:chevron-right" class="ml-auto text-xs" />
        </button>

        <AdBanner ad-slot="game_detail_sidebar" />
      </aside>

      <!-- 右栏：主体内容 -->
      <section class="min-w-0 space-y-4 md:space-y-6">

        <!-- 移动端标签 -->
        <div v-if="game.tags?.length" class="md:hidden bg-white dark:bg-zinc-800 rounded-lg p-2.5 sm:p-3 shadow">
          <GameTagGroups :tags="game.tags" />
        </div>

        <!-- 移动端侧栏广告：显示与否由每条广告的移动端设置控制 -->
        <AdBanner ad-slot="game_detail_sidebar" class="md:hidden" />

        <!-- 标题 + 别名 + 操作按钮 (桌面端) -->
        <div class="hidden md:block space-y-3 md:-mt-6">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold">{{ game.title }}</h1>
            <span v-if="game.isNsfw" class="px-2 py-0.5 bg-red-500 text-white text-xs rounded font-medium">NSFW</span>
          </div>
          <div v-if="subtitleNames" class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {{ subtitleNames }}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-gray-400 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Icon name="fa6-solid:eye" class="mr-1" />{{ game.viewCount }} 次浏览
            </span>
            <!-- 游戏时间 -->
            <span v-if="estimatedPlayTime" class="text-xs text-gray-400 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm rounded px-1.5 py-0.5">
              <Icon name="fa6-solid:clock" class="mr-1" />约 {{ estimatedPlayTime }} 小时
            </span>
            <div class="flex items-center gap-2 ml-auto">
              <!-- 相关链接按钮 -->
              <div v-if="game.purchaseLinks?.length" class="relative" ref="purchaseDropdownRef">
                <button 
                  @click="showPurchaseDropdown = !showPurchaseDropdown"
                  class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm flex items-center gap-1.5 transition-colors hover:bg-gray-700 dark:hover:bg-zinc-500"
                >
                  <Icon name="fa6-solid:link" />相关链接
                  <Icon name="fa6-solid:chevron-down" class="text-xs" />
                </button>
                <Transition name="dropdown">
                  <div 
                    v-if="showPurchaseDropdown"
                    class="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-700 rounded-lg shadow-lg border dark:border-zinc-600 py-1 z-20"
                  >
                    <a 
                      v-for="link in game.purchaseLinks" 
                      :key="link.url"
                      :href="link.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-600 transition"
                      @click="showPurchaseDropdown = false"
                    >
                      <Icon name="fa6-solid:arrow-up-right-from-square" class="mr-2 text-gray-400" />{{ link.name }}
                    </a>
                  </div>
                </Transition>
              </div>
              <!-- 顶一下按钮 -->
              <ClientOnly>
              <button 
                @click="handleBump"
                :disabled="bumpLoading || (isLoggedIn && hasBumpedToday)"
                class="action-btn px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5"
                :class="isLoggedIn && hasBumpedToday 
                  ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 text-orange-600 cursor-default' 
                  : 'border-gray-300 dark:border-zinc-600'"
              >
                <Icon name="fa6-solid:fire" :class="{ 'text-orange-500': isLoggedIn && hasBumpedToday }" />
                <span v-if="isLoggedIn && hasBumpedToday">
                  今日热度 <span class="font-medium">{{ bumpCount }}</span>
                </span>
                <span v-else>顶一下<span v-if="bumpCount > 0" class="ml-1 text-xs text-gray-400 dark:text-gray-500">{{ bumpCount }}</span></span>
              </button>
              </ClientOnly>
              <!-- 攻略按钮 -->
              <NuxtLink 
                :to="`/games/${game.id}/guides`"
                class="action-btn px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm flex items-center gap-1.5"
              >
                <Icon name="fa6-solid:book" />攻略
                <span v-if="game.guidesCount" class="text-xs">({{ game.guidesCount }})</span>
              </NuxtLink>
              <!-- 收藏按钮（悬浮弹出分类选项） -->
              <ClientOnly>
              <div class="relative" ref="favoriteDropdownRef">
                <button
                  @click="showFavoriteDropdown = !showFavoriteDropdown"
                  class="action-btn px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors"
                  :class="isLoggedIn && game.isFavorited
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-300 dark:border-zinc-600'"
                >
                  <FaIcon :icon="favoriteIcon" />
                  <span>{{ favoriteLabel }}</span>
                  <Icon name="fa6-solid:chevron-down" class="text-[10px] opacity-60 ml-0.5" />
                </button>
                <Transition name="dropdown">
                  <div
                    v-if="showFavoriteDropdown"
                    class="absolute right-0 mt-1 w-36 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-600 py-1 z-30 text-sm"
                  >
                    <button
                      v-for="opt in favoriteOptions"
                      :key="opt.status"
                      @click="setFavoriteStatus(opt.status)"
                      class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-left"
                      :class="isLoggedIn && game.favoriteStatus === opt.status ? 'text-red-500 font-medium' : 'text-gray-700 dark:text-gray-300'"
                    >
                      <FaIcon :icon="opt.icon" class="w-4 text-center" />
                      {{ opt.label }}
                    </button>
                    <div v-if="isLoggedIn && game.isFavorited" class="border-t border-gray-100 dark:border-zinc-700 mt-1 pt-1">
                      <button
                        @click="setFavoriteStatus(null)"
                        class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-left text-gray-400 hover:text-red-500"
                      >
                        <Icon name="fa6-solid:trash-can" class="w-4 text-center text-xs" />
                        取消收藏
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
              </ClientOnly>
              <!-- 编辑按钮 -->
              <NuxtLink 
                v-if="canEdit"
                :to="`/games/${game.id}/edit`"
                class="action-btn px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm flex items-center gap-1.5"
              >
                <Icon name="fa6-solid:pen" />编辑
              </NuxtLink>
              <!-- 管理员编辑按钮 -->
              <NuxtLink 
                v-if="isAdmin"
                :to="`/admin/games/${game.id}/edit`"
                class="action-btn px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm flex items-center gap-1.5"
              >
                <Icon name="fa6-solid:screwdriver-wrench" />管理
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- 简介 / 截图 选项卡 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <div class="relative flex border-b border-gray-200 dark:border-zinc-700">
            <div 
              class="absolute bottom-0 h-0.5 bg-gray-800 dark:bg-white transition-all duration-300 ease-out"
              :style="{
                width: '50%',
                left: activeTab === 'intro' ? '0%' : '50%'
              }"
            ></div>
            <button 
              @click="activeTab = 'intro'"
              class="flex-1 px-3 sm:px-5 py-3 text-sm font-medium flex items-center justify-center gap-2 transition relative z-10"
              :class="activeTab === 'intro' 
                ? 'text-gray-800 dark:text-white' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              <Icon name="fa6-solid:file-lines" />游戏简介
            </button>
            <button 
              @click="activeTab = 'screenshots'"
              class="flex-1 px-3 sm:px-5 py-3 text-sm font-medium flex items-center justify-center gap-2 transition relative z-10"
              :class="activeTab === 'screenshots' 
                ? 'text-gray-800 dark:text-white' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              <Icon name="fa6-solid:images" />游戏截图
            </button>
          </div>
          
          <div class="relative overflow-hidden">
            <Transition name="tab" mode="out-in">
              <div v-if="activeTab === 'intro'" key="intro" class="p-4 sm:p-5">
                <!-- 多语言简介切换 -->
                <div v-if="availableDescLangs.length > 1" class="flex gap-2 mb-4">
                  <button
                    v-for="lang in availableDescLangs"
                    :key="lang.key"
                    @click="activeDescLang = lang.key"
                    class="px-3 py-1 text-xs rounded-lg transition"
                    :class="activeDescLang === lang.key 
                      ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
                      : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                  >
                    {{ lang.label }}
                  </button>
                </div>
                <div class="max-h-64 overflow-y-auto">
                  <p class="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {{ currentDescription || '暂无简介' }}
                  </p>
                </div>
              </div>

              <div v-else-if="activeTab === 'screenshots'" key="screenshots" class="p-4 sm:p-5">
                <div v-if="(game as any).screenshots?.length" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <img 
                    v-for="screenshot in (game as any).screenshots" 
                    :key="screenshot.id"
                    :src="screenshot.url" 
                    :alt="`${game.title} 截图`"
                    class="rounded-lg cursor-pointer hover:opacity-80 transition"
                    loading="lazy"
                    @click="openLightbox(screenshot.url)"
                  />
                </div>
                <p v-else class="text-gray-500 text-center py-8">暂无截图</p>
              </div>
            </Transition>
          </div>

        </div>

        <!-- 游戏资源上方广告 -->
        <AdBanner ad-slot="game_resource_top" />

        <!-- 下载资源：游客可查看摘要，下载时再按站点策略要求登录 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <!-- 标签页切换 -->
          <div class="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700">
            <div class="relative flex items-center">
              <!-- 动画下划线 -->
              <div 
                class="absolute bottom-0 h-0.5 bg-gray-800 dark:bg-white transition-all duration-300 ease-out"
                :style="resourceTabIndicator"
              ></div>
              <button
                ref="gameTabRef"
                @click="resourceTab = 'game'"
                class="px-3 sm:px-5 py-3 text-sm font-medium transition relative z-10"
                :class="resourceTab === 'game' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
              >
                <Icon name="fa6-solid:download" class="mr-1.5" />游戏资源
                <span v-if="game.resources?.length" class="ml-1 text-xs">({{ game.resources.length }})</span>
              </button>
              <button
                ref="patchTabRef"
                @click="resourceTab = 'patch'"
                class="px-3 sm:px-5 py-3 text-sm font-medium transition relative z-10"
                :class="resourceTab === 'patch' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
              >
                <Icon name="fa6-solid:puzzle-piece" class="mr-1.5" />补丁资源
                <span v-if="moyuResources.length" class="ml-1 text-xs">({{ moyuResources.length }})</span>
              </button>
            </div>
            <!-- 添加资源按钮（仅游戏资源标签页显示） -->
            <button 
              v-if="resourceTab === 'game' && isLoggedIn"
              @click="showAddResource = true"
              class="mr-4 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center gap-1.5"
            >
              <Icon name="fa6-solid:plus" /><span class="hidden md:inline">添加资源</span>
            </button>
          </div>

          <!-- 资源标签页（动画切换） -->
          <div class="relative overflow-hidden">
          <Transition name="tab" mode="out-in">
          <!-- 游戏资源标签页 -->
          <div v-if="resourceTab === 'game'" key="game" class="p-4 sm:p-5">
          <div v-if="game.resources?.length" class="space-y-3">
            <div 
              v-for="resource in game.resources" 
              :key="resource.id"
              class="border rounded-lg dark:border-zinc-700 overflow-hidden"
            >
              <div class="p-3 md:p-4 text-sm">
                <div class="flex flex-col gap-3">
                  <!-- 第一行：标题和操作按钮 -->
                  <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span
                          v-if="resource.netDiskType?.name"
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded font-medium"
                        >
                          <FaIcon :icon="resource.netDiskType.icon || 'fa6-solid:cloud'" />{{ resource.netDiskType.name }}
                        </span>
                        <span
                          v-if="resource.type?.name"
                          class="px-1.5 py-0.5 text-[10px] bg-gray-800 dark:bg-zinc-500 text-white rounded font-medium"
                        >
                          {{ resource.type.name }}
                        </span>
                        <span class="font-medium">{{ resource.title }}</span>
                        <span v-if="resource.language" class="px-1.5 py-0.5 text-[10px] rounded font-medium" :class="{
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300': resource.language === 'ja',
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300': resource.language === 'en',
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300': resource.language === 'zh-Hans',
                          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300': resource.language === 'zh-Hant',
                        }">{{ resourceLangLabel(resource.language) }}</span>
                        <span v-if="resource.fileSize" class="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 rounded">{{ resource.fileSize }}</span>
                        <span v-if="resource.isMachineTranslated" class="px-1.5 py-0.5 text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">机器翻译</span>
                        <span
                          v-if="resource.status === 'PENDING'"
                          class="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 rounded"
                        >
                          待审核
                        </span>
                        <span
                          v-if="resource.status === 'REJECTED'"
                          class="px-2 py-0.5 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded"
                        >
                          已拒绝
                        </span>
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        投稿者：
                        <NuxtLink
                          v-if="resource.uploader?.id"
                          :to="`/user/${resource.uploader.id}`"
                          class="hover:underline"
                        >
                          {{ resource.uploader.username }}
                        </NuxtLink>
                        <span v-else>未知</span>
                        <span class="mx-1">·</span>
                        {{ formatDate(resource.createdAt) }}
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                    <NuxtLink 
                      :to="`/download/${resource.id}`"
                      class="action-btn flex-1 md:flex-none px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm flex items-center justify-center gap-2"
                    >
                      <Icon name="fa6-solid:cloud-arrow-down" />下载
                    </NuxtLink>
                    <!-- 资源举报按钮 -->
                    <button 
                      v-if="isLoggedIn && resource.uploader?.id !== user?.id"
                      @click="openReportModal('resource', resource)"
                      class="p-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition"
                      title="举报资源"
                    >
                      <Icon name="fa6-solid:flag" class="text-orange-500" />
                    </button>
                    <!-- 编辑/删除按钮（仅上传者和管理员可见） -->
                    <template v-if="canEditResource(resource)">
                      <button 
                        @click="editResource(resource)"
                        class="p-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                        title="编辑"
                      >
                        <Icon name="fa6-solid:pen" class="text-gray-500" />
                      </button>
                      <button 
                        @click="deleteResource(resource)"
                        class="p-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="删除"
                      >
                        <Icon name="fa6-solid:trash" class="text-red-500" />
                      </button>
                    </template>
                  </div>
                  </div>
                  <!-- 第二行：提取密码、解压码 -->
                  <div v-if="resource.extractCode || resource.unzipPassword" class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <span v-if="resource.extractCode" class="flex items-center gap-1">
                      <span class="text-gray-500">提取密码：</span>
                      <code 
                        class="bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600 transition"
                        @click="copyToClipboard(resource.extractCode, '提取密码')"
                        title="点击复制"
                      >{{ resource.extractCode }}</code>
                    </span>
                    <span v-if="resource.unzipPassword" class="flex items-center gap-1">
                      <span class="text-gray-500">解压密码：</span>
                      <code 
                        class="bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600 transition"
                        @click="copyToClipboard(resource.unzipPassword, '解压密码')"
                        title="点击复制"
                      >{{ resource.unzipPassword }}</code>
                    </span>
                  </div>
                </div>
                <div v-if="resource.remark" class="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700 text-xs text-gray-500 dark:text-gray-400">
                  <Icon name="fa6-solid:circle-info" class="mr-1" />备注：{{ resource.remark }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            <Icon name="fa6-solid:folder-open" class="text-3xl mb-3 text-gray-300 dark:text-zinc-600" />
            <p>暂无游戏资源</p>
            <p class="text-xs mt-1">点击上方按钮添加第一个资源</p>
          </div>
          </div>

          <!-- 补丁资源标签页 -->
          <div v-else-if="resourceTab === 'patch'" key="patch" class="p-4 sm:p-5 overflow-hidden">
            <MoyuPatchResources
              :resources="moyuResources"
              :loading="moyuLoading"
              :error="moyuError"
              :retry-seconds="moyuRetrySeconds"
              :missing-vndb="moyuData?.status === 'missing_vndb'"
              @retry="reloadMoyuPatches"
            />
          </div>
          </Transition>
          </div>
        </div>

        <!-- 游戏资源下方广告 -->
        <AdBanner ad-slot="game_resource_bottom" />

        <!-- 评论 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 sm:p-5 shadow space-y-4">
          <h2 class="font-medium flex items-center gap-2">
            <Icon name="fa6-solid:comments" class="text-gray-400" />评论 ({{ game.commentCount }})
          </h2>

          <!-- 发表评论 + 评分 -->
          <div v-if="isLoggedIn" class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-sm text-gray-500">我的评分：</span>
                <!-- 星级评分 -->
                <div class="flex items-center gap-1 text-lg cursor-pointer">
                  <Icon
                    v-for="i in 5"
                    :key="i"
                    :name="i <= (hoverRating || pendingRating) ? 'fa6-solid:star' : 'fa6-regular:star'"
                    class="hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
                    @mouseenter="hoverRating = i"
                    @mouseleave="hoverRating = 0"
                    @click="pendingRating = i"
                  />
                </div>
                <span v-if="pendingRating" class="text-sm text-gray-500">{{ pendingRating }} 分</span>
                <span v-if="userRating && !pendingRating" class="text-xs text-green-600">
                  <Icon name="fa6-solid:check" class="mr-1" />已评 {{ userRating }} 分
                </span>
              </div>
              <button 
                @click="submitCommentWithRating"
                :disabled="isEmptyRichText(commentContent)"
                class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 transition disabled:opacity-50 hover:scale-105 active:scale-95"
              >
                {{ pendingRating ? '评分并发送' : '发送评论' }}
              </button>
            </div>
            <!-- 富文本编辑器 -->
            <LazyTiptapEditor
              ref="commentEditorRef"
              v-model="commentContent"
              placeholder="发表你的看法（评分需配合评论一起提交）..."
              :show-play-time-option="true"
              :initial-play-time="0"
              :min-height="120"
              @update:play-time="commentPlayTime = $event"
            />
          </div>

          <!-- 评论列表 -->
          <div class="space-y-4 pt-2">
            <template v-for="comment in game.comments" :key="comment.id">
              <!-- 主评论 -->
              <div :id="`comment-${comment.id}`" class="flex gap-3 group scroll-mt-20">
                <NuxtLink :to="`/user/${comment.user.id}`" class="flex-shrink-0">
                <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-gray-500 overflow-hidden">
                  <img v-if="comment.user.avatar" :src="comment.user.avatar" class="w-full h-full object-cover" loading="lazy" />
                  <Icon name="fa6-solid:user" v-else />
                </div>
                </NuxtLink>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 text-sm flex-wrap">
                    <NuxtLink :to="`/user/${comment.user.id}`" class="font-medium hover:underline">{{ comment.user.username }}</NuxtLink>
                    <span v-if="comment.playTime" class="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Icon name="fa6-solid:clock" class="leading-none" />
                      <span class="leading-none">{{ comment.playTime }} 小时</span>
                    </span>
                    <span class="text-xs text-gray-500">{{ formatDate(comment.createdAt) }}</span>
                  </div>
                  <SafeHtml class="text-sm text-gray-700 dark:text-gray-300 mt-1 prose prose-sm dark:prose-invert max-w-none" :content="comment.content" />
                  
                  <!-- 评论操作栏 -->
                  <div class="flex items-center gap-4 mt-2 text-xs">
                    <!-- 点赞 -->
                    <button 
                      @click="handleLikeComment(comment)"
                      class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition"
                      :class="{ 'text-red-500': comment.isLiked }"
                    >
                      <Icon :name="comment.isLiked ? 'fa6-solid:heart' : 'fa6-regular:heart'" />
                      <span v-if="comment.likeCount > 0">{{ comment.likeCount }}</span>
                      <span v-else>点赞</span>
                    </button>
                    <!-- 回复 -->
                    <button 
                      @click="startReply(comment)"
                      class="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition"
                    >
                      <Icon name="fa6-solid:reply" />
                      <span>回复</span>
                    </button>
                    <!-- 举报 -->
                    <button 
                      v-if="isLoggedIn && comment.user.id !== user?.id"
                      @click="openReportModal('comment', comment)"
                      class="flex items-center gap-1 text-gray-400 hover:text-orange-500 transition opacity-0 group-hover:opacity-100"
                    >
                      <Icon name="fa6-solid:flag" />
                      <span>举报</span>
                    </button>
                    <!-- 删除 (仅作者和管理员可见) -->
                    <button 
                      v-if="isLoggedIn && (comment.user.id === user?.id || user?.role === 'ADMIN')"
                      @click="handleDeleteComment(comment)"
                      class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                    >
                      <Icon name="fa6-solid:trash" />
                      <span>删除</span>
                    </button>
                  </div>

                  <!-- 回复输入框 -->
                  <div v-if="replyingTo?.id === comment.id" class="mt-3 p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
                    <div class="text-xs text-gray-500 mb-2">
                      回复 @{{ comment.user.username }}
                    </div>
                    <LazyTiptapInput
                      v-model="replyContent"
                      placeholder="写下你的回复..."
                      @submit="submitReply"
                    />
                    <div class="flex justify-end gap-2 mt-2">
                      <button 
                        @click="cancelReply"
                        class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        取消
                      </button>
                      <button
                        @click="submitReply"
                        :disabled="isEmptyRichText(replyContent)"
                        class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        回复
                      </button>
                    </div>
                  </div>

                  <!-- 回复列表 -->
                  <div v-if="comment.replies?.length" class="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-zinc-700">
                    <div v-for="reply in comment.replies" :key="reply.id" :id="`comment-${reply.id}`" class="flex gap-2 group/reply scroll-mt-20">
                      <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-gray-500 overflow-hidden flex-shrink-0">
                        <img v-if="reply.user.avatar" :src="reply.user.avatar" class="w-full h-full object-cover" loading="lazy" />
                        <Icon name="fa6-solid:user" class="text-xs" v-else />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 text-xs">
                          <span class="font-medium">{{ reply.user.username }}</span>
                          <span class="text-gray-500">{{ formatDate(reply.createdAt) }}</span>
                        </div>
                        <SafeHtml class="text-sm text-gray-700 dark:text-gray-300 mt-0.5" :content="reply.content" />
                        <div class="flex items-center gap-3 mt-1 text-xs">
                          <button 
                            @click="handleLikeComment(reply)"
                            class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition"
                            :class="{ 'text-red-500': reply.isLiked }"
                          >
                            <Icon :name="reply.isLiked ? 'fa6-solid:heart' : 'fa6-regular:heart'" class="text-[10px]" />
                            <span v-if="reply.likeCount > 0">{{ reply.likeCount }}</span>
                          </button>
                          <!-- 回复按钮 -->
                          <button 
                            @click="startReplyToReply(comment, reply)"
                            class="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition"
                          >
                            <Icon name="fa6-solid:reply" class="text-[10px]" />
                            <span>回复</span>
                          </button>
                          <!-- 举报按钮 -->
                          <button 
                            v-if="isLoggedIn && reply.user.id !== user?.id"
                            @click="openReportModal('comment', reply)"
                            class="text-gray-400 hover:text-orange-500 transition opacity-0 group-hover/reply:opacity-100"
                          >
                            <Icon name="fa6-solid:flag" class="text-[10px]" />
                          </button>
                          <!-- 删除按钮 -->
                          <button 
                            v-if="isLoggedIn && (reply.user.id === user?.id || user?.role === 'ADMIN')"
                            @click="handleDeleteComment(reply)"
                            class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition opacity-0 group-hover/reply:opacity-100"
                          >
                            <Icon name="fa6-solid:trash" class="text-[10px]" />
                            <span>删除</span>
                          </button>
                        </div>
                        
                        <!-- 回复输入框（针对回复的回复） -->
                        <div v-if="replyingTo?.id === reply.id" class="mt-3 p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
                          <div class="text-xs text-gray-500 mb-2">
                            回复 @{{ reply.user.username }}
                          </div>
                          <LazyTiptapInput
                            v-model="replyContent"
                            placeholder="写下你的回复..."
                            @submit="submitReplyToReply(comment)"
                          />
                          <div class="flex justify-end gap-2 mt-2">
                            <button 
                              @click="cancelReply"
                              class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              取消
                            </button>
                            <button
                              @click="submitReplyToReply(comment)"
                              :disabled="isEmptyRichText(replyContent)"
                              class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                            >
                              回复
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <div v-if="!game.comments?.length" class="text-center text-gray-500 py-4">
              暂无评论，来发表第一条评论吧
            </div>
          </div>
        </div>

        <button
          @click="openHistoryModal"
          class="md:hidden w-full flex items-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl shadow text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
        >
          <Icon name="fa6-solid:clock-rotate-left" />
          <span>编辑历史</span>
          <Icon name="fa6-solid:chevron-right" class="ml-auto text-xs" />
        </button>

        <!-- 举报弹窗 -->
        <Teleport to="body">
          <Transition name="modal">
            <div 
              v-if="showReportModal"
              class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            >
              <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 w-96 shadow-xl modal-content">
                <h3 class="font-semibold mb-4">举报{{ reportType === 'comment' ? '评论' : '资源' }}</h3>
                <div class="space-y-3">
                  <div class="text-sm text-gray-500 mb-3">请选择举报理由：</div>
                  <label 
                    v-for="reason in reportReasons[reportType]"
                    :key="reason"
                    class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer"
                  >
                    <input 
                      type="radio" 
                      v-model="reportForm.reason" 
                      :value="reason"
                      class="text-gray-800"
                    />
                    <span class="text-sm">{{ reason }}</span>
                  </label>
                  <div v-if="reportForm.reason === '其他'" class="mt-2">
                    <textarea 
                      v-model="reportForm.detail"
                      class="w-full px-3 py-2 text-sm rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      rows="3"
                      required
                      maxlength="1000"
                      placeholder="请详细说明举报理由（必填）"
                    ></textarea>
                    <p v-if="reportDetailMissing" class="mt-1 text-xs text-red-500">选择“其他”时，请填写具体举报理由</p>
                  </div>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                  <button 
                    @click="closeReportModal"
                    class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    取消
                  </button>
                  <button 
                    @click="submitReport"
                    :disabled="!reportForm.reason || reportDetailMissing || reportSubmitting"
                    class="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                  >
                    {{ reportSubmitting ? '提交中...' : '提交举报' }}
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>


        <!-- 内容底部横幅广告 -->
        <AdBanner ad-slot="game_detail_bottom" />
      </section>
    </div>

    <!-- 加载中 -->
    <div v-else-if="pending" class="text-center py-20">
      <Icon name="fa6-solid:spinner" class="fa-spin text-3xl text-gray-400" />
    </div>

    <!-- 错误 -->
    <div v-else class="text-center py-20">
      <!-- NSFW 内容需要登录或开启 NSFW 模式 -->
      <template v-if="error?.statusCode === 403">
        <Icon name="fa6-solid:shield-halved" class="text-5xl text-gray-400 mb-4" />
        <h2 class="text-xl font-semibold mb-2">内容访问受限</h2>
        <p class="text-gray-500 mb-6">{{ error?.message || '您没有权限查看此内容' }}</p>
        <div class="flex justify-center gap-4">
          <NuxtLink 
            v-if="!isLoggedIn"
            to="/login"
            class="px-6 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 transition"
          >
            <Icon name="fa6-solid:right-to-bracket" class="mr-2" />登录账号
          </NuxtLink>
          <NuxtLink 
            to="/games"
            class="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
          >
            <Icon name="fa6-solid:arrow-left" class="mr-2" />返回列表
          </NuxtLink>
        </div>
        <p v-if="isLoggedIn" class="text-sm text-gray-400 mt-6">
          <Icon name="fa6-solid:circle-info" class="mr-1" />
          如需查看 NSFW 内容，请在设置中开启 NSFW 模式
        </p>
      </template>
      <!-- 其他错误 -->
      <template v-else>
        <Icon name="fa6-solid:circle-exclamation" class="text-4xl text-gray-400 mb-4" />
        <p class="text-gray-500">{{ error?.message || '加载失败' }}</p>
      </template>
    </div>

    <!-- 添加资源弹窗 -->
    <AddResourceModal 
      v-if="showAddResource"
      :game-id="game?.id"
      @close="showAddResource = false"
      @success="handleResourceAdded"
    />

    <!-- 编辑资源弹窗 -->
    <EditResourceModal 
      v-if="editingResource"
      :resource="editingResource"
      @close="editingResource = null"
      @success="handleResourceUpdated"
    />

    <!-- 截图灯箱 -->
    <Lightbox 
      :show="showLightbox"
      :images="screenshotUrls"
      :initial-index="lightboxIndex"
      @close="showLightbox = false"
    />

    <!-- 编辑历史弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showHistoryModal"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          @click.self="showHistoryModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden modal-content">
            <!-- 头部 -->
            <div class="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-700 flex-shrink-0">
              <h3 class="text-lg font-semibold flex items-center gap-2">
                <Icon name="fa6-solid:clock-rotate-left" class="text-gray-400" />编辑历史
              </h3>
              <button 
                @click="showHistoryModal = false"
                class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
              >
                <Icon name="fa6-solid:xmark" />
              </button>
            </div>

            <!-- 内容 -->
            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="historyLoading" class="text-center py-12 text-gray-400">
                <Icon name="fa6-solid:spinner" class="fa-spin text-2xl" />
              </div>
              <div v-else-if="historyItems.length" class="space-y-3">
                <div
                  v-for="item in historyItems"
                  :key="item.id"
                  class="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden"
                >
                  <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-zinc-700/50">
                    <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img v-if="item.editor?.avatar" :src="item.editor.avatar" class="w-full h-full object-cover" loading="lazy" />
                      <Icon name="fa6-solid:user" class="text-gray-400 text-xs" v-else />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-medium">{{ item.editor?.username || '已注销用户' }}</span>
                        <span v-if="item.isRevert" class="px-1.5 py-0.5 text-[10px] rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">撤销操作</span>
                      </div>
                      <p v-if="item.changeSummary" class="text-xs text-gray-500 mt-0.5">{{ item.changeSummary }}</p>
                      <p class="text-xs text-gray-400 mt-0.5">{{ formatDate(item.createdAt) }}</p>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button
                        v-if="getChanges(item).length"
                        @click="toggleExpand(item.id)"
                        class="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-zinc-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                      >
                        <Icon :name="expandedIds.has(item.id) ? 'fa6-solid:chevron-up' : 'fa6-solid:chevron-down'" />
                        <span class="ml-1">{{ getChanges(item).length }} 项变更</span>
                      </button>
                      <button
                        v-if="isEditor && !item.isRevert"
                        class="px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                        :disabled="revertingId === item.id"
                        @click="handleRevert(item.id)"
                      >
                        <Icon name="fa6-solid:spinner" v-if="revertingId === item.id" />
                        <span v-else>撤销到此版本</span>
                      </button>
                    </div>
                  </div>

                  <!-- 变更详情 -->
                  <Transition name="expand">
                    <div v-if="expandedIds.has(item.id) && getChanges(item).length" class="border-t border-gray-200 dark:border-zinc-700">
                      <div
                        v-for="(change, idx) in getChanges(item)"
                        :key="idx"
                        class="px-4 py-2.5 text-xs border-b last:border-b-0 border-gray-100 dark:border-zinc-700/50"
                      >
                        <div class="flex items-center gap-2 mb-1">
                          <FaIcon :icon="changeIcon(change.field)" class="w-4 text-center text-gray-400" />
                          <span class="font-medium text-gray-700 dark:text-gray-300">{{ change.label }}</span>
                        </div>
                        <div v-if="isScalarField(change.field)" class="ml-6 space-y-0.5">
                          <div v-if="(change.oldDisplay || change.old) !== null && (change.oldDisplay || change.old) !== undefined && (change.oldDisplay || change.old) !== ''" class="flex items-start gap-1.5">
                            <span class="text-red-400 flex-shrink-0">-</span>
                            <span class="text-red-500 dark:text-red-400 break-all line-through">{{ change.oldDisplay || formatChangeValue(change.field, change.old) }}</span>
                          </div>
                          <div v-if="(change.newDisplay || change.new) !== null && (change.newDisplay || change.new) !== undefined && (change.newDisplay || change.new) !== ''" class="flex items-start gap-1.5">
                            <span class="text-green-400 flex-shrink-0">+</span>
                            <span class="text-green-600 dark:text-green-400 break-all">{{ change.newDisplay || formatChangeValue(change.field, change.new) }}</span>
                          </div>
                          <div v-if="!change.oldDisplay && !change.newDisplay && (change.old === null || change.old === undefined || change.old === '') && (change.new === null || change.new === undefined || change.new === '')" class="text-gray-400">
                            值已清除
                          </div>
                        </div>
                        <div v-else-if="change.field === 'tags'" class="ml-6">
                          <span v-if="(change.new as any)?.addedNames?.length" class="text-green-600 dark:text-green-400">
                            +{{ (change.new as any).addedNames.join('，') }}
                          </span>
                          <span v-if="(change.new as any)?.added?.length && !(change.new as any)?.addedNames" class="text-green-600 dark:text-green-400">
                            新增 {{ (change.new as any).added.length }} 个标签
                          </span>
                          <span v-if="(change.new as any)?.removedNames?.length" class="ml-2 text-red-500 dark:text-red-400">
                            -{{ (change.new as any).removedNames.join('，') }}
                          </span>
                          <span v-if="(change.new as any)?.removed?.length && !(change.new as any)?.removedNames" class="ml-2 text-red-500 dark:text-red-400">
                            移除 {{ (change.new as any).removed.length }} 个标签
                          </span>
                          <span v-if="(change.new as any)?.count !== undefined && !(change.new as any)?.added && !(change.new as any)?.removed" class="text-gray-500">
                            {{ (change.old as any)?.count || 0 }} → {{ (change.new as any).count }} 个标签
                          </span>
                        </div>
                        <div v-else-if="change.field === 'screenshots'" class="ml-6 text-gray-500">
                          {{ (change.old as any)?.count || 0 }} → {{ (change.new as any)?.count || 0 }} 张截图
                        </div>
                        <div v-else-if="change.field === 'staff' || change.field === 'companies'" class="ml-6 text-gray-500">
                          <span v-if="(change.new as any)?.companyName">{{ (change.new as any).companyName }}（{{ (change.new as any).role === 'DEVELOPER' ? '开发商' : '发行商' }}）</span>
                          <span v-else>{{ changeCount(change.old) }} → {{ changeCount(change.new) }} 个{{ change.field === 'staff' ? '人员' : '会社' }}</span>
                        </div>
                        <div v-else-if="change.field === 'aliases'" class="ml-6 space-y-0.5">
                          <div v-if="Array.isArray(change.old) && change.old.length" class="flex items-start gap-1.5">
                            <span class="text-red-400 flex-shrink-0">-</span>
                            <span class="text-red-500 dark:text-red-400">{{ (change.old as string[]).join('，') }}</span>
                          </div>
                          <div v-if="Array.isArray(change.new) && (change.new as string[]).length" class="flex items-start gap-1.5">
                            <span class="text-green-400 flex-shrink-0">+</span>
                            <span class="text-green-600 dark:text-green-400">{{ (change.new as string[]).join('，') }}</span>
                          </div>
                        </div>
                        <div v-else-if="change.field === 'purchaseLinks'" class="ml-6 text-gray-500">
                          {{ Array.isArray(change.old) ? (change.old as any[]).length : 0 }} → {{ Array.isArray(change.new) ? (change.new as any[]).length : 0 }} 个链接
                        </div>
                        <div v-else class="ml-6 text-gray-500">
                          已修改
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
              <div v-else class="flex flex-col items-center justify-center text-center py-12 text-gray-500">
                <Icon name="fa6-solid:clock-rotate-left" class="text-3xl mb-3" />
                <p>暂无编辑历史</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import type { FavoriteStatus, GameDetail } from '~/types/api'

type DescriptionKey = 'descriptionZhHans' | 'descriptionZhHant' | 'descriptionJa' | 'descriptionEn'

const route = useRoute()
const router = useRouter()
const { formatDate } = useFormatDate()
const { data: session, status, token } = useAuth()
const { authFetch } = useAuthRequest()
const toast = useToast()

const gameId = computed(() => parseInt(route.params.id as string))

const runtimeConfig = useRuntimeConfig()

// 获取游戏数据（使用认证请求以获取下载资源）
const { data: game, pending, error, refresh } = await useAuthFetch<GameDetail>(() => `/api/games/${gameId.value}`, {
  key: `game-detail-${gameId.value}`,
})

// 获取补丁资源
const resourceTab = ref<'game' | 'patch'>('game')
const {
  data: moyuData,
  resources: moyuResources,
  loading: moyuLoading,
  error: moyuError,
  retrySeconds: moyuRetrySeconds,
  reload: reloadMoyuPatches,
} = useMoyuPatches(gameId, computed(() => resourceTab.value === 'patch'))
const gameTabRef = ref<HTMLElement>()
const patchTabRef = ref<HTMLElement>()

// 动画下划线的位置和宽度（需要在 DOM 更新后读取实际尺寸）
const resourceTabIndicator = ref({ width: '0px', left: '0px' })

async function updateResourceTabIndicator() {
  await nextTick()
  const el = resourceTab.value === 'game' ? gameTabRef.value : patchTabRef.value
  if (!el) return
  resourceTabIndicator.value = {
    width: `${el.offsetWidth}px`,
    left: `${el.offsetLeft}px`,
  }
}

// 监听标签页切换，更新下划线位置
watch(resourceTab, updateResourceTabIndicator)

// 游戏资源数量或补丁数量变化时（badge 出现/消失导致宽度变化）重新定位下划线
watch(() => game.value?.resources?.length, updateResourceTabIndicator)
watch(() => moyuResources.value.length, updateResourceTabIndicator)

// 状态
const activeTab = ref('intro')
const activeDescLang = ref<DescriptionKey | ''>('') // 当前选中的简介语言
const showAddResource = ref(false)
const editingResource = ref<any>(null) // 正在编辑的资源
const showPurchaseDropdown = ref(false)
const purchaseDropdownRef = ref<HTMLElement>()
const showFavoriteDropdown = ref(false)
const favoriteDropdownRef = ref<HTMLElement>()
const favoriteDropdownMobileRef = ref<HTMLElement>()

const favoriteOptions = [
  { status: 'WISHLIST' as const, label: '想玩', icon: 'fa6-regular:bookmark' },
  { status: 'PLAYING' as const, label: '在玩', icon: 'fa6-solid:gamepad' },
  { status: 'COMPLETED' as const, label: '玩过', icon: 'fa6-solid:circle-check' },
  { status: 'ON_HOLD' as const, label: '搁置', icon: 'fa6-solid:pause' },
  { status: 'DROPPED' as const, label: '抛弃', icon: 'fa6-solid:ban' },
]

const favoriteIcon = computed(() => {
  if (!isLoggedIn.value || !game.value?.isFavorited) return 'fa6-regular:heart'
  const map: Record<string, string> = {
    WISHLIST: 'fa6-regular:bookmark text-red-500',
    PLAYING: 'fa6-solid:gamepad text-red-500',
    COMPLETED: 'fa6-solid:circle-check text-red-500',
    ON_HOLD: 'fa6-solid:pause text-red-500',
    DROPPED: 'fa6-solid:ban text-red-500',
  }
  const status = game.value.favoriteStatus
  return status ? map[status] ?? 'fa6-solid:heart text-red-500' : 'fa6-solid:heart text-red-500'
})

const favoriteLabel = computed(() => {
  if (!isLoggedIn.value || !game.value?.isFavorited) return '加入收藏'
  const map: Record<string, string> = {
    WISHLIST: '想玩',
    PLAYING: '在玩',
    COMPLETED: '玩过',
    ON_HOLD: '搁置',
    DROPPED: '抛弃',
  }
  const status = game.value.favoriteStatus
  return status ? map[status] ?? '已收藏' : '已收藏'
})
const mobileFavoriteLabel = computed(() => favoriteLabel.value === '加入收藏' ? '收藏' : favoriteLabel.value)

const commentContent = ref('')
const commentPlayTime = ref(0)
const commentEditorRef = ref<any>(null)
const userRating = ref(game.value?.userRating || 0)
const pendingRating = ref(0) // 待提交的评分
const hoverRating = ref(0)

// 顶一下状态
const bumpLoading = ref(false)
const hasBumpedToday = ref(game.value?.hasBumpedToday || false)
const bumpCount = ref(game.value?.todayBumps || 0)

// 评论回复状态
const replyingTo = ref<any>(null)
const replyContent = ref('')

// 举报相关状态
const showReportModal = ref(false)
const reportType = ref<'comment' | 'resource'>('comment')
const reportTarget = ref<any>(null)
const reportSubmitting = ref(false)
const reportForm = ref({
  reason: '',
  detail: '',
})

const reportDetailMissing = computed(() => reportForm.value.reason === '其他' && !reportForm.value.detail.trim())

// 举报理由选项
const reportReasons = {
  comment: ['垃圾广告', '色情低俗', '人身攻击', '违法违规', '剧透内容', '其他'],
  resource: ['资源链接失效', '资源需要付费', '资源与描述不符', '病毒/恶意软件', '其他'],
}

// 灯箱状态
const showLightbox = ref(false)
const lightboxIndex = ref(0)
const screenshotUrls = computed(() => game.value?.screenshots?.map((s: any) => s.url) || [])

function openLightbox(url: string) {
  const index = screenshotUrls.value.indexOf(url)
  lightboxIndex.value = index >= 0 ? index : 0
  showLightbox.value = true
}

// 复制到剪贴板
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label}已复制`)
  } catch {
    toast.error('复制失败')
  }
}

function resourceLangLabel(lang: string): string {
  const map: Record<string, string> = { ja: '日文', en: '英文', 'zh-Hans': '简体中文', 'zh-Hant': '繁体中文' }
  return map[lang] || lang
}

function resourceHealthLabel(status: string): string {
  const map: Record<string, string> = {
    AVAILABLE: '可用',
    NEEDS_REVIEW: '待复查',
    SUSPECTED_BAD: '疑似失效',
    UNAVAILABLE: '已失效',
  }
  return map[status] || status
}

function resourceHealthClass(status: string): string {
  const map: Record<string, string> = {
    NEEDS_REVIEW: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    SUSPECTED_BAD: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    UNAVAILABLE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  }
  return map[status] || 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
}

// 点击外部关闭购买下拉框
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  if (purchaseDropdownRef.value && !purchaseDropdownRef.value.contains(e.target as Node)) {
    showPurchaseDropdown.value = false
  }
}

// 简介语言配置
const descLangConfig: Array<{ key: DescriptionKey; label: string }> = [
  { key: 'descriptionZhHans', label: '简体中文' },
  { key: 'descriptionZhHant', label: '繁体中文' },
  { key: 'descriptionJa', label: '日本語' },
  { key: 'descriptionEn', label: 'English' },
]

// 计算属性
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
  updateResourceTabIndicator()

  // 通知中心跳转时，滚动到指定评论
  const targetCommentId = route.query.comment
  if (targetCommentId) {
    const scrollToComment = () => {
      const el = document.getElementById(`comment-${targetCommentId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('comment-highlight')
        setTimeout(() => el.classList.remove('comment-highlight'), 2000)
      }
    }
    // 等待 DOM 渲染完成再滚动
    nextTick(scrollToComment)
  }
})

// 在 loading 状态时，如果有 session 数据则保持登录状态，避免切换标签页时闪烁
const isLoggedIn = computed(() => {
  if (!hydrated.value) return false
  if (status.value === 'authenticated') return true
  if (status.value === 'loading') return !!token.value
  return false
})
const user = computed(() => session.value as any)

function requireLogin(): boolean {
  if (isLoggedIn.value) return true
  toast.info('请先登录后再操作，即将跳转到登录页面')
  setTimeout(() => {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
  }, 2000)
  return false
}

const isAdmin = computed(() => hydrated.value && user.value?.role === 'ADMIN')
const isEditor = computed(() => hydrated.value && (user.value?.role === 'ADMIN' || user.value?.role === 'EDITOR'))
const canEdit = computed(() => {
  return Boolean(game.value)
})

// 副标题：大标题以外的所有游戏名（其他语言标题 + 别名）
const subtitleNames = computed(() => {
  if (!game.value) return ''
  const mainTitle = game.value.title
  const names = [
    game.value.titleZhHans,
    game.value.titleZhHant,
    game.value.titleJa,
    game.value.titleEn,
    ...(game.value.aliases || []),
  ].filter((n): n is string => !!n && n !== mainTitle)
  // 去重
  return [...new Set(names)].join(' / ')
})

// 计算预估游玩时间
const estimatedPlayTime = computed(() => {
  if (!game.value) return null
  
  // 优先使用用户评论的平均值
  if (game.value.avgPlayTime && game.value.avgPlayTime > 0) {
    return Math.round(game.value.avgPlayTime * 10) / 10
  }
  
  // 其次使用 VNDB 数据
  if (game.value.lengthMinutes && game.value.lengthMinutes > 0) {
    return Math.round(game.value.lengthMinutes / 60 * 10) / 10
  }
  
  return null
})

// 开发商列表
const developers = computed(() => {
  if (!game.value?.companies) return []
  return game.value.companies
    .filter((c: any) => c.role === 'DEVELOPER')
    .map((c: any) => c.company || c)
})

// 发行商列表
const publishers = computed(() => {
  if (!game.value?.companies) return []
  return game.value.companies
    .filter((c: any) => c.role === 'PUBLISHER')
    .map((c: any) => c.company || c)
})

const hasSidebarBasicInfo = computed(() => {
  return developers.value.length > 0 ||
    publishers.value.length > 0 ||
    !!game.value?.releaseDate ||
    !!game.value?.language?.length
})

// 可用的简介语言
const availableDescLangs = computed(() => {
  if (!game.value) return []
  return descLangConfig.filter(lang => game.value[lang.key])
})

// 当前显示的简介
const currentDescription = computed(() => {
  if (!game.value) return ''
  if (activeDescLang.value && game.value[activeDescLang.value]) {
    return game.value[activeDescLang.value]
  }
  // 默认显示优先级：简中 > 繁中 > 日文 > 英文
  return game.value.descriptionZhHans || game.value.descriptionZhHant || 
         game.value.descriptionJa || game.value.descriptionEn || ''
})

// 初始化简介语言
watch(() => game.value, (newGame) => {
  if (newGame && !activeDescLang.value) {
    // 设置默认语言
    if (newGame.descriptionZhHans) activeDescLang.value = 'descriptionZhHans'
    else if (newGame.descriptionZhHant) activeDescLang.value = 'descriptionZhHant'
    else if (newGame.descriptionJa) activeDescLang.value = 'descriptionJa'
    else if (newGame.descriptionEn) activeDescLang.value = 'descriptionEn'
  }
}, { immediate: true })

const staffByRole = computed(() => {
  if (!game.value?.staff?.length) return null
  const grouped: Record<string, any[]> = {}
  for (const staff of game.value.staff) {
    if (!grouped[staff.role]) {
      grouped[staff.role] = []
    }
    grouped[staff.role].push(staff)
  }
  return grouped
})

const roleLabels: Record<string, string> = {
  ARTIST: '原画',
  WRITER: '剧本',
  COMPOSER: '音乐',
  VOICE_ACTOR: '声优',
  DIRECTOR: '导演',
  OTHER: '其他',
}

// 编辑历史
const showHistoryModal = ref(false)
const historyItems = ref<any[]>([])
const historyLoading = ref(false)
const historyLoaded = ref(false)
const revertingId = ref<number | null>(null)
const expandedIds = ref(new Set<number>())

function openHistoryModal() {
  showHistoryModal.value = true
  loadHistory()
}

async function loadHistory() {
  if (historyLoaded.value) return
  historyLoading.value = true
  try {
    const res: any = await ($fetch as any)(`/api/games/${gameId.value}/history`)
    historyItems.value = res?.items || []
    historyLoaded.value = true
  } catch {
    historyItems.value = []
  } finally {
    historyLoading.value = false
  }
}

async function handleRevert(editId: number) {
  if (!confirm('确定要撤销到此版本吗？这将覆盖当前的游戏信息。')) return
  revertingId.value = editId
  try {
    await authFetch(`/api/admin/content-edits/${editId}/revert`, { method: 'POST' })
    toast.success('已成功撤销到该版本')
    historyLoaded.value = false
    await Promise.all([refresh(), loadHistory()])
  } catch (e: any) {
    toast.error(e.data?.message || '撤销失败')
  } finally {
    revertingId.value = null
  }
}

function toggleExpand(id: number) {
  const s = new Set(expandedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedIds.value = s
}

function getChanges(item: any): any[] {
  return item.snapshot?._changes || []
}

// 兼容两种变更记录形态：{ count } 或 数组（会社/STAFF）
function changeCount(val: any): number {
  if (Array.isArray(val)) return val.length
  if (val && typeof val === 'object' && typeof val.count === 'number') return val.count
  return 0
}

function isScalarField(field: string): boolean {
  return ![
    'tags', 'screenshots', 'staff', 'companies', 'aliases', 'purchaseLinks',
  ].includes(field)
}

function changeIcon(field: string): string {
  const map: Record<string, string> = {
    titleEn: 'fa6-solid:heading',
    titleJa: 'fa6-solid:heading',
    titleZhHans: 'fa6-solid:heading',
    titleZhHant: 'fa6-solid:heading',
    aliases: 'fa6-solid:tags',
    descriptionEn: 'fa6-solid:align-left',
    descriptionJa: 'fa6-solid:align-left',
    descriptionZhHans: 'fa6-solid:align-left',
    descriptionZhHant: 'fa6-solid:align-left',
    coverImage: 'fa6-solid:image',
    releaseDate: 'fa6-solid:calendar',
    isNsfw: 'fa6-solid:shield-halved',
    vndbId: 'fa6-solid:link',
    bangumiId: 'fa6-solid:link',
    purchaseLinks: 'fa6-solid:cart-shopping',
    lengthMinutes: 'fa6-solid:clock',
    seriesId: 'fa6-solid:layer-group',
    tags: 'fa6-solid:tags',
    screenshots: 'fa6-solid:images',
    staff: 'fa6-solid:users',
    companies: 'fa6-solid:building',
  }
  return map[field] || 'fa6-solid:pen'
}

function formatChangeValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '(空)'
  if (field === 'isNsfw') return value ? '是' : '否'
  if (field === 'releaseDate') return String(value).split('T')[0]
  if (field === 'coverImage') return '(图片已更改)'
  if (field === 'seriesId') return value ? `${value}` : '(无)'
  if (field === 'lengthMinutes') return `${value} 分钟`
  const str = String(value)
  if (str.length > 120) return str.slice(0, 120) + '...'
  return str
}

async function setFavoriteStatus(status: FavoriteStatus | null) {
  if (!game.value) return
  if (!requireLogin()) return
  showFavoriteDropdown.value = false
  try {
    const res = await authFetch<{ isFavorited: boolean; favoriteStatus: string | null; message: string }>(
      `/api/games/${game.value.id}/favorite`,
      { method: 'POST', body: { status } },
    )
    toast.success(res.message)
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  }
}

onClickOutside(favoriteDropdownRef, () => { showFavoriteDropdown.value = false })
onClickOutside(favoriteDropdownMobileRef, () => { showFavoriteDropdown.value = false })

// 顶一下
async function handleBump() {
  if (!game.value || bumpLoading.value || hasBumpedToday.value) return
  if (!requireLogin()) return
  
  bumpLoading.value = true
  try {
    const result = await authFetch<{ todayBumps: number; totalBumps: number }>(`/api/games/${game.value.id}/bump`, {
      method: 'POST',
    })
    hasBumpedToday.value = true
    bumpCount.value = result.todayBumps
    toast.success(`顶一下成功！该条目今天已被顶了 ${result.todayBumps} 次`)
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    bumpLoading.value = false
  }
}

// 评分+评论一起提交
async function submitCommentWithRating() {
  if (!game.value || isEmptyRichText(commentContent.value)) return
  try {
    // 如果有待提交的评分，先提交评分
    if (pendingRating.value > 0) {
      await authFetch(`/api/games/${game.value.id}/rating`, {
        method: 'POST',
        body: { score: pendingRating.value },
      })
      userRating.value = pendingRating.value
      pendingRating.value = 0
    }
    // 提交评论（包含游玩时长）
    await authFetch(`/api/games/${game.value.id}/comment`, {
      method: 'POST',
      body: { 
        content: commentContent.value,
        playTime: commentPlayTime.value > 0 ? commentPlayTime.value : null,
      },
    })
    commentContent.value = ''
    commentPlayTime.value = 0
    commentEditorRef.value?.clear()
    await refresh()
    toast.success('评论发布成功')
  } catch (error: any) {
    console.error('评论失败:', error)
    toast.error(error.data?.message || '评论失败')
  }
}

async function handleResourceAdded() {
  console.log('handleResourceAdded called, refreshing data...')
  showAddResource.value = false
  await refresh()
  console.log('Data refreshed, resources:', game.value?.resources?.length)
}

// 检查是否可以编辑资源（上传者或管理员）
function canEditResource(resource: any) {
  if (!isLoggedIn.value || !user.value) return false
  return resource.uploader?.id === user.value.id || user.value.role === 'ADMIN'
}

// 编辑资源
function editResource(resource: any) {
  editingResource.value = resource
}

// 资源更新成功
async function handleResourceUpdated() {
  editingResource.value = null
  await refresh()
}

// 删除资源
async function deleteResource(resource: any) {
  if (!confirm(`确定要删除资源「${resource.title}」吗？此操作不可撤销。`)) return
  
  try {
    await authFetch(`/api/resources/${resource.id}`, {
      method: 'DELETE',
    })
    if (game.value?.resources) {
      game.value.resources = game.value.resources.filter((item: any) => item.id !== resource.id)
    }
    await refresh()
    toast.success('资源删除成功')
  } catch (error: any) {
    console.error('删除资源失败:', error)
    toast.error(error.data?.message || error.message || '删除失败')
  }
}

// 删除评论
async function handleDeleteComment(comment: any) {
  if (!confirm('确定要删除这条评论吗？此操作无法撤销。')) return
  
  try {
    await authFetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
    toast.success('评论已删除')

    // 立即更新本地状态，避免依赖 refresh() 传播深层嵌套变更
    const comments: any[] = game.value?.comments ?? []
    const topIdx = comments.findIndex((c: any) => c.id === comment.id)
    let removedCount = 1
    if (topIdx !== -1) {
      removedCount += comments[topIdx]?.replies?.length ?? 0
      comments.splice(topIdx, 1)
    } else {
      for (const c of comments) {
        const replyIdx = (c.replies ?? []).findIndex((r: any) => r.id === comment.id)
        if (replyIdx !== -1) {
          c.replies.splice(replyIdx, 1)
          break
        }
      }
    }
    if (game.value.commentCount !== undefined) {
      game.value.commentCount = Math.max(0, game.value.commentCount - removedCount)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

// 评论点赞
async function handleLikeComment(comment: any) {
  if (!isLoggedIn.value) {
    toast.error('请先登录')
    return
  }
  
  try {
    const result = await authFetch<{ liked: boolean; likeCount: number }>(`/api/comments/${comment.id}/like`, {
      method: 'POST',
    })
    comment.isLiked = result.liked
    comment.likeCount = result.likeCount
    if (result.liked) {
      toast.success('点赞成功')
    }
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  }
}

// 开始回复评论
function startReply(comment: any) {
  if (!isLoggedIn.value) {
    toast.error('请先登录')
    return
  }
  replyingTo.value = comment
  replyContent.value = ''
}

// 开始回复评论的回复
function startReplyToReply(parentComment: any, reply: any) {
  if (!isLoggedIn.value) {
    toast.error('请先登录')
    return
  }
  replyingTo.value = reply
  replyContent.value = ''
}

// 提交回复的回复
async function submitReplyToReply(parentComment: any) {
  if (!replyingTo.value || isEmptyRichText(replyContent.value)) return
  
  try {
    await authFetch(`/api/games/${game.value.id}/comment`, {
      method: 'POST',
      body: {
        content: replyContent.value,
        parentId: parentComment.id, // 回复到主评论下
      },
    })
    cancelReply()
    await refresh()
    toast.success('回复成功')
  } catch (error: any) {
    toast.error(error.data?.message || '回复失败')
  }
}

// 取消回复
function cancelReply() {
  replyingTo.value = null
  replyContent.value = ''
}

// 提交回复
async function submitReply() {
  if (!replyingTo.value || isEmptyRichText(replyContent.value)) return
  
  try {
    await authFetch(`/api/games/${game.value.id}/comment`, {
      method: 'POST',
      body: {
        content: replyContent.value,
        parentId: replyingTo.value.id,
      },
    })
    cancelReply()
    await refresh()
    toast.success('回复成功')
  } catch (error: any) {
    toast.error(error.data?.message || '回复失败')
  }
}

// 打开举报弹窗
function openReportModal(type: 'comment' | 'resource', target: any) {
  reportType.value = type
  reportTarget.value = target
  reportForm.value = { reason: '', detail: '' }
  showReportModal.value = true
}

// 关闭举报弹窗
function closeReportModal() {
  showReportModal.value = false
  reportTarget.value = null
}

// 提交举报
async function submitReport() {
  if (!reportForm.value.reason || reportSubmitting.value) return
  if (reportDetailMissing.value) {
    toast.error('选择“其他”时，请填写具体举报理由')
    return
  }
  
  reportSubmitting.value = true
  try {
    await authFetch('/api/reports', {
      method: 'POST',
      body: {
        type: reportType.value.toUpperCase(),
        targetId: reportTarget.value.id,
        reason: reportForm.value.reason,
        detail: reportForm.value.reason === '其他' ? reportForm.value.detail.trim() : null,
      },
    })
    toast.success('举报提交成功，我们会尽快处理')
    closeReportModal()
  } catch (error: any) {
    toast.error(error.data?.message || '举报提交失败')
  } finally {
    reportSubmitting.value = false
  }
}

const siteName = useSiteName()

// 构建 SEO 标题：中文名 / 日文名（无日文则英文，都没有则省略） - 网站名
const seoTitle = computed(() => {
  if (!game.value) return siteName.value
  const zhTitle = game.value.titleZhHans || game.value.titleZhHant || ''
  const altTitle = game.value.titleJa || game.value.titleEn || ''
  const uniqueAlt = altTitle && altTitle !== zhTitle ? altTitle : ''
  const titleParts = [zhTitle, uniqueAlt].filter(Boolean)
  const gameTitle = titleParts.length ? titleParts.join(' / ') : game.value.title
  return `${gameTitle} - ${siteName.value}`
})

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// SEO - 为 NSFW 游戏添加 noindex 标签，阻止搜索引擎索引
useHead({
  title: seoTitle,
  meta: computed(() => {
    const metas: any[] = []
    
    if (game.value) {
      // 描述
      const description = plainText(game.value.description || game.value.descriptionZhHans || 
                          game.value.descriptionZhHant || game.value.descriptionJa || 
                          game.value.descriptionEn || '')
      const truncatedDesc = description.slice(0, 160) + (description.length > 160 ? '...' : '')
      
      metas.push({ name: 'description', content: truncatedDesc || `${game.value.title} - Galgame 游戏资源` })
      
      // Open Graph
      metas.push({ property: 'og:title', content: seoTitle.value })
      metas.push({ property: 'og:description', content: truncatedDesc || `${game.value.title} - Galgame 游戏资源` })
      metas.push({ property: 'og:type', content: 'website' })
      const origin = ((runtimeConfig.public?.siteUrl as string) || '').replace(/\/+$/, '')
      metas.push({ property: 'og:url', content: `${origin}/games/${game.value.id}` })
      if (game.value.coverImage) {
        metas.push({ property: 'og:image', content: game.value.coverImage })
        metas.push({ property: 'og:image:alt', content: game.value.title })
      }
      // Twitter Card
      metas.push({ name: 'twitter:title', content: seoTitle.value })
      metas.push({ name: 'twitter:description', content: truncatedDesc || `${game.value.title} - Galgame 游戏资源` })
      if (game.value.coverImage) {
        metas.push({ name: 'twitter:image', content: game.value.coverImage })
      }
      
      // 仅对 NSFW 游戏禁止搜索引擎索引。
      // 普通游戏即使有资源，也应保留游戏条目的正常收录；资源下载地址和敏感凭据
      // 已在 API/下载页鉴权层处理，不通过整页 noindex 来牺牲资源站的搜索入口。
      if (game.value.isNsfw) {
        metas.push({ name: 'robots', content: 'noindex, nofollow' })
        metas.push({ name: 'googlebot', content: 'noindex, nofollow' })
      }
    }
    
    return metas
  }),
  script: computed(() => {
    if (!game.value) return []
    const g = game.value as any
    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: g.title,
      url: `${(runtimeConfig.public?.siteUrl as string || '').replace(/\/+$/, '')}/games/${g.id}`,
    }
    if (g.coverImage) jsonLd.image = g.coverImage
    const desc = plainText(g.description || g.descriptionZhHans || g.descriptionZhHant || g.descriptionJa || g.descriptionEn || '')
    if (desc) jsonLd.description = desc.slice(0, 300)
    if (g.releaseDate) jsonLd.datePublished = g.releaseDate
    if (g.company?.name) {
      jsonLd.publisher = { '@type': 'Organization', name: g.company.name }
    }
    if (g.avgRating && g.ratingCount) {
      jsonLd.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: g.avgRating,
        ratingCount: g.ratingCount,
        bestRating: 10,
        worstRating: 1,
      }
    }
    return [{ type: 'application/ld+json', key: 'jsonld-game', innerHTML: JSON.stringify(jsonLd) }]
  }),
})
</script>

<style scoped>
/* 通知跳转评论高亮 */
@keyframes comment-flash {
  0%   { background-color: transparent; }
  20%  { background-color: rgb(254 240 138 / 0.5); }
  80%  { background-color: rgb(254 240 138 / 0.5); }
  100% { background-color: transparent; }
}
.comment-highlight {
  border-radius: 0.5rem;
  animation: comment-flash 2s ease forwards;
}

/* 按钮悬浮和点击动画 */
.action-btn {
  @apply transition-colors duration-150 backdrop-blur-sm;
}

.action-btn.border {
  @apply bg-white/85 dark:bg-zinc-800/85;
}

.action-btn.border:hover:not(:disabled) {
  @apply bg-gray-100/95 dark:bg-zinc-700/95;
}

.action-btn:active:not(:disabled) {
  @apply bg-gray-200 dark:bg-zinc-600;
}

/* 下拉菜单动画 */
.dropdown-enter-active {
  animation: dropdown-in 0.2s ease-out;
}
.dropdown-leave-active {
  animation: dropdown-out 0.15s ease-in forwards;
}
@keyframes dropdown-in {
  from { opacity: 0; transform: scale(0.95) translateY(-8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes dropdown-out {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.95) translateY(-8px); }
}

/* 弹窗动画已移至 app.vue 全局样式 */

/* 变更详情展开动画 */
.expand-enter-active {
  animation: expand-in 0.25s ease-out;
}
.expand-leave-active {
  animation: expand-out 0.2s ease-in forwards;
}
@keyframes expand-in {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}
@keyframes expand-out {
  from { opacity: 1; max-height: 500px; }
  to { opacity: 0; max-height: 0; }
}
</style>
