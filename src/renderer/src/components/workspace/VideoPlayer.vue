<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Tv,
  SkipForward,
  LayoutPanelLeft,
  FolderOpen,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Paperclip,
  FileText,
  FileCode,
  Archive,
  File
} from 'lucide-vue-next'
import type { Course, Lesson, Attachment, Module } from '@shared/types/course'
import { useTimeFormat } from '../../composables/useTimeFormat'
import { useCourseStore } from '../../stores/courseStore'
import { useMpcStore } from '../../stores/mpcStore'
import { useMpcControls } from '../../composables/useMpcControls'

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
const mpc = useMpcControls()
const { msToTime } = useTimeFormat()

// Display mode: 'mpc' (primary) or 'embedded' (optional fallback)
const displayMode = ref<'mpc' | 'embedded'>('mpc')
const isStartingMpc = ref(false)
const toastMessage = ref<string | null>(null)
let toastTimeout: ReturnType<typeof setTimeout> | null = null

// Embedded player state
const videoRef = ref<HTMLVideoElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const embeddedPlaying = ref(false)
const embeddedCurrentTime = ref(0)
const embeddedDuration = ref(0)
const embeddedVolume = ref(1)
const embeddedMuted = ref(false)
const embeddedRate = ref(1)
const embeddedFullscreen = ref(false)
const hasMediaError = ref(false)
const mediaErrorMessage = ref('')
const subtitleUrl = ref<string | null>(null)

const isMpcActiveWithThisLesson = computed(() => {
  if (!mpcStore.isConnected || !props.lesson) return false
  if (mpcStore.state.activeLessonId === props.lesson.id) return true
  if (mpcStore.state.activeFilePath) {
    const curPath = mpcStore.state.activeFilePath.toLowerCase().replace(/\\/g, '/')
    const lessonPath = props.lesson.relativePath.toLowerCase().replace(/\\/g, '/')
    return curPath.endsWith(lessonPath)
  }
  return false
})

const livePositionMs = computed(() => {
  if (displayMode.value === 'embedded') {
    return Math.round(embeddedCurrentTime.value * 1000)
  }
  if (isMpcActiveWithThisLesson.value) {
    return mpcStore.state.positionMs
  }
  return props.lesson?.lastPositionMs || 0
})

const liveDurationMs = computed(() => {
  if (displayMode.value === 'embedded') {
    return Math.round(embeddedDuration.value * 1000)
  }
  if (isMpcActiveWithThisLesson.value && mpcStore.state.durationMs > 0) {
    return mpcStore.state.durationMs
  }
  return props.lesson?.durationMs || 0
})

const progressPercent = computed(() => {
  if (liveDurationMs.value <= 0) return 0
  return Math.min(100, (livePositionMs.value / liveDurationMs.value) * 100)
})

const activeModuleAttachments = computed((): Attachment[] => {
  if (!props.course || !props.lesson) return []
  function findMod(modules: Module[]): Module | null {
    for (const m of modules) {
      if (m.id === props.lesson?.moduleId) return m
      if (m.subModules && m.subModules.length > 0) {
        const found = findMod(m.subModules)
        if (found) return found
      }
    }
    return null
  }
  const mod = findMod(props.course.modules)
  return mod?.attachments || []
})

const allCurrentMaterials = computed(() => {
  const list: { att: Attachment; source: 'lesson' | 'module' | 'course' }[] = []
  if (props.lesson?.attachments) {
    for (const a of props.lesson.attachments) {
      list.push({ att: a, source: 'lesson' })
    }
  }
  for (const a of activeModuleAttachments.value) {
    list.push({ att: a, source: 'module' })
  }
  if (props.course?.attachments) {
    for (const a of props.course.attachments) {
      list.push({ att: a, source: 'course' })
    }
  }
  return list
})

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getMaterialIcon(kind: string) {
  switch (kind) {
    case 'pdf':
      return FileText
    case 'code':
      return FileCode
    case 'archive':
      return Archive
    case 'text':
      return FileText
    default:
      return File
  }
}

