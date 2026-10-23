<script setup lang="ts">
import { computed } from 'vue'
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
  Repeat
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
const { msToTimestamp } = useTimeFormat()

async function handleSeekBar(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const posMs = Math.round(ratio * (mpcStore.state.durationMs || 1))
  await mpc.seek(posMs)
}

async function setSpeed(targetRate: number) {
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

async function handleSnapshot() {
  if (!props.course || !props.lesson) return
  try {
    const result = await window.api.mpcSnapshot({
      courseId: props.course.id,
      lessonId: props.lesson.id,
      positionMs: mpcStore.state.positionMs,
      courseRootPath: props.course.rootPath
    })
    const current = courseStore.activeNoteContent || ''
    const updated = current + '\n' + result.markdownSnippet + '\n'
    await courseStore.saveNote(updated)
  } catch (e) {
    console.error('Snapshot failed:', e)
  }
}

async function handleBookmark() {
  if (!props.course || !props.lesson) return
  const ts = msToTimestamp(mpcStore.state.positionMs)
  const current = courseStore.activeNoteContent || ''
  const bookmarkSnippet = `\n> 🔖 **[${ts}] Marcador de Estudo**\n`
  await courseStore.saveNote(current + bookmarkSnippet)
}

function toggleAutoplay() {
  mpcStore.setAutoplayNext(!mpcStore.state.autoplayNext)
}
</script>

<template>
  <div class="flex items-center gap-2.5 px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
    <!-- Play/Pause -->
    <button
      class="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
      :title="mpcStore.isPlaying ? 'Pausar (Space)' : 'Reproduzir'"
      @click="mpc.playPause()"
    >
      <component :is="mpcStore.isPlaying ? Pause : Play" class="w-4 h-4 fill-current" />
    </button>

    <!-- Time display -->
    <div class="text-xs text-zinc-400 font-mono min-w-[95px] text-center">
      {{ mpcStore.state.positionFormatted }} / {{ mpcStore.state.durationFormatted }}
    </div>

    <!-- Seek Bar -->
    <div
      class="flex-1 h-2 bg-zinc-800 rounded-full cursor-pointer group relative overflow-hidden"
      title="Clique para avançar/retroceder"
      @click="handleSeekBar"
    >
      <div
        class="h-full bg-indigo-500 rounded-full transition-all duration-150 relative"
        :style="{ width: `${mpcStore.progressPercent}%` }"
      />
    </div>

    <!-- Speed pills -->
    <div class="flex items-center gap-1 bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-700/50">
      <button
        v-for="speed in [1, 1.25, 1.5, 2]"
        :key="speed"
        class="px-2 py-0.5 text-[11px] font-mono rounded transition-colors"
        :class="
          Math.abs(mpcStore.state.playbackRate - speed) < 0.05
            ? 'bg-indigo-600 text-white font-medium'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
        "
        @click="setSpeed(speed)"
      >
        {{ speed }}x
      </button>
    </div>

    <div class="w-px h-5 bg-zinc-800" />

    <!-- Actions -->
    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-indigo-400"
      title="Capturar Frame Atual para Nota (Alt+S)"
      @click="handleSnapshot"
    >
      <Camera class="w-4 h-4" />
    </button>

    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-amber-400"
      title="Adicionar Marcador de Estudo (Alt+B)"
      @click="handleBookmark"
    >
      <Bookmark class="w-4 h-4" />
    </button>

    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
      :class="{ 'text-indigo-400 bg-indigo-500/15': mpcStore.state.autoplayNext }"
      title="Autoplay da Próxima Aula"
      @click="toggleAutoplay"
    >
      <Repeat class="w-4 h-4" />
    </button>

    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
      title="Always on Top no MPC"
      @click="mpc.toggleAlwaysOnTop()"
    >
      <PinIcon class="w-4 h-4" />
    </button>

    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
      title="Snap Assist (Lado a lado com MPC)"
      @click="emit('snapAssist')"
    >
      <LayoutPanelLeft class="w-4 h-4" />
    </button>

    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-emerald-400"
      title="Avançar para Próxima Aula (Alt+N)"
      @click="courseStore.playNextLesson()"
    >
      <SkipForward class="w-4 h-4" />
    </button>

    <div class="w-px h-5 bg-zinc-800" />

    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-blue-400"
      title="Abrir pasta no VS Code"
      @click="emit('openVscode')"
    >
      <Code class="w-4 h-4" />
    </button>

    <button
      class="btn-icon !p-1.5 text-zinc-400 hover:text-amber-400"
      title="Mostrar no Windows Explorer"
      @click="emit('openExplorer')"
    >
      <FolderOpen class="w-4 h-4" />
    </button>
  </div>
</template>

