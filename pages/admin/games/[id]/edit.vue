<template>
  <div class="pb-20">
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink to="/admin/games" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <i class="fa-solid fa-arrow-left"></i>
      </NuxtLink>
      <h1 class="text-2xl font-bold">编辑游戏条目（管理员）</h1>
      <NuxtLink :to="`/games/${gameId}`" target="_blank" class="text-sm text-blue-500 hover:underline">
        <i class="fa-solid fa-external-link mr-1"></i>查看前台
      </NuxtLink>
    </div>

    <div v-if="pending" class="text-center py-16">
      <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
      <p class="mt-2 text-gray-500">加载中...</p>
    </div>

    <div v-else-if="error" class="text-center py-16">
      <i class="fa-solid fa-circle-exclamation text-4xl text-red-500 mb-4"></i>
      <p class="text-gray-500">{{ error.data?.message || '加载失败' }}</p>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- 外部平台关联 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">外部平台关联</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">VNDB ID</label>
            <input 
              v-model="form.vndbId"
              type="text" 
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="如：v27448"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Bangumi ID</label>
            <input 
              v-model="form.bangumiId"
              type="text" 
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="如：297264"
            />
          </div>
        </div>
      </div>

      <!-- 封面图片 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">封面图片 *</h2>
        <div class="flex gap-6">
          <div class="w-40 flex-shrink-0">
            <div 
              class="aspect-[3/4] rounded-lg border-2 border-dashed dark:border-zinc-600 overflow-hidden bg-gray-50 dark:bg-zinc-700 flex items-center justify-center"
              :class="{ 'border-gray-300': !form.coverImage, 'border-transparent': form.coverImage }"
            >
              <img v-if="form.coverImage" :src="form.coverImage" class="w-full h-full object-cover" />
              <div v-else class="text-center text-gray-400 p-4">
                <i class="fa-solid fa-image text-3xl mb-2"></i>
                <p class="text-xs">封面预览</p>
              </div>
            </div>
          </div>
          <div class="flex-1 space-y-4">
            <div 
              class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition hover:border-gray-400 dark:hover:border-zinc-500"
              :class="uploading === 'cover' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-zinc-600'"
              @click="triggerFileInput('cover')"
              @dragover.prevent
              @drop.prevent="e => handleDrop(e, 'cover')"
            >
              <input ref="coverInputRef" type="file" accept="image/*" class="hidden" @change="e => handleFileSelect(e, 'cover')" />
              <div v-if="uploading === 'cover'" class="text-blue-600 dark:text-blue-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
                <p>上传中...</p>
              </div>
              <div v-else>
                <i class="fa-solid fa-cloud-arrow-up text-2xl text-gray-400 mb-2"></i>
                <p class="text-sm text-gray-600 dark:text-gray-400">点击或拖拽图片上传封面</p>
              </div>
            </div>
            <div v-if="uploadError" class="text-sm text-red-500">
              <i class="fa-solid fa-circle-exclamation mr-1"></i>{{ uploadError }}
            </div>
          </div>
        </div>
      </div>

      <!-- 多语言标题 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">游戏标题 *</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="w-5 h-5 inline-flex items-center justify-center rounded bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold mr-1">JP</span>
              日文标题
            </label>
            <input v-model="form.titleJa" type="text" class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如：クラナド" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="w-5 h-5 inline-flex items-center justify-center rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold mr-1">EN</span>
              英文标题
            </label>
            <input v-model="form.titleEn" type="text" class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如：CLANNAD" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="w-5 h-5 inline-flex items-center justify-center rounded bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs font-bold mr-1">简</span>
              简体中文标题
            </label>
            <input v-model="form.titleZhHans" type="text" class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如：团子大家族" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="w-5 h-5 inline-flex items-center justify-center rounded bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-xs font-bold mr-1">繁</span>
              繁体中文标题
            </label>
            <input v-model="form.titleZhHant" type="text" class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如：團子大家族" />
          </div>
        </div>
      </div>

      <!-- 多语言简介 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">游戏简介 *</h2>
        <div class="flex border-b dark:border-zinc-700">
          <button 
            v-for="lang in descriptionLangs" :key="lang.key" type="button" @click="activeDescLang = lang.key"
            class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
            :class="activeDescLang === lang.key ? 'border-gray-800 dark:border-white text-gray-800 dark:text-white' : 'border-transparent text-gray-500'"
          >
            {{ lang.label }}
            <i v-if="form[lang.key as keyof typeof form]" class="fa-solid fa-check text-green-500 text-xs ml-1"></i>
          </button>
        </div>
        <textarea 
          v-model="(form as any)[activeDescLang]"
          class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
          rows="6"
          :placeholder="descriptionLangs.find(l => l.key === activeDescLang)?.placeholder"
        ></textarea>
      </div>

      <!-- 基本信息 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">基本信息</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">发售日期</label>
            <input v-model="form.releaseDate" type="date" class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" />
          </div>
          
        </div>

        <!-- 开发商/发行商（多选） -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium mb-2">开发商/发行商</label>
          
          <!-- 已选择的会社 -->
          <div v-if="selectedCompanies.length" class="flex flex-wrap gap-2 mb-3">
            <div 
              v-for="(sc, index) in selectedCompanies" :key="sc.companyId"
              class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-zinc-700 rounded-lg"
            >
              <select 
                v-model="sc.role" 
                class="text-xs bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="DEVELOPER">开发商</option>
                <option value="PUBLISHER">发行商</option>
              </select>
              <span class="text-sm font-medium">{{ sc.name }}</span>
              <button type="button" @click="removeCompany(index)" class="text-gray-400 hover:text-red-500">
                <i class="fa-solid fa-times text-xs"></i>
              </button>
            </div>
          </div>
          
          <!-- 搜索添加会社 -->
          <div class="relative">
            <input 
              v-model="companySearch"
              type="text" 
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              placeholder="搜索会社名称或别名..."
              @focus="showCompanyDropdown = true"
              @input="searchCompanies"
            />
            <i class="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            
            <!-- 下拉列表 -->
            <div 
              v-if="showCompanyDropdown && filteredCompanies.length"
              class="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg shadow-lg max-h-60 overflow-auto"
            >
              <button 
                v-for="company in filteredCompanies" :key="company.id"
                type="button"
                class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-600 text-sm flex items-center justify-between"
                :class="{ 'opacity-50': isCompanySelected(company.id) }"
                :disabled="isCompanySelected(company.id)"
                @click="addCompany(company)"
              >
                <div>
                  <span class="font-medium">{{ company.name }}</span>
                  <span v-if="company.nameOriginal" class="text-gray-500 ml-2">{{ company.nameOriginal }}</span>
                  <div v-if="company.aliases?.length" class="text-xs text-gray-400">
                    别名: {{ company.aliases.slice(0, 3).join(', ') }}
                  </div>
                </div>
                <i v-if="isCompanySelected(company.id)" class="fa-solid fa-check text-green-500"></i>
              </button>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">可添加多个开发商/发行商，支持按名称和别名搜索</p>

          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-2">别名（每行一个）</label>
            <textarea v-model="aliasesText" class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" rows="3" placeholder="其他名称或别名..."></textarea>
          </div>
        </div>
      </div>

      <!-- 标签 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-4">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">标签</h2>

        <!-- 已选标签 -->
        <div v-if="selectedTags.length || pendingNewTags.length" class="flex flex-wrap gap-2">
          <span
            v-for="tag in selectedTags" :key="tag.id"
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
            :style="tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : { backgroundColor: 'rgba(107,114,128,0.12)', color: 'inherit' }"
          >
            {{ tag.name }}
            <button type="button" @click="removeTag(tag.id)" class="opacity-60 hover:opacity-100 ml-0.5">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </span>
          <!-- 待即时创建的新标签（管理员保存时直接生效，无需审核） -->
          <span
            v-for="name in pendingNewTags" :key="'new-' + name"
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border border-dashed border-blue-400 text-blue-600 dark:text-blue-400"
            :title="'新标签「' + name + '」将在保存时立即创建'"
          >
            <i class="fa-solid fa-plus text-xs opacity-70"></i>
            {{ name }}
            <button type="button" @click="removePendingTag(name)" class="opacity-60 hover:opacity-100 ml-0.5">
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </span>
        </div>
        <p v-else class="text-sm text-gray-400">暂未添加任何标签</p>

        <!-- 搜索输入 -->
        <div class="relative">
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 focus-within:ring-2 focus-within:ring-blue-500">
            <i class="fa-solid fa-magnifying-glass text-gray-400 text-sm"></i>
            <input
              v-model="tagSearch"
              type="text"
              placeholder="搜索标签，或输入新名称直接创建..."
              class="flex-1 bg-transparent outline-none text-sm placeholder-gray-400"
              @input="searchTags"
              @focus="onTagFocus"
              @blur="hideTagDropdown"
              @keydown.enter.prevent="onTagInputEnter"
            />
          </div>
          <div
            v-if="showTagDropdown && (tagResults.length || canCreateNewTag)"
            class="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border dark:border-zinc-700 max-h-56 overflow-y-auto"
          >
            <button
              v-for="tag in tagResults"
              :key="tag.id"
              type="button"
              class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-700 text-sm flex items-center gap-2.5 transition"
              @mousedown.prevent="addTag(tag)"
            >
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="tag.color ? { backgroundColor: tag.color } : { backgroundColor: '#9ca3af' }"></span>
              <span>{{ tag.name }}</span>
              <span class="text-xs text-gray-400 ml-auto">{{ tag.gamesCount }} 个游戏</span>
            </button>
            <div v-if="tagResults.length && canCreateNewTag" class="border-t dark:border-zinc-700" />
            <button
              v-if="canCreateNewTag"
              type="button"
              class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-700 text-sm flex items-center gap-2.5 transition text-blue-500"
              @mousedown.prevent="createPendingTag"
            >
              <i class="fa-solid fa-plus text-xs"></i>
              <span>创建新标签「{{ tagSearch.trim() }}」</span>
              <span class="ml-auto text-xs text-gray-400">保存时生效</span>
            </button>
          </div>
          <div
            v-else-if="showTagDropdown && tagSearch && !tagResults.length && !canCreateNewTag"
            class="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border dark:border-zinc-700 px-4 py-3 text-sm text-gray-400"
          >
            已添加该标签
          </div>
        </div>
        <p v-if="pendingNewTags.length" class="text-xs text-gray-400">
          <i class="fa-solid fa-circle-info mr-1"></i>虚线标签为新标签，保存后立即创建并关联
        </p>
      </div>

      <!-- 游戏截图 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">游戏截图</h2>
        
        <!-- 已有截图 -->
        <div v-if="screenshots.length" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="(screenshot, index) in screenshots" :key="screenshot._key" class="relative group">
            <img :src="screenshot.url" class="w-full aspect-video object-cover rounded-lg" />
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
              <button type="button" v-if="index > 0" @click="moveScreenshot(index, -1)" class="w-8 h-8 bg-white/20 rounded-full text-white hover:bg-white/30">
                <i class="fa-solid fa-arrow-left"></i>
              </button>
              <button type="button" @click="removeScreenshot(index)" class="w-8 h-8 bg-red-500 rounded-full text-white hover:bg-red-600">
                <i class="fa-solid fa-trash"></i>
              </button>
              <button type="button" v-if="index < screenshots.length - 1" @click="moveScreenshot(index, 1)" class="w-8 h-8 bg-white/20 rounded-full text-white hover:bg-white/30">
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
            <div class="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {{ index + 1 }}
            </div>
          </div>
        </div>

        <!-- 上传新截图 -->
        <div 
          class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition hover:border-gray-400 dark:hover:border-zinc-500"
          :class="uploading === 'screenshot' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-zinc-600'"
          @click="triggerFileInput('screenshot')"
          @dragover.prevent
          @drop.prevent="e => handleDrop(e, 'screenshot')"
        >
          <input ref="screenshotInputRef" type="file" accept="image/*" multiple class="hidden" @change="e => handleFileSelect(e, 'screenshot')" />
          <div v-if="uploading === 'screenshot'" class="text-blue-600 dark:text-blue-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p>上传中... {{ uploadProgress }}</p>
          </div>
          <div v-else>
            <i class="fa-solid fa-images text-2xl text-gray-400 mb-2"></i>
            <p class="text-sm text-gray-600 dark:text-gray-400">点击或拖拽图片上传截图（可多选）</p>
            <p class="text-xs text-gray-400 mt-1">支持排序，拖拽调整顺序</p>
          </div>
        </div>
      </div>

      <!-- 制作人员 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700">
          <h2 class="font-semibold text-lg">制作人员</h2>
          <button type="button" @click="addStaff" class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500">
            <i class="fa-solid fa-plus mr-1"></i>添加制作人员
          </button>
        </div>
        
        <div v-if="staffList.length" class="space-y-3">
          <div v-for="(staff, index) in staffList" :key="staff._key" class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg">
            <div class="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">职位 *</label>
                <select v-model="staff.role" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-600 dark:border-zinc-500 text-sm">
                  <option value="ARTIST">原画</option>
                  <option value="WRITER">剧本</option>
                  <option value="COMPOSER">音乐</option>
                  <option value="VOICE_ACTOR">声优</option>
                  <option value="DIRECTOR">导演</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">姓名 *</label>
                <input v-model="staff.name" type="text" placeholder="如：麻枝准" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-600 dark:border-zinc-500 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">原名</label>
                <input v-model="staff.nameOriginal" type="text" placeholder="如：麻枝 准" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-600 dark:border-zinc-500 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">角色名（声优用）</label>
                <input v-model="staff.characterName" type="text" placeholder="如：古河渚" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-600 dark:border-zinc-500 text-sm" />
              </div>
            </div>
            <button type="button" @click="removeStaff(index)" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-5">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        
        <div v-else class="text-center py-8 text-gray-500">
          <i class="fa-solid fa-users text-3xl mb-2"></i>
          <p>暂无制作人员信息，点击上方按钮添加</p>
        </div>
      </div>

      <!-- 相关链接 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700">
          <h2 class="font-semibold text-lg">相关链接</h2>
          <button type="button" @click="addPurchaseLink" class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500">
            <i class="fa-solid fa-plus mr-1"></i>添加链接
          </button>
        </div>
        
        <div v-if="purchaseLinks.length" class="space-y-3">
          <div v-for="(link, index) in purchaseLinks" :key="link._key" class="flex items-center gap-3">
            <input 
              v-model="link.name"
              type="text" 
              class="w-32 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
              placeholder="平台名称"
            />
            <input 
              v-model="link.url"
              type="url" 
              class="flex-1 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
              placeholder="https://..."
            />
            <button type="button" @click="removePurchaseLink(index)" class="p-2 text-red-500 hover:text-red-600 transition">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">暂无相关链接，点击上方按钮添加</p>
        <p class="text-xs text-gray-500">常见平台：Steam、DLsite、Getchu、DMM、官网等</p>
      </div>

      <!-- 设置 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">设置</h2>
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" v-model="form.isNsfw" class="w-5 h-5 rounded border-gray-300 dark:border-zinc-600" />
          <div>
            <span class="font-medium">NSFW 内容</span>
            <p class="text-sm text-gray-500">标记此条目为成人内容（NSFW）</p>
          </div>
        </label>
      </div>

      <!-- 系列 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">游戏系列</h2>
        <div>
          <div v-if="selectedSeries" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg">
            <div class="flex-1">
              <span class="font-medium">{{ selectedSeries.name }}</span>
              <span v-if="selectedSeries.nameOriginal" class="text-sm text-gray-500 ml-2">{{ selectedSeries.nameOriginal }}</span>
            </div>
            <button type="button" @click="selectedSeries = null" class="text-red-500 hover:text-red-600 text-sm">
              <i class="fa-solid fa-xmark"></i> 移除
            </button>
          </div>
          <div v-else class="relative">
            <input
              v-model="seriesSearch"
              type="text"
              placeholder="搜索系列名称..."
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              @input="searchSeries"
            />
            <div v-if="seriesResults.length > 0" class="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              <button
                v-for="s in seriesResults"
                :key="s.id"
                type="button"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm"
                @click="selectSeries(s)"
              >
                <span class="font-medium">{{ s.name }}</span>
                <span v-if="s.nameOriginal" class="text-gray-500 ml-2">{{ s.nameOriginal }}</span>
                <span class="text-gray-400 ml-2">({{ s.gamesCount }}款游戏)</span>
              </button>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2">将此游戏归入某个系列，方便用户浏览同系列作品</p>
        </div>
      </div>

    </form>

    <!-- 底部固定操作栏 -->
    <div class="fixed bottom-0 right-0 lg:left-56 left-0 z-30 px-6 py-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-t border-gray-200 dark:border-zinc-700 flex justify-between">
      <button type="button" @click="confirmDelete" class="px-6 py-2.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600">
        <i class="fa-solid fa-trash mr-1"></i>删除条目
      </button>
      <div class="flex gap-3">
        <NuxtLink to="/admin/games" class="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700">
          取消
        </NuxtLink>
        <button :disabled="loading || !canSubmit" class="px-6 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50" @click="handleSubmit">
          {{ loading ? '保存中...' : '保存修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdminGameItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()

const gameId = computed(() => parseInt(route.params.id as string))

// 获取游戏数据
const { data: gameData, pending, error } = await useAuthFetch<AdminGameItem>(`/api/admin/games/${gameId.value}`, {
  key: `admin-game-edit-${gameId.value}`,
})

// 获取标签列表
const tagSearch = ref('')
const tagResults = ref<{ id: number; name: string; color: string | null; gamesCount: number }[]>([])
const showTagDropdown = ref(false)
const selectedTags = ref<{ id: number; name: string; color: string | null }[]>([])
// 管理员直接创建的新标签（不存在于词表，保存时立即创建无需审核）
const pendingNewTags = ref<string[]>([])
let tagSearchTimer: ReturnType<typeof setTimeout>

function searchTags() {
  clearTimeout(tagSearchTimer)
  const q = tagSearch.value.trim()
  if (!q) { tagResults.value = []; showTagDropdown.value = false; return }
  showTagDropdown.value = true
  tagSearchTimer = setTimeout(async () => {
    try {
      const data = await $fetch<any>('/api/tags', { query: { search: q, limit: 20 } })
      tagResults.value = (data.items || []).filter((t: any) => !form.tagIds.includes(t.id))
    } catch { tagResults.value = [] }
  }, 300)
}

/** 输入框内容是否可以作为新标签（未选中且词表搜索无精确匹配） */
const canCreateNewTag = computed(() => {
  const q = tagSearch.value.trim()
  if (!q || q.length < 1 || q.length > 100) return false
  if (selectedTags.value.some(t => t.name.toLowerCase() === q.toLowerCase())) return false
  if (pendingNewTags.value.some(n => n.toLowerCase() === q.toLowerCase())) return false
  if (tagResults.value.some(t => t.name.toLowerCase() === q.toLowerCase())) return false
  return true
})

function addTag(tag: { id: number; name: string; color: string | null; gamesCount?: number }) {
  if (!form.tagIds.includes(tag.id)) {
    form.tagIds.push(tag.id)
    selectedTags.value.push({ id: tag.id, name: tag.name, color: tag.color })
  }
  tagSearch.value = ''
  tagResults.value = []
  showTagDropdown.value = false
}

function createPendingTag() {
  const name = tagSearch.value.trim()
  if (!name || name.length > 100) return
  if (pendingNewTags.value.some(n => n.toLowerCase() === name.toLowerCase())) return
  if (selectedTags.value.some(t => t.name.toLowerCase() === name.toLowerCase())) return
  pendingNewTags.value.push(name)
  tagSearch.value = ''
  tagResults.value = []
  showTagDropdown.value = false
}

function removeTag(id: number) {
  form.tagIds = form.tagIds.filter(tid => tid !== id)
  selectedTags.value = selectedTags.value.filter(t => t.id !== id)
}

function removePendingTag(name: string) {
  pendingNewTags.value = pendingNewTags.value.filter(n => n !== name)
}

function onTagInputEnter() {
  const q = tagSearch.value.trim()
  if (!q) return
  const exact = tagResults.value.find(t => t.name.toLowerCase() === q.toLowerCase())
  if (exact) {
    addTag(exact)
  } else if (canCreateNewTag.value) {
    createPendingTag()
  }
}

function hideTagDropdown() {
  setTimeout(() => { showTagDropdown.value = false }, 150)
}

function onTagFocus() {
  if (tagSearch.value) showTagDropdown.value = true
}

// 会社搜索结果（通过 API 实时搜索）
const companyResults = ref<any[]>([])

// 图片上传
const coverInputRef = ref<HTMLInputElement>()
const screenshotInputRef = ref<HTMLInputElement>()
const uploading = ref<'cover' | 'screenshot' | null>(null)
const uploadError = ref('')
const uploadProgress = ref('')

// 会社搜索（多选）
const companySearch = ref('')
const showCompanyDropdown = ref(false)
const selectedCompanies = ref<{ companyId: number; name: string; role: 'DEVELOPER' | 'PUBLISHER' }[]>([])

// 系列搜索
const seriesSearch = ref('')
const seriesResults = ref<{ id: number; name: string; nameOriginal: string | null; gamesCount: number }[]>([])
const selectedSeries = ref<{ id: number; name: string; nameOriginal: string | null } | null>(null)
let seriesSearchTimer: ReturnType<typeof setTimeout>

async function searchSeries() {
  clearTimeout(seriesSearchTimer)
  const q = seriesSearch.value.trim()
  if (!q) {
    seriesResults.value = []
    return
  }
  seriesSearchTimer = setTimeout(async () => {
    try {
      const data = await $fetch<any[]>('/api/series/search', { query: { q, limit: 10 } })
      seriesResults.value = data
    } catch {
      seriesResults.value = []
    }
  }, 300)
}

function selectSeries(s: { id: number; name: string; nameOriginal: string | null }) {
  selectedSeries.value = s
  seriesSearch.value = ''
  seriesResults.value = []
}
const filteredCompanies = computed(() => companyResults.value)

function isCompanySelected(companyId: number) {
  return selectedCompanies.value.some(c => c.companyId === companyId)
}

function addCompany(company: any) {
  if (isCompanySelected(company.id)) return
  selectedCompanies.value.push({
    companyId: company.id,
    name: company.name,
    role: 'DEVELOPER',
  })
  companySearch.value = ''
  showCompanyDropdown.value = false
}

function removeCompany(index: number) {
  selectedCompanies.value.splice(index, 1)
}

// 简介语言切换
const activeDescLang = ref('descriptionEn')
const descriptionLangs = [
  { key: 'descriptionEn', label: '英文', placeholder: 'English description...' },
  { key: 'descriptionJa', label: '日文', placeholder: '日本語の説明...' },
  { key: 'descriptionZhHans', label: '简中', placeholder: '简体中文简介...' },
  { key: 'descriptionZhHant', label: '繁中', placeholder: '繁體中文簡介...' },
]

// 表单数据
const form = reactive({
  titleEn: '',
  titleJa: '',
  titleZhHans: '',
  titleZhHant: '',
  descriptionEn: '',
  descriptionJa: '',
  descriptionZhHans: '',
  descriptionZhHant: '',
  coverImage: '',
  releaseDate: '',
  tagIds: [] as number[],
  isNsfw: false,
  vndbId: '',
  bangumiId: '',
})

const aliasesText = ref('')
// 行唯一 key（仅用于 v-for，提交前会剥离）
let rowKeySeed = 0
const screenshots = ref<{ _key: number; id?: number; url: string }[]>([])
const staffList = ref<{ _key: number; role: string; name: string; nameOriginal: string; characterName: string; staffId?: number }[]>([])
const purchaseLinks = ref<{ _key: number; name: string; url: string }[]>([])
const loading = ref(false)

function addPurchaseLink() {
  purchaseLinks.value.push({ _key: ++rowKeySeed, name: '', url: '' })
}

function removePurchaseLink(index: number) {
  purchaseLinks.value.splice(index, 1)
}

// 初始化表单数据
watch(gameData, (data) => {
  if (data) {
    form.titleEn = data.titleEn || ''
    form.titleJa = data.titleJa || ''
    form.titleZhHans = data.titleZhHans || ''
    form.titleZhHant = data.titleZhHant || ''
    form.descriptionEn = data.descriptionEn || ''
    form.descriptionJa = data.descriptionJa || ''
    form.descriptionZhHans = data.descriptionZhHans || ''
    form.descriptionZhHant = data.descriptionZhHant || ''
    form.coverImage = data.coverImage || ''
    form.releaseDate = data.releaseDate ? (typeof data.releaseDate === 'string' ? data.releaseDate.split('T')[0] : data.releaseDate.toISOString().split('T')[0]) : ''
    form.tagIds = data.tags?.map((t: any) => t.tagId || t.id) || []
    selectedTags.value = data.tags?.map((t: any) => ({
      id: t.tagId || t.id,
      name: t.tag?.name || t.name || '',
      color: t.tag?.color || t.color || null,
    })) || []
    form.isNsfw = data.isNsfw || false
    form.vndbId = data.vndbId || ''
    form.bangumiId = data.bangumiId?.toString() || ''
    aliasesText.value = data.aliases?.join('\n') || ''
    screenshots.value = data.screenshots?.map((s: any) => ({ _key: ++rowKeySeed, id: s.id, url: s.url })) || []
    staffList.value = data.staff?.map((s: any) => ({
      _key: ++rowKeySeed,
      role: s.role,
      name: s.staff?.name || s.name || '',
      nameOriginal: s.staff?.nameOriginal || s.nameOriginal || '',
      characterName: s.characterName || '',
      staffId: s.staffId || s.staff?.id,
    })) || []
    
    // 设置选中的会社（多个）
    if (data.companies?.length) {
      selectedCompanies.value = data.companies.map((gc: any) => ({
        companyId: gc.companyId || gc.company?.id,
        name: gc.company?.name || gc.name,
        role: gc.role || 'DEVELOPER',
      }))
    }
    
    // 设置购买链接
    if (data.purchaseLinks?.length) {
      purchaseLinks.value = data.purchaseLinks.map((link: any) => ({
        _key: ++rowKeySeed,
        name: link.name || '',
        url: link.url || '',
      }))
    }

    // 设置系列
    if (data.series) {
      selectedSeries.value = {
        id: data.series.id,
        name: data.series.name,
        nameOriginal: data.series.nameOriginal ?? null,
      }
    }
  }
}, { immediate: true })

// 点击外部关闭下拉框
function handleClickOutsideDropdown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.relative')) {
    showCompanyDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutsideDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutsideDropdown)
})

