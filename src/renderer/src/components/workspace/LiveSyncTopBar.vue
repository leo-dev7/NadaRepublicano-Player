<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Play,
  Pause,
  Camera,
  PinIcon,
  LayoutPanelLeft,
  Code,
  FolderOpen,
  SkipForward,
  Bookmark,
  Repeat,
  Tv,
  ExternalLink,
  CheckCircle2
} from 'lucide-vue-next'
import { useMpcStore } from '../../stores/mpcStore'
import { useCourseStore } from '../../stores/courseStore'
import { useMpcControls } from '../../composables/useMpcControls'
import { useTimeFormat } from '../../composables/useTimeFormat'
import type { Course, Lesson } from '@shared/types/course'

const props = defineProps<{
  course: Course
  lesson: Lesson | null
}>()

const emit = defineEmits<{
  snapAssist: []
  openVscode: []
  openExplorer: []
}>()

const mpcStore = useMpcStore()
const courseStore = useCourseStore()
const mpc = useMpcControls()
const { msToTimestamp, msToTime } = useTimeFormat()

const toast = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showNotification(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = null
  }, 2500)
}

async function handleSeekBar(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const posMs = Math.round(ratio * (mpcStore.state.durationMs || 1))
  if (mpcStore.isConnected) {
    await mpc.seek(posMs)
  }
}

async function setSpeed(targetRate: number) {
  if (mpcStore.isConnected) {
    await mpc.speedNormal()
    const currentRate = 1.0
    const diff = Math.round((targetRate - currentRate) * 10)
    for (let i = 0; i < Math.abs(diff); i++) {
      if (diff > 0) {
        await mpc.speedUp()
      } else {
        await mpc.speedDown()
      }
    }
  }
}

async function handleSnapshot() {
  if (!props.course || !props.lesson) return
  if (!mpcStore.isConnected) {
    showNotification('MPC offline: Use o botão de print no player acima')
    return
  }
  try {
    const result = await window.api.mpcSnapshot({
      courseId: props.course.id,
      lessonId: props.lesson.id,
      positionMs: mpcStore.state.positionMs,
      courseRootPath: props.course.rootPath
    })
    const ts = msToTimestamp(mpcStore.state.positionMs)
    const obsidianMarkdown = `\n> 📸 **[${ts}] Frame MPC**\n![[${result.relativePath.split(/[/\\\\]/).pop()}]]\n`
    await window.api.copyToClipboard(obsidianMarkdown)
    showNotification(`📸 Snapshot salvo e copiado para Obsidian!`)
  } catch (e: any) {
    console.error('Snapshot failed:', e)
    showNotification(`Erro no snapshot: ${e.message}`)
  }
}

async function handleBookmark() {
  if (!props.lesson) return
  const posMs = mpcStore.isConnected ? mpcStore.state.positionMs : (props.lesson.lastPositionMs || 0)
  const ts = msToTimestamp(posMs)
  const text = `- [${ts}] **${props.lesson.cleanTitle}** - `
  await window.api.copyToClipboard(text)
  showNotification(`⏱ Timestamp [${ts}] copiado para Obsidian!`)
}

async function openObsidian() {
  await window.api.openInObsidian(props.course.rootPath)
  showNotification('Abrindo pasta no Obsidian...')
}

function watchInMpc() {
  if (!props.lesson) return
  courseStore.playInMpc()
  showNotification('Iniciando MPC...')
}

function toggleAutoplay() {
  mpcStore.setAutoplayNext(!mpcStore.state.autoplayNext)
}
</script>

<template>
  <div class="flex items-center gap-2.5 px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none relative">
    <!-- Play in MPC button -->
    <button
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
      title="Abrir no player externo MPC-HC"
      @click="watchInMpc"
    >
      <Tv class="w-3.5 h-3.5" />
      <span>Abrir no MPC</span>
    </button>

    <!-- Time display if MPC is connected -->
    <div v-if="mpcStore.isConnected" class="flex items-center gap-2">
      <button
        class="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
        :title="mpcStore.isPlaying ? 'Pausar MPC' : 'Reproduzir MPC'"
        @click="mpc.playPause()"
      >
        <component :is="mpcStore.isPlaying ? Pause : Play" class="w-4 h-4 fill-current" />
      </button>

      <span class="text-xs text-zinc-400 font-mono min-w-[95px] text-center">
        {{ mpcStore.state.positionFormatted }} / {{ mpcStore.state.durationFormatted }}
      </span>

      <!-- Seek Bar -->
      <div
        class="w-36 h-2 bg-zinc-800 rounded-full cursor-pointer group relative overflow-hidden"
        title="Seek no MPC"
        @click="handleSeekBar"
      >
        <div
          class="h-full bg-emerald-500 rounded-full transition-all duration-150"
          :style="{ width: `${mpcStore.progressPercent}%` }"
        />
      </div>

      <!-- Speed pills -->
      <div class="flex items-center gap-0.5 bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-700/50">
        <button
          v-for="speed in [1, 1.25, 1.5, 2]"
          :key="speed"
          class="px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors"
          :class="
            Math.abs(mpcStore.state.playbackRate - speed) < 0.05
              ? 'bg-emerald-600 text-white font-medium'
              : 'text-zinc-400 hover:text-zinc-200'
          "
          @click="setSpeed(speed)"
        >
          {{ speed }}x
        </button>
      </div>

      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
        title="Always on Top no MPC"
        @click="mpc.toggleAlwaysOnTop()"
      >
        <PinIcon class="w-3.5 h-3.5" />
      </button>

      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
        title="Snap Assist (Lado a lado com MPC)"
        @click="emit('snapAssist')"
      >
        <LayoutPanelLeft class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="flex-1" />

    <!-- Obsidian & Productivity Quick Actions -->
    <div class="flex items-center gap-2">
      <!-- Timestamp para Obsidian -->
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-900/30 hover:bg-purple-900/60 text-purple-300 hover:text-white border border-purple-700/40 transition-colors"
        title="Copiar timestamp da aula atual para colar no Obsidian"
        @click="handleBookmark"
      >
        <Bookmark class="w-3.5 h-3.5" />
        <span>Copiar Timestamp</span>
      </button>

      <!-- Abrir no Obsidian -->
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
        title="Abrir pasta do curso no Obsidian"
        @click="openObsidian"
      >
        <ExternalLink class="w-3.5 h-3.5 text-purple-400" />
        <span>Obsidian</span>
      </button>

      <!-- Abrir no VS Code -->
      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-blue-400"
        title="Abrir pasta no VS Code"
        @click="emit('openVscode')"
      >
        <Code class="w-4 h-4" />
      </button>

      <!-- Mostrar no Explorer -->
      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-amber-400"
        title="Mostrar pasta no Windows Explorer"
        @click="emit('openExplorer')"
      >
        <FolderOpen class="w-4 h-4" />
      </button>

      <div class="w-px h-5 bg-zinc-800 mx-1" />

      <!-- Next Lesson -->
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors"
        title="Avançar para Próxima Aula"
        @click="courseStore.playNextLesson()"
      >
        <span>Próxima</span>
        <SkipForward class="w-3.5 h-3.5 text-emerald-400" />
      </button>
    </div>

    <!-- Toast Notification -->
    <Transition
      enter-active-class="transition-all duration-200"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="toast"
        class="absolute right-4 top-12 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg shadow-xl z-30 flex items-center gap-1.5"
      >
        <CheckCircle2 class="w-3.5 h-3.5 text-emerald-300" />
        <span>{{ toast }}</span>
      </div>
    </Transition>
  </div>
</template>
