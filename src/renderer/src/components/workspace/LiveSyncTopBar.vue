<script setup lang="ts">
import { ref } from 'vue'
import {
  Play,
  Pause,
  PinIcon,
  LayoutPanelLeft,
  Camera,
  Code,
  FolderOpen,
  SkipForward,
  Tv,
  ArrowLeft,
  FolderSync,
  CheckCircle2,
  History,
  ChevronDown,
  Folder
} from 'lucide-vue-next'
import { useMpcStore } from '../../stores/mpcStore'
import { useCourseStore } from '../../stores/courseStore'
import { useMpcControls } from '../../composables/useMpcControls'
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

const showRecent = ref(false)
const toast = ref<string | null>(null)
const isCapturing = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showNotification(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = null
  }, 2500)
}

async function handleCopyFrameSnapshot() {
  if (isCapturing.value) return
  isCapturing.value = true
  try {
    const res = await window.api.mpcSnapshotToClipboard()
    if (res.success) {
      showNotification('✓ Print do frame copiado para a área de transferência!')
    } else {
      showNotification(`Aviso: ${res.error || 'Não foi possível capturar o frame do MPC'}`)
    }
  } catch {
    showNotification('Falha ao comunicar com o MPC para obter o frame.')
  } finally {
    setTimeout(() => {
      isCapturing.value = false
    }, 400)
  }
}

async function handleSelectRecentCourse(id: string) {
  showRecent.value = false
  await courseStore.openCourse(id, false)
}

async function handleChangeFolder() {
  const folderPath = await window.api.selectFolder()
  if (folderPath) {
    const newCourse = await courseStore.importCourse(folderPath)
    if (newCourse) {
      await courseStore.openCourse(newCourse.id, false)
      showNotification('Pasta do curso alterada com sucesso!')
    }
  }
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

function watchInMpc() {
  if (!props.lesson) return
  courseStore.playInMpc()
  showNotification('Iniciando MPC...')
}
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none relative">
    <!-- Back to Dashboard -->
    <button
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
      title="Voltar para a lista de cursos"
      @click="courseStore.goToDashboard()"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Voltar</span>
    </button>

    <!-- Mudar Pasta do Curso (Requested feature) -->
    <button
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-indigo-400 hover:text-indigo-300 border border-zinc-700/80 transition-all shadow-sm"
      title="Selecionar outra pasta de curso no disco"
      @click="handleChangeFolder"
    >
      <FolderSync class="w-3.5 h-3.5" />
      <span>Mudar Pasta</span>
    </button>

    <!-- Recent Courses Selector Dropdown -->
    <div class="relative">
      <button
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        title="Alternar para outro curso recente"
        @click="showRecent = !showRecent"
      >
        <History class="w-3.5 h-3.5 text-zinc-400" />
        <span>Recentes</span>
        <ChevronDown class="w-3 h-3 text-zinc-500" />
      </button>

      <div
        v-if="showRecent"
        class="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50 overflow-hidden"
      >
        <div class="px-3 py-1 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-800">
          Cursos Recentes
        </div>
        <div class="max-h-56 overflow-y-auto divide-y divide-zinc-800/40">
          <button
            v-for="rec in courseStore.recentCourses"
            :key="rec.id"
            class="w-full text-left px-3 py-2 hover:bg-zinc-800/80 text-xs flex flex-col gap-0.5"
            :class="rec.id === course.id ? 'bg-indigo-600/10 text-indigo-400' : 'text-zinc-300'"
            @click="handleSelectRecentCourse(rec.id)"
          >
            <span class="font-medium truncate">{{ rec.title }}</span>
            <span class="text-[10px] text-zinc-500 font-mono truncate">{{ rec.rootPath }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="w-px h-5 bg-zinc-800" />

    <!-- MPC Controls (if MPC is connected) -->
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
        class="w-32 h-2 bg-zinc-800 rounded-full cursor-pointer group relative overflow-hidden"
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

      <!-- Snapshot / Print do frame para Área de Transferência -->
      <button
        class="btn-icon !p-1.5 transition-colors relative"
        :class="isCapturing ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800'"
        title="Tirar print do frame e copiar para a área de transferência (Alt+S)"
        :disabled="isCapturing"
        @click="handleCopyFrameSnapshot"
      >
        <Camera class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="flex-1" />

    <!-- Actions Right -->
    <div class="flex items-center gap-2">
      <!-- Assistir no MPC -->
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
        title="Abrir a aula atual no player externo MPC-HC"
        @click="watchInMpc"
      >
        <Tv class="w-3.5 h-3.5" />
        <span>Abrir no MPC</span>
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
