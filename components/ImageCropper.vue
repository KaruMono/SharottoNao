<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
        @click.self="cancel"
      >
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg modal-content flex flex-col max-h-[90vh]">
          <!-- 头部 -->
          <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700 shrink-0">
            <h3 class="font-semibold">{{ circle ? '裁剪头像' : '裁剪封面' }}</h3>
            <button @click="cancel" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- 裁剪区域 -->
          <div class="flex-1 overflow-hidden flex items-center justify-center bg-gray-900 relative select-none" ref="containerRef">
            <canvas
              ref="canvasRef"
              class="cursor-grab active:cursor-grabbing touch-none"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @wheel.prevent="onWheel"
            />
          </div>

          <!-- 缩放控制 -->
          <div class="px-4 py-3 border-t dark:border-zinc-700 shrink-0">
            <div class="flex items-center gap-3">
              <i class="fa-solid fa-magnifying-glass-minus text-gray-400 text-sm"></i>
              <input
                type="range"
                :min="minScale"
                :max="maxScale"
                :step="0.01"
                v-model.number="scale"
                class="flex-1 h-1.5 accent-blue-600"
              />
              <i class="fa-solid fa-magnifying-glass-plus text-gray-400 text-sm"></i>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="flex justify-end gap-3 p-4 border-t dark:border-zinc-700 shrink-0">
            <button @click="cancel" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700">取消</button>
            <button @click="confirmCrop" :disabled="cropping" class="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50">
              <i v-if="cropping" class="fa-solid fa-spinner fa-spin mr-1"></i>
              确认裁剪
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  imageFile: File | null
  aspectRatio?: number
  circle?: boolean
  outputWidth?: number
  outputQuality?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'cropped': [blob: Blob]
}>()

const aspect = computed(() => props.aspectRatio ?? (props.circle ? 1 : 0.75))
const outWidth = computed(() => props.outputWidth ?? (props.circle ? 400 : 600))
const quality = computed(() => props.outputQuality ?? 0.9)

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

let img: HTMLImageElement | null = null
let imgLoaded = false
const scale = ref(1)
const minScale = ref(0.1)
const maxScale = ref(5)
const offsetX = ref(0)
const offsetY = ref(0)
const cropping = ref(false)
const canvasW = ref(400)
const canvasH = ref(400)

let dragging = false
let dragStartX = 0
let dragStartY = 0
let dragOffsetX = 0
let dragOffsetY = 0

watch(() => [props.modelValue, props.imageFile], async ([visible, file]) => {
  if (visible && file) {
    await nextTick()
    await loadImage(file as File)
  }
}, { immediate: true })

watch(scale, () => {
  clampOffset()
  draw()
})
watch([offsetX, offsetY], () => {
  clampOffset()
  draw()
})

async function loadImage(file: File) {
  const url = URL.createObjectURL(file)
  img = new Image()
  imgLoaded = false

  await new Promise<void>((resolve) => {
    img!.onload = () => {
      imgLoaded = true
      URL.revokeObjectURL(url)
      initCanvas()
      resolve()
    }
    img!.onerror = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    img!.src = url
  })
}

function initCanvas() {
  if (!img || !containerRef.value || !canvasRef.value) return

  const maxW = Math.min(containerRef.value.clientWidth || 460, 460)
  const maxH = Math.min(window.innerHeight * 0.5, 400)

  if (aspect.value >= 1) {
    canvasW.value = Math.min(maxW, maxH * aspect.value)
    canvasH.value = canvasW.value / aspect.value
  } else {
    canvasH.value = Math.min(maxH, maxW / aspect.value)
    canvasW.value = canvasH.value * aspect.value
  }

  canvasRef.value.width = canvasW.value
  canvasRef.value.height = canvasH.value

  const scaleX = canvasW.value / img.width
  const scaleY = canvasH.value / img.height
  const fitScale = Math.max(scaleX, scaleY)

  minScale.value = Math.ceil(fitScale * 100) / 100
  maxScale.value = Math.round(fitScale * 500) / 100
  scale.value = minScale.value

  offsetX.value = (canvasW.value - img.width * scale.value) / 2
  offsetY.value = (canvasH.value - img.height * scale.value) / 2
  clampOffset()

  draw()
}

function clampOffset() {
  if (!img || !imgLoaded) return

  const imageW = img.width * scale.value
  const imageH = img.height * scale.value

  if (imageW <= canvasW.value) {
    offsetX.value = (canvasW.value - imageW) / 2
  } else {
    offsetX.value = Math.min(0, Math.max(canvasW.value - imageW, offsetX.value))
  }

  if (imageH <= canvasH.value) {
    offsetY.value = (canvasH.value - imageH) / 2
  } else {
    offsetY.value = Math.min(0, Math.max(canvasH.value - imageH, offsetY.value))
  }
}

function draw() {
  if (!canvasRef.value || !img || !imgLoaded) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const w = canvasW.value
  const h = canvasH.value
  ctx.clearRect(0, 0, w, h)

  // 绘制图片
  ctx.drawImage(img, offsetX.value, offsetY.value, img.width * scale.value, img.height * scale.value)

  if (props.circle) {
    const cx = w / 2
    const cy = h / 2
    const r = Math.min(w, h) / 2

    // 半透明遮罩
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 圆形边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    // 三分线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.lineWidth = 1
    const tw = w / 3, th = h / 3
    ctx.beginPath()
    ctx.moveTo(tw, 0); ctx.lineTo(tw, h)
    ctx.moveTo(tw * 2, 0); ctx.lineTo(tw * 2, h)
    ctx.moveTo(0, th); ctx.lineTo(w, th)
    ctx.moveTo(0, th * 2); ctx.lineTo(w, th * 2)
    ctx.stroke()
    // 外框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, w - 2, h - 2)
  }
}

function onPointerDown(e: PointerEvent) {
  dragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOffsetX = offsetX.value
  dragOffsetY = offsetY.value
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  offsetX.value = dragOffsetX + (e.clientX - dragStartX)
  offsetY.value = dragOffsetY + (e.clientY - dragStartY)
  clampOffset()
}

function onPointerUp(e: PointerEvent) {
  dragging = false
  ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.05 : 0.05
  const newScale = Math.max(minScale.value, Math.min(maxScale.value, scale.value + delta))

  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const ratio = newScale / scale.value
    offsetX.value = mx - (mx - offsetX.value) * ratio
    offsetY.value = my - (my - offsetY.value) * ratio
  }

  scale.value = newScale
  clampOffset()
}

async function confirmCrop() {
  if (!img || !imgLoaded) return
  cropping.value = true

  try {
    const outW = outWidth.value
    const outH = Math.round(outW / aspect.value)

    const offscreen = document.createElement('canvas')
    offscreen.width = outW
    offscreen.height = outH
    const ctx = offscreen.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, outW, outH)

    const ratioX = outW / canvasW.value
    const ratioY = outH / canvasH.value
    ctx.drawImage(
      img,
      offsetX.value * ratioX,
      offsetY.value * ratioY,
      img.width * scale.value * ratioX,
      img.height * scale.value * ratioY,
    )

    const blob = await new Promise<Blob | null>((resolve) => {
      offscreen.toBlob(resolve, 'image/webp', quality.value)
    })

    if (blob) {
      emit('cropped', blob)
      emit('update:modelValue', false)
    }
  } finally {
    cropping.value = false
  }
}

function cancel() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
  opacity: 0;
}
</style>
