<template>
  <div class="tiptap-editor rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden">
    <!-- 工具栏 -->
    <div v-if="editor" class="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80">
      <!-- 文本格式 -->
      <button
        type="button"
        @click="editor.chain().focus().toggleBold().run()"
        :class="['toolbar-btn', { active: editor.isActive('bold') }]"
        title="加粗"
      >
        <i class="fa-solid fa-bold"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleItalic().run()"
        :class="['toolbar-btn', { active: editor.isActive('italic') }]"
        title="斜体"
      >
        <i class="fa-solid fa-italic"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleUnderline().run()"
        :class="['toolbar-btn', { active: editor.isActive('underline') }]"
        title="下划线"
      >
        <i class="fa-solid fa-underline"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleStrike().run()"
        :class="['toolbar-btn', { active: editor.isActive('strike') }]"
        title="删除线"
      >
        <i class="fa-solid fa-strikethrough"></i>
      </button>
      <button
        type="button"
        @click="(editor as any).chain().focus().toggleSpoiler().run()"
        :class="['toolbar-btn', { active: editor.isActive('spoiler') }]"
        title="剧透"
      >
        <i class="fa-solid fa-eye-slash"></i>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 标题 -->
      <button
        type="button"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        :class="['toolbar-btn', { active: editor.isActive('heading', { level: 2 }) }]"
        title="大标题"
      >
        <span class="text-[10px] font-bold">H2</span>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        :class="['toolbar-btn', { active: editor.isActive('heading', { level: 3 }) }]"
        title="小标题"
      >
        <span class="text-[10px] font-bold">H3</span>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 引用和代码 -->
      <button
        type="button"
        @click="editor.chain().focus().toggleBlockquote().run()"
        :class="['toolbar-btn', { active: editor.isActive('blockquote') }]"
        title="引用"
      >
        <i class="fa-solid fa-quote-left"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleCode().run()"
        :class="['toolbar-btn', { active: editor.isActive('code') }]"
        title="行内代码"
      >
        <i class="fa-solid fa-code"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleCodeBlock().run()"
        :class="['toolbar-btn', { active: editor.isActive('codeBlock') }]"
        title="代码块"
      >
        <i class="fa-solid fa-file-code"></i>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 列表 -->
      <button
        type="button"
        @click="editor.chain().focus().toggleBulletList().run()"
        :class="['toolbar-btn', { active: editor.isActive('bulletList') }]"
        title="无序列表"
      >
        <i class="fa-solid fa-list-ul"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().toggleOrderedList().run()"
        :class="['toolbar-btn', { active: editor.isActive('orderedList') }]"
        title="有序列表"
      >
        <i class="fa-solid fa-list-ol"></i>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 插入 -->
      <button
        type="button"
        @click="openLinkModal"
        :class="['toolbar-btn', { active: editor.isActive('link') }]"
        title="链接"
      >
        <i class="fa-solid fa-link"></i>
      </button>
      <button
        type="button"
        @click="openImageModal"
        class="toolbar-btn"
        title="图片"
      >
        <i class="fa-solid fa-image"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().setHorizontalRule().run()"
        class="toolbar-btn"
        title="分割线"
      >
        <i class="fa-solid fa-minus"></i>
      </button>

      <!-- 表情 -->
      <div class="relative" ref="emojiPickerRef">
        <button
          type="button"
          @click="showEmojiPicker = !showEmojiPicker"
          class="toolbar-btn"
          title="表情"
        >
          <i class="fa-regular fa-face-smile"></i>
        </button>

        <!-- 表情选择器 -->
        <Transition name="dropdown">
          <div
            v-if="showEmojiPicker"
            class="absolute left-0 top-full mt-1 w-60 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-lg z-50 overflow-hidden"
          >
            <div class="flex border-b border-gray-200 dark:border-zinc-700 overflow-x-auto">
              <button
                v-for="pack in emojiPacks"
                :key="pack.id"
                @click="activeEmojiPack = pack.id"
                class="px-2 py-1.5 text-xs whitespace-nowrap"
                :class="activeEmojiPack === pack.id
                  ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-700'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-700'"
              >
                {{ pack.name }}
              </button>
            </div>
            <div class="p-2 max-h-28 overflow-y-auto">
              <div class="grid grid-cols-8 gap-1">
                <button
                  v-for="emoji in currentPackEmojis"
                  :key="emoji.id"
                  @click="insertEmoji(emoji)"
                  class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
                  :title="emoji.name"
                >
                  <img :src="emoji.url" :alt="emoji.name" class="w-5 h-5 object-contain" />
                </button>
              </div>
              <div v-if="!currentPackEmojis.length" class="text-center text-gray-400 py-2 text-xs">
                暂无表情
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <div class="flex-1"></div>

      <!-- 撤销/重做 -->
      <button
        type="button"
        @click="editor.chain().focus().undo().run()"
        :disabled="!editor.can().undo()"
        class="toolbar-btn"
        title="撤销"
      >
        <i class="fa-solid fa-rotate-left"></i>
      </button>
      <button
        type="button"
        @click="editor.chain().focus().redo().run()"
        :disabled="!editor.can().redo()"
        class="toolbar-btn"
        title="重做"
      >
        <i class="fa-solid fa-rotate-right"></i>
      </button>
    </div>

    <!-- 编辑区域 -->
    <EditorContent :editor="editor" class="tiptap-content" />

    <!-- 链接弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showLinkModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          @click.self="showLinkModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-80 p-4 modal-content">
            <h3 class="font-medium mb-3 text-sm dark:text-gray-100">插入链接</h3>
            <input
              v-model="linkUrl"
              type="url"
              class="w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-zinc-600 dark:bg-zinc-700 focus:outline-none focus:border-gray-400"
              placeholder="https://"
              @keyup.enter="insertLink"
            />
            <div class="flex justify-end gap-2 mt-3">
              <button
                type="button"
                @click="showLinkModal = false"
                class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                取消
              </button>
              <button
                type="button"
                @click="insertLink"
                class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded hover:bg-gray-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 图片弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showImageModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          @click.self="showImageModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-96 p-4 modal-content">
            <h3 class="font-medium mb-3 text-sm dark:text-gray-100">插入图片</h3>

            <!-- 切换标签 -->
            <div class="flex border-b border-gray-200 dark:border-zinc-700 mb-3">
              <button
                type="button"
                @click="imageTab = 'upload'"
                class="px-3 py-1.5 text-sm border-b-2 transition"
                :class="imageTab === 'upload'
                  ? 'border-gray-800 dark:border-gray-300 text-gray-800 dark:text-gray-200'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'"
              >
                <i class="fa-solid fa-upload mr-1"></i>上传图片
              </button>
              <button
                type="button"
                @click="imageTab = 'url'"
                class="px-3 py-1.5 text-sm border-b-2 transition"
                :class="imageTab === 'url'
                  ? 'border-gray-800 dark:border-gray-300 text-gray-800 dark:text-gray-200'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'"
              >
                <i class="fa-solid fa-link mr-1"></i>图片地址
              </button>
            </div>

            <!-- 上传模式 -->
            <div v-if="imageTab === 'upload'">
              <div
                class="border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 dark:hover:border-zinc-500 transition"
                @click="triggerFileInput"
                @dragover.prevent
                @drop.prevent="handleFileDrop"
              >
                <div v-if="!imageUploading && !imagePreview">
                  <i class="fa-solid fa-cloud-arrow-up text-2xl text-gray-400 mb-2"></i>
                  <p class="text-sm text-gray-500">点击或拖拽图片到此处</p>
                  <p class="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF、WebP，最大 10MB</p>
                </div>
                <div v-else-if="imageUploading" class="py-2">
                  <i class="fa-solid fa-spinner fa-spin text-xl text-gray-400 mb-2"></i>
                  <p class="text-sm text-gray-500">上传中...</p>
                </div>
                <div v-else-if="imagePreview">
                  <img :src="imagePreview" class="max-h-40 mx-auto rounded" />
                  <p class="text-xs text-green-500 mt-2"><i class="fa-solid fa-check mr-1"></i>上传成功，点击重新选择</p>
                </div>
              </div>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                class="hidden"
                @change="handleFileSelect"
              />
            </div>

            <!-- URL 模式 -->
            <div v-else>
              <input
                v-model="imageUrl"
                type="url"
                class="w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-zinc-600 dark:bg-zinc-700 focus:outline-none focus:border-gray-400"
                placeholder="图片地址"
                @keyup.enter="insertImage"
              />
            </div>

            <div class="flex justify-end gap-2 mt-3">
              <button
                type="button"
                @click="closeImageModal"
                class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                取消
              </button>
              <button
                type="button"
                @click="insertImage"
                :disabled="imageUploading"
                class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Mark, mergeAttributes } from '@tiptap/core'
