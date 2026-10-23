<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import type { Module } from '@shared/types/course'
import { useTimeFormat } from '../../composables/useTimeFormat'
import LessonRow from './LessonRow.vue'

const props = defineProps<{
  module: Module
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

const { msToTime } = useTimeFormat()
const expanded = ref(true)

const progress = computed(() => {
  const total = props.module.lessons.length
  if (total === 0) return 0
  return Math.round((props.module.completedLessonsCount / total) * 100)
})
</script>

<template>
  <div class="py-1">
    <!-- Module Header -->
    <button
      class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/40 transition-colors group"
      @click="expanded = !expanded"
    >
      <component :is="expanded ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold text-zinc-200 truncate">{{ module.cleanTitle }}</div>
        <div class="text-[10px] text-zinc-400 mt-0.5">
          {{ module.completedLessonsCount }}/{{ module.lessons.length }} aulas
          <span v-if="module.totalDurationMs"> • {{ msToTime(module.totalDurationMs) }}</span>
        </div>
      </div>
      <!-- Mini Progress bar -->
      <div class="w-7 h-1 bg-zinc-800 rounded-full overflow-hidden shrink-0">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </button>

    <!-- Lessons list -->
    <div v-if="expanded" class="space-y-0.5 px-1 pt-1">
      <LessonRow
        v-for="lesson in module.lessons"
        :key="lesson.id"
        :lesson="lesson"
        :is-active="lesson.id === activeLessonId"
        :is-playing="
          lesson.id === mpcActiveLessonId ||
          (!!mpcActiveFilePath && mpcActiveFilePath.toLowerCase().replace(/\\/g, '/').endsWith(lesson.relativePath.toLowerCase().replace(/\\/g, '/')))"
        @select="emit('selectLesson', lesson.id)"
        @play="emit('playLesson', lesson.id)"
        @toggle-complete="(val) => emit('toggleComplete', lesson.id, val)"
        @open-resource="emit('openResource', $event)"
      />
    </div>
  </div>
</template>

