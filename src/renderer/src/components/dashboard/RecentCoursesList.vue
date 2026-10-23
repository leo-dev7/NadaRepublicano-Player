<script setup lang="ts">
import { computed } from 'vue'
import { Folder, Clock, BookOpen, FolderOpen, Trash2 } from 'lucide-vue-next'
import { useCourseStore } from '../../stores/courseStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { CourseListEntry } from '@shared/types/course'

const courseStore = useCourseStore()
const settingsStore = useSettingsStore()

const emit = defineEmits<{
  openCourse: [courseId: string, autoPlay: boolean]
}>()

const recentCourses = computed(() => courseStore.recentCourses)

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Agora mesmo'
    if (diffMins < 60) return `Há ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Há ${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `Há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`
  } catch {
    return 'Recentemente'
  }
}

function handleOpenExplorer(path: string) {
  window.api.openInExplorer(path)
}

function handleDeleteRecent(course: CourseListEntry) {
  courseStore.deleteCourse(course.id)
}
</script>

<template>
  <div v-if="recentCourses.length > 0" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
      <div>
        <h2 class="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <Clock class="w-5 h-5 text-indigo-400" />
          <span>Cursos Recentes</span>
        </h2>
        <p class="text-xs text-zinc-400 mt-0.5">
          Suas pastas locais abertas recentemente — clique para abrir o curso no workspace
        </p>
      </div>
    </div>

    <!-- Recent items list -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="course in recentCourses"
        :key="course.id"
        class="group relative rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800/80 hover:border-zinc-700 p-5 transition-all flex flex-col justify-between shadow-sm hover:shadow-md cursor-pointer"
        @click="emit('openCourse', course.id, false)"
      >
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <h3 class="text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-indigo-300 transition-colors" :title="course.title">
              {{ course.title }}
            </h3>
            <button
              class="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remover do histórico recente"
              @click.stop="handleDeleteRecent(course)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Folder path -->
          <div
            class="flex items-center gap-1.5 text-xs text-zinc-400 font-mono truncate mb-3 hover:text-zinc-200"
            :title="`Abrir pasta: ${course.rootPath}`"
            @click.stop="handleOpenExplorer(course.rootPath)"
          >
            <Folder class="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span class="truncate">{{ course.rootPath }}</span>
          </div>
        </div>

        <div class="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
          <span class="text-[11px] text-zinc-500 flex items-center gap-1">
            <Clock class="w-3 h-3" />
            {{ formatRelativeTime(course.lastAccessedAt) }}
          </span>

          <div class="flex items-center gap-1.5">
            <button
              class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Mostrar pasta no Windows Explorer"
              @click.stop="handleOpenExplorer(course.rootPath)"
            >
              <FolderOpen class="w-4 h-4" />
            </button>
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-medium rounded-lg transition-all shadow-sm"
              @click.stop="emit('openCourse', course.id, false)"
            >
              <BookOpen class="w-3.5 h-3.5" />
              <span>Acessar Curso</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

