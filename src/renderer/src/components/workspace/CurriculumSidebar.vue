<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  FolderSync,
  Search,
  Paperclip,
  FileText,
  FileCode,
  Archive,
  File,
  FolderOpen,
  ExternalLink
} from 'lucide-vue-next'
import type { Course, Attachment } from '@shared/types/course'
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
const sidebarFilter = ref('')

async function handleChangeFolder() {
  const folderPath = await window.api.selectFolder()
  if (folderPath) {
    const newCourse = await courseStore.importCourse(folderPath)
    if (newCourse) {
      await courseStore.openCourse(newCourse.id, false)
    }
  }
}

function getIconForKind(kind: string) {
  switch (kind) {
    case 'pdf':
      return FileText
    case 'code':
      return FileCode
    case 'archive':
      return Archive
    case 'text':
      return FileText
    default:
      return File
  }
}

function isTargetAttachment(att: Attachment): boolean {
  if (!courseStore.targetExpandKey) return false
  const tNorm = courseStore.targetExpandKey.toLowerCase().replace(/\\/g, '/').trim()
  return (
    att.id === courseStore.targetExpandKey ||
    att.absolutePath.toLowerCase().replace(/\\/g, '/') === tNorm ||
    att.relativePath.toLowerCase().replace(/\\/g, '/') === tNorm
  )
}

const filteredCourseAttachments = computed(() => {
  if (!props.course.attachments) return []
  if (!sidebarFilter.value.trim()) return props.course.attachments
  const q = sidebarFilter.value.toLowerCase().trim()
  return props.course.attachments.filter(
    (a) =>
      a.cleanTitle.toLowerCase().includes(q) ||
      a.filename.toLowerCase().includes(q) ||
      a.extension.toLowerCase().includes(q)
  )
})

async function handleOpenMaterial(att: Attachment) {
  courseStore.revealItem(att.absolutePath)
  emit('openResource', att.absolutePath)
  await window.api.openPath(att.absolutePath)
}

function handleShowInExplorer(att: Attachment) {
  window.api.openInExplorer(att.absolutePath)
}
</script>

<template>
  <div
    class="shrink-0 border-r border-zinc-800 bg-zinc-900/60 flex flex-col overflow-hidden transition-[width] duration-200 select-none"
    :class="collapsed ? 'w-12' : 'w-[360px]'"
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

    <!-- Search / Filter in Sidebar -->
    <div v-if="!collapsed" class="px-2.5 py-1.5 border-b border-zinc-800/60 bg-zinc-950/40 shrink-0">
      <div class="relative flex items-center">
        <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
        <input
          v-model="sidebarFilter"
          type="text"
          placeholder="Filtrar aulas e materiais..."
          class="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg pl-8 pr-7 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
        <button
          v-if="sidebarFilter"
          class="absolute right-2 text-zinc-500 hover:text-zinc-300 text-xs p-0.5"
          @click="sidebarFilter = ''"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Curriculum Content -->
    <div v-if="!collapsed" class="flex-1 overflow-y-auto p-2 space-y-1">
      <!-- Course-Level Attachments (Files in the root of the course folder) -->
      <div
        v-if="filteredCourseAttachments.length > 0"
        class="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 mb-2"
      >
        <div class="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1 mb-1">
          <Paperclip class="w-3 h-3" />
          <span>Materiais Gerais ({{ filteredCourseAttachments.length }})</span>
        </div>
        <div class="space-y-0.5">
          <div
            v-for="att in filteredCourseAttachments"
            :key="att.id"
            class="flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs hover:bg-zinc-800/60 cursor-pointer group text-zinc-300 transition-colors"
            :class="{
              'bg-indigo-950/70 border border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-400/50': isTargetAttachment(att)
            }"
            @click="handleOpenMaterial(att)"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <component
                :is="getIconForKind(att.kind)"
                class="w-3.5 h-3.5 shrink-0 text-indigo-400"
              />
              <span class="truncate group-hover:text-white" :class="{ 'text-indigo-200 font-medium': isTargetAttachment(att) }">{{ att.cleanTitle }}</span>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                class="p-1 rounded text-zinc-400 hover:text-white"
                title="Mostrar no Explorer"
                @click.stop="handleShowInExplorer(att)"
              >
                <FolderOpen class="w-3 h-3" />
              </button>
              <button
                class="p-1 rounded text-zinc-400 hover:text-indigo-300"
                title="Abrir arquivo"
                @click.stop="handleOpenMaterial(att)"
              >
                <ExternalLink class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modules List -->
      <ModuleAccordion
        v-for="mod in course.modules"
        :key="mod.id"
        :module="mod"
        :active-lesson-id="activeLessonId"
        :mpc-active-lesson-id="mpcActiveLessonId"
        :mpc-active-file-path="mpcActiveFilePath"
        :filter-text="sidebarFilter"
        @select-lesson="emit('selectLesson', $event)"
        @play-lesson="emit('playLesson', $event)"
        @toggle-complete="(id: string, val: boolean) => emit('toggleComplete', id, val)"
        @open-resource="emit('openResource', $event)"
      />
    </div>
  </div>
</template>