import { onClickOutside } from '@vueuse/core'

// 剧透文本扩展
const Spoiler = Mark.create({
  name: 'spoiler',
  
  parseHTML() {
    return [
      { tag: 'span.spoiler' },
    ]
  },
  
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'spoiler' }), 0]
  },
  
  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    }
  },
})

interface Emoji {
  id: number
  name: string
  url: string
}

interface EmojiPack {
  id: number
  name: string
  emojis: Emoji[]
}

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  minHeight?: number
}>(), {
  placeholder: '写下你的内容...',
  minHeight: 200,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// 表情包
const emojiPacks = ref<EmojiPack[]>([])
const activeEmojiPack = ref(0)
const showEmojiPicker = ref(false)
const emojiPickerRef = ref<HTMLElement>()

// 弹窗状态
const showLinkModal = ref(false)
const showImageModal = ref(false)
const linkUrl = ref('')
const imageUrl = ref('')

// 图片上传相关
const imageTab = ref<'upload' | 'url'>('upload')
const imageUploading = ref(false)
const imagePreview = ref('')
const uploadedImageUrl = ref('')
const fileInputRef = ref<HTMLInputElement>()
const { authFetch } = useAuthRequest()

function escapePastedText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToParagraphs(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line ? `<p>${escapePastedText(line)}</p>` : '<p></p>')
    .join('')
}
const { data: emojiPacksData } = await useFetch('/api/emoji-packs', { key: 'emoji-packs' })
watch(emojiPacksData, (data) => {
  if (data) {
    emojiPacks.value = data as EmojiPack[]
    if (emojiPacks.value.length > 0) {
      activeEmojiPack.value = emojiPacks.value[0].id
    }
  }
}, { immediate: true })

