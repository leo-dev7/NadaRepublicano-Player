<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Play, Clock } from 'lucide-vue-next'
import { useTimeFormat } from '../../composables/useTimeFormat'
import type { Course } from '@shared/types/course'

const emit = defineEmits<{
  resume: [courseId: string]
}>()

const { msToTime } = useTimeFormat()

const lastData = ref<{ course: Course; lessonId?: string; positionMs?: number } | null>(null)

onMounted(async () => {
  try {
    lastData.value = await window.api.getLastCourse()
  } catch {
    // None
  }
})

function getLastLessonTitle(): string {
  if (!lastData.value?.course || !lastData.value.lessonId) return ''
  for (const mod of lastData.value.course.modules) {
    const lesson = mod.lessons.find((l) => l.id === lastData.value!.lessonId)
    if (lesson) return lesson.cleanTitle
  }
  return ''
}
</script>

<template>
  <div
    v-if="lastData?.course"
    class="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-indigo-950/40 p-6 shadow-xl"
  >
    <div class="relative z-10">
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        <p class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Continuar de onde parou</p>
      </div>

      <h3 class="text-xl font-bold text-zinc-100 mb-1.5">{{ lastData.course.cleanTitle }}</h3>
      <p v-if="getLastLessonTitle()" class="text-sm text-zinc-400 mb-5 flex items-center gap-2">
        <span class="text-zinc-500">Última aula:</span>
        <span class="text-zinc-300 font-medium">{{ getLastLessonTitle() }}</span>
      </p>

      <div class="flex flex-wrap items-center gap-4">
        <button
          class="inline-flex items-center gap-2.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-indigo-500/25 active:scale-95"
          @click="emit('resume', lastData!.course.id)"
        >
          <Play class="w-4 h-4 fill-current" />
          <span>Retomar Aula no MPC</span>
          <span v-if="lastData.positionMs" class="text-indigo-200 text-xs font-normal">
            (parou aos {{ msToTime(lastData.positionMs) }})
          </span>
        </button>

        <div class="flex items-center gap-1.5 text-xs text-zinc-400">
          <Clock class="w-4 h-4 text-zinc-500" />
          <span>{{ lastData.course.completedLessonsCount }} de {{ lastData.course.totalLessonsCount }} aulas concluídas</span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mt-5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
          :style="{
            width: `${
              lastData.course.totalLessonsCount > 0
                ? Math.round((lastData.course.completedLessonsCount / lastData.course.totalLessonsCount) * 100)
                : 0
            }%`
          }"
        />
      </div>
    </div>
  </div>
</template>