async function handleOpenMaterial(path: string) {
  await window.api.openPath(path)
  showToast('Abrindo arquivo...')
}

function handleShowInExplorer(path: string) {
  window.api.openInExplorer(path)
}

function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    toastMessage.value = null
  }, 2500)
}

async function handleLaunchMpc(withSnap = false) {
  if (!props.lesson) return
  isStartingMpc.value = true
  try {
    await courseStore.playInMpc(props.lesson.id)
    if (withSnap) {
      setTimeout(() => {
        window.api.snapAssist()
      }, 300)
    }
    showToast('Aula iniciada no MPC!')
  } catch (err) {
    showToast('Erro ao abrir MPC. Verifique se está instalado.')
  } finally {
    isStartingMpc.value = false
  }
}

async function handleSnapAssist() {
  await window.api.snapAssist()
  showToast('Janelas organizadas lado a lado!')
}

async function handleMpcPlayPause() {
  if (isMpcActiveWithThisLesson.value) {
    await mpc.playPause()
  } else {
    await handleLaunchMpc()
  }
}

async function handleMpcSeek(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const targetMs = Math.round(ratio * (liveDurationMs.value || 1))

  if (displayMode.value === 'embedded' && videoRef.value) {
    videoRef.value.currentTime = targetMs / 1000
  } else if (mpcStore.isConnected) {
    await mpc.seek(targetMs)
  } else {
    // Update local position and open in MPC at that position
    if (props.lesson) {
      await window.api.mpcOpenFile({
        filePath: props.lesson.absolutePath,
        startMs: targetMs,
        lessonId: props.lesson.id
      })
    }
  }
}

async function handleMpcRelativeSeek(seconds: number) {
  if (displayMode.value === 'embedded' && videoRef.value) {
    videoRef.value.currentTime = Math.max(0, Math.min(embeddedDuration.value, videoRef.value.currentTime + seconds))
  } else if (mpcStore.isConnected) {
    const targetMs = Math.max(0, livePositionMs.value + seconds * 1000)
    await mpc.seek(targetMs)
  }
}

async function setMpcSpeed(speed: number) {
  if (displayMode.value === 'embedded' && videoRef.value) {
    embeddedRate.value = speed
    videoRef.value.playbackRate = speed
    return
  }
  if (!mpcStore.isConnected) return
  await mpc.speedNormal()
  const diff = Math.round((speed - 1.0) * 10)
  for (let i = 0; i < Math.abs(diff); i++) {
    if (diff > 0) await mpc.speedUp()
    else await mpc.speedDown()
  }
}

function handleOpenExplorer() {
  if (props.lesson) {
    window.api.openInExplorer(props.lesson.absolutePath)
  }
}

// Embedded video functions
const videoSrc = computed(() => {
  if (!props.lesson?.absolutePath) return ''
  return `local-media://stream?path=${encodeURIComponent(props.lesson.absolutePath)}`
})

function handleVideoError(e: Event) {
  hasMediaError.value = true
  const video = e.target as HTMLVideoElement
  const err = video.error
  if (err && err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    mediaErrorMessage.value = 'Este formato (MKV/HEVC/AC3) requer o MPC com aceleração de hardware nativa.'
  } else {
    mediaErrorMessage.value = 'Erro de codec no player embutido. Recomendado usar o MPC.'
  }
}

function toggleEmbeddedPlay() {
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play().then(() => {
      embeddedPlaying.value = true
    }).catch(() => {})
  } else {
    videoRef.value.pause()
    embeddedPlaying.value = false
  }
}

function handleEmbeddedTimeUpdate() {
  if (!videoRef.value) return
  embeddedCurrentTime.value = videoRef.value.currentTime
  embeddedDuration.value = videoRef.value.duration || 0
}

