<template>
  <div class="tiptap-input rounded border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 overflow-hidden">
    <!-- 简化工具栏 -->
    <div v-if="editor" class="flex items-center gap-0.5 px-1.5 py-1 bg-gray-50 dark:bg-zinc-700/50 border-b border-gray-200 dark:border-zinc-600">
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

        <Transition name="dropdown">
          <div
            v-if="showEmojiPicker"
            class="absolute left-0 bottom-full mb-1 w-56 bg-white dark:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-700 shadow-lg z-50"
          >
            <div class="flex border-b border-gray-200 dark:border-zinc-700 overflow-x-auto">
              <button
                v-for="pack in emojiPacks"
                :key="pack.id"
                @click="activeEmojiPack = pack.id"
                class="px-2 py-1 text-xs whitespace-nowrap"
                :class="activeEmojiPack === pack.id
                  ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-700'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-700'"
              >
                {{ pack.name }}
              </button>
            </div>
            <div class="p-1.5 max-h-28 overflow-y-auto">
              <div class="grid grid-cols-8 gap-0.5">
                <button
                  v-for="emoji in currentPackEmojis"
                  :key="emoji.id"
                  @click="insertEmoji(emoji)"
                  class="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
                  :title="emoji.name"
                >
                  <img :src="emoji.url" :alt="emoji.name" class="w-4 h-4 object-contain" />
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
    <EditorContent :editor="editor" class="tiptap-content-mini" />
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
}>(), {
  placeholder: '写下你的回复...',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

// 表情包
const emojiPacks = ref<EmojiPack[]>([])
const activeEmojiPack = ref(0)
const showEmojiPicker = ref(false)
const emojiPickerRef = ref<HTMLElement>()

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
      class: 'focus:outline-none text-sm',
    },
    handleKeyDown: (view, event) => {
      // Enter 提交，Shift+Enter 换行
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        emit('submit')
        return true
      }
      return false
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

// 表情 - 插入文本标记格式（包含表情包名）
function insertEmoji(emoji: Emoji) {
  const pack = emojiPacks.value.find(p => p.id === activeEmojiPack.value)
  if (pack) {
    editor.value?.chain().focus().insertContent(`[emoji:${pack.name}:${emoji.name}]`).run()
  }
  showEmojiPicker.value = false
}

// 方法
function clear() {
  editor.value?.commands.clearContent()
  emit('update:modelValue', '')
}

function focus() {
  editor.value?.commands.focus()
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})

defineExpose({
  clear,
  focus,
})
</script>

<style scoped>
.toolbar-btn {
  @apply w-6 h-6 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-[11px] rounded;
}

.toolbar-btn.active {
  @apply bg-gray-200 dark:bg-zinc-600 text-gray-900 dark:text-white;
}

.tiptap-content-mini {
  @apply px-2 py-1.5;
}

.tiptap-content-mini :deep(.tiptap) {
  @apply outline-none text-sm min-h-[40px];
}

.tiptap-content-mini :deep(.tiptap p.is-editor-empty:first-child::before) {
  @apply text-gray-400 dark:text-gray-500 float-left h-0 pointer-events-none;
  content: attr(data-placeholder);
}

/* 内容样式 */
.tiptap-content-mini :deep(.tiptap strong) {
  @apply font-semibold;
}

.tiptap-content-mini :deep(.tiptap .spoiler) {
  @apply bg-gray-800 dark:bg-zinc-300 text-gray-800 dark:text-zinc-300 rounded px-0.5 cursor-pointer;
}

.tiptap-content-mini :deep(.tiptap img.inline-emoji) {
  width: 20px !important;
  height: 20px !important;
  margin: 0 !important;
  padding: 0 !important;
  display: inline !important;
  vertical-align: middle !important;
}

/* 下拉动画 */
.dropdown-enter-active {
  animation: dropdown-in 0.15s ease-out;
}
.dropdown-leave-active {
  animation: dropdown-out 0.1s ease-in forwards;
}
@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes dropdown-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(4px); }
}
</style>