// 是否可以提交
const canSubmit = computed(() => {
  if (!form.coverImage) return false
  if (!form.titleEn && !form.titleJa && !form.titleZhHans && !form.titleZhHant) return false
  if (!form.descriptionEn && !form.descriptionJa && !form.descriptionZhHans && !form.descriptionZhHant) return false
  return true
})

// 会社相关方法
let companySearchTimer: ReturnType<typeof setTimeout>
function searchCompanies() {
  showCompanyDropdown.value = true
  clearTimeout(companySearchTimer)
  const q = companySearch.value.trim()
  if (!q) {
    companyResults.value = []
    return
  }
  companySearchTimer = setTimeout(async () => {
    try {
      const data = await $fetch<any>('/api/companies', { query: { search: q, limit: 20 } })
      companyResults.value = data.items || []
    } catch {
      companyResults.value = []
    }
  }, 300)
}

// 文件上传相关方法
function triggerFileInput(type: 'cover' | 'screenshot') {
  if (type === 'cover') {
    coverInputRef.value?.click()
  } else {
    screenshotInputRef.value?.click()
  }
}

async function handleFileSelect(e: Event, type: 'cover' | 'screenshot') {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    if (type === 'cover') {
      await uploadFile(input.files[0], 'cover')
    } else {
      const files = Array.from(input.files)
      for (let i = 0; i < files.length; i++) {
        uploadProgress.value = `${i + 1}/${files.length}`
        await uploadFile(files[i], 'screenshot')
      }
      uploadProgress.value = ''
    }
  }
  input.value = ''
}

