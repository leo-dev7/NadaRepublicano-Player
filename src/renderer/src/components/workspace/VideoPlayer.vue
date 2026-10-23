<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ExternalLink,
  Camera,
  Bookmark,
  Check,
  CheckCircle2,
  SkipForward,
  Tv
} from 'lucide-vue-next'
import type { Course, Lesson } from '@shared/types/course'
import { useTimeFormat } from '../../composables/useTimeFormat'
import { useCourseStore } from '../../stores/courseStore'
import { useMpcStore } from '../../stores/mpcStore'

const props = defineProps<{
  course: Course
  lesson: Lesson | null
  mpcConnected: boolean
}>()

const emit = defineEmits<{
  playNext: []
  openMpc: []
}>()

const courseStore = useCourseStore()
const mpcStore = useMpcStore()
const { msToTime, msToTimestamp } = useTimeFormat()

const videoRef = ref<HTMLVideoElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Video state
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const playbackRate = ref(1)
const isFullscreen = ref(false)
const showControls = ref(true)
const controlsTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const subtitleUrl = ref<string | null>(null)
const toastMessage = ref<string | null>(null)
const toastTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

let progressInterval: ReturnType<typeof setInterval> | null = null

const videoSrc = computed(() => {
  if (!props.lesson?.absolutePath) return ''
  // Use local-media protocol for streaming local files
  return `local-media://${props.lesson.absolutePath.replace(/\\/g, '/')}`
})

const progressPercent = computed(() => {
  if (duration.value <= 0) return 0
  return Math.min(100, (currentTime.value / duration.value) * 100)
})

function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimeout.value) clearTimeout(toastTimeout.value)
  toastTimeout.value = setTimeout(() => {
    toastMessage.value = null
  }, 2500)
}

// Convert SRT to WebVTT Blob URL
async function loadSubtitles(subPath: string) {
  try {
    const rawText = await window.api.readTextFile({ filePath: subPath })
    const vttText =
      'WEBVTT\n\n' +
      rawText
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
        .replace(/\r\n|\r|\n/g, '\n')

    const blob = new Blob([vttText], { type: 'text/vtt' })
    if (subtitleUrl.value) URL.revokeObjectURL(subtitleUrl.value)
    subtitleUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    console.warn('Failed to load subtitles:', err)
  }
}

watch(
  () => props.lesson,
  async (newLesson) => {
    if (!newLesson) return

    currentTime.value = (newLesson.lastPositionMs || 0) / 1000
    isPlaying.value = false

    if (newLesson.subtitlePath) {
      await loadSubtitles(newLesson.subtitlePath)
    } else {
      subtitleUrl.value = null
    }

    await nextTick()
    if (videoRef.value) {
      videoRef.value.currentTime = currentTime.value
      videoRef.value.playbackRate = playbackRate.value
    }
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  // Periodic progress saving
  progressInterval = setInterval(() => {
    saveCurrentProgress()
  }, 3000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (progressInterval) clearInterval(progressInterval)
  if (subtitleUrl.value) URL.revokeObjectURL(subtitleUrl.value)
  saveCurrentProgress()
})

function saveCurrentProgress() {
  if (!props.lesson || !videoRef.value || duration.value <= 0) return
  const posMs = Math.round(videoRef.value.currentTime * 1000)
  const durMs = Math.round(duration.value * 1000)
  courseStore.updateLessonProgress(props.lesson.id, posMs, durMs)
}

function togglePlay() {
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play().then(() => {
      isPlaying.value = true
    }).catch(() => {})
  } else {
    videoRef.value.pause()
    isPlaying.value = false
    saveCurrentProgress()
  }
}

function handleTimeUpdate() {
  if (!videoRef.value) return
  currentTime.value = videoRef.value.currentTime
  duration.value = videoRef.value.duration || 0

  // Auto-complete at 90%
  if (
    props.lesson &&
    !props.lesson.isCompleted &&
    duration.value > 0 &&
    currentTime.value / duration.value >= 0.9
  ) {
    courseStore.markLessonComplete(props.lesson.id, true)
    showToast('Aula concluída!')
  }
}

function handleLoadedMetadata() {
  if (!videoRef.value) return
  duration.value = videoRef.value.duration || 0
  if (props.lesson?.lastPositionMs) {
    videoRef.value.currentTime = props.lesson.lastPositionMs / 1000
  }
}

function handleEnded() {
  isPlaying.value = false
  saveCurrentProgress()
  if (props.lesson) {
    courseStore.markLessonComplete(props.lesson.id, true)
  }
  showToast('Aula concluída! Avançando para a próxima...')
  setTimeout(() => {
    courseStore.playNextLesson()
  }, 1000)
}

function seekRelative(seconds: number) {
  if (!videoRef.value) return
  videoRef.value.currentTime = Math.max(0, Math.min(duration.value, videoRef.value.currentTime + seconds))
}

