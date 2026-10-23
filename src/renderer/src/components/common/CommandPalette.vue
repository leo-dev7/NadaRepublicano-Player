<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useCourseStore } from '../../stores/courseStore'
import {
  Search,
  BookOpen,
  Play,
  FileText,
  FileCode,
  Archive,
  Paperclip,
  File
} from 'lucide-vue-next'
import type { AttachmentKind, Module } from '@shared/types/course'

const emit = defineEmits<{
  close: []
  openCourse: [id: string]
  playLesson: [id: string, courseId: string]
  openMaterial: [path: string, courseId: string]
}>()

const courseStore = useCourseStore()
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface SearchResult {
  type: 'course' | 'lesson' | 'material'
  id: string
  title: string
  subtitle?: string
  courseId: string
  resourcePath?: string
  kind?: AttachmentKind
  sizeBytes?: number
}

function getIconForKind(kind?: AttachmentKind) {
  switch (kind) {
    case 'pdf':
    case 'text':
      return FileText
    case 'code':
      return FileCode
    case 'archive':
      return Archive
    default:
      return Paperclip
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const results = computed((): SearchResult[] => {
  const q = query.value.toLowerCase().trim()
  const items: SearchResult[] = []

  // Ensure active course is searched first for instant relevance
  const allCourses = [...courseStore.courses]
  if (courseStore.activeCourse) {
    const idx = allCourses.findIndex((c) => c.id === courseStore.activeCourse?.id)
    if (idx > 0) {
      const [cur] = allCourses.splice(idx, 1)
      allCourses.unshift(cur)
    }
  }

  for (const course of allCourses) {
    if (items.length >= 40) break

    // 1. Match course title
    if (!q || course.cleanTitle.toLowerCase().includes(q)) {
      items.push({
        type: 'course',
        id: course.id,
        courseId: course.id,
        title: course.cleanTitle,
        subtitle: `${course.totalLessonsCount} aulas`
      })
      if (items.length >= 40) return items
    }

    if (q) {
      // 2. Course-level attachments (root materials)
      if (course.attachments && course.attachments.length > 0) {
        for (const att of course.attachments) {
          if (items.length >= 40) break
          const matchesTitle = att.cleanTitle.toLowerCase().includes(q)
          const matchesFilename = att.filename.toLowerCase().includes(q)
          const matchesExt = att.extension.toLowerCase().replace('.', '') === q || att.kind.toLowerCase() === q
          if (matchesTitle || matchesFilename || matchesExt) {
            items.push({
              type: 'material',
              id: att.id,
              title: att.cleanTitle || att.filename,
              subtitle: `${course.cleanTitle} → Materiais Gerais`,
              courseId: course.id,
              resourcePath: att.absolutePath,
              kind: att.kind,
              sizeBytes: att.sizeBytes
            })
          }
        }
      }

      // 3. Module & Submodule recursive search (lessons & materials)
      function searchModuleTree(mods: Module[], breadcrumb: string) {
        for (const mod of mods) {
          if (items.length >= 40) return
          const currentBreadcrumb = breadcrumb ? `${breadcrumb} → ${mod.cleanTitle}` : mod.cleanTitle

          // A) Module-level attachments
          if (mod.attachments && mod.attachments.length > 0) {
            for (const att of mod.attachments) {
              if (items.length >= 40) return
              const matchesTitle = att.cleanTitle.toLowerCase().includes(q)
              const matchesFilename = att.filename.toLowerCase().includes(q)
              const matchesExt = att.extension.toLowerCase().replace('.', '') === q || att.kind.toLowerCase() === q
              if (matchesTitle || matchesFilename || matchesExt) {
                items.push({
                  type: 'material',
                  id: att.id,
                  title: att.cleanTitle || att.filename,
                  subtitle: `${course.cleanTitle} → ${currentBreadcrumb}`,
                  courseId: course.id,
                  resourcePath: att.absolutePath,
                  kind: att.kind,
                  sizeBytes: att.sizeBytes
                })
              }
            }
          }

          // B) Lessons & Lesson-level attachments
          if (mod.lessons && mod.lessons.length > 0) {
            for (const lesson of mod.lessons) {
              if (items.length >= 40) return
              if (lesson.cleanTitle.toLowerCase().includes(q) || lesson.originalFilename.toLowerCase().includes(q)) {
                items.push({
                  type: 'lesson',
                  id: lesson.id,
                  title: lesson.cleanTitle,
                  subtitle: `${course.cleanTitle} → ${currentBreadcrumb}`,
                  courseId: course.id
                })
              }

              if (lesson.attachments && lesson.attachments.length > 0) {
                for (const att of lesson.attachments) {
                  if (items.length >= 40) return
                  const matchesTitle = att.cleanTitle.toLowerCase().includes(q)
                  const matchesFilename = att.filename.toLowerCase().includes(q)
                  const matchesExt = att.extension.toLowerCase().replace('.', '') === q || att.kind.toLowerCase() === q
                  if (matchesTitle || matchesFilename || matchesExt) {
                    items.push({
                      type: 'material',
                      id: att.id,
                      title: att.cleanTitle || att.filename,
                      subtitle: `${course.cleanTitle} → ${currentBreadcrumb} → ${lesson.cleanTitle}`,
                      courseId: course.id,
                      resourcePath: att.absolutePath,
                      kind: att.kind,
                      sizeBytes: att.sizeBytes
                    })
                  }
                }
              }
            }
          }

          // C) Submodules
          if (mod.subModules && mod.subModules.length > 0) {
            searchModuleTree(mod.subModules, currentBreadcrumb)
          }
        }
      }

      searchModuleTree(course.modules, '')
      if (items.length >= 40) return items
    }
  }

  return items
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

async function selectItem(index: number) {
  const item = results.value[index]
  if (!item) return
  emit('close')

  if (item.type === 'course') {
    emit('openCourse', item.courseId)
  } else if (item.type === 'lesson') {
    emit('playLesson', item.id, item.courseId)
  } else if (item.type === 'material') {
    if (item.resourcePath) {
      emit('openMaterial', item.resourcePath, item.courseId)
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
      class="relative w-full max-w-2xl bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden animate-fade-in"
      @keydown="handleKeydown"
    >
      <!-- Search Input -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <Search class="w-5 h-5 text-indigo-400 shrink-0" />
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          placeholder="Buscar aulas, vídeos, materiais (PDF, código, slides, zip)..."
          class="flex-1 bg-transparent text-sm text-zinc-150 placeholder-zinc-500 focus:outline-none"
        />
        <kbd class="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
      </div>

      <!-- Results Count Bar -->
      <div v-if="query && results.length > 0" class="px-4 py-1.5 bg-zinc-950/40 border-b border-zinc-800/60 text-[11px] text-zinc-400 flex items-center justify-between">
        <span>{{ results.length }} resultado(s) encontrado(s)</span>
        <span class="text-zinc-500">Pressione Enter para abrir</span>
      </div>

      <!-- Results List -->
      <div class="max-h-96 overflow-y-auto py-2">
        <div v-if="results.length === 0" class="px-4 py-10 text-center text-sm text-zinc-500">
          {{ query ? 'Nenhum resultado encontrado para esta busca' : 'Digite para buscar cursos, aulas e materiais de estudo...' }}
        </div>
        <button
          v-for="(item, i) in results"
          :key="`${item.type}-${item.id}`"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group"
          :class="i === selectedIndex ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/50 text-zinc-300'"
          @click="selectItem(i)"
          @mouseenter="selectedIndex = i"
        >
          <!-- Icon -->
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="{
              'bg-indigo-500/10 text-indigo-400': item.type === 'course',
              'bg-emerald-500/10 text-emerald-400': item.type === 'lesson',
              'bg-rose-500/10 text-rose-400': item.type === 'material' && item.kind === 'pdf',
              'bg-sky-500/10 text-sky-400': item.type === 'material' && item.kind === 'code',
              'bg-amber-500/10 text-amber-400': item.type === 'material' && item.kind === 'archive',
              'bg-purple-500/10 text-purple-400': item.type === 'material' && item.kind !== 'pdf' && item.kind !== 'code' && item.kind !== 'archive'
            }"
          >
            <component
              :is="
                item.type === 'course'
                  ? BookOpen
                  : item.type === 'lesson'
                    ? Play
                    : getIconForKind(item.kind)
              "
              class="w-4 h-4"
            />
          </div>

          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-zinc-200 group-hover:text-white truncate flex items-center gap-2">
              <span>{{ item.title }}</span>
              <span v-if="item.sizeBytes" class="text-[10px] text-zinc-500 font-mono">
                ({{ formatBytes(item.sizeBytes) }})
              </span>
            </div>
            <div v-if="item.subtitle" class="text-xs text-zinc-500 truncate mt-0.5">
              {{ item.subtitle }}
            </div>
          </div>

          <!-- Type Badge -->
          <span
            class="text-[9px] uppercase tracking-wider font-mono px-2 py-0.5 rounded shrink-0 font-semibold"
            :class="{
              'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50': item.type === 'course',
              'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50': item.type === 'lesson',
              'bg-rose-950/80 text-rose-300 border border-rose-800/50': item.type === 'material' && item.kind === 'pdf',
              'bg-sky-950/80 text-sky-300 border border-sky-800/50': item.type === 'material' && item.kind === 'code',
              'bg-amber-950/80 text-amber-300 border border-amber-800/50': item.type === 'material' && item.kind === 'archive',
              'bg-purple-950/80 text-purple-300 border border-purple-800/50': item.type === 'material' && item.kind !== 'pdf' && item.kind !== 'code' && item.kind !== 'archive'
            }"
          >
            {{
              item.type === 'course'
                ? 'Curso'
                : item.type === 'lesson'
                  ? 'Aula'
                  : item.kind?.toUpperCase() || 'Material'
            }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