function handleEmbeddedLoadedMetadata() {
  if (!videoRef.value) return
  hasMediaError.value = false
  embeddedDuration.value = videoRef.value.duration || 0
  if (props.lesson?.lastPositionMs) {
    videoRef.value.currentTime = props.lesson.lastPositionMs / 1000
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

// Watch lesson changes: if lesson changes, reset media errors and update
watch(
  () => props.lesson?.id,
  () => {
    hasMediaError.value = false
    mediaErrorMessage.value = ''
  }
)
</script>

<template>
  <div class="relative w-full h-full bg-zinc-950 flex flex-col overflow-hidden select-none">
    <!-- Header / Subtitle Info Bar -->
    <div class="px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
      <div class="min-w-0 pr-4">
        <div class="flex items-center gap-2 text-xs text-indigo-400 font-medium truncate">
          <span>{{ course.cleanTitle }}</span>
          <span class="text-zinc-600">•</span>
          <span class="text-zinc-400 truncate">{{ lesson?.cleanTitle || 'Nenhuma aula selecionada' }}</span>
        </div>
      </div>

      <!-- Mode & Status Badges -->
      <div class="flex items-center gap-2.5 shrink-0">
        <!-- MPC Live State Pill -->
        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
          :class="
            isMpcActiveWithThisLesson
              ? (mpcStore.isPlaying ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400')
              : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400'
          "
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="
              isMpcActiveWithThisLesson
                ? (mpcStore.isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400')
                : (mpcStore.isConnected ? 'bg-indigo-400' : 'bg-zinc-600')
            "
          />
          <span>
            {{
              isMpcActiveWithThisLesson
                ? (mpcStore.isPlaying ? 'MPC: Em Reprodução' : 'MPC: Pausado')
                : (mpcStore.isConnected ? 'MPC Conectado' : 'MPC Aguardando')
            }}
          </span>
        </div>

        <!-- Mode Toggle -->
        <button
          class="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/80 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 transition-colors"
          :title="displayMode === 'mpc' ? 'Testar player web embutido' : 'Voltar ao modo MPC (Recomendado)'"
          @click="displayMode = displayMode === 'mpc' ? 'embedded' : 'mpc'"
        >
          {{ displayMode === 'mpc' ? 'Player Web' : 'Centro MPC' }}
        </button>
      </div>
    </div>

    <!-- MAIN STAGE: MPC Control Companion (Recommended) -->
    <div
      v-if="displayMode === 'mpc'"
      class="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto"
    >
      <div class="w-full max-w-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-900/50 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        <!-- Background Glow -->
        <div class="absolute -top-24 -left-24 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div class="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <!-- Top icon -->
        <div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-inner">
          <Tv class="w-10 h-10" />
        </div>

        <!-- Lesson Title -->
        <h2 class="text-xl font-bold text-zinc-100 mb-1 max-w-lg leading-snug">
          {{ lesson?.cleanTitle || 'Selecione uma aula' }}
        </h2>
        <p class="text-xs text-zinc-400 mb-6 font-mono truncate max-w-md">
          {{ lesson?.originalFilename }}
        </p>

        <!-- Big Launch in MPC Buttons -->
        <div class="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            class="inline-flex items-center gap-2.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
            @click="handleLaunchMpc(false)"
          >
            <Play class="w-4 h-4 fill-current" />
            <span>{{ isMpcActiveWithThisLesson ? 'Trazer MPC para Frente' : 'Abrir no MPC-HC' }}</span>
          </button>

          <button
            class="inline-flex items-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white text-sm font-medium rounded-xl border border-zinc-700/80 transition-all shadow-sm"
            title="Abre o MPC e divide a tela perfeitamente lado a lado"
            @click="handleLaunchMpc(true)"
          >
            <LayoutPanelLeft class="w-4 h-4 text-indigo-400" />
            <span>Encaixar Lado a Lado</span>
          </button>
        </div>

        <!-- Live MPC Control Console -->
        <div class="w-full bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-5 shadow-inner">
          <!-- Time & Position -->
          <div class="flex items-center justify-between text-xs text-zinc-400 mb-2 font-mono">
            <span class="text-zinc-200 font-semibold">{{ msToTime(livePositionMs) }}</span>
            <span>{{ msToTime(liveDurationMs) }}</span>
          </div>

          <!-- Scrub Seek Bar -->
          <div
            class="w-full h-2.5 bg-zinc-800 hover:h-3 rounded-full cursor-pointer relative group transition-all duration-150 overflow-hidden mb-5"
            title="Clique para ir a este ponto no MPC"
            @click="handleMpcSeek"
          >
            <div
              class="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-150"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>

          <!-- Media Remote Controls -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Left: Seek jumps -->
            <div class="flex items-center gap-2">
              <button
                class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Voltar 10s"
                @click="handleMpcRelativeSeek(-10)"
              >
                <RotateCcw class="w-4 h-4" />
              </button>

              <button
                class="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all shadow-md"
                :title="isMpcActiveWithThisLesson && mpcStore.isPlaying ? 'Pausar MPC' : 'Reproduzir MPC'"
                @click="handleMpcPlayPause"
              >
                <component
                  :is="isMpcActiveWithThisLesson && mpcStore.isPlaying ? Pause : Play"
                  class="w-5 h-5 fill-current"
                />
              </button>

              <button
                class="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Avançar 10s"
                @click="handleMpcRelativeSeek(10)"
              >
                <RotateCw class="w-4 h-4" />
              </button>
            </div>

            <!-- Center: Speed presets -->
            <div class="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800">
              <button
                v-for="s in [1, 1.25, 1.5, 2]"
                :key="s"
                class="px-2.5 py-1 text-xs font-mono rounded transition-colors"
                :class="
                  Math.abs((mpcStore.state.playbackRate || 1) - s) < 0.05
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                "
                @click="setMpcSpeed(s)"
              >
                {{ s }}x
              </button>
            </div>

            <!-- Right: Next Lesson -->
            <div class="flex items-center gap-2">
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors"
                title="Próxima aula do módulo"
                @click="courseStore.playNextLesson()"
              >
                <span>Próxima</span>
                <SkipForward class="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>

        <!-- Quick Actions Footer -->
        <div class="w-full flex items-center justify-between mt-5 pt-4 border-t border-zinc-800/80 text-xs text-zinc-400">
          <button
            class="flex items-center gap-1.5 hover:text-zinc-200 transition-colors"
            @click="handleOpenExplorer"
          >
            <FolderOpen class="w-3.5 h-3.5 text-amber-400" />
            <span>Mostrar arquivo no Explorer</span>
          </button>

          <button
            v-if="lesson"
            class="flex items-center gap-1.5 transition-colors"
            :class="lesson.isCompleted ? 'text-emerald-400 font-semibold' : 'hover:text-zinc-200'"
            @click="courseStore.markLessonComplete(lesson.id, !lesson.isCompleted)"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ lesson.isCompleted ? 'Aula Concluída' : 'Marcar como Concluída' }}</span>
          </button>
        </div>

        <!-- Materials & Attachments (Lesson, Subfolders & Module) -->
        <div
          v-if="allCurrentMaterials.length > 0"
          class="w-full mt-6 bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 text-left"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Paperclip class="w-4 h-4 text-indigo-400" />
              <h4 class="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Materiais de Apoio da Aula & Módulo
              </h4>
              <span class="px-1.5 py-0.2 bg-zinc-800 text-[10px] rounded-full text-indigo-400 font-mono">
                {{ allCurrentMaterials.length }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
            <div
              v-for="item in allCurrentMaterials"
              :key="item.att.id"
              class="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800/80 group transition-all"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <component
                  :is="getMaterialIcon(item.att.kind)"
                  class="w-4 h-4 shrink-0"
                  :class="{
                    'text-rose-400': item.att.kind === 'pdf',
                    'text-sky-400': item.att.kind === 'code',
                    'text-amber-400': item.att.kind === 'archive',
                    'text-emerald-400': item.att.kind === 'text',
                    'text-zinc-400': item.att.kind === 'other'
                  }"
                />
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-medium text-zinc-200 group-hover:text-white truncate" :title="item.att.filename">
                    {{ item.att.cleanTitle }}
                  </div>
                  <div class="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                    <span class="px-1 py-0.2 rounded bg-zinc-800 text-[9px] uppercase text-zinc-400">
                      {{ item.source === 'lesson' ? 'Aula' : (item.source === 'module' ? 'Módulo' : 'Geral') }}
                    </span>
                    <span v-if="item.att.sizeBytes">• {{ formatFileSize(item.att.sizeBytes) }}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  class="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/60"
                  title="Mostrar arquivo no Explorer"
                  @click="handleShowInExplorer(item.att.absolutePath)"
                >
                  <FolderOpen class="w-3.5 h-3.5" />
                </button>
                <button
                  class="p-1 rounded text-zinc-400 hover:text-indigo-300 hover:bg-zinc-700/60"
                  title="Abrir arquivo no aplicativo padrão"
                  @click="handleOpenMaterial(item.att.absolutePath)"
                >
                  <ExternalLink class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- OPTIONAL EMBEDDED WEB PLAYER STAGE -->
    <div
      v-else
      ref="containerRef"
      class="flex-1 relative bg-black flex flex-col justify-between overflow-hidden group select-none"
    >
      <video
        ref="videoRef"
        :src="videoSrc"
        class="w-full h-full object-contain cursor-pointer"
        playsinline
        @click="toggleEmbeddedPlay"
        @dblclick="toggleFullscreen"
        @timeupdate="handleEmbeddedTimeUpdate"
        @loadedmetadata="handleEmbeddedLoadedMetadata"
        @error="handleVideoError"
      />

      <!-- Codec Error Alert in Embedded Mode -->
      <div
        v-if="hasMediaError"
        class="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-8 text-center z-30"
      >
        <div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 mb-4">
          <Tv class="w-12 h-12 text-indigo-400" />
        </div>
        <h3 class="text-lg font-bold text-zinc-100 mb-2">Este formato de vídeo requer o MPC</h3>
        <p class="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
          {{ mediaErrorMessage }}
        </p>
        <button
          class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2.5 shadow-xl hover:scale-105 active:scale-95 transition-all"
          @click="displayMode = 'mpc'; handleLaunchMpc()"
        >
          <Play class="w-4 h-4 fill-current" />
          <span>Voltar para o Modo MPC</span>
        </button>
      </div>

      <!-- Embedded Controls Bar -->
      <div
        v-if="!hasMediaError"
        class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-2"
      >
        <div
          class="h-2 bg-zinc-700/60 rounded-full cursor-pointer relative overflow-hidden"
          @click="handleMpcSeek"
        >
          <div
            class="h-full bg-indigo-500 rounded-full"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>

        <div class="flex items-center justify-between text-xs text-zinc-300">
          <div class="flex items-center gap-3">
            <button class="p-1 hover:text-white" @click="toggleEmbeddedPlay">
              <component :is="embeddedPlaying ? Pause : Play" class="w-4 h-4 fill-current" />
            </button>
            <span class="font-mono">{{ msToTime(embeddedCurrentTime * 1000) }} / {{ msToTime(embeddedDuration * 1000) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-2 py-1 rounded bg-zinc-800 hover:bg-indigo-600 text-[11px]" @click="displayMode = 'mpc'">
              Mudar para MPC
            </button>
            <button class="p-1 hover:text-white" @click="toggleFullscreen">
              <component :is="embeddedFullscreen ? Minimize : Maximize" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Toast Notification -->
    <Transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="toastMessage"
        class="absolute bottom-6 right-6 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-2xl z-50 flex items-center gap-2"
      >
        <CheckCircle2 class="w-4 h-4 text-emerald-300" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>
  </div>
</template>
