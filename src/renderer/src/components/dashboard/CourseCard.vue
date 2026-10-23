<script setup lang="ts">
import { BookOpen, Trash2, Folder } from 'lucide-vue-next'
import { useTimeFormat } from '../../composables/useTimeFormat'
import type { Course } from '@shared/types/course'

const props = defineProps<{ course: Course }>()
const emit = defineEmits<{
  open: []
  delete: []
}>()

const { msToTime } = useTimeFormat()

const progress = Math.round(
  props.course.totalLessonsCount > 0
    ? (props.course.completedLessonsCount / props.course.totalLessonsCount) * 100
    : 0
)

function handleDelete() {
  if (confirm(`Deseja remover o curso "${props.course.cleanTitle}" do Nada Republicano Player? (Os arquivos no disco não serão apagados)`)) {
    emit('delete')
  }
}
</script>

<template>
  <div
    class="group relative rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer p-5 flex flex-col justify-between shadow-sm hover:shadow-md"
    @click="emit('open')"
  >
    <div>
      <div class="flex items-start justify-between mb-3">
        <div class="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
          <BookOpen class="w-5 h-5" />
        </div>
        <button
          class="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          title="Remover da lista"
          @click.stop="handleDelete"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>

      <h3 class="text-base font-semibold text-zinc-100 mb-1.5 line-clamp-2 leading-snug">
        {{ course.cleanTitle }}
      </h3>

      <div class="flex items-center gap-3 text-xs text-zinc-400 mb-4">
        <span class="flex items-center gap-1">
          <Folder class="w-3.5 h-3.5 text-zinc-500" />
          {{ course.modules.length }} {{ course.modules.length === 1 ? 'módulo' : 'módulos' }}
        </span>
        <span>•</span>
        <span>{{ course.completedLessonsCount }}/{{ course.totalLessonsCount }} aulas</span>
        <span v-if="course.totalDurationMs">• {{ msToTime(course.totalDurationMs) }}</span>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between text-xs mb-1.5 font-medium">
        <span :class="progress === 100 ? 'text-emerald-400' : 'text-zinc-400'">
          {{ progress === 100 ? 'Concluído' : 'Progresso' }}
        </span>
        <span :class="progress === 100 ? 'text-emerald-400' : 'text-zinc-400 font-mono'">{{ progress }}%</span>
      </div>
      <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>
  </div>
</template>

