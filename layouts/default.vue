<template>
  <div :class="['text-gray-800 dark:text-gray-100 min-h-screen relative', bgSettings.enabled && bgSettings.imageUrl ? 'bg-transparent' : 'bg-gray-100 dark:bg-zinc-900']">
    <!-- 页面跳转进度条 -->
    <AppLoadingBar />

    <!-- 背景图层 -->
    <div 
      id="bg-layer"
      class="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
      style="display: none;"
    ></div>
    
    <!-- 浮动顶栏 -->
    <header class="fixed top-0 md:top-4 inset-x-0 z-50 pointer-events-none max-w-full overflow-x-clip">
      <div class="w-screen max-w-full md:max-w-6xl md:mx-auto px-0 md:px-4 pointer-events-auto">
        <div class="w-full bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl md:rounded-2xl shadow-lg border-b md:border border-gray-200/40 dark:border-zinc-700/40 overflow-visible">
          <div class="flex items-center justify-between px-4 md:px-6 h-14 overflow-visible min-w-0">
            <!-- 左侧 -->
            <div class="flex items-center gap-3 md:gap-8 overflow-visible min-w-0">
              <!-- 移动端菜单按钮 -->
              <button 
                @click="showMobileMenu = !showMobileMenu"
                class="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                <i :class="showMobileMenu ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
              </button>
              <NuxtLink to="/" class="text-lg font-semibold tracking-wide truncate max-w-[52vw] md:max-w-none">
                {{ siteName }}
              </NuxtLink>
              <nav
                ref="navRef"
                class="hidden md:flex items-center text-sm text-gray-600 dark:text-gray-300 min-w-0 max-w-full overflow-hidden transition-opacity duration-150"
                :class="navReady ? 'opacity-100' : 'opacity-0'"
              >
                <div class="flex items-center gap-6 min-w-0">
                  <template v-for="link in visibleNavLinks" :key="link.id">
                    <NuxtLink
                      :to="link.to"
                      :class="[link.isBuiltin === false ? 'nav-rainbow-link' : 'hover:text-gray-900 dark:hover:text-white', 'whitespace-nowrap']"
                      active-class="text-gray-900 dark:text-white font-medium"
                    >{{ link.label }}</NuxtLink>
                  </template>
                  <NavMenuAds v-if="visibleNavLinks.length && navMenuAds.length" :ads="navMenuAds" />
                </div>
              </nav>
              <!-- 溢出导航按钮：放在 nav 外部避免被 overflow-hidden 裁切 -->
            </div>

            <!-- 右侧 -->
            <div class="flex items-center gap-1 md:gap-1.5 shrink-0">
              <!-- 动态图标按钮 -->
              <template v-for="btn in visibleIconButtons" :key="btn.id">
                <div v-if="btn.action === 'randomGame'" class="relative group/random">
                  <button 
                    @click="goRandomGame"
                    class="header-icon-btn hidden md:flex"
                    :disabled="randomLoading"
                  >
                    <i :class="randomLoading ? 'fa-solid fa-spinner fa-spin' : btn.icon"></i>
                  </button>
                  <div class="header-tooltip hidden md:block">{{ btn.label }}</div>
                </div>
                <div v-else-if="btn.action === 'search'" class="relative group/search">
                  <button 
                    @click="showSearchModal = true"
                    class="header-icon-btn"
                  >
                    <i :class="btn.icon"></i>
                  </button>
                  <div class="header-tooltip">{{ btn.label }}</div>
                </div>
                <div 
                  v-else-if="btn.action === 'settings'"
                  class="relative group/settings" 
                  ref="settingsMenuRef"
                >
                  <button 
                    @click.stop="showSettingsMenu = !showSettingsMenu" 
                    class="header-icon-btn"
                  >
                    <i :class="btn.icon"></i>
                  </button>
                  <div class="header-tooltip">{{ btn.label }}</div>
                  <Transition name="dropdown">
                    <div 
                      v-if="showSettingsMenu"
                      class="fixed md:absolute inset-x-3 md:inset-x-auto md:right-0 mt-2 md:w-72 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border dark:border-zinc-700 p-1 z-[9999] origin-top-right"
                      @click.stop
                    >
                      <div class="px-2 py-1.5 text-base font-semibold">网站设置</div>
                      <div class="-mx-1 my-1 h-px bg-gray-200 dark:bg-zinc-700"></div>
                      
                      <div class="px-2 py-3">
                        <div class="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          <i class="fa-solid fa-sun w-3.5 text-center"></i>
                          <span>主题模式</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                          <button 
                            @click="setColorMode('light')"
                            class="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-center transition"
                            :class="colorMode.preference === 'light' 
                              ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
                              : 'bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                          >
                            <i class="fa-solid fa-sun block"></i>
                            <span class="text-[10px] block w-full text-center">浅色主题</span>
                          </button>
                          <button 
                            @click="setColorMode('dark')"
                            class="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-center transition"
                            :class="colorMode.preference === 'dark' 
                              ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
                              : 'bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                          >
                            <i class="fa-solid fa-moon block"></i>
                            <span class="text-[10px] block w-full text-center">深色主题</span>
                          </button>
                          <button 
                            @click="setColorMode('system')"
                            class="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-center transition"
                            :class="colorMode.preference === 'system' 
                              ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
                              : 'bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                          >
                            <i class="fa-solid fa-circle-half-stroke block"></i>
                            <span class="text-[10px] block w-full text-center">跟随系统</span>
                          </button>
                        </div>
                      </div>
                      
                      <div v-if="isLoggedIn" class="-mx-1 my-1 h-px bg-gray-200 dark:bg-zinc-700"></div>
                      
                      <div v-if="isLoggedIn" class="px-2 py-3">
                        <div class="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          <i class="fa-solid fa-shield-halved w-3.5 text-center"></i>
                          <span>内容过滤</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                          <button 
                            @click="setNsfwMode('SFW')"
                            class="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-center transition"
                            :class="nsfwMode === 'SFW' 
                              ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
                              : 'bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                          >
                            <i class="fa-solid fa-shield-halved block"></i>
                            <span class="text-[10px] block w-full text-center">SFW</span>
                          </button>
                          <button 
                            @click="setNsfwMode('NSFW')"
                            class="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-center transition"
                            :class="nsfwMode === 'NSFW' 
                              ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
                              : 'bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                          >
                            <i class="fa-solid fa-ban block"></i>
                            <span class="text-[10px] block w-full text-center">NSFW</span>
                          </button>
                          <button 
                            @click="setNsfwMode('ALL')"
                            class="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-center transition"
                            :class="nsfwMode === 'ALL' 
                              ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
                              : 'bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                          >
                            <i class="fa-solid fa-circle-minus block"></i>
                            <span class="text-[10px] block w-full text-center">全部</span>
                          </button>
                        </div>
                      </div>
                      
                      <div class="-mx-1 my-1 h-px bg-gray-200 dark:bg-zinc-700"></div>
                      
                      <div class="px-2 py-2 space-y-1">
                        <div 
                          class="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer transition"
                          @click="toggleOpenInNewTab"
                        >
                          <div class="flex items-center gap-2.5">
                            <i class="fa-solid fa-external-link w-4 text-center text-gray-400"></i>
                            <span class="text-sm">新窗口打开游戏</span>
                          </div>
                          <div 
                            class="relative w-8 h-5 rounded-full transition-colors flex items-center"
                            :class="openInNewTab ? 'bg-gray-800 dark:bg-zinc-500' : 'bg-gray-300 dark:bg-zinc-600'"
                          >
                            <div 
                              class="absolute w-4 h-4 rounded-full bg-white shadow transition-transform"
                              :class="openInNewTab ? 'translate-x-3.5' : 'translate-x-0.5'"
                            ></div>
                          </div>
                        </div>
                        
                        <div 
                          class="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer transition"
                          @click="openBgSettings()"
                        >
                          <div class="flex items-center gap-2.5">
                            <i class="fa-solid fa-image w-4 text-center text-gray-400"></i>
                            <span class="text-sm">背景图片设置</span>
                          </div>
                          <i class="fa-solid fa-chevron-right text-gray-400 text-xs"></i>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
                <template v-else-if="btn.action.startsWith('http')">
                  <ClientOnly v-if="btn.requireAuth">
                    <div v-if="isLoggedIn" class="relative group/iconbtn">
                      <a :href="btn.action" target="_blank" rel="noopener noreferrer" class="header-icon-btn">
                        <i :class="btn.icon"></i>
                      </a>
                      <div class="header-tooltip">{{ btn.label }}</div>
                    </div>
                  </ClientOnly>
                  <div v-else class="relative group/iconbtn">
                    <a :href="btn.action" target="_blank" rel="noopener noreferrer" class="header-icon-btn">
                      <i :class="btn.icon"></i>
                    </a>
                    <div class="header-tooltip">{{ btn.label }}</div>
                  </div>
                </template>
                <template v-else>
                  <ClientOnly v-if="btn.requireAuth">
                    <div v-if="isLoggedIn" class="relative group/iconbtn">
                      <NuxtLink :to="btn.action" class="header-icon-btn">
                        <i :class="btn.icon"></i>
                      </NuxtLink>
                      <div class="header-tooltip">{{ btn.label }}</div>
                    </div>
                  </ClientOnly>
                  <div v-else class="relative group/iconbtn">
                    <NuxtLink :to="btn.action" class="header-icon-btn">
                      <i :class="btn.icon"></i>
                    </NuxtLink>
                    <div class="header-tooltip">{{ btn.label }}</div>
                  </div>
                </template>
              </template>

              <ClientOnly>
                <!-- 通知中心 -->
                <div v-if="isLoggedIn" class="relative group/bell hidden md:block">
                  <NuxtLink to="/messages" class="header-icon-btn relative">
                    <i class="fa-solid fa-bell"></i>
                    <span v-if="unreadCount > 0" class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  </NuxtLink>
                  <div class="header-tooltip">通知中心</div>
                </div>

                <!-- 用户菜单 -->
                <div v-if="isLoggedIn" class="relative" ref="userMenuRef">
                  <button 
                    @click="showUserMenu = !showUserMenu"
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors duration-200"
                  >
                    <div class="relative w-7 h-7 shrink-0">
                      <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-600 flex items-center justify-center overflow-hidden">
                        <img
                          v-if="user?.avatar && !avatarBroken"
                          :src="user.avatar"
                          class="w-full h-full object-cover"
                          @error="avatarBroken = true"
                        />
                        <i v-else class="fa-solid fa-user text-xs text-gray-500"></i>
                      </div>
                      <span
                        v-if="privateUnreadCount > 0"
                        class="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-800"
                      ></span>
                    </div>
                    <span class="text-sm hidden sm:inline">{{ user?.username }}</span>
                  </button>
                  
                  <!-- 下拉菜单 -->
                  <Transition name="dropdown">
                    <div 
                      v-if="showUserMenu"
                      class="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 py-2 z-50 origin-top-right"
                    >
                    <NuxtLink 
                      to="/messages" 
                      class="md:hidden flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                      @click="showUserMenu = false"
                    >
                      <i class="fa-solid fa-bell w-4"></i>
                      通知中心
                      <span v-if="unreadCount > 0" class="ml-auto px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">{{ unreadCount }}</span>
                    </NuxtLink>
                    <NuxtLink
                      to="/private-messages"
                      class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                      @click="showUserMenu = false"
                    >
                      <i class="fa-solid fa-message w-4"></i>私信
                      <span v-if="privateUnreadCount > 0" class="ml-auto w-2 h-2 bg-red-500 rounded-full"></span>
                    </NuxtLink>
                    <button
                      class="md:hidden flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 w-full text-left"
                      :disabled="randomLoading"
                      @click="goRandomGameFromUserMenu"
                    >
                      <i :class="[randomLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-dice', 'w-4']"></i>随机游戏
                    </button>
                    <hr class="md:hidden my-2 border-gray-200 dark:border-zinc-700" />
                    <NuxtLink 
                      to="/profile" 
                      class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                      @click="showUserMenu = false"
                    >
                      <i class="fa-solid fa-user w-4"></i>个人中心
                    </NuxtLink>
                    <NuxtLink 
                      to="/profile?tab=favorites" 
                      class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                      @click="showUserMenu = false"
                    >
                      <i class="fa-solid fa-heart w-4"></i>我的收藏
                    </NuxtLink>
                    <NuxtLink 
                      v-if="user?.role === 'ADMIN'"
                      to="/admin" 
                      class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                      @click="showUserMenu = false"
                    >
                      <i class="fa-solid fa-gear w-4"></i>管理后台
                    </NuxtLink>
                    <hr class="my-2 border-gray-200 dark:border-zinc-700" />
                    <button 
                      @click="handleLogout"
                      class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 w-full text-left text-red-500"
                    >
                      <i class="fa-solid fa-right-from-bracket w-4"></i>退出登录
                    </button>
                    </div>
                  </Transition>
                </div>

                <!-- 登录按钮 -->
                <NuxtLink 
                  v-else
                  to="/login"
                  class="px-2 md:px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-1.5"
                >
                  <i class="fa-solid fa-user"></i><span class="hidden sm:inline">登录</span>
                </NuxtLink>

                <template #fallback>
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center">
                    <i class="fa-solid fa-user text-sm text-gray-400"></i>
                  </div>
                </template>
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 移动端导航菜单 -->
    <Teleport to="body">
      <Transition name="slide-menu">
        <div 
          v-if="showMobileMenu"
          class="fixed inset-x-0 top-14 bottom-0 z-[60] md:hidden"
        >
          <div class="absolute inset-0 bg-black/50" @click="showMobileMenu = false"></div>
          <div class="absolute left-0 top-0 bottom-0 w-64 max-w-[85vw] bg-white dark:bg-zinc-800 shadow-xl overflow-y-auto">
            <nav class="p-4 space-y-1">
              <template v-for="link in visibleNavLinks" :key="link.id">
                <NuxtLink 
                  :to="link.to" 
                  class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                  @click="showMobileMenu = false"
                >
                  <i :class="[link.icon, 'w-5 text-center text-gray-400']"></i>{{ link.label }}
                </NuxtLink>
              </template>
              <div class="mobile-menu-ad-list w-full">
                <NavMenuAds v-if="visibleNavLinks.length" mobile :ads="navMenuAds" />
              </div>
              
              <div class="my-4 border-t dark:border-zinc-700"></div>
              
              <!-- 移动端用户菜单 -->
              <ClientOnly>
              <template v-if="isLoggedIn">
                <NuxtLink 
                  to="/profile" 
                  class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                  @click="showMobileMenu = false"
                >
                  <i class="fa-solid fa-user w-5 text-center text-gray-400"></i>个人中心
                </NuxtLink>
                <NuxtLink 
                  v-if="user?.role === 'ADMIN'"
                  to="/admin" 
                  class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                  @click="showMobileMenu = false"
                >
                  <i class="fa-solid fa-gear w-5 text-center text-gray-400"></i>管理后台
                </NuxtLink>
                <button 
                  @click="handleLogout(); showMobileMenu = false"
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <i class="fa-solid fa-right-from-bracket w-5 text-center"></i>退出登录
                </button>
              </template>
              <template v-else>
                <NuxtLink 
                  to="/login" 
                  class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                  @click="showMobileMenu = false"
                >
                  <i class="fa-solid fa-right-to-bracket w-5 text-center text-gray-400"></i>登录
                </NuxtLink>
                <NuxtLink 
                  to="/register" 
                  class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                  @click="showMobileMenu = false"
                >
                  <i class="fa-solid fa-user-plus w-5 text-center text-gray-400"></i>注册
                </NuxtLink>
              </template>
              </ClientOnly>
            </nav>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 主内容 -->
    <main class="pt-20 md:pt-24 pb-12 min-h-screen relative z-10">
      <AdBanner v-if="$route.path === '/'" ad-slot="home_header_strip" class="mb-4 md:mb-5" />
      <slot />
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-gray-200 dark:border-zinc-800 py-6">
      <div class="max-w-7xl mx-auto px-4 md:px-6">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <!-- 左侧：网站名称 + Favicon -->
          <div class="flex items-center gap-2">
            <img 
              v-if="favicon" 
              :src="favicon" 
              alt="favicon" 
              class="w-4 h-4"
            />
            <ClientOnly><span>© {{ currentYear }} {{ siteName }}</span></ClientOnly>
          </div>
          
          <!-- 右侧：可配置链接 -->
          <div v-if="visibleFooterLinks.length" class="flex items-center gap-4">
            <template v-for="link in visibleFooterLinks" :key="link.id">
              <ClientOnly v-if="link.requireAuth">
                <a
                  v-if="isLoggedIn"
                  :href="link.url"
                  :target="link.openInNewTab ? '_blank' : '_self'"
                  rel="noopener noreferrer"
                  class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                  <i v-if="link.icon" :class="link.icon"></i>
                  <span>{{ link.label }}</span>
                </a>
              </ClientOnly>
              <a
                v-else
                :href="link.url"
                :target="link.openInNewTab ? '_blank' : '_self'"
                rel="noopener noreferrer"
                class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition"
              >
                <i v-if="link.icon" :class="link.icon"></i>
                <span>{{ link.label }}</span>
              </a>
            </template>
          </div>
        </div>
        
        <!-- 自定义页脚 HTML -->
        <SafeHtml v-if="customFooterHtml" class="mt-4 text-center text-xs text-gray-500" :content="customFooterHtml" />
      </div>
    </footer>

    <!-- 返回顶部按钮 -->
    <Transition name="fade">
      <button 
        v-if="showScrollTop"
        @click="scrollToTop"
        class="fixed right-4 md:right-6 bottom-4 md:bottom-6 w-10 md:w-11 h-10 md:h-11 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-gray-200 dark:border-zinc-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all hover:scale-110 z-40"
        title="返回顶部"
      >
        <i class="fa-solid fa-arrow-up text-gray-600 dark:text-gray-300"></i>
      </button>
    </Transition>

    <!-- Toast 通知 -->
    <ToastContainer />

    <!-- 搜索弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showSearchModal"
          class="fixed inset-0 z-[100] flex items-start justify-center pt-4 md:pt-20 p-4 bg-black/60"
          @click.self="showSearchModal = false"
        >
          <div class="relative">
            <!-- 主搜索弹窗 - 位置固定不变，z-10 让它在热门面板上层 -->
            <div
              class="relative z-10 bg-white dark:bg-zinc-800 shadow-2xl w-[calc(100vw-2rem)] md:w-[672px] min-h-[60vh] max-h-[85vh] overflow-hidden modal-content flex flex-col transition-[border-radius] duration-300"
              :class="showTrendingPanel ? 'rounded-2xl md:rounded-r-none' : 'rounded-2xl'"
            >
            <!-- 搜索类型切换 -->
            <div class="relative flex border-b dark:border-zinc-700">
              <!-- 滑动指示条 -->
              <div 
                class="absolute bottom-0 h-0.5 bg-gray-800 dark:bg-white transition-all duration-300 ease-out"
                :style="{
                  width: searchType === 'image' ? '33.333%' : '33.333%',
                  left: searchType === 'game' ? '0%' : searchType === 'company' ? '33.333%' : '66.666%'
                }"
              ></div>
              <button 
                @click="searchType = 'game'"
                class="flex-1 px-4 py-3 text-sm font-medium transition relative z-10"
                :class="searchType === 'game' 
                  ? 'text-gray-900 dark:text-white' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
              >
                <i class="fa-solid fa-gamepad mr-1.5"></i>搜索游戏
              </button>
              <button 
                @click="searchType = 'company'"
                class="flex-1 px-4 py-3 text-sm font-medium transition relative z-10"
                :class="searchType === 'company' 
                  ? 'text-gray-900 dark:text-white' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
              >
                <i class="fa-solid fa-building mr-1.5"></i>搜索会社
              </button>
              <button 
                @click="searchType = 'image'"
                class="flex-1 px-4 py-3 text-sm font-medium transition relative z-10"
                :class="searchType === 'image' 
                  ? 'text-gray-900 dark:text-white' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
              >
                <i class="fa-solid fa-image mr-1.5"></i>图片搜索
              </button>
            </div>
            
            <!-- 搜索输入框 -->
            <div v-if="searchType !== 'image'" class="p-3 md:p-4">
              <div class="relative">
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  type="text"
                  :placeholder="searchType === 'game' ? '游戏名称 / VNDB ID (v123) / Bangumi ID (bg123)' : '输入会社名称...'"
                  class="w-full px-4 py-3 pl-11 pr-12 rounded-xl bg-gray-100 dark:bg-zinc-700 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
                  @keyup.enter="handleSearch"
                  @input="handleSearchInput"
                />
                <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    v-if="searchQuery"
                    @click="searchQuery = ''; searchSuggestions = []"
                    class="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                  <button
                    @click="showTrendingPanel = !showTrendingPanel"
                    class="hidden md:block p-1 text-gray-400 hover:text-gray-600 transition-transform duration-300"
                    :class="{ 'rotate-180': showTrendingPanel }"
                    title="本月热门"
                  >
                    <i class="fa-solid fa-chevron-left"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- 图片搜索界面 -->
            <div v-else class="p-3 md:p-4">
              <div 
                class="border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-zinc-500 transition"
                @click="triggerImageInput"
                @dragover.prevent
                @drop.prevent="handleImageDrop"
              >
                <div v-if="!imageSearching && !imagePreview">
                  <i class="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-3"></i>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">点击或拖拽图片到此处</p>
                  <p class="text-xs text-gray-400">支持 JPG、PNG、GIF、WebP，最大 10MB</p>
                </div>
                <div v-else-if="imageSearching" class="py-4">
                  <i class="fa-solid fa-spinner fa-spin text-3xl text-gray-400 mb-3"></i>
                  <p class="text-sm text-gray-500">识别中...</p>
                </div>
                <div v-else-if="imagePreview">
                  <img :src="imagePreview" class="max-h-48 mx-auto rounded mb-3" />
                  <p class="text-xs text-gray-500">点击重新选择图片</p>
                </div>
              </div>
              <input
                ref="imageInputRef"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                class="hidden"
                @change="handleImageSelect"
              />
              
              <!-- 识别结果 -->
              <div v-if="imageRecognizedGames.length" class="mt-4">
                <!-- 识别到的游戏名称 -->
                <div class="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div class="flex items-start gap-2">
                    <i class="fa-solid fa-info-circle text-blue-500 mt-0.5"></i>
                    <div class="flex-1 text-sm text-blue-700 dark:text-blue-300">
                      <div class="font-medium mb-1">图片疑似游戏为：</div>
                      <div class="space-y-1">
                        <div v-for="(gameName, index) in imageRecognizedGames" :key="index" class="text-xs">
                          {{ gameName }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 数据库中找到的游戏 -->
                <div v-if="imageSearchResults.length" class="space-y-2">
                  <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">站内匹配结果</div>
                  <NuxtLink
                    v-for="result in imageSearchResults"
                    :key="result.id"
                    :to="`/games/${result.id}`"
                    class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition border dark:border-zinc-700"
                    @click="showSearchModal = false; imageSearchResults = []; imageRecognizedGames = []"
                  >
                    <img 
                      v-if="result.coverImage"
                      :src="result.coverImage" 
                      class="w-10 h-14 rounded object-cover flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate">{{ result.title }}</div>
                      <div class="text-xs text-gray-500 mt-0.5">
                        相似度: {{ result.similarity }}%
                      </div>
                    </div>
                  </NuxtLink>
                </div>
                
                <!-- 未在数据库中找到 -->
                <div v-else class="text-xs text-gray-500 dark:text-gray-400 italic">
                  站内暂无此游戏
                </div>
              </div>
              
              <!-- 错误提示 -->
              <div v-if="imageSearchError" class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <i class="fa-solid fa-exclamation-circle text-red-500 mt-0.5"></i>
                  <div class="flex-1 text-sm text-red-700 dark:text-red-300">{{ imageSearchError }}</div>
                </div>
              </div>
            </div>

            <!-- 搜索建议 -->
            <div v-if="searchSuggestions.length && searchType !== 'image'" class="px-3 md:px-4 pb-3 flex-1 overflow-y-auto">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">搜索建议</div>
              <div class="space-y-1">
                <NuxtLink
                  v-for="suggestion in searchSuggestions"
                  :key="suggestion.id"
                  :to="`/games/${suggestion.id}`"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                  @click="showSearchModal = false; searchSuggestions = []"
                >
                  <img 
                    v-if="suggestion.coverImage"
                    :src="suggestion.coverImage" 
                    class="w-8 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div 
                    v-else
                    class="w-8 h-10 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0"
                  >
                    <i class="fa-solid fa-gamepad text-xs text-gray-400 dark:text-zinc-500"></i>
                  </div>
                  <span class="text-sm truncate">{{ suggestion.title }}</span>
                </NuxtLink>
              </div>
            </div>
            
            <!-- 搜索历史 -->
            <div v-if="searchHistory.length && !searchQuery" class="px-3 md:px-4 pb-3 md:pb-4">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                <span class="flex items-center gap-1">
                  <i class="fa-solid fa-clock-rotate-left text-gray-400"></i>
                  <span>搜索历史</span>
                </span>
                <button 
                  @click="clearSearchHistory"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  清除
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <button 
                  v-for="(term, index) in searchHistory" 
                  :key="index"
                  @click="handleHistorySearch(term)"
                  class="group max-w-[200px] px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600 transition flex items-center gap-1.5"
                >
                  <span class="truncate">{{ term }}</span>
                  <i 
                    class="fa-solid fa-xmark text-xs text-gray-400 hover:text-red-500 transition"
                    @click.stop="removeHistoryItem(index)"
                  ></i>
                </button>
              </div>
            </div>
            
            <!-- 热门搜索 -->
            <div v-if="hotSearches?.length" class="px-3 md:px-4 pb-3 md:pb-4">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                <i class="fa-solid fa-fire text-gray-400"></i>
                <span class="dark:text-gray-400">热门搜索</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <button 
                  v-for="(term, index) in hotSearches" 
                  :key="index"
                  @click="handleHotSearch(term)"
                  class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600 transition"
                >
                  {{ term }}
                </button>
              </div>
            </div>
            
            <!-- 快捷键提示 - 固定在弹窗底部 -->
            <div class="hidden md:flex mt-auto px-4 py-3 text-xs text-gray-400 items-center gap-4 border-t border-gray-200 dark:border-zinc-700">
              <span><kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-xs">Enter</kbd> 搜索</span>
              <span><kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-xs">Esc</kbd> 关闭</span>
            </div>
            </div>

            <!-- 右侧：本月热门推荐 - 绝对定位在搜索弹窗右侧，弹窗位置不变 -->
            <Transition name="slide-panel">
              <div v-if="showTrendingPanel" class="hidden md:flex md:flex-col absolute left-full top-0 bottom-0 w-80 border-l dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-r-2xl shadow-2xl overflow-hidden">
                <div class="px-3 py-2.5 border-b dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <i class="fa-solid fa-fire text-orange-500"></i>
                      <h3 class="font-semibold text-sm">本月热门</h3>
                    </div>
                    <button
                      @click="showTrendingPanel = false"
                      class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 hover:text-gray-600 transition"
                    >
                      <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </div>
                </div>
              
              <div class="flex-1 overflow-hidden px-2.5 py-2">
                <div v-if="trendingGames.length" class="flex flex-col h-full">
                  <NuxtLink
                    v-for="(game, index) in trendingGames"
                    :key="game.id"
                    :to="`/games/${game.id}`"
                    class="flex-1 flex gap-2.5 px-1.5 items-center rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition group"
                    @click="showSearchModal = false"
                  >
                    <!-- 排名 -->
                    <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                      <span 
                        class="text-sm font-bold"
                        :class="{
                          'text-yellow-500': index === 0,
                          'text-gray-400': index === 1,
                          'text-orange-600': index === 2,
                          'text-gray-500': index > 2,
                        }"
                      >
                        {{ index + 1 }}
                      </span>
                    </div>
                    
                    <!-- 封面 -->
                    <div class="flex-shrink-0">
                      <img
                        v-if="game.coverImage"
                        :src="game.coverImage"
                        class="w-11 h-14 rounded object-cover"
                        loading="lazy"
                      />
                      <div 
                        v-else
                        class="w-11 h-14 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center"
                      >
                        <i class="fa-solid fa-gamepad text-xs text-gray-400"></i>
                      </div>
                    </div>
                    
                    <!-- 信息 -->
                    <div class="flex-1 min-w-0">
                      <div class="text-[13px] font-medium line-clamp-2 leading-snug group-hover:text-gray-900 dark:group-hover:text-white transition">
                        {{ game.title }}
                      </div>
                      <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        <span v-if="game.year">{{ game.year }}</span>
                        <span v-if="game.year && game.company">·</span>
                        <span v-if="game.company" class="truncate">{{ game.company.name }}</span>
                      </div>
                      <div class="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                        <i class="fa-solid fa-eye"></i>
                        <span>{{ formatViewCount(game.viewCount) }}</span>
                      </div>
                    </div>
                  </NuxtLink>
                </div>
                
                <div v-else class="text-center py-8 text-gray-400 text-sm">
                  <i class="fa-solid fa-spinner fa-spin mb-2"></i>
                  <p>加载中...</p>
                </div>
              </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 全局弹窗公告 -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showGlobalAnnouncement"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          @click.self="closeGlobalAnnouncement"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden modal-content">
            <div class="px-6 py-5 border-b dark:border-zinc-700">
              <h3 class="text-lg font-semibold dark:text-gray-100">{{ globalAnnouncement?.title || '公告' }}</h3>
            </div>
            <div class="px-6 py-5">
              <SafeHtml 
                class="text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
                :content="globalAnnouncement?.content || ''"
              />
            </div>
            <div class="px-6 py-4 bg-gray-50 dark:bg-zinc-700/50">
              <button 
                @click="closeGlobalAnnouncement"
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
              >
                {{ globalAnnouncement?.buttonText || '我知道了' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 背景设置弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showBgSettingsModal"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          @click.self="showBgSettingsModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden modal-content">
            <div class="px-6 py-4 border-b dark:border-zinc-700 flex items-center justify-between">
              <h3 class="text-lg font-semibold dark:text-gray-100">背景图片设置</h3>
              <button @click="showBgSettingsModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition dark:text-gray-300">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div class="p-6 space-y-5">
              <!-- 启用开关 -->
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium dark:text-gray-200">启用背景图片</span>
                <button 
                  @click="bgPreview.enabled = !bgPreview.enabled"
                  class="relative w-10 h-6 rounded-full transition-colors"
                  :class="bgPreview.enabled ? 'bg-gray-800 dark:bg-zinc-500' : 'bg-gray-300 dark:bg-zinc-600'"
                >
                  <div 
                    class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
                    :class="bgPreview.enabled ? 'left-[18px]' : 'left-0.5'"
                  ></div>
                </button>
              </div>
              
              <!-- 图片上传 -->
              <div>
                <label class="block text-sm font-medium mb-2 dark:text-gray-200">背景图片</label>
                <div class="flex items-center gap-4">
                  <div class="flex-1">
                    <input 
                      v-model="bgPreview.imageUrl"
                      type="text"
                      class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
                      placeholder="图片地址或上传图片"
                    />
                  </div>
                  <input 
                    type="file"
                    accept="image/*"
                    class="hidden"
                    ref="bgImageInputRef"
                    @change="handleBgImageUpload"
                  />
                  <button 
                    @click="bgImageInputRef?.click()"
                    class="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center gap-2"
                    :disabled="bgUploading"
                  >
                    <i :class="bgUploading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-upload'"></i>
                    {{ bgUploading ? '上传中' : '上传' }}
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-1">图片存储在本地浏览器，上传限制 2MB</p>
              </div>
              
              <!-- 透明度 -->
              <div>
                <label class="block text-sm font-medium mb-2 dark:text-gray-200">背景透明度: {{ Math.round(bgPreview.opacity * 100) }}%</label>
                <input 
                  v-model.number="bgPreview.opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <!-- 模糊度 -->
              <div>
                <label class="block text-sm font-medium mb-2 dark:text-gray-200">高斯模糊: {{ bgPreview.blur }}px</label>
                <input 
                  v-model.number="bgPreview.blur"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  class="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <!-- 预览区域 -->
              <div class="relative h-32 rounded-lg overflow-hidden border dark:border-zinc-700">
                <div 
                  v-if="bgPreview.enabled && bgPreview.imageUrl"
                  class="absolute inset-0 bg-cover bg-center"
                  :style="{
                    backgroundImage: `url(${bgPreview.imageUrl})`,
                    opacity: bgPreview.opacity,
                    filter: `blur(${bgPreview.blur}px)`,
                  }"
                ></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="bg-white/90 dark:bg-zinc-800/90 rounded-lg px-4 py-2 text-sm">
                    效果预览
                  </div>
                </div>
              </div>
            </div>
            
            <div class="px-6 py-4 bg-gray-50 dark:bg-zinc-700/50 flex justify-end gap-3">
              <button 
                @click="resetBgSettings"
                class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                重置
              </button>
              <button 
                @click="saveBgSettings"
                class="px-4 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

const { data: session, signOut, status, token } = useAuth()
const colorMode = useColorMode()

// 搜索弹窗 composable
const {
  searchQuery, searchType, showSearchModal, searchInputRef,
  hotSearches, searchSuggestions, searchHistory,
  imageSearchResults, imageRecognizedGames, imageSearching,
  imagePreview, imageSearchError, imageInputRef,
  trendingGames, showTrendingPanel,
  handleSearch, handleHotSearch, handleHistorySearch, handleSearchInput,
  removeHistoryItem, clearSearchHistory,
  triggerImageInput, handleImageDrop, handleImageSelect,
  formatViewCount, initSearchListeners, cleanupSearchListeners,
} = useSearchModal()

// 背景设置 composable
const {
  showBgSettingsModal, bgSettings, bgPreview,
  bgImageInputRef, bgUploading,
  openBgSettings, handleBgImageUpload,
  saveBgSettings, resetBgSettings, loadBgSettings,
} = useBgSettings()

// 全局公告 composable
const {
  showGlobalAnnouncement, globalAnnouncement,
  fetchGlobalAnnouncement, closeGlobalAnnouncement,
} = useGlobalAnnouncement()

// 状态
const showUserMenu = ref(false)
const showSettingsMenu = ref(false)
const showMobileMenu = ref(false)
const navReady = ref(false)
const navRef = ref<HTMLElement | null>(null)
const randomLoading = ref(false)
const nsfwModeUpdating = ref(false)
const avatarBroken = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const settingsMenuRef = ref<HTMLElement | null>(null)
const unreadCount = useState<number>('unreadMessagesCount', () => 0)
const privateUnreadCount = useState<number>('unreadPrivateMessagesCount', () => 0)

function setUnreadCount(count: number) {
  unreadCount.value = Math.max(0, count)
}

function setPrivateUnreadCount(count: number) {
  privateUnreadCount.value = Math.max(0, count)
}
const { openInNewTab, toggleOpenInNewTab } = useOpenInNewTab()

// 返回顶部
const showScrollTop = ref(false)
const currentYear = ref(0)

interface NavMenuAd {
  id: number
  name?: string
  imageUrl: string
  linkUrl: string
  openInNewTab: boolean
}

const runtimeConfig = useRuntimeConfig()
const buildId = runtimeConfig.public?.buildId as string | undefined
const { data: navMenuAdData } = await useAsyncData<NavMenuAd[]>(
  'nav-menu-ads',
  () => $fetch<NavMenuAd[]>('/api/ads', { query: { slot: 'nav_menu', v: buildId } }),
  { default: () => [] }
)
const navMenuAds = computed(() => navMenuAdData.value ?? [])

// 计算属性
// 在 loading 状态时，如果有 token 则保持登录状态，避免切换标签页时闪烁
const isLoggedIn = computed(() => {
  if (status.value === 'authenticated') return true
  if (status.value === 'loading') return !!token.value
  return false
})
const user = computed(() => session.value as any)
const isDark = computed(() => colorMode.value === 'dark')
const siteName = useSiteName()

const nsfwMode = computed(() => user.value?.nsfwMode || 'SFW')
// 导航栏配置
const navConfig = useNavConfig()
const effectiveNavConfig = computed(() => {
  const hasNavLinks = Array.isArray(navConfig.value.navLinks) && navConfig.value.navLinks.length > 0
  if (!hasNavLinks) return DEFAULT_NAV_CONFIG

  const navLinks = navConfig.value.navLinks
  const visibleBuiltinCount = navLinks.filter(link => link.isBuiltin && link.visible).length
  if (visibleBuiltinCount >= 3) return navConfig.value

  return {
    ...navConfig.value,
    navLinks: [
      ...DEFAULT_NAV_CONFIG.navLinks,
      ...navLinks.filter(link => !DEFAULT_NAV_CONFIG.navLinks.some(defaultLink => defaultLink.id === link.id)),
    ],
  }
})
const visibleNavLinks = computed(() => effectiveNavConfig.value.navLinks.filter(l => l.visible && (!l.requireAuth || isLoggedIn.value)))
const visibleIconButtons = computed(() => effectiveNavConfig.value.iconButtons.filter(b => b.visible && (!b.requireAuth || isLoggedIn.value)))
const visibleFooterLinks = computed(() => (effectiveNavConfig.value.footerLinks ?? []).filter(l => l.visible && (!l.requireAuth || isLoggedIn.value)))

const customFooterHtml = useState<string>('customFooterHtml', () => '')
const favicon = useState<string>('favicon', () => '')

// 点击外部关闭菜单
onClickOutside(userMenuRef, () => {
  showUserMenu.value = false
})

// 设置菜单用 document 级监听，兼容 fixed 定位的下拉面板
watch(showSettingsMenu, (val) => {
  if (val) {
    const close = () => {
      showSettingsMenu.value = false
      document.removeEventListener('click', close, true)
    }
    document.addEventListener('click', close, true)
  }
})

// 方法
function setColorMode(mode: 'light' | 'dark' | 'system') {
  colorMode.preference = mode
}


async function setNsfwMode(mode: 'SFW' | 'NSFW' | 'ALL') {
  if (mode === nsfwMode.value || nsfwModeUpdating.value) return
  nsfwModeUpdating.value = true
  
  try {
    const { authFetch } = useAuthRequest()
    await authFetch('/api/user/nsfw-mode', {
      method: 'PUT',
      body: { mode },
    })
    // 刷新 session 和页面数据以应用新设置
    const { getSession } = useAuth()
    await getSession()
    await refreshNuxtData()
  } catch (error) {
    console.error('切换NSFW模式失败:', error)
  } finally {
    nsfwModeUpdating.value = false
  }
}

async function handleLogout() {
  showUserMenu.value = false
  await signOut({ callbackUrl: '/' })
}

async function goRandomGame() {
  if (randomLoading.value) return
  randomLoading.value = true
  try {
    const data = await $fetch<{ id: number }>('/api/games/random', { timeout: 8000 })
    await navigateTo(`/games/${data.id}`)
  } catch {
    // 静默失败
  } finally {
    randomLoading.value = false
  }
}

async function goRandomGameFromUserMenu() {
  showUserMenu.value = false
  await goRandomGame()
}

function resetHeaderStateForViewport() {
  if (!import.meta.client) return

  if (window.innerWidth < 768) {
    showMobileMenu.value = false
    return
  }
}

function handleViewportChange() {
  resetHeaderStateForViewport()
}

// 获取未读消息数
async function fetchUnreadCount() {
  if (!isLoggedIn.value) return
  
  const { $api } = useNuxtApp()
  if (!$api) return
  
  try {
    const data = await $api<any>('/api/user/messages', {
      params: { unreadOnly: true, limit: 1 },
    })
    setUnreadCount(data.unreadCount)
  } catch {
    // 忽略错误
  }
}

async function fetchPrivateUnreadCount() {
  if (!isLoggedIn.value) {
    setPrivateUnreadCount(0)
    return
  }

  const { $api } = useNuxtApp()
  if (!$api) return

  try {
    const data = await $api<any>('/api/private-messages/unread-count')
    setPrivateUnreadCount(data.unreadCount)
  } catch {
    // 忽略错误
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleScroll() {
  showScrollTop.value = window.scrollY > 300
}

onMounted(() => {
  navReady.value = true
  currentYear.value = new Date().getFullYear()
  fetchUnreadCount()
  fetchPrivateUnreadCount()
  fetchGlobalAnnouncement()
  loadBgSettings()
  initSearchListeners()
  window.addEventListener('scroll', handleScroll)
  window.addEventListener('resize', handleViewportChange)
  window.visualViewport?.addEventListener('resize', handleViewportChange)
})

onUnmounted(() => {
  cleanupSearchListeners()
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleViewportChange)
  window.visualViewport?.removeEventListener('resize', handleViewportChange)
})

watch(isLoggedIn, (val) => {
  if (val) {
    fetchUnreadCount()
    fetchPrivateUnreadCount()
  } else {
    setPrivateUnreadCount(0)
  }
  resetHeaderStateForViewport()
})

watch([visibleNavLinks, navMenuAds], () => {
  resetHeaderStateForViewport()
})

watch(() => user.value?.avatar, () => {
  avatarBroken.value = false
})
</script>

<style scoped>
/* 自定义链接彩虹渐变文字 */
.nav-rainbow-link {
  background-image: linear-gradient(90deg, rgb(59, 130, 246) 0%, rgb(168, 85, 247) 20%, rgb(236, 72, 153) 50%, rgb(168, 85, 247) 80%, rgb(59, 130, 246) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow-shift 3s linear infinite;
  font-weight: 500;
}

@keyframes rainbow-shift {
  0% { background-position-x: 0%; }
  100% { background-position-x: 200%; }
}

/* 顶部栏图标按钮 */
.header-icon-btn {
  @apply w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all duration-200 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:scale-105 active:scale-95;
}

/* Tooltip 气泡 */
.header-tooltip {
  @apply absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-zinc-600 rounded whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-200 z-50;
}

.group\/nsfw:hover .header-tooltip,
.group\/theme:hover .header-tooltip,
.group\/bell:hover .header-tooltip,
.group\/random:hover .header-tooltip,
.group\/search:hover .header-tooltip,
.group\/settings:hover .header-tooltip,
.group\/iconbtn:hover .header-tooltip {
  @apply opacity-100;
}

/* 下拉菜单动画 */
.dropdown-enter-active {
  animation: dropdown-in 0.2s ease-out;
}

.dropdown-leave-active {
  animation: dropdown-out 0.15s ease-in forwards;
}

@keyframes dropdown-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 弹窗动画已移至 app.vue 全局样式 */

@keyframes dropdown-out {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端菜单滑入动画 */
.slide-menu-enter-active {
  transition: opacity 0.2s ease;
}
.slide-menu-enter-active > div:last-child {
  animation: slide-in-left 0.25s ease-out;
}
.slide-menu-leave-active {
  transition: opacity 0.15s ease;
}
.slide-menu-leave-active > div:last-child {
  animation: slide-out-left 0.2s ease-in forwards;
}
.slide-menu-enter-from,
.slide-menu-leave-to {
  opacity: 0;
}

@keyframes slide-in-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slide-out-left {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}

/* 侧边面板滑入动画 - 从搜索弹窗后方向右滑出 */
.slide-panel-enter-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-panel-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-panel-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}

.slide-panel-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}

</style>