async function handleDrop(e: DragEvent, type: 'cover' | 'screenshot') {
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    if (type === 'cover') {
      await uploadFile(files[0], 'cover')
    } else {
      const fileList = Array.from(files)
      for (let i = 0; i < fileList.length; i++) {
        uploadProgress.value = `${i + 1}/${fileList.length}`
        await uploadFile(fileList[i], 'screenshot')
      }
      uploadProgress.value = ''
    }
  }
}

async function uploadFile(file: File, type: 'cover' | 'screenshot') {
  if (file.size > 10 * 1024 * 1024) {
    uploadError.value = '文件大小不能超过 10MB'
    return
  }
  
  uploading.value = type
  uploadError.value = ''
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', type === 'cover' ? 'covers' : 'screenshots')
    formData.append('gameId', gameId.value.toString())
    
    const result = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
    })
    
    if (type === 'cover') {
      form.coverImage = result.url
    } else {
      screenshots.value.push({ _key: ++rowKeySeed, url: result.url })
    }
  } catch (error: any) {
    uploadError.value = error.data?.message || '上传失败'
  } finally {
    uploading.value = null
  }
}

// 截图操作
function removeScreenshot(index: number) {
  screenshots.value.splice(index, 1)
}

function moveScreenshot(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < screenshots.value.length) {
    const temp = screenshots.value[index]
    screenshots.value[index] = screenshots.value[newIndex]
    screenshots.value[newIndex] = temp
  }
}

