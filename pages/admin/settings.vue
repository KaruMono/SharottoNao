<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">网站设置</h1>

    <form @submit.prevent="handleSave" class="space-y-6">
      <!-- 基本设置 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">基本设置</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">网站名称</label>
            <input 
              v-model="form.site_name"
              type="text" 
              class="admin-input w-full"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">网站URL</label>
            <input 
              v-model="form.site_url"
              type="url" 
              class="admin-input w-full"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">首页标题 <span class="text-xs text-gray-400 font-normal ml-1">（SEO 专用，留空则使用网站名称）</span></label>
          <input 
            v-model="form.home_title"
            type="text" 
            class="admin-input w-full"
            placeholder="例：Sharotto - Galgame 资源数据库"
          />
          <p class="text-xs text-gray-500 mt-1">单独设置首页 &lt;title&gt; 标签，建议包含品牌词和核心关键词</p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">网站描述</label>
          <textarea 
            v-model="form.site_description"
            class="admin-textarea w-full"
            rows="2"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">关键词（SEO）</label>
          <input 
            v-model="form.site_keywords"
            type="text" 
            class="admin-input w-full"
            placeholder="关键词1,关键词2,关键词3"
          />
        </div>
      </div>

      <!-- 图标设置 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">图标设置</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">Favicon</label>
            <div class="flex gap-2 items-center">
              <input 
                v-model="form.favicon"
                type="text" 
                class="admin-input flex-1"
                placeholder="/favicon.ico"
              />
              <AdminKumoButton variant="secondary"
                type="button"
                :disabled="uploadingFavicon"
                class="shrink-0"
                @click="triggerUpload('favicon')"
              >
                <Icon name="fa6-solid:upload" />{{ uploadingFavicon ? '上传中...' : '上传' }}
              </AdminKumoButton>
              <img v-if="form.favicon" :src="form.favicon" class="w-8 h-8 shrink-0 object-contain rounded border dark:border-zinc-600" />
            </div>
            <p class="text-xs text-gray-500 mt-1">支持 ICO、PNG、SVG、WebP，最大 1MB</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Touch Icon</label>
            <div class="flex gap-2 items-center">
              <input 
                v-model="form.touch_icon"
                type="text" 
                class="admin-input flex-1"
                placeholder="/apple-touch-icon.png"
              />
              <AdminKumoButton variant="secondary"
                type="button"
                :disabled="uploadingTouchIcon"
                class="shrink-0"
                @click="triggerUpload('touch_icon')"
              >
                <Icon name="fa6-solid:upload" />{{ uploadingTouchIcon ? '上传中...' : '上传' }}
              </AdminKumoButton>
              <img v-if="form.touch_icon" :src="form.touch_icon" class="w-8 h-8 shrink-0 object-contain rounded border dark:border-zinc-600" />
            </div>
            <p class="text-xs text-gray-500 mt-1">支持 ICO、PNG、SVG、WebP，最大 1MB</p>
          </div>
        </div>
      </div>

      <!-- 隐藏的文件选择器 -->
      <input ref="faviconInput" type="file" accept=".ico,.png,.svg,.webp" class="hidden" @change="handleFileChange('favicon', $event)" />
      <input ref="touchIconInput" type="file" accept=".ico,.png,.svg,.webp" class="hidden" @change="handleFileChange('touch_icon', $event)" />

      <!-- 登录页背景 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">登录页背景</h2>
        <div>
          <label for="login-background-images" class="block text-sm font-medium mb-2">背景图片链接</label>
          <textarea
            id="login-background-images"
            v-model="form.login_background_images"
            :disabled="uploadingLoginBackgrounds"
            rows="4"
            class="admin-textarea w-full"
            placeholder="每行一张图片，支持 https:// 图片链接或 /uploads/ 站内路径"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">用于登录卡片左侧展示区，每次刷新页面随机展示一张。留空使用默认渐变背景，手机端不显示此区域。</p>
        </div>
        <div>
          <AdminKumoButton variant="secondary"
            type="button"
            :disabled="uploadingLoginBackgrounds || saving"
            @click="loginBackgroundInput?.click()"
          >
            <Icon name="fa6-solid:upload" />{{ uploadingLoginBackgrounds ? '上传中...' : '上传背景图片' }}
          </AdminKumoButton>
          <input
            ref="loginBackgroundInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
            multiple
            class="hidden"
            @change="handleLoginBackgroundUpload"
          />
          <p class="text-xs text-gray-500 mt-2">可多选，支持 JPG、PNG、GIF、WebP、AVIF，每张最大 10MB。上传或移除后请点击下方“保存设置”。</p>
        </div>
        <div v-if="loginBackgroundImages.length" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div v-for="(url, index) in loginBackgroundImages" :key="url" class="overflow-hidden rounded-lg border dark:border-zinc-600">
            <img :src="url" :alt="'背景图片 ' + (index + 1)" class="w-full h-36 object-cover bg-gray-100 dark:bg-zinc-700" loading="lazy" />
            <button
              type="button"
              :disabled="uploadingLoginBackgrounds || saving"
              :aria-label="'移除背景图片 ' + (index + 1)"
              class="w-full py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-zinc-700 disabled:opacity-50"
              @click="removeLoginBackground(url)"
            >移除</button>
          </div>
        </div>
      </div>

      <!-- CDN设置 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">CDN设置</h2>
        <div>
          <label class="block text-sm font-medium mb-2">JS 库 CDN</label>
          <AdminSelect aria-label="JS 库 CDN"
            v-model="form.cdn_type"
            class="w-full"
          >
            <option value="none">不使用CDN（本地加载）</option>
            <option value="lolicdn">LoliCDN (loli.net)</option>
            <option value="jsdelivr">jsDelivr</option>
            <option value="cdnjs">cdnjs (Cloudflare)</option>
            <option value="unpkg">Unpkg</option>
            <option value="custom">自定义</option>
          </AdminSelect>
          <p class="text-xs text-gray-500 mt-1">
            用于加载 Font Awesome 等前端库。
            <span v-if="form.cdn_type === 'lolicdn'">LoliCDN：<a href="https://u.sb/css-cdn/" target="_blank" class="text-blue-500 hover:underline">https://u.sb/css-cdn/</a>，国内速度快</span>
            <span v-else-if="form.cdn_type === 'jsdelivr'">jsDelivr：全球 CDN，国内有节点</span>
            <span v-else-if="form.cdn_type === 'cdnjs'">cdnjs：由 Cloudflare 提供，全球覆盖</span>
            <span v-else-if="form.cdn_type === 'unpkg'">Unpkg：基于 npm 的 CDN</span>
          </p>
        </div>

        <div v-if="form.cdn_type === 'custom'">
          <label class="block text-sm font-medium mb-2">自定义 CDN URL</label>
          <input 
            v-model="form.cdn_url"
            type="url" 
            class="admin-input w-full"
            placeholder="https://cdn.example.com"
          />
          <p class="text-xs text-gray-500 mt-1">需要兼容 npm 包路径格式，如 <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700">CDN_URL/@fortawesome/fontawesome-free@6/css/all.min.css</code></p>
        </div>

        <div class="border-t dark:border-zinc-700 pt-4">
          <label class="block text-sm font-medium mb-2">Gravatar CDN</label>
          <AdminSelect aria-label="Gravatar CDN"
            v-model="form.gravatar_cdn"
            class="w-full"
          >
            <option value="default">官方 (gravatar.com)</option>
            <option value="cravatar">Cravatar (cravatar.cn)</option>
            <option value="loli">LoliCDN (gravatar.loli.net)</option>
            <option value="weavatar">WeAvatar (weavatar.com)</option>
            <option value="custom">自定义</option>
          </AdminSelect>
          <p class="text-xs text-gray-500 mt-1">用于加载用户 Gravatar 头像，国内推荐使用 Cravatar 或 LoliCDN 镜像</p>
        </div>

        <div v-if="form.gravatar_cdn === 'custom'">
          <label class="block text-sm font-medium mb-2">自定义 Gravatar 镜像 URL</label>
          <input 
            v-model="form.gravatar_cdn_url"
            type="url" 
            class="admin-input w-full"
            placeholder="https://gravatar.example.com/avatar"
          />
          <p class="text-xs text-gray-500 mt-1">完整路径格式：<code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700">URL/HASH?s=200&d=404</code></p>
        </div>
      </div>

      <!-- 下载限制 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">下载限制</h2>

        <div>
          <label class="block text-sm font-medium mb-2">每日下载次数限制</label>
          <input
            v-model="form.daily_download_limit"
            type="number"
            min="1"
            class="admin-input w-full"
            placeholder="10"
          />
          <p class="text-xs text-gray-500 mt-1">每位用户每天可下载的资源次数，管理员不受此限制。留空默认为 10 次。</p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-3">下载列表可见性</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition"
              :class="form.download_visibility === 'login_required'
                ? 'border-gray-800 dark:border-zinc-400 bg-gray-50 dark:bg-zinc-700/50'
                : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50'"
            >
              <input
                v-model="form.download_visibility"
                type="radio"
                value="login_required"
                class="mt-0.5 shrink-0 rounded-full"
              />
              <div>
                <div class="text-sm font-medium">需要登录才可见</div>
                <div class="text-xs text-gray-500 mt-0.5">访客看不到下载列表，必须登录后才能查看和下载</div>
              </div>
            </label>
            <label
              class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition"
              :class="form.download_visibility === 'always_show'
                ? 'border-gray-800 dark:border-zinc-400 bg-gray-50 dark:bg-zinc-700/50'
                : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50'"
            >
              <input
                v-model="form.download_visibility"
                type="radio"
                value="always_show"
                class="mt-0.5 shrink-0 rounded-full"
              />
              <div>
                <div class="text-sm font-medium">所有人可见</div>
                <div class="text-xs text-gray-500 mt-0.5">访客也能看到下载列表，点击下载按钮时再要求登录</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- 站内信设置 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">站内信设置</h2>

        <div>
          <label class="block text-sm font-medium mb-3">普通用户可发送站内信的权限组</label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label
              v-for="role in privateMessageRoleOptions"
              :key="role.value"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg border dark:border-zinc-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50"
            >
              <input
                v-model="privateMessageAllowedRoles"
                type="checkbox"
                :value="role.value"
                class="rounded border-gray-300 text-gray-800 focus:ring-gray-400"
              />
              <span class="text-sm">{{ role.label }}</span>
            </label>
          </div>
          <p class="text-xs text-gray-500 mt-2">未被勾选的普通用户之间不能互相发送站内信；被允许的权限组可以回复或主动给用户发送站内信。</p>
        </div>
      </div>

      <!-- 自定义代码 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">自定义代码</h2>
        <div>
          <label class="block text-sm font-medium mb-1">自定义页脚 HTML</label>
          <p class="text-xs text-gray-400 mb-2">仅支持展示类 HTML（文字、链接等），不支持 &lt;script&gt; 标签</p>
          <textarea 
            v-model="form.footer_html"
            class="admin-textarea w-full font-mono"
            rows="3"
            placeholder="<p>自定义页脚内容</p>"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">头部统计代码</label>
          <p class="text-xs text-gray-400 mb-2">统计/追踪脚本请放这里，输出到 &lt;head&gt; 中，支持 &lt;script&gt; 和 &lt;noscript&gt;</p>
          <textarea 
            v-model="form.header_scripts"
            class="admin-textarea w-full font-mono"
            rows="3"
            placeholder="<!-- Google Analytics -->"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">底部统计代码</label>
          <p class="text-xs text-gray-400 mb-2">输出到 &lt;/body&gt; 前，适合放置不需要提前加载的脚本</p>
          <textarea 
            v-model="form.footer_scripts"
            class="admin-textarea w-full font-mono"
            rows="3"
            placeholder="<!-- 百度统计 -->"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">全局 Meta 标签</label>
          <textarea 
            v-model="form.custom_meta_tags"
            class="admin-textarea w-full font-mono"
            rows="4"
            placeholder='<meta name="google-site-verification" content="xxx" />&#10;<meta name="baidu-site-verification" content="xxx" />&#10;<meta property="og:image" content="https://example.com/og.jpg" />'
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">每行一个 <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700">&lt;meta&gt;</code> 标签，将注入到所有页面的 &lt;head&gt; 中，支持 SEO 验证、OG 标签等</p>
        </div>
      </div>

      <!-- 资源同步发布 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">资源同步发布</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">发布同步密钥</label>
            <div class="flex gap-2">
              <input 
                v-model="form.resource_sync_token"
                type="text" 
                class="admin-input flex-1"
                placeholder="C# 程序 publishSecretTextBox 填写的 Bearer Token"
              />
              <AdminKumoButton variant="secondary"
                type="button"
                class="shrink-0"
                @click="generateResourceSyncToken"
              >
                随机生成
              </AdminKumoButton>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              对接地址为 <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700">/api/resources/sync</code>，请求头使用 <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700">Authorization: Bearer 发布同步密钥</code>
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">资源发布者</label>
            <AdminSelect aria-label="资源发布者"
              v-model="form.resource_sync_uploader_id"
              class="w-full"
            >
              <option value="">使用首个可用管理员</option>
              <option v-for="user in syncUploaderOptions" :key="user.id" :value="String(user.id)">
                {{ user.username }} (#{{ user.id }}) · {{ user.role }}
              </option>
            </AdminSelect>
            <p class="text-xs text-gray-500 mt-1">同步创建的资源投稿者、游戏创建者和编辑动态都会记录到这个用户。</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">资源语言可选项</label>
            <div class="rounded-lg border dark:border-zinc-700 overflow-hidden">
              <div v-for="item in resourceLanguageOptions" :key="item.value" class="flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 dark:border-zinc-700">
                <span>{{ item.label }}</span>
                <code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-xs">{{ item.value }}</code>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">资源平台可选项</label>
            <div class="rounded-lg border dark:border-zinc-700 overflow-hidden">
              <div v-for="type in resourceTypeOptions" :key="type.id" class="flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 dark:border-zinc-700">
                <span>{{ type.name }}</span>
                <code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-xs">typeId: {{ type.id }}</code>
              </div>
              <div v-if="!resourceTypeOptions.length" class="px-3 py-2 text-sm text-gray-500">暂无资源平台，请先到资源类型管理中创建。</div>
            </div>
            <p class="text-xs text-gray-500 mt-1">生产环境会显示生产数据库里的资源类型；C# 程序可内置这里显示的 typeId。</p>
          </div>
        </div>
      </div>

      <!-- Alist 网盘 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">Alist 网盘</h2>
        <div>
          <label class="block text-sm font-medium mb-2">Alist 地址</label>
          <input 
            v-model="form.alist_base_url"
            type="url" 
            class="admin-input w-full"
            placeholder="https://alist.example.com"
          />
          <p class="text-xs text-gray-500 mt-1">添加资源时，如果链接匹配此地址，将自动从 Alist 获取文件名作为资源标题</p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Alist Token（可选）</label>
          <input 
            v-model="form.alist_token"
            type="text" 
            class="admin-input w-full"
            placeholder="如果需要认证才能访问，填写 Token"
          />
        </div>
      </div>
      <!-- 保存按钮 -->
      <div class="flex justify-end">
        <AdminKumoButton variant="primary"
          type="submit"
          :disabled="saving || uploadingLoginBackgrounds"
        >
          {{ saving ? '保存中...' : '保存设置' }}
        </AdminKumoButton>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { isLoginBackgroundUrl, parseLoginBackgrounds } from '~/utils/login-backgrounds'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const { data: settings, refresh } = await useAuthFetch<Record<string, string>>('/api/admin/settings', { key: 'admin-settings' })
const { data: syncUsersData } = await useAuthFetch<{ items: Array<{ id: number; username: string; role: string; status: string }> }>('/api/admin/users', {
  key: 'admin-settings-sync-users',
  query: { limit: 100, status: 'ACTIVE', role: 'ADMIN' },
})
const { data: resourceTypesData } = await useAuthFetch<Array<{ id: number; name: string; icon?: string | null }>>('/api/admin/resource-types', {
  key: 'admin-settings-resource-types',
})

const resourceLanguageOptions = [
  { value: 'ja', label: '日语' },
  { value: 'en', label: '英语' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁体中文' },
]

const syncUploaderOptions = computed(() => syncUsersData.value?.items || [])
const resourceTypeOptions = computed(() => resourceTypesData.value || [])
const privateMessageRoleOptions = [
  { value: 'ADMIN', label: '管理员' },
  { value: 'EDITOR', label: '编辑' },
  { value: 'USER', label: '普通用户' },
]

const form = reactive({
  site_name: '',
  site_url: '',
  home_title: '',
  site_description: '',
  site_keywords: '',
  favicon: '',
  touch_icon: '',
  login_background_images: '',
  cdn_type: 'none',
  cdn_url: '',
  gravatar_cdn: 'default',
  gravatar_cdn_url: '',
  footer_html: '',
  header_scripts: '',
  footer_scripts: '',
  custom_meta_tags: '',
  daily_download_limit: '',
  download_visibility: 'login_required',
  private_message_allowed_roles: 'ADMIN,EDITOR',
  resource_sync_token: '',
  resource_sync_uploader_id: '',
  alist_base_url: '',
  alist_token: '',
})

const privateMessageAllowedRoles = ref<string[]>(['ADMIN', 'EDITOR'])
const saving = ref(false)
const uploadingFavicon = ref(false)
const uploadingTouchIcon = ref(false)
const faviconInput = ref<HTMLInputElement>()
const touchIconInput = ref<HTMLInputElement>()
const loginBackgroundInput = ref<HTMLInputElement>()
const uploadingLoginBackgrounds = ref(false)
const loginBackgroundImages = computed(() => parseLoginBackgrounds(form.login_background_images).filter(isLoginBackgroundUrl))

function removeLoginBackground(url: string) {
  form.login_background_images = parseLoginBackgrounds(form.login_background_images)
    .filter(image => image !== url).join('\n')
}

async function handleLoginBackgroundUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return

  uploadingLoginBackgrounds.value = true
  let uploadedCount = 0
  try {
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(file.name + '：文件大小不能超过 10MB')
        continue
      }
      const body = new FormData()
      body.append('file', file)
      try {
        const result = await authFetch<{ url: string }>('/api/admin/upload-login-background', {
          method: 'POST',
          body,
        })
        form.login_background_images = [...new Set([
          ...parseLoginBackgrounds(form.login_background_images), result.url,
        ])].join('\n')
        uploadedCount++
      } catch (error: any) {
        toast.error(file.name + '：' + (error.data?.message || '上传失败'))
      }
    }
    if (uploadedCount) toast.success('已上传 ' + uploadedCount + ' 张背景图片，请保存设置')
  } finally {
    uploadingLoginBackgrounds.value = false
    input.value = ''
  }
}

