<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6">
    <h1 class="text-xl md:text-2xl font-bold mb-4 md:mb-8">个人中心</h1>

    <div v-if="profile" class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 md:gap-8">
      
      <!-- 左侧：个人信息 -->
      <aside class="space-y-4">
        <!-- 基本信息卡片 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 shadow">
          <div class="flex flex-row lg:flex-col items-center lg:items-center gap-4">
            <!-- 头像 -->
            <div class="relative group">
              <div 
                class="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer"
                @click="triggerAvatarUpload"
              >
                <img v-if="profile.avatar" :src="profile.avatar" class="w-full h-full object-cover" />
                <i v-else class="fa-solid fa-user text-xl md:text-3xl text-gray-400"></i>
              </div>
              <div 
                class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                @click="triggerAvatarUpload"
              >
                <i v-if="uploadingAvatar" class="fa-solid fa-spinner fa-spin text-white text-xl"></i>
                <i v-else class="fa-solid fa-camera text-white text-xl"></i>
              </div>
              <input 
                ref="avatarInputRef"
                type="file" 
                accept="image/*"
                class="hidden"
                @change="handleAvatarUpload"
              />
            </div>
            
            <!-- 用户名和角色 -->
            <div class="flex-1 lg:text-center">
              <div class="flex items-center lg:justify-center gap-2">
                <h2 class="text-lg md:text-xl font-semibold">{{ profile.username }}</h2>
                <span 
                  class="px-2 py-0.5 text-xs rounded font-medium"
                  :class="{
                    'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300': profile.role === 'ADMIN',
                    'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300': profile.role === 'EDITOR',
                    'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300': profile.role === 'USER',
                  }"
                >
                  {{ roleLabels[profile.role] }}
                </span>
              </div>
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">{{ profile.email }}</p>
              <p v-if="profile.bio" class="text-gray-600 dark:text-gray-300 text-sm mt-2 lg:mt-3">{{ profile.bio }}</p>
            </div>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-3 md:p-4 shadow">
          <div class="grid grid-cols-3 lg:grid-cols-3 gap-2 md:gap-3">
            <button
              class="text-center p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/50 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
              @click="showFollowersModal = true"
            >
              <div class="text-lg md:text-2xl font-bold">{{ profile.stats.followers || 0 }}</div>
              <div class="text-[10px] md:text-xs text-gray-500">粉丝</div>
            </button>
            <button
              class="text-center p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/50 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
              @click="showFollowingModal = true"
            >
              <div class="text-lg md:text-2xl font-bold">{{ profile.stats.following || 0 }}</div>
              <div class="text-[10px] md:text-xs text-gray-500">关注</div>
            </button>
            <div class="text-center p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/50">
              <div class="text-lg md:text-2xl font-bold">{{ profile.stats.favorites }}</div>
              <div class="text-[10px] md:text-xs text-gray-500">收藏</div>
            </div>
            <div class="text-center p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/50">
              <div class="text-lg md:text-2xl font-bold">{{ profile.stats.createdGames }}</div>
              <div class="text-[10px] md:text-xs text-gray-500">创建</div>
            </div>
            <div class="text-center p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/50">
              <div class="text-lg md:text-2xl font-bold">{{ profile.stats.editedGames }}</div>
              <div class="text-[10px] md:text-xs text-gray-500">编辑</div>
            </div>
            <div class="text-center p-2 md:p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/50">
              <div class="text-lg md:text-2xl font-bold">{{ profile.stats.comments || 0 }}</div>
              <div class="text-[10px] md:text-xs text-gray-500">评论</div>
            </div>
          </div>
        </div>

        <!-- 详细信息 - 移动端隐藏 -->
        <div class="hidden lg:block bg-white dark:bg-zinc-800 rounded-xl p-4 shadow text-sm space-y-3">
          <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <i class="fa-solid fa-calendar w-5"></i>
            <span>加入时间：{{ formatDate(profile.createdAt) }}</span>
          </div>
          <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <i class="fa-solid fa-id-card w-5"></i>
            <span>用户ID：{{ profile.id }}</span>
          </div>
        </div>

        <!-- 编辑资料按钮 -->
        <button 
          @click="showEditModal = true"
          class="w-full py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
        >
          <i class="fa-solid fa-pen"></i>编辑个人信息
        </button>
      </aside>

      <!-- 右侧：历史记录 -->
      <main class="space-y-4">
        <!-- 顶栏切换 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <div class="relative flex border-b dark:border-zinc-700 overflow-x-auto">
            <!-- 滑动指示条 -->
            <div 
              class="absolute bottom-0 h-0.5 bg-gray-800 dark:bg-white transition-all duration-300 ease-out"
              :style="{
                width: `${100 / tabs.length}%`,
                left: `${tabs.findIndex(t => t.key === activeTab) * (100 / tabs.length)}%`
              }"
            ></div>
            <button 
              v-for="tab in tabs"
              :key="tab.key"
              @click="activeTab = tab.key"
              class="flex-1 min-w-[60px] px-2 md:px-4 py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 transition relative z-10 whitespace-nowrap"
              :class="activeTab === tab.key 
                ? 'text-gray-800 dark:text-white' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              <i :class="tab.icon"></i>
              <span class="hidden sm:inline">{{ tab.label }}</span>
            </button>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow relative overflow-hidden">
          <Transition name="tab" mode="out-in">
          <!-- 历史评论 -->
          <div v-if="activeTab === 'comments'" key="comments" class="p-3 md:p-4">
            <div v-if="comments?.length" class="space-y-3 md:space-y-4">
              <div 
                v-for="comment in comments"
                :key="comment.id"
                class="p-3 md:p-4 rounded-lg bg-gray-50 dark:bg-zinc-700/50"
              >
                <div class="flex items-start justify-between gap-2 md:gap-4">
                  <div class="flex-1 min-w-0">
                    <NuxtLink 
                      :to="`/games/${comment.game.id}`"
                      class="font-medium text-sm md:text-base hover:text-gray-600 dark:hover:text-gray-300 transition"
                    >
                      {{ comment.game.title }}
                    </NuxtLink>
                    <SafeHtml tag="p" class="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 md:mt-2 line-clamp-2" :content="comment.content" />
                    <div class="flex items-center gap-3 md:gap-4 text-xs text-gray-500 mt-2">
                      <span v-if="comment.playTime">
                        <i class="fa-solid fa-clock mr-1"></i>{{ comment.playTime }} 小时
                      </span>
                      <span class="flex items-center gap-1">
                        <i class="fa-solid fa-heart text-red-400"></i>{{ comment.likeCount || 0 }}
                      </span>
                    </div>
                  </div>
                  <span class="text-[10px] md:text-xs text-gray-400 whitespace-nowrap">{{ formatDate(comment.createdAt) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 md:py-12 text-gray-500">
              <i class="fa-solid fa-comments text-2xl md:text-3xl mb-3"></i>
              <p class="text-sm">暂无评论记录</p>
            </div>
          </div>

          <!-- 历史收藏 -->
          <div v-else-if="activeTab === 'favorites'" key="favorites" class="p-3 md:p-4">
            <!-- 状态筛选 -->
            <div class="flex gap-2 mb-4 flex-wrap">
              <button
                v-for="f in favoriteFilters"
                :key="f.value"
                @click="favoriteStatusFilter = f.value"
                class="px-3 py-1.5 text-xs rounded-full border transition"
                :class="favoriteStatusFilter === f.value
                  ? 'bg-gray-800 dark:bg-zinc-600 text-white border-transparent'
                  : 'border-gray-200 dark:border-zinc-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700'"
              >
                <i :class="f.icon" class="mr-1"></i>{{ f.label }}
              </button>
            </div>
            <Transition name="fade" mode="out-in">
            <div
              v-if="filteredFavorites?.length"
              :key="favoriteStatusFilter + '-grid'"
              class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-3 md:gap-4"
            >
              <NuxtLink 
                v-for="fav in filteredFavorites"
                :key="fav.id"
                :to="`/games/${fav.game.id}`"
                class="group"
              >
                <div class="aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-700">
                  <img 
                    v-if="fav.game.coverImage"
                    :src="fav.game.coverImage" 
                    :alt="fav.game.title"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div 
                    v-else
                    class="w-full h-full flex items-center justify-center"
                  >
                    <i class="fa-solid fa-gamepad text-3xl text-gray-400 dark:text-zinc-500"></i>
                  </div>
                </div>
                <h4 class="text-sm font-medium mt-2 truncate group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {{ fav.game.title }}
                </h4>
                <p class="text-xs text-gray-500">{{ formatDate(fav.createdAt) }}</p>
              </NuxtLink>
            </div>
            <div v-else :key="favoriteStatusFilter + '-empty'" class="text-center py-12 text-gray-500">
              <i class="fa-solid fa-heart text-3xl mb-3"></i>
              <p>暂无收藏</p>
            </div>
            </Transition>
          </div>

          <!-- 我的动态 -->
          <div v-else-if="activeTab === 'activity'" key="activity" class="p-3 md:p-4">
            <!-- 类型筛选 -->
            <div class="flex flex-wrap gap-2 mb-4">
              <button
                v-for="f in activityFilters"
                :key="f.value"
                @click="activityFilter = f.value"
                class="px-3 py-1.5 text-xs rounded-full border transition"
                :class="activityFilter === f.value
                  ? 'bg-gray-800 dark:bg-zinc-600 text-white border-transparent'
                  : 'border-gray-200 dark:border-zinc-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700'"
              >
                <i :class="f.icon" class="mr-1"></i>{{ f.label }}
              </button>
            </div>

            <div v-if="activityLoading" class="text-center py-12 text-gray-400">
              <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
            </div>
            <template v-else>
              <Transition name="fade" mode="out-in">
              <div v-if="activities.length" :key="activityFilter + '-list'" class="space-y-3">
                <div
                  v-for="item in activities"
                  :key="item.id"
                  class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/50"
                >
                  <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    :class="{
                      'bg-blue-100 text-blue-500 dark:bg-blue-900/30': item.type === 'CREATE_GAME',
                      'bg-green-100 text-green-500 dark:bg-green-900/30': item.type === 'EDIT_GAME',
                      'bg-yellow-100 text-yellow-500 dark:bg-yellow-900/30': item.type === 'COMMENT',
                      'bg-purple-100 text-purple-500 dark:bg-purple-900/30': ['CREATE_GUIDE','EDIT_GUIDE'].includes(item.type),
                      'bg-red-100 text-red-500 dark:bg-red-900/30': item.type === 'FAVORITE_GAME',
                      'bg-orange-100 text-orange-500 dark:bg-orange-900/30': item.type === 'RATE_GAME',
                    }"
                  >
                    <i :class="{
                      'fa-solid fa-plus': item.type === 'CREATE_GAME',
                      'fa-solid fa-pen': item.type === 'EDIT_GAME',
                      'fa-solid fa-comment': item.type === 'COMMENT',
                      'fa-solid fa-book': ['CREATE_GUIDE','EDIT_GUIDE'].includes(item.type),
                      'fa-solid fa-heart': item.type === 'FAVORITE_GAME',
                      'fa-solid fa-star': item.type === 'RATE_GAME',
                    }" class="text-sm"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm">
                      <span class="text-gray-500">{{ activityLabel(item.type) }}</span>
                      <NuxtLink
                        v-if="item.targetType === 'game' && item.targetId"
                        :to="`/games/${item.targetId}`"
                        class="ml-1 font-medium hover:underline"
                      >{{ (item.meta as any)?.gameTitle || `游戏 #${item.targetId}` }}</NuxtLink>
                      <NuxtLink
                        v-else-if="item.targetType === 'guide' && item.targetId"
                        :to="`/games/${(item.meta as any)?.gameId}`"
                        class="ml-1 font-medium hover:underline"
                      >{{ (item.meta as any)?.guideTitle || '攻略' }}</NuxtLink>
                    </p>
                    <p class="text-xs text-gray-400 mt-0.5">{{ formatDate(item.createdAt) }}</p>
                  </div>
                </div>
              </div>
              <div v-else :key="activityFilter + '-empty'" class="text-center py-12 text-gray-500">
                <i class="fa-solid fa-bolt text-3xl mb-3"></i>
                <p>{{ activityFilter === '' ? '暂无动态记录' : '该类型暂无记录' }}</p>
              </div>
              </Transition>
              <Pagination
                v-if="activityPagination.totalPages > 1"
                :current-page="activityPage"
                :total-pages="activityPagination.totalPages"
                @page-change="handleActivityPageChange"
                class="mt-4"
              />
            </template>
          </div>


          <!-- 待审核 -->
          <div v-else-if="activeTab === 'pending'" key="pending" class="p-4">
            <div v-if="pendingItems?.editRequests?.length || pendingItems?.resources?.length" class="space-y-6">
              <!-- 条目修改请求 -->
              <div v-if="pendingItems?.editRequests?.length">
                <h3 class="text-sm font-medium text-gray-500 mb-3">条目修改请求</h3>
                <div class="space-y-3">
                  <div 
                    v-for="request in pendingItems.editRequests"
                    :key="request.id"
                    class="p-4 rounded-lg bg-gray-50 dark:bg-zinc-700/50"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <NuxtLink 
                            :to="`/games/${request.gameId}`"
                            class="font-medium hover:text-gray-600 dark:hover:text-gray-300 transition"
                          >
                            {{ request.game?.title || `游戏 #${request.gameId}` }}
                          </NuxtLink>
                          <span 
                            class="px-2 py-0.5 text-xs rounded"
                            :class="{
                              'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400': request.status === 'PENDING',
                              'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': request.status === 'APPROVED',
                              'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400': request.status === 'REJECTED',
                            }"
                          >
                            {{ { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[request.status] }}
                          </span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                          修改了 {{ Object.keys(request.changes || {}).length }} 个字段
                        </p>
                        <p v-if="request.reviewNote" class="text-xs text-gray-500 mt-1">
                          审核备注：{{ request.reviewNote }}
                        </p>
                      </div>
                      <span class="text-xs text-gray-400 whitespace-nowrap">{{ formatDate(request.createdAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 资源审核 -->
              <div v-if="pendingItems?.resources?.length">
                <h3 class="text-sm font-medium text-gray-500 mb-3">资源审核</h3>
                <div class="space-y-3">
                  <div 
                    v-for="resource in pendingItems.resources"
                    :key="resource.id"
                    class="p-4 rounded-lg bg-gray-50 dark:bg-zinc-700/50"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-medium">{{ resource.title }}</span>
                          <span 
                            class="px-2 py-0.5 text-xs rounded"
                            :class="{
                              'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400': resource.status === 'PENDING',
                              'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': resource.status === 'APPROVED',
                              'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400': resource.status === 'REJECTED',
                            }"
                          >
                            {{ { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝' }[resource.status] }}
                          </span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                          关联游戏：
                          <NuxtLink 
                            :to="`/games/${resource.gameId}`"
                            class="text-blue-500 hover:underline"
                          >
                            {{ resource.game?.title || `游戏 #${resource.gameId}` }}
                          </NuxtLink>
                        </p>
                      </div>
                      <span class="text-xs text-gray-400 whitespace-nowrap">{{ formatDate(resource.createdAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-12 text-gray-500">
              <i class="fa-solid fa-clock text-3xl mb-3"></i>
              <p>暂无待审核内容</p>
            </div>
          </div>
          </Transition>
        </div>
      </main>
    </div>

    <!-- 加载中 -->
    <div v-else class="text-center py-20">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-gray-400"></i>
    </div>

    <!-- 编辑资料弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showEditModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl modal-content w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
              <h3 class="font-semibold">编辑个人资料</h3>
              <button @click="showEditModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                <i class="fa-solid fa-xmark text-gray-400"></i>
              </button>
            </div>
            
            <!-- 标签切换 -->
            <div class="relative flex border-b dark:border-zinc-700">
              <!-- 滑动指示条 -->
              <div 
                class="absolute bottom-0 h-0.5 bg-gray-800 dark:bg-white transition-all duration-300 ease-out"
                :style="{
                  width: `${100 / editTabs.length}%`,
                  left: `${editTabs.findIndex(t => t.key === editActiveTab) * (100 / editTabs.length)}%`
                }"
              ></div>
              <button 
                v-for="tab in editTabs"
                :key="tab.key"
                @click="editActiveTab = tab.key"
                class="flex-1 px-4 py-2.5 text-sm font-medium transition relative z-10"
                :class="editActiveTab === tab.key 
                  ? 'text-gray-800 dark:text-white' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
              >
                <i :class="tab.icon" class="mr-1.5"></i>{{ tab.label }}
              </button>
            </div>
            
            <div class="p-4">
              <Transition name="fade" mode="out-in">
              <!-- 基本信息 -->
              <form v-if="editActiveTab === 'profile'"  key="profile" @submit.prevent="handleUpdateProfile" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">用户名</label>
                  <input 
                    v-model="editForm.username"
                    type="text" 
                    class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">个人简介</label>
                  <textarea 
                    v-model="editForm.bio"
                    class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    rows="3"
                    placeholder="介绍一下自己..."
                  ></textarea>
                </div>
                <div>
                  <label class="flex items-center gap-3 cursor-pointer mb-3">
                    <input 
                      type="checkbox" 
                      v-model="editForm.emailNotify"
                      class="w-5 h-5 rounded border-gray-300 dark:border-zinc-600"
                    />
                    <div>
                      <span class="font-medium text-sm">邮件通知总开关</span>
                      <p class="text-xs text-gray-500">关闭后将不会收到任何邮件通知</p>
                    </div>
                  </label>
                  <div v-if="editForm.emailNotify" class="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-zinc-600 pl-4">
                    <label 
                      v-for="nt in notificationTypes" 
                      :key="nt.key"
                      class="flex items-center gap-3 cursor-pointer"
                    >
                      <input 
                        type="checkbox" 
                        v-model="notifPrefs[nt.key]"
                        class="w-4 h-4 rounded border-gray-300 dark:border-zinc-600"
                      />
                      <div>
                        <span class="text-sm">{{ nt.label }}</span>
                        <p class="text-xs text-gray-500">{{ nt.desc }}</p>
                      </div>
                    </label>
                  </div>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                  <button 
                    type="button"
                    @click="showEditModal = false"
                    class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    :disabled="updating"
                    class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
                  >
                    {{ updating ? '保存中...' : '保存修改' }}
                  </button>
                </div>
              </form>

              <!-- 换绑邮箱 -->
              <form v-else-if="editActiveTab === 'email'" key="email" @submit.prevent="handleChangeEmail" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">当前邮箱</label>
                  <div class="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-500">
                    {{ profile?.email }}
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">新邮箱</label>
                  <input 
                    v-model="emailForm.newEmail"
                    type="email" 
                    class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="输入新邮箱地址"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">验证码</label>
                  <div class="flex gap-2">
                    <input 
                      v-model="emailForm.code"
                      type="text" 
                      class="flex-1 px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="输入验证码"
                      required
                    />
                    <button 
                      type="button"
                      @click="sendEmailCode"
                      :disabled="emailCodeCooldown > 0 || sendingCode"
                      class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {{ sendingCode ? '发送中...' : (emailCodeCooldown > 0 ? `${emailCodeCooldown}s` : '发送验证码') }}
                    </button>
                  </div>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                  <button 
                    type="button"
                    @click="showEditModal = false"
                    class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    :disabled="changingEmail"
                    class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
                  >
                    {{ changingEmail ? '更换中...' : '更换邮箱' }}
                  </button>
                </div>
              </form>

              <!-- 修改密码 -->
              <form v-else-if="editActiveTab === 'password'" key="password" @submit.prevent="handleChangePassword" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">当前密码</label>
                  <input 
                    v-model="passwordForm.currentPassword"
                    type="password"
                    autocomplete="current-password"
                    class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="输入当前密码"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">新密码</label>
                  <input 
                    v-model="passwordForm.newPassword"
                    type="password"
                    autocomplete="new-password"
                    class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="输入新密码（至少6位）"
                    minlength="6"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">确认新密码</label>
                  <input 
                    v-model="passwordForm.confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="再次输入新密码"
                    required
                  />
                  <p v-if="passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword" class="text-xs text-red-500 mt-1">
                    两次输入的密码不一致
                  </p>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                  <button 
                    type="button"
                    @click="showEditModal = false"
                    class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    :disabled="changingPassword || passwordForm.newPassword !== passwordForm.confirmPassword"
                    class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
                  >
                    {{ changingPassword ? '修改中...' : '修改密码' }}
                  </button>
                </div>
              </form>

              <!-- 两步验证 -->
              <div v-else-if="editActiveTab === 'security'" key="security" class="space-y-5">
                <!-- 已启用状态 -->
                <div v-if="profile?.twoFactorEnabled" class="space-y-4">
                  <div class="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                    <i class="fa-solid fa-shield-check text-lg"></i>
                    <div>
                      <p class="text-sm font-medium">两步验证已启用</p>
                      <p class="text-xs opacity-75">登录时需要输入 Authenticator 验证码</p>
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-2">当前密码（确认关闭）</label>
                    <input
                      v-model="twoFaDisablePassword"
                      type="password"
                      autocomplete="current-password"
                      class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="输入密码以关闭两步验证"
                    />
                  </div>
                  <button
                    :disabled="!twoFaDisablePassword || twoFaLoading"
                    class="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
                    @click="handleDisable2FA"
                  >
                    {{ twoFaLoading ? '处理中...' : '关闭两步验证' }}
                  </button>
                </div>

                <!-- 未启用状态 -->
                <div v-else class="space-y-4">
                  <div class="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
                    <i class="fa-solid fa-shield-halved text-lg"></i>
                    <div>
                      <p class="text-sm font-medium">两步验证未启用</p>
                      <p class="text-xs opacity-75">启用后可大幅提升账号安全性</p>
                    </div>
                  </div>

                  <!-- 步骤一：扫码 -->
                  <div v-if="!twoFaSetupDone">
                    <p class="text-sm text-gray-500 mb-3">
                      1. 使用 Google Authenticator、Microsoft Authenticator 或其他 TOTP 应用扫描下方二维码
                    </p>
                    <div v-if="twoFaQr" class="flex flex-col items-center gap-2 mb-4">
                      <img :src="twoFaQr" alt="2FA QR Code" class="w-40 h-40 rounded-lg border dark:border-zinc-600" />
                      <p class="text-xs text-gray-400">无法扫码？手动输入密钥：</p>
                      <code class="text-xs bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded select-all">{{ twoFaSecret }}</code>
                    </div>
                    <button
                      v-if="!twoFaQr"
                      :disabled="twoFaLoading"
                      class="w-full py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition"
                      @click="handleSetup2FA"
                    >
                      {{ twoFaLoading ? '生成中...' : '获取二维码' }}
                    </button>

                    <!-- 步骤二：输入验证码 -->
                    <div v-if="twoFaQr" class="space-y-3">
                      <p class="text-sm text-gray-500">2. 输入 Authenticator 显示的 6 位验证码</p>
                      <input
                        v-model="twoFaCode"
                        type="text"
                        inputmode="numeric"
                        maxlength="6"
                        class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-center text-2xl tracking-widest font-mono"
                        placeholder="000000"
                      />
                      <button
                        :disabled="twoFaCode.length < 6 || twoFaLoading"
                        class="w-full py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition"
                        @click="handleEnable2FA"
                      >
                        {{ twoFaLoading ? '验证中...' : '验证并启用' }}
                      </button>
                    </div>
                  </div>

                  <!-- 启用成功 -->
                  <div v-else class="text-center py-4 text-green-600 dark:text-green-400">
                    <i class="fa-solid fa-circle-check text-3xl mb-2"></i>
                    <p class="font-medium">两步验证已成功启用！</p>
                    <p class="text-sm text-gray-500 mt-1">下次登录时将需要输入验证码</p>
                  </div>
                </div>
              </div>
              </Transition>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 粉丝列表弹窗 -->
    <Modal v-model="showFollowersModal" title="我的粉丝">
      <div v-if="followersLoading" class="text-center py-8">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
      </div>
      <div v-else-if="followersList.length" class="space-y-3 max-h-96 overflow-y-auto">
        <NuxtLink
          v-for="user in followersList"
          :key="user.id"
          :to="`/user/${user.id}`"
          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
          @click="showFollowersModal = false"
        >
          <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" />
            <i v-else class="fa-solid fa-user text-gray-400"></i>
          </div>
          <div>
            <div class="font-medium text-sm">{{ user.username }}</div>
            <div v-if="user.bio" class="text-xs text-gray-500 line-clamp-1">{{ user.bio }}</div>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="text-center text-gray-500 py-8">暂无粉丝</div>
    </Modal>

    <!-- 关注列表弹窗 -->
    <Modal v-model="showFollowingModal" title="我的关注">
      <div v-if="followingLoading" class="text-center py-8">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
      </div>
      <div v-else-if="followingList.length" class="space-y-3 max-h-96 overflow-y-auto">
        <NuxtLink
          v-for="user in followingList"
          :key="user.id"
          :to="`/user/${user.id}`"
          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
          @click="showFollowingModal = false"
        >
          <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" />
            <i v-else class="fa-solid fa-user text-gray-400"></i>
          </div>
          <div>
            <div class="font-medium text-sm">{{ user.username }}</div>
            <div v-if="user.bio" class="text-xs text-gray-500 line-clamp-1">{{ user.bio }}</div>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="text-center text-gray-500 py-8">暂无关注</div>
    </Modal>

    <!-- 头像裁剪器 -->
    <ImageCropper
      v-model="avatarCropperOpen"
      :image-file="avatarCropFile"
      :circle="true"
      :aspect-ratio="1"
      :output-width="400"
      @cropped="handleAvatarCropped"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  ListResponse,
  PendingReviewsResponse,
  ProfileResponse,
  UserCommentItem,
  UserFavoriteItem,
  UserSummary,
} from '~/types/api'

definePageMeta({
  middleware: 'require-auth',
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

// 获取个人信息
const { data: profile, refresh } = await useAuthFetch<ProfileResponse>('/api/user/profile', { key: 'user-profile' })

// 获取历史数据
const { data: comments } = await useAuthFetch<UserCommentItem[]>('/api/user/comments', { key: 'user-comments' })
const { data: favorites } = await useAuthFetch<UserFavoriteItem[]>('/api/user/favorites', { key: 'user-favorites' })

const favoriteFilters = [
  { value: '', label: '全部', icon: 'fa-solid fa-list' },
  { value: 'WISHLIST', label: '想玩', icon: 'fa-regular fa-bookmark' },
  { value: 'PLAYING', label: '在玩', icon: 'fa-solid fa-gamepad' },
  { value: 'COMPLETED', label: '玩过', icon: 'fa-solid fa-circle-check' },
  { value: 'ON_HOLD', label: '搁置', icon: 'fa-solid fa-pause' },
  { value: 'DROPPED', label: '抛弃', icon: 'fa-solid fa-ban' },
]
const favoriteStatusFilter = ref('')
const filteredFavorites = computed(() => {
  const list = favorites.value || []
  if (!favoriteStatusFilter.value) return list
  return list.filter(f => f.status === favoriteStatusFilter.value)
})
const { data: pendingItems } = await useAuthFetch<PendingReviewsResponse>('/api/user/pending-reviews', { key: 'user-pending-reviews' })

// 从URL获取初始tab
const route = useRoute()
const router = useRouter()
const initialTab = route.query.tab as string || 'comments'
const activeTab = ref(initialTab)

// 活动流数据（懒加载 + 服务端分页）
const activities = ref<any[]>([])
const activityLoading = ref(false)
const activityInitialized = ref(false)
const activityPage = ref(1)
const activityPagination = ref({ total: 0, totalPages: 0 })
const activityFilter = ref('')

const activityFilters = [
  { value: '', label: '全部', icon: 'fa-solid fa-list' },
  { value: 'CREATE_GAME', label: '创建', icon: 'fa-solid fa-plus' },
  { value: 'EDIT_GAME', label: '编辑', icon: 'fa-solid fa-pen' },
  { value: 'COMMENT', label: '评论', icon: 'fa-solid fa-comment' },
  { value: 'GUIDE', label: '攻略', icon: 'fa-solid fa-book' },
  { value: 'RATE_GAME', label: '评分', icon: 'fa-solid fa-star' },
  { value: 'FAVORITE_GAME', label: '收藏', icon: 'fa-solid fa-heart' },
]

async function loadActivities() {
  const userId = profile.value?.id
  if (!userId) return
  activityLoading.value = true
  try {
    const params: Record<string, unknown> = { page: activityPage.value, limit: 20 }
    const filterVal = activityFilter.value
    if (filterVal === 'GUIDE') {
      params.type = 'CREATE_GUIDE,EDIT_GUIDE'
    } else if (filterVal) {
      params.type = filterVal
    }
    const res = await authFetch<any>(`/api/activity/user/${userId}`, { params })
    activities.value = (res as any)?.items || []
    activityPagination.value = (res as any)?.pagination || { total: 0, totalPages: 0 }
  } catch {
    activities.value = []
  } finally {
    activityLoading.value = false
  }
}

function handleActivityPageChange(page: number) {
  activityPage.value = page
  loadActivities()
}

watch(activityFilter, () => {
  activityPage.value = 1
  if (activityInitialized.value) {
    loadActivities()
  }
})

watch(activeTab, (tab) => {
  if (tab === 'activity' && !activityInitialized.value) {
    activityInitialized.value = true
    loadActivities()
  }
}, { immediate: true })

function activityLabel(type: string) {
  const map: Record<string, string> = {
    CREATE_GAME: '创建了游戏',
    EDIT_GAME: '编辑了游戏',
    COMMENT: '评论了',
    CREATE_GUIDE: '发布了攻略',
    EDIT_GUIDE: '更新了攻略',
    RATE_GAME: '评分了',
    FAVORITE_GAME: '收藏了',
  }
  return map[type] || type
}

// 关注/粉丝弹窗
const showFollowersModal = ref(false)
const showFollowingModal = ref(false)
const followersList = ref<UserSummary[]>([])
const followingList = ref<UserSummary[]>([])
const followersLoading = ref(false)
const followingLoading = ref(false)

async function loadFollowers() {
  const userId = profile.value?.id
  if (!userId) return
  followersLoading.value = true
  try {
    const data = await $fetch<ListResponse<UserSummary>>(`/api/user/${userId}/followers`)
    followersList.value = data.items
  } catch {
    followersList.value = []
  } finally {
    followersLoading.value = false
  }
}

async function loadFollowing() {
  const userId = profile.value?.id
  if (!userId) return
  followingLoading.value = true
  try {
    const data = await $fetch<ListResponse<UserSummary>>(`/api/user/${userId}/following`)
    followingList.value = data.items
  } catch {
    followingList.value = []
  } finally {
    followingLoading.value = false
  }
}

watch(showFollowersModal, (val) => {
  if (val) loadFollowers()
})

watch(showFollowingModal, (val) => {
  if (val) loadFollowing()
})

// 2FA 状态
const twoFaQr = ref('')
const twoFaSecret = ref('')
const twoFaCode = ref('')
const twoFaLoading = ref(false)
const twoFaSetupDone = ref(false)
const twoFaDisablePassword = ref('')

async function handleSetup2FA() {
  twoFaLoading.value = true
  try {
    const res = await authFetch<any>('/api/user/2fa/setup', { method: 'POST' })
    twoFaQr.value = (res as any)?.qrDataUrl || ''
    twoFaSecret.value = (res as any)?.secret || ''
  } catch (e: any) {
    toast.error(e.data?.message || '获取二维码失败')
  } finally {
    twoFaLoading.value = false
  }
}

async function handleEnable2FA() {
  if (twoFaCode.value.length < 6) return
  twoFaLoading.value = true
  try {
    await authFetch('/api/user/2fa/enable', {
      method: 'POST',
      body: { code: twoFaCode.value },
    })
    twoFaSetupDone.value = true
    await refresh()
    toast.success('两步验证已启用')
  } catch (e: any) {
    toast.error(e.data?.message || '验证码错误')
    twoFaCode.value = ''
  } finally {
    twoFaLoading.value = false
  }
}

async function handleDisable2FA() {
  if (!twoFaDisablePassword.value) return
  twoFaLoading.value = true
  try {
    await authFetch('/api/user/2fa/disable', {
      method: 'POST',
      body: { password: twoFaDisablePassword.value },
    })
    twoFaDisablePassword.value = ''
    twoFaQr.value = ''
    twoFaSecret.value = ''
    twoFaSetupDone.value = false
    await refresh()
    toast.success('两步验证已关闭')
  } catch (e: any) {
    toast.error(e.data?.message || '密码错误')
  } finally {
    twoFaLoading.value = false
  }
}

const roleLabels: Record<string, string> = {
  ADMIN: '管理员',
  EDITOR: '编辑员',
  USER: '普通用户',
}

// 标签页
const tabs = [
  { key: 'comments', label: '我的评论', icon: 'fa-solid fa-comments' },
  { key: 'favorites', label: '我的收藏', icon: 'fa-solid fa-heart' },
  { key: 'activity', label: '我的动态', icon: 'fa-solid fa-bolt' },
  { key: 'pending', label: '待审核', icon: 'fa-solid fa-clock' },
]

// 监听activeTab变化，更新URL
watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } })
})

// 编辑表单
const showEditModal = ref(false)
const editActiveTab = ref('profile')
const editTabs = [
  { key: 'profile', label: '基本信息', icon: 'fa-solid fa-user' },
  { key: 'email', label: '换绑邮箱', icon: 'fa-solid fa-envelope' },
  { key: 'password', label: '修改密码', icon: 'fa-solid fa-lock' },
  { key: 'security', label: '两步验证', icon: 'fa-solid fa-shield-halved' },
]

const editForm = reactive({
  username: profile.value?.username || '',
  bio: profile.value?.bio || '',
  emailNotify: profile.value?.emailNotify ?? true,
})

const emailForm = reactive({
  newEmail: '',
  code: '',
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const updating = ref(false)
const uploadingAvatar = ref(false)
const avatarInputRef = ref<HTMLInputElement | null>(null)
const avatarCropperOpen = ref(false)
const avatarCropFile = ref<File | null>(null)
const sendingCode = ref(false)
const emailCodeCooldown = ref(0)
const changingEmail = ref(false)
const changingPassword = ref(false)

const notificationTypes = [
  { key: 'COMMENT_REPLY', label: '评论回复', desc: '有人回复了你的评论' },
  { key: 'COMMENT_LIKE', label: '评论点赞', desc: '有人赞了你的评论' },
  { key: 'MENTION', label: '@提及', desc: '有人在评论中提到了你' },
  { key: 'RESOURCE_APPROVED', label: '资源审核通过', desc: '你提交的资源通过审核' },
  { key: 'RESOURCE_REJECTED', label: '资源审核驳回', desc: '你提交的资源未通过审核' },
  { key: 'RESOURCE_HEALTH', label: '资源可用性', desc: '你上传的资源收到反馈或处理结果' },
  { key: 'EDIT_APPROVED', label: '编辑请求通过', desc: '你的条目编辑请求通过审核' },
  { key: 'EDIT_REJECTED', label: '编辑请求驳回', desc: '你的条目编辑请求未通过审核' },
  { key: 'FOLLOWING_ACTIVITY', label: '关注动态', desc: '你关注的用户有新动态' },
  { key: 'FAVORITE_GAME_UPDATE', label: '收藏条目更新', desc: '你收藏的游戏条目有更新' },
  { key: 'SYSTEM', label: '系统通知', desc: '系统公告和管理通知' },
] as const

const notifPrefs = reactive<Record<string, boolean>>({
  COMMENT_REPLY: true,
  COMMENT_LIKE: true,
  MENTION: true,
  RESOURCE_APPROVED: true,
  RESOURCE_REJECTED: true,
  RESOURCE_HEALTH: true,
  EDIT_APPROVED: true,
  EDIT_REJECTED: true,
  FOLLOWING_ACTIVITY: true,
  FAVORITE_GAME_UPDATE: true,
  SYSTEM: true,
})

// 加载通知偏好
async function loadNotifPrefs() {
  try {
    const data = await authFetch<{ preferences: Record<string, boolean> }>('/api/user/notification-preferences')
    if (data?.preferences) {
      Object.assign(notifPrefs, data.preferences)
    }
  } catch {}
}

loadNotifPrefs()

function triggerAvatarUpload() {
  avatarInputRef.value?.click()
}

async function handleAvatarUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.error('请选择图片文件')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    toast.error('图片大小不能超过 5MB')
    return
  }

  // 打开裁剪器
  avatarCropFile.value = file
  avatarCropperOpen.value = true
  // 重置 input
  if (avatarInputRef.value) {
    avatarInputRef.value.value = ''
  }
}

async function handleAvatarCropped(blob: Blob) {
  uploadingAvatar.value = true
  try {
    const formData = new FormData()
    formData.append('file', blob, 'avatar.webp')
    formData.append('type', 'avatar')

    const result = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
    })

    await authFetch('/api/user/profile', {
      method: 'PUT',
      body: { avatar: result.url },
    })

    await refresh()
    toast.success('头像更新成功')
  } catch (error: any) {
    toast.error(error.data?.message || '上传失败')
  } finally {
    uploadingAvatar.value = false
    avatarCropFile.value = null
  }
}

watch(profile, (val) => {
  if (val) {
    editForm.username = val.username
    editForm.bio = val.bio || ''
    editForm.emailNotify = val.emailNotify ?? true
  }
})

async function handleUpdateProfile() {
  updating.value = true
  try {
    await authFetch('/api/user/profile', {
      method: 'PUT',
      body: {
        username: editForm.username,
        bio: editForm.bio,
        emailNotify: editForm.emailNotify,
      },
    })
    // 保存通知偏好
    await authFetch('/api/user/notification-preferences', {
      method: 'PUT',
      body: {
        preferences: { ...notifPrefs },
      },
    })
    await refresh()
    showEditModal.value = false
    toast.success('保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    updating.value = false
  }
}

// 发送邮箱验证码
async function sendEmailCode() {
  if (!emailForm.newEmail || sendingCode.value || emailCodeCooldown.value > 0) return
  
  sendingCode.value = true
  try {
    await authFetch('/api/user/email/send-code', {
      method: 'POST',
      body: { email: emailForm.newEmail },
    })
    toast.success('验证码已发送')
    emailCodeCooldown.value = 60
    const timer = setInterval(() => {
      emailCodeCooldown.value--
      if (emailCodeCooldown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (error: any) {
    toast.error(error.data?.message || '发送失败')
  } finally {
    sendingCode.value = false
  }
}

// 更换邮箱
async function handleChangeEmail() {
  if (!emailForm.newEmail || !emailForm.code) return
  
  changingEmail.value = true
  try {
    await authFetch('/api/user/email/change', {
      method: 'POST',
      body: {
        email: emailForm.newEmail,
        code: emailForm.code,
      },
    })
    await refresh()
    showEditModal.value = false
    emailForm.newEmail = ''
    emailForm.code = ''
    toast.success('邮箱更换成功')
  } catch (error: any) {
    toast.error(error.data?.message || '更换失败')
  } finally {
    changingEmail.value = false
  }
}

// 修改密码
async function handleChangePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    toast.error('两次输入的密码不一致')
    return
  }
  
  changingPassword.value = true
  try {
    await authFetch('/api/user/password/change', {
      method: 'POST',
      body: {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      },
    })
    showEditModal.value = false
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    toast.success('密码修改成功')
  } catch (error: any) {
    toast.error(error.data?.message || '修改失败')
  } finally {
    changingPassword.value = false
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `个人中心 - ${siteName.value}`),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<style scoped>
</style>
