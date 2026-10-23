<script setup lang="ts">
import { ref } from 'vue'
import { ChevronLeft, ChevronRight, Layers, FolderSync } from 'lucide-vue-next'
import type { Course } from '@shared/types/course'
import { useCourseStore } from '../../stores/courseStore'
import ModuleAccordion from './ModuleAccordion.vue'

const props = defineProps<{
  course: Course
  activeLessonId: string | null
  mpcActiveLessonId?: string
  mpcActiveFilePath?: string
}>()

const emit = defineEmits<{
  selectLesson: [id: string]
  playLesson: [id: string]
  toggleComplete: [id: string, value: boolean]
  openResource: [path: string]
}>()

const courseStore = useCourseStore()
const collapsed = ref(false)

async function handleChangeFolder() {
  const folderPath = await window.api.selectFolder()
  if (folderPath) {
    const newCourse = await courseStore.importCourse(folderPath)
    if (newCourse) {
      await courseStore.openCourse(newCourse.id)
    }
  }
}
</script>

<template>
  <div
    class="shrink-0 border-r border-zinc-800 bg-zinc-900/60 flex flex-col overflow-hidden transition-[width] duration-200 select-none"
    :class="collapsed ? 'w-12' : 'w-[320px]'"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/40">
      <div v-if="!collapsed" class="flex items-center gap-2 truncate">
        <Layers class="w-4 h-4 text-indigo-400 shrink-0" />
        <h3 class="text-xs font-semibold text-zinc-300 uppercase tracking-wider truncate">
          Conteúdo do Curso
        </h3>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="!collapsed"
          class="p-1 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors"
          title="Mudar pasta / selecionar outro curso"
          @click="handleChangeFolder"
        >
          <FolderSync class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors mx-auto"
          :title="collapsed ? 'Expandir currículo' : 'Recolher currículo'"
          @click="collapsed = !collapsed"
        >
          <component :is="collapsed ? ChevronRight : ChevronLeft" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Module List -->
    <div v-if="!collapsed" class="flex-1 overflow-y-auto divide-y divide-zinc-800/40 py-1">
      <ModuleAccordion
        v-for="mod in course.modules"
        :key="mod.id"
        :module="mod"
        :active-lesson-id="activeLessonId"
        :mpc-active-lesson-id="mpcActiveLessonId"
        :mpc-active-file-path="mpcActiveFilePath"
        @select-lesson="emit('selectLesson', $event)"
        @play-lesson="emit('playLesson', $event)"
        @toggle-complete="(id, val) => emit('toggleComplete', id, val)"
        @open-resource="emit('openResource', $event)"
      />
    </div>
  </div>
</template>