// STAFF 操作
function addStaff() {
  staffList.value.push({
    _key: ++rowKeySeed,
    role: 'ARTIST',
    name: '',
    nameOriginal: '',
    characterName: '',
  })
}

function removeStaff(index: number) {
  staffList.value.splice(index, 1)
}

// 确认删除
async function confirmDelete() {
  if (!confirm('确定要删除这个游戏条目吗？此操作不可撤销。')) return
  
  try {
    await authFetch(`/api/admin/games/${gameId.value}`, { method: 'DELETE' })
    toast.success('删除成功')
    router.push('/admin/games')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

// 提交表单
async function handleSubmit() {
  if (!canSubmit.value) return

  loading.value = true
  try {
    const aliases = aliasesText.value.split('\n').map(a => a.trim()).filter(Boolean)

    // 过滤有效的购买链接（剥离 _key，避免污染提交数据）
    const validPurchaseLinks = purchaseLinks.value
      .filter(link => link.name && link.url)
      .map(link => ({ name: link.name, url: link.url }))

    await authFetch(`/api/admin/games/${gameId.value}`, {
      method: 'PUT',
      body: {
        titleEn: form.titleEn || undefined,
        titleJa: form.titleJa || undefined,
        titleZhHans: form.titleZhHans || undefined,
        titleZhHant: form.titleZhHant || undefined,
        aliases,
        descriptionEn: form.descriptionEn || undefined,
        descriptionJa: form.descriptionJa || undefined,
        descriptionZhHans: form.descriptionZhHans || undefined,
        descriptionZhHant: form.descriptionZhHant || undefined,
        coverImage: form.coverImage,
        releaseDate: form.releaseDate || undefined,
        companies: selectedCompanies.value.map(c => ({
          companyId: c.companyId,
          role: c.role,
        })),
        tagIds: form.tagIds,
        newTagNames: pendingNewTags.value.length > 0 ? pendingNewTags.value : undefined,
        isNsfw: form.isNsfw,
        vndbId: form.vndbId || undefined,
        bangumiId: form.bangumiId ? parseInt(form.bangumiId) : undefined,
        screenshots: screenshots.value.map(s => s.url),
        staff: staffList.value.filter(s => s.name).map(s => ({
          role: s.role,
          name: s.name,
          nameOriginal: s.nameOriginal || undefined,
          characterName: s.characterName || undefined,
          staffId: s.staffId,
        })),
        purchaseLinks: validPurchaseLinks.length > 0 ? validPurchaseLinks : [],
        seriesId: selectedSeries.value?.id || null,
      },
    })
    toast.success('保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

useHead({
  title: computed(() => gameData.value ? `编辑 ${gameData.value.titleZhHans || gameData.value.titleJa || gameData.value.titleEn} - 管理后台` : '编辑游戏 - 管理后台'),
})
</script>