function handleProgressClick(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  if (videoRef.value && duration.value > 0) {
    videoRef.value.currentTime = ratio * duration.value
  }
}

function setPlaybackRate(rate: number) {
  playbackRate.value = rate
  if (videoRef.value) {
    videoRef.value.playbackRate = rate
  }
}

function toggleMute() {
  if (!videoRef.value) return
  isMuted.value = !isMuted.value
  videoRef.value.muted = isMuted.value
}

function handleVolumeChange(e: Event) {
  const target = e.target as HTMLInputElement
  const val = parseFloat(target.value)
  volume.value = val
  if (videoRef.value) {
    videoRef.value.volume = val
    isMuted.value = val === 0
  }
}

function toggleFullscreen() {
  if (!containerRef.value) return
  if (!document.fullscreenElement) {
    containerRef.value.requestFullscreen().catch(() => {})
  } else {
    document.exitFullscreen().catch(() => {})
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function handleMouseMove() {
  showControls.value = true
  if (controlsTimeout.value) clearTimeout(controlsTimeout.value)
  controlsTimeout.value = setTimeout(() => {
    if (isPlaying.value) {
      showControls.value = false
    }
  }, 3000)
}

// ── Obsidian & Snapshot Integrations ──
async function captureFrameForObsidian() {
  if (!videoRef.value || !props.lesson) return
  try {
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.value.videoWidth || 1920
    canvas.height = videoRef.value.videoHeight || 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    const res = await window.api.saveSnapshotBase64({
      courseRootPath: props.course.rootPath,
      lessonId: props.lesson.id,
      positionMs: Math.round(videoRef.value.currentTime * 1000),
      dataUrl
    })

    const ts = msToTimestamp(videoRef.value.currentTime * 1000)
    const obsidianMarkdown = `\n> 📸 **[${ts}] Captura de Tela**\n${res.obsidianLink}\n`

    await window.api.copyToClipboard(obsidianMarkdown)
    showToast(`📸 Frame salvo e link ${res.obsidianLink} copiado para o Obsidian!`)
  } catch (err) {
    console.error('Failed to capture frame:', err)
  }
}

async function copyTimestampForObsidian() {
  if (!videoRef.value || !props.lesson) return
  const ts = msToTimestamp(videoRef.value.currentTime * 1000)
  const text = `- [${ts}] **${props.lesson.cleanTitle}** - `
  await window.api.copyToClipboard(text)
  showToast(`⏱ Timestamp [${ts}] copiado para o Obsidian!`)
}

async function openInObsidian() {
  await window.api.openInObsidian(props.course.rootPath)
  showToast('Abrindo pasta no Obsidian...')
}

function watchInMpc() {
  if (!props.lesson) return
  // Pause internal player and resume in MPC
  if (videoRef.value) {
    videoRef.value.pause()
    isPlaying.value = false
  }
  const posMs = Math.round(currentTime.value * 1000)
  window.api.mpcOpenFile({
    filePath: props.lesson.absolutePath,
    startMs: posMs,
    lessonId: props.lesson.id
  })
  showToast(`Abrindo aula no MPC aos ${msToTime(posMs)}...`)
}

function handleKeydown(e: KeyboardEvent) {
  // Ignore if user is typing in an input
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.key === ' ' || e.key === 'k') {
    e.preventDefault()
    togglePlay()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    seekRelative(-5)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    seekRelative(5)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    volume.value = Math.min(1, volume.value + 0.1)
    if (videoRef.value) videoRef.value.volume = volume.value
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    volume.value = Math.max(0, volume.value - 0.1)
    if (videoRef.value) videoRef.value.volume = volume.value
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault()
    toggleFullscreen()
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault()
    toggleMute()
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full h-full bg-black flex flex-col justify-between overflow-hidden group select-none"
    @mousemove="handleMouseMove"
    @mouseleave="showControls = false"
  >
    <!-- Video Element -->
    <video
      ref="videoRef"
      :src="videoSrc"
      class="w-full h-full object-contain cursor-pointer"
      playsinline
      @click="togglePlay"
      @dblclick="toggleFullscreen"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @ended="handleEnded"
      @play="isPlaying = true"
      @pause="isPlaying = false"
    >
      <track
        v-if="subtitleUrl"
        :src="subtitleUrl"
        kind="subtitles"
        label="Legenda"
        default
      />
    </video>

    <!-- Big Center Play Button Overlay on Pause -->
    <div
      v-if="!isPlaying"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div class="p-6 rounded-full bg-indigo-600/90 text-white shadow-2xl backdrop-blur-sm transform transition-all duration-200 hover:scale-110">
        <Play class="w-10 h-10 fill-current translate-x-0.5" />
      </div>
    </div>

    <!-- Top Overlay Bar (Lesson title, MPC sync, Obsidian actions) -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showControls || !isPlaying"
        class="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto"
      >
        <div class="flex items-center gap-3">
          <div class="flex flex-col">
            <span class="text-xs text-indigo-400 font-medium">
              {{ course.cleanTitle }}
            </span>
            <h2 class="text-sm font-bold text-white line-clamp-1">
              {{ lesson?.cleanTitle || 'Selecione uma aula' }}
            </h2>
          </div>
        </div>

        <!-- Action Pills -->
        <div class="flex items-center gap-2">
          <!-- Assistir no MPC -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800/90 hover:bg-indigo-600 text-zinc-200 hover:text-white transition-all shadow-md backdrop-blur-sm"
            title="Abrir e sincronizar com o MPC-HC externo"
            @click="watchInMpc"
          >
            <Tv class="w-3.5 h-3.5" />
            <span>Assistir no MPC</span>
          </button>

          <!-- Obsidian: Copiar Timestamp -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-900/40 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-700/50 transition-all shadow-md backdrop-blur-sm"
            title="Copiar timestamp formatado para colar no Obsidian"
            @click="copyTimestampForObsidian"
          >
            <Bookmark class="w-3.5 h-3.5" />
            <span>Timestamp Obsidian</span>
          </button>

          <!-- Obsidian: Snapshot Frame -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900/40 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-700/50 transition-all shadow-md backdrop-blur-sm"
            title="Capturar print deste exato frame e copiar link para Obsidian"
            @click="captureFrameForObsidian"
          >
            <Camera class="w-3.5 h-3.5" />
            <span>Print para Obsidian</span>
          </button>

          <!-- Abrir no Obsidian -->
          <button
            class="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all backdrop-blur-sm"
            title="Abrir pasta no Obsidian"
            @click="openInObsidian"
          >
            <ExternalLink class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Toast Notification (Top Center) -->
    <Transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="toastMessage"
        class="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-2xl z-30 flex items-center gap-2 pointer-events-none"
      >
        <CheckCircle2 class="w-4 h-4 text-emerald-300" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Bottom Controls Overlay Bar -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showControls || !isPlaying"
        class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-2 pointer-events-auto"
      >
        <!-- Scrub Progress Bar -->
        <div
          class="h-2 bg-zinc-700/60 hover:h-3 rounded-full cursor-pointer relative group transition-all duration-150 overflow-hidden"
          @click="handleProgressClick"
        >
          <div
            class="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-75 relative"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>

        <!-- Controls Row -->
        <div class="flex items-center justify-between pt-1">
          <!-- Left Controls -->
          <div class="flex items-center gap-3">
            <!-- Play/Pause -->
            <button
              class="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
              @click="togglePlay"
            >
              <component :is="isPlaying ? Pause : Play" class="w-5 h-5 fill-current" />
            </button>

            <!-- -10s / +10s -->
            <button
              class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Voltar 5 segundos"
              @click="seekRelative(-5)"
            >
              <RotateCcw class="w-4 h-4" />
            </button>
            <button
              class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Avançar 5 segundos"
              @click="seekRelative(5)"
            >
              <RotateCw class="w-4 h-4" />
            </button>

            <!-- Time Display -->
            <div class="text-xs text-zinc-300 font-mono">
              {{ msToTime(currentTime * 1000) }} / {{ msToTime(duration * 1000) }}
            </div>

            <!-- Volume Slider -->
            <div class="flex items-center gap-1.5 group/vol">
              <button
                class="p-1.5 text-zinc-400 hover:text-white transition-colors"
                @click="toggleMute"
              >
                <component :is="isMuted || volume === 0 ? VolumeX : Volume2" class="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="isMuted ? 0 : volume"
                class="w-16 h-1 accent-indigo-500 bg-zinc-700 rounded-lg cursor-pointer"
                @input="handleVolumeChange"
              />
            </div>
          </div>

          <!-- Right Controls -->
          <div class="flex items-center gap-3">
            <!-- Speed pills -->
            <div class="flex items-center bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-700/50">
              <button
                v-for="rate in [1, 1.25, 1.5, 1.75, 2]"
                :key="rate"
                class="px-2 py-0.5 text-[11px] font-mono rounded transition-colors"
                :class="
                  playbackRate === rate
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                "
                @click="setPlaybackRate(rate)"
              >
                {{ rate }}x
              </button>
            </div>

            <!-- Next Lesson -->
            <button
              class="p-2 rounded-lg text-zinc-300 hover:text-emerald-400 hover:bg-white/10 transition-colors"
              title="Próxima Aula"
              @click="courseStore.playNextLesson()"
            >
              <SkipForward class="w-4 h-4" />
            </button>

            <!-- Fullscreen -->
            <button
              class="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Tela Cheia (F)"
              @click="toggleFullscreen"
            >
              <component :is="isFullscreen ? Minimize : Maximize" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
