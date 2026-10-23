<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCourseStore } from '../../stores/courseStore'
import { Search, BookOpen, Play } from 'lucide-vue-next'

const emit = defineEmits<{
  close: []
  openCourse: [id: string]
  playLesson: [id: string]
}>()

const courseStore = useCourseStore()
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface SearchResult {
  type: 'course' | 'lesson'
  id: string
  title: string
  subtitle?: string
  courseId?: string
}

const results = computed((): SearchResult[] => {
  const q = query.value.toLowerCase().trim()
  const items: SearchResult[] = []

  for (const course of courseStore.courses) {
    if (!q || course.cleanTitle.toLowerCase().includes(q)) {
      items.push({
        type: 'course',
        id: course.id,
        title: course.cleanTitle,
        subtitle: `${course.totalLessonsCount} aulas`
      })
    }
    if (q) {
      for (const mod of course.modules) {
        for (const lesson of mod.lessons) {
          if (lesson.cleanTitle.toLowerCase().includes(q)) {
            items.push({
              type: 'lesson',
              id: lesson.id,
              title: lesson.cleanTitle,
              subtitle: `${course.cleanTitle} → ${mod.cleanTitle}`,
              courseId: course.id
            })
          }
        }
      }
    }
  }
  return items.slice(0, 20)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, Math.max(0, results.value.length - 1))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    selectItem(selectedIndex.value)
  }
}

function selectItem(index: number) {
  const item = results.value[index]
  if (!item) return
  if (item.type === 'course') {
    emit('openCourse', item.id)
  } else {
    if (item.courseId) {
      courseStore.openCourse(item.courseId).then(() => {
        emit('playLesson', item.id)
      })
    }
  }
}

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" @click.self="emit('close')">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />
    <div
      class="relative w-full max-w-xl bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden animate-fade-in"
      @keydown="handleKeydown"
    >
      <!-- Search Input -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <Search class="w-5 h-5 text-zinc-500 shrink-0" />
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          placeholder="Buscar cursos, aulas..."
          class="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none"
        />
        <kbd class="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
      </div>

      <!-- Results -->
      <div class="max-h-80 overflow-y-auto py-2">
        <div v-if="results.length === 0" class="px-4 py-8 text-center text-sm text-zinc-500">
          {{ query ? 'Nenhum resultado encontrado' : 'Digite para buscar...' }}
        </div>
        <button
          v-for="(item, i) in results"
          :key="`${item.type}-${item.id}`"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
          :class="i === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'"
          @click="selectItem(i)"
          @mouseenter="selectedIndex = i"
        >
          <component
            :is="item.type === 'course' ? BookOpen : Play"
            class="w-4 h-4 shrink-0"
            :class="item.type === 'course' ? 'text-indigo-400' : 'text-emerald-400'"
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm text-zinc-200 truncate">{{ item.title }}</div>
            <div v-if="item.subtitle" class="text-xs text-zinc-500 truncate">{{ item.subtitle }}</div>
          </div>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
            {{ item.type === 'course' ? 'Curso' : 'Aula' }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