function triggerUpload(type: 'favicon' | 'touch_icon') {
  if (type === 'favicon') faviconInput.value?.click()
  else touchIconInput.value?.click()
}

function generateResourceSyncToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = new Uint32Array(32)
  crypto.getRandomValues(values)
  form.resource_sync_token = Array.from(values, value => chars[value % chars.length]).join('')
}

async function handleFileChange(type: 'favicon' | 'touch_icon', event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const loading = type === 'favicon' ? uploadingFavicon : uploadingTouchIcon
  loading.value = true

  try {
    const fd = new FormData()
    fd.append('file', file)
    const result = await authFetch<{ url: string }>('/api/admin/upload-icon', {
      method: 'POST',
      body: fd,
    })
    form[type] = result.url
    toast.success('上传成功')
  } catch (error: any) {
    toast.error(error.data?.message || '上传失败')
  } finally {
    loading.value = false
    input.value = ''
  }
}

// 初始化表单
watch(settings, (val) => {
  if (val) {
    Object.assign(form, val)
    privateMessageAllowedRoles.value = (val.private_message_allowed_roles || 'ADMIN,EDITOR')
      .split(',')
      .map(role => role.trim())
      .filter(Boolean)
  }
}, { immediate: true })

async function handleSave() {
  if (saving.value || uploadingLoginBackgrounds.value) return
  const images = parseLoginBackgrounds(form.login_background_images)
  if (images.some(url => !isLoginBackgroundUrl(url))) {
    toast.error('登录页背景请填写有效的 HTTP(S) 图片链接或以 / 开头的站内路径，每行一张')
    return
  }
  form.login_background_images = images.join('\n')
  saving.value = true
  try {
    form.private_message_allowed_roles = privateMessageAllowedRoles.value.join(',')
    await authFetch('/api/admin/settings', {
      method: 'PUT',
      body: form,
    })
    await refresh()
    toast.success('保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `网站设置 - ${siteName.value} 管理后台`),
})
</script>