const currentPackEmojis = computed(() => {
  const pack = emojiPacks.value.find(p => p.id === activeEmojiPack.value)
  return pack?.emojis || []
})

// 点击外部关闭表情选择器
onClickOutside(emojiPickerRef, () => {
  showEmojiPicker.value = false
})

// 初始化编辑器
const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [2, 3],
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-600 dark:text-blue-400 hover:underline',
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full rounded',
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Underline,
    Spoiler,
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
      style: `min-height: ${props.minHeight}px`,
    },
    handlePaste(_view, event) {
      const html = event.clipboardData?.getData('text/html')
      const text = event.clipboardData?.getData('text/plain')

      if (!text || html || !/\r|\n/.test(text)) return false

      editor.value?.chain().focus().insertContent(plainTextToParagraphs(text)).run()
      return true
    },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

// 监听外部值变化
watch(() => props.modelValue, (value) => {
  if (editor.value && value !== editor.value.getHTML()) {
    editor.value.commands.setContent(value, { emitUpdate: false })
  }
})

// 链接
function openLinkModal() {
  const previousUrl = editor.value?.getAttributes('link').href
  linkUrl.value = previousUrl || ''
  showLinkModal.value = true
}

function insertLink() {
  if (!linkUrl.value) {
    editor.value?.chain().focus().unsetLink().run()
  } else {
    editor.value?.chain().focus().setLink({ href: linkUrl.value }).run()
  }
  showLinkModal.value = false
  linkUrl.value = ''
}

// 图片
function openImageModal() {
  imageUrl.value = ''
  imagePreview.value = ''
  uploadedImageUrl.value = ''
  imageTab.value = 'upload'
  showImageModal.value = true
}

function closeImageModal() {
  showImageModal.value = false
  imageUrl.value = ''
  imagePreview.value = ''
  uploadedImageUrl.value = ''
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) uploadFile(file)
}

function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) uploadFile(file)
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function uploadFile(file: File) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    return
  }

  imageUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'guides')

    const result = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
    })

    uploadedImageUrl.value = result.url
    imagePreview.value = result.url
  } catch {
    imagePreview.value = ''
    uploadedImageUrl.value = ''
  } finally {
    imageUploading.value = false
  }
}

function insertImage() {
  const url = imageTab.value === 'upload' ? uploadedImageUrl.value : imageUrl.value
  if (url) {
    editor.value?.chain().focus().setImage({ src: url }).run()
  }
  closeImageModal()
}

