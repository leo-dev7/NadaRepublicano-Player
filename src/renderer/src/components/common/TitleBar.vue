<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { BookOpen, Search, Settings, History, ChevronDown, FolderPlus, Folder } from 'lucide-vue-next'
import type { MpcPlaybackState } from '@shared/types/mpc'
import { useCourseStore } from '../../stores/courseStore'

const props = defineProps<{
  mpcConnected: boolean
  mpcState: MpcPlaybackState
}>()

const emit = defineEmits<{
  openCommandPalette: []
  openSettings: []
  goDashboard: []
  openCourse: [id: string]
}>()

const courseStore = useCourseStore()
const showRecentDropdown = ref(false)

function toggleRecentDropdown() {
  showRecentDropdown.value = !showRecentDropdown.value
}

function handleSelectRecent(courseId: string) {
  showRecentDropdown.value = false
  emit('openCourse', courseId)
}

async function handleImportFolder() {
  showRecentDropdown.value = false
  const folderPath = await window.api.selectFolder()
  if (folderPath) {
    const course = await courseStore.importCourse(folderPath)
    if (course) {
      emit('openCourse', course.id)
    }
  }
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.recent-dropdown-container')) {
    showRecentDropdown.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    class="h-9 flex items-center justify-between px-3 bg-surface border-b border-zinc-800 shrink-0 select-none app-drag"
  >
    <!-- Left -->
    <div class="flex items-center gap-3 app-no-drag">
      <button
        class="flex items-center gap-1.5 text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
        @click="emit('goDashboard')"
      >
        <BookOpen class="w-4 h-4 text-indigo-400" />
        <span>Nada Republicano Player</span>
      </button>

      <!-- Recent Courses Dropdown -->
      <div class="relative recent-dropdown-container">
        <button
          class="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Ver cursos recentes"
          @click="toggleRecentDropdown"
        >
          <History class="w-3.5 h-3.5 text-zinc-400" />
          <span>Cursos Recentes</span>
          <ChevronDown class="w-3 h-3 text-zinc-500" />
        </button>

        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div
            v-if="showRecentDropdown"
            class="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden"
          >
            <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/80">
              Histórico de Cursos
            </div>

            <div v-if="courseStore.recentCourses.length === 0" class="px-3 py-3 text-xs text-zinc-500 text-center">
              Nenhum curso recente
            </div>

            <div v-else class="max-h-60 overflow-y-auto divide-y divide-zinc-800/40">
              <button
                v-for="recent in courseStore.recentCourses"
                :key="recent.id"
                class="w-full text-left px-3 py-2 hover:bg-zinc-800/70 transition-colors flex flex-col gap-0.5 group"
                @click="handleSelectRecent(recent.id)"
              >
                <div class="text-xs font-semibold text-zinc-200 group-hover:text-indigo-400 truncate">
                  {{ recent.title }}
                </div>
                <div class="text-[10px] text-zinc-500 truncate flex items-center gap-1 font-mono">
                  <Folder class="w-2.5 h-2.5 shrink-0" />
                  <span>{{ recent.rootPath }}</span>
                </div>
              </button>
            </div>

            <div class="p-1 border-t border-zinc-800">
              <button
                class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors font-medium"
                @click="handleImportFolder"
              >
                <FolderPlus class="w-3.5 h-3.5" />
                <span>+ Abrir Outra Pasta de Curso</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Center -->
    <button
      class="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 hover:bg-zinc-800 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors app-no-drag"
      @click="emit('openCommandPalette')"
    >
      <Search class="w-3.5 h-3.5 text-zinc-400" />
      <span>Buscar aula ou material...</span>
      <kbd class="text-[10px] bg-zinc-700/50 px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
    </button>

    <!-- Right -->
    <div class="flex items-center gap-3 pr-24 app-no-drag">
      <!-- MPC Status -->
      <div class="flex items-center gap-1.5 text-xs">
        <div
          class="w-2 h-2 rounded-full transition-colors"
          :class="props.mpcConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'"
        />
        <span :class="props.mpcConnected ? 'text-emerald-400' : 'text-zinc-500'">
          {{ props.mpcConnected ? 'MPC Conectado' : 'MPC Offline' }}
        </span>
      </div>

      <button class="btn-icon !p-1 text-zinc-400 hover:text-zinc-200" title="Configurações" @click="emit('openSettings')">
        <Settings class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-drag {
  -webkit-app-region: drag;
}
.app-no-drag {
  -webkit-app-region: no-drag;
}
</style>
