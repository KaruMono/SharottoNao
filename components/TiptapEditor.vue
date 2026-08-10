<template>
  <div class="tiptap-editor rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden">
    <!-- 工具栏 -->
    <div v-if="editor" class="flex items-center gap-0.5 px-2 py-1 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80">
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
    </div>

    <!-- 编辑区域 -->
    <EditorContent :editor="editor" class="tiptap-content" />

    <!-- 游玩时长设置（可选） -->
    <div v-if="showPlayTimeOption" class="flex items-center px-2 py-1 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
      <button
        type="button"
        @click="showPlayTimeModal = true"
        class="flex items-center gap-1 px-2 py-1 text-xs transition-colors rounded"
        :class="playTime > 0
          ? 'text-green-600 dark:text-green-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        <i class="fa-solid fa-clock text-[10px]"></i>
        <span v-if="playTime > 0">{{ playTime }}小时</span>
        <span v-else>设置游玩时长</span>
      </button>
    </div>

    <!-- 游玩时长弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showPlayTimeModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          @click.self="showPlayTimeModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-72 p-4 modal-content">
            <h3 class="font-medium mb-3 text-sm dark:text-gray-100">设置游玩时长</h3>
            <div class="mb-3">
              <input
                type="range"
                :value="Math.min(playTime, 24)"
                @input="handleSliderInput"
                min="0"
                max="24"
                step="0.5"
                class="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded appearance-none cursor-pointer"
              />
              <div class="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span>
                <span>12</span>
                <span>24h</span>
              </div>
            </div>
            <div class="flex items-center gap-2 mb-3">
              <input
                v-model.number="playTime"
                type="number"
                min="0"
                max="48"
                step="0.5"
                class="flex-1 px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-zinc-600 dark:bg-zinc-700 focus:outline-none"
              />
              <span class="text-sm text-gray-500">小时</span>
            </div>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                @click="playTime = 0; showPlayTimeModal = false"
                class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                清除
              </button>
              <button
                type="button"
                @click="showPlayTimeModal = false"
                class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded hover:bg-gray-700"
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
import Placeholder from '@tiptap/extension-placeholder'
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
  showPlayTimeOption?: boolean
  initialPlayTime?: number
}>(), {
  placeholder: '发表你的看法...',
  minHeight: 150,
  showPlayTimeOption: false,
  initialPlayTime: 0,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:playTime', value: number): void
}>()

// 表情包
const emojiPacks = ref<EmojiPack[]>([])
const activeEmojiPack = ref(0)
const showEmojiPicker = ref(false)
const emojiPickerRef = ref<HTMLElement>()

// 弹窗状态
const showPlayTimeModal = ref(false)
const playTime = ref(props.initialPlayTime)

// 获取表情包
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
      heading: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      codeBlock: false,
      horizontalRule: false,
      code: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Spoiler,
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
      style: `min-height: ${props.minHeight}px`,
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

// 监听游玩时长变化
watch(playTime, (val) => {
  if (val > 48) playTime.value = 48
  if (val < 0) playTime.value = 0
  emit('update:playTime', playTime.value)
})

// 表情 - 插入文本标记格式（包含表情包名）
function insertEmoji(emoji: Emoji) {
  const pack = emojiPacks.value.find(p => p.id === activeEmojiPack.value)
  if (pack) {
    editor.value?.chain().focus().insertContent(`[emoji:${pack.name}:${emoji.name}]`).run()
  }
  showEmojiPicker.value = false
}

// 滑条
function handleSliderInput(e: Event) {
  playTime.value = parseFloat((e.target as HTMLInputElement).value)
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
  @apply w-7 h-7 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-xs rounded;
}

.toolbar-btn.active {
  @apply bg-gray-200 dark:bg-zinc-600 text-gray-900 dark:text-white;
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

/* 内容样式 */
.tiptap-content :deep(.tiptap strong) {
  @apply font-semibold;
}

.tiptap-content :deep(.tiptap img.inline-emoji) {
  width: 20px !important;
  height: 20px !important;
  margin: 0 !important;
  padding: 0 !important;
  display: inline !important;
  vertical-align: middle !important;
}

/* 剧透文本样式 */
.tiptap-content :deep(.tiptap .spoiler) {
  @apply bg-gray-800 dark:bg-zinc-300 text-gray-800 dark:text-zinc-300 rounded px-0.5 cursor-pointer;
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