// 表情 - 插入文本标记格式（包含表情包名）
function insertEmoji(emoji: Emoji) {
  const pack = emojiPacks.value.find(p => p.id === activeEmojiPack.value)
  if (pack) {
    editor.value?.chain().focus().insertContent(`[emoji:${pack.name}:${emoji.name}]`).run()
  }
  showEmojiPicker.value = false
}

// 方法暴露
function getValue(): string {
  return editor.value?.getHTML() || ''
}

function setValue(content: string) {
  editor.value?.commands.setContent(content)
}

function clear() {
  editor.value?.commands.clearContent()
  emit('update:modelValue', '')
}

function focus() {
  editor.value?.commands.focus()
}

// 销毁
onBeforeUnmount(() => {
  editor.value?.destroy()
})

defineExpose({
  getValue,
  setValue,
  clear,
  focus,
})
</script>

<style scoped>
.toolbar-btn {
  @apply w-7 h-7 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed rounded;
}

.toolbar-btn.active {
  @apply bg-gray-200 dark:bg-zinc-600 text-gray-900 dark:text-white;
}

.toolbar-divider {
  @apply w-px h-4 bg-gray-200 dark:bg-zinc-600 mx-0.5;
}

.tiptap-content {
  @apply px-3 py-2;
}

.tiptap-content :deep(.tiptap) {
  @apply outline-none;
}

.tiptap-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  @apply text-gray-400 dark:text-gray-500 float-left h-0 pointer-events-none;
  content: attr(data-placeholder);
}

/* 编辑器内容样式 */
.tiptap-content :deep(.tiptap h2) {
  @apply text-lg font-semibold text-gray-800 dark:text-gray-100 mt-3 mb-2;
}

.tiptap-content :deep(.tiptap h3) {
  @apply text-base font-medium text-gray-800 dark:text-gray-100 mt-2 mb-1;
}

.tiptap-content :deep(.tiptap blockquote) {
  @apply border-l-4 border-gray-300 dark:border-zinc-600 pl-3 my-2 text-gray-600 dark:text-gray-400 italic;
}

.tiptap-content :deep(.tiptap code) {
  @apply bg-gray-100 dark:bg-zinc-700 text-rose-500 dark:text-rose-400 px-1 py-0.5 rounded text-sm font-mono;
}

.tiptap-content :deep(.tiptap pre) {
  @apply bg-gray-900 dark:bg-zinc-900 text-gray-100 p-3 rounded my-2 overflow-x-auto text-sm font-mono;
}

.tiptap-content :deep(.tiptap pre code) {
  @apply bg-transparent text-inherit p-0;
}

.tiptap-content :deep(.tiptap ul),
.tiptap-content :deep(.tiptap ol) {
  @apply pl-5 my-2;
}

.tiptap-content :deep(.tiptap ul) {
  @apply list-disc;
}

.tiptap-content :deep(.tiptap ol) {
  @apply list-decimal;
}

.tiptap-content :deep(.tiptap li) {
  @apply text-gray-700 dark:text-gray-300;
}

.tiptap-content :deep(.tiptap a) {
  @apply text-blue-600 dark:text-blue-400 hover:underline;
}

.tiptap-content :deep(.tiptap img) {
  @apply max-w-full rounded my-2;
}

.tiptap-content :deep(.tiptap img.inline-emoji) {
  width: 20px !important;
  height: 20px !important;
  margin: 0 !important;
  padding: 0 !important;
  display: inline !important;
  vertical-align: middle !important;
  border-radius: 0 !important;
}

.tiptap-content :deep(.tiptap hr) {
  @apply border-gray-200 dark:border-zinc-700 my-3;
}

/* 剧透文本样式 */
.tiptap-content :deep(.tiptap .spoiler) {
  @apply bg-gray-800 dark:bg-zinc-300 text-gray-800 dark:text-zinc-300 rounded px-0.5 cursor-pointer transition-colors;
}

.tiptap-content :deep(.tiptap .spoiler:hover),
.tiptap-content :deep(.tiptap .spoiler.revealed) {
  @apply bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200;
}

/* 下拉动画 */
.dropdown-enter-active {
  animation: dropdown-in 0.15s ease-out;
}
.dropdown-leave-active {
  animation: dropdown-out 0.1s ease-in forwards;
}
@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes dropdown-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-4px); }
}

/* 弹窗动画已移至 app.vue 全局样式 */
</style>
