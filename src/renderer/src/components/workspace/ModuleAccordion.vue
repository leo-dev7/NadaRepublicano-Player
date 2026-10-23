<script lang="ts">
const sharedCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
</script>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Archive,
  File,
  ExternalLink,
  FolderOpen as FolderShowIcon
} from 'lucide-vue-next'
import type { Module, Attachment, Lesson } from '@shared/types/course'
import { useTimeFormat } from '../../composables/useTimeFormat'
import { useCourseStore } from '../../stores/courseStore'
import LessonRow from './LessonRow.vue'

const props = withDefaults(
  defineProps<{
    module: Module
    activeLessonId: string | null
    mpcActiveLessonId?: string
    mpcActiveFilePath?: string
    depth?: number
    filterText?: string
  }>(),
  {
    depth: 0,
    filterText: ''
  }
)

const emit = defineEmits<{
  selectLesson: [id: string]
  playLesson: [id: string]
  toggleComplete: [id: string, value: boolean]
  openResource: [path: string]
}>()

const courseStore = useCourseStore()
const { msToTime } = useTimeFormat()

function moduleContainsTarget(mod: Module, target: string | null | undefined): boolean {
  if (!target) return false
  const tNorm = target.toLowerCase().replace(/\\/g, '/').trim()

  // 1. Direct attachments in module
  if (mod.attachments) {
    for (const att of mod.attachments) {
      if (att.id === target) return true
      if (att.absolutePath.toLowerCase().replace(/\\/g, '/') === tNorm) return true
      if (att.relativePath.toLowerCase().replace(/\\/g, '/') === tNorm) return true
      if (att.filename.toLowerCase() === tNorm) return true
    }
  }

  // 2. Direct lessons in module
  if (mod.lessons) {
    for (const l of mod.lessons) {
      if (l.id === target) return true
      if (l.absolutePath.toLowerCase().replace(/\\/g, '/') === tNorm) return true
      if (l.relativePath.toLowerCase().replace(/\\/g, '/') === tNorm) return true
      if (l.originalFilename.toLowerCase() === tNorm) return true

      // Lesson attachments
      if (l.attachments) {
        for (const att of l.attachments) {
          if (att.id === target) return true
          if (att.absolutePath.toLowerCase().replace(/\\/g, '/') === tNorm) return true
          if (att.relativePath.toLowerCase().replace(/\\/g, '/') === tNorm) return true
        }
      }
    }
  }

  // 3. Submodules recursively
  if (mod.subModules && mod.subModules.length > 0) {
    for (const sub of mod.subModules) {
      if (moduleContainsTarget(sub, target)) return true
    }
  }

  return false
}

function moduleContainsFilter(mod: Module, q: string): boolean {
  if (!q) return true
  const query = q.toLowerCase()
  if (mod.cleanTitle.toLowerCase().includes(query)) return true
  if (mod.lessons && mod.lessons.some((l) => l.cleanTitle.toLowerCase().includes(query) || l.originalFilename.toLowerCase().includes(query))) return true
  if (mod.attachments && mod.attachments.some((a) => a.cleanTitle.toLowerCase().includes(query) || a.filename.toLowerCase().includes(query) || a.extension.toLowerCase().includes(query))) return true
  if (mod.subModules && mod.subModules.length > 0) {
    return mod.subModules.some((sm) => moduleContainsFilter(sm, query))
  }
  return false
}

// Pastas pais e subpastas iniciam FECHADAS por padrão para o usuário escolher quando abrir.
const expanded = ref(false)

// Abre a pasta ou subpasta automaticamente quando o usuário seleciona um resultado de pesquisa ou aula
watch(
  () => courseStore.targetExpandKey,
  (target) => {
    if (target && moduleContainsTarget(props.module, target)) {
      expanded.value = true
    }
  },
  { immediate: true }
)

// Abre se houver filtro de pesquisa ativo na barra lateral
watch(
  () => props.filterText,
  (filter) => {
    if (filter && filter.trim().length > 0 && moduleContainsFilter(props.module, filter.trim())) {
      expanded.value = true
    }
  },
  { immediate: true }
)

const hasMatches = computed(() => {
  if (!props.filterText || !props.filterText.trim()) return true
  return moduleContainsFilter(props.module, props.filterText.trim().toLowerCase())
})

function isTargetAttachment(att: Attachment): boolean {
  if (!courseStore.targetExpandKey) return false
  const tNorm = courseStore.targetExpandKey.toLowerCase().replace(/\\/g, '/').trim()
  return (
    att.id === courseStore.targetExpandKey ||
    att.absolutePath.toLowerCase().replace(/\\/g, '/') === tNorm ||
    att.relativePath.toLowerCase().replace(/\\/g, '/') === tNorm
  )
}

interface SectionItem {
  id: string
  type: 'lesson' | 'attachment'
  sortKey: string
  lesson?: Lesson
  attachment?: Attachment
}

// Mescla vídeos e materiais da pasta em ordem alfabética/numérica natural, aplicando filtro se houver
const sectionItems = computed((): SectionItem[] => {
  const items: SectionItem[] = []
  const filter = (props.filterText || '').toLowerCase().trim()

  if (props.module.lessons) {
    for (const l of props.module.lessons) {
      if (
        !filter ||
        l.cleanTitle.toLowerCase().includes(filter) ||
        l.originalFilename.toLowerCase().includes(filter)
      ) {
        items.push({
          id: l.id,
          type: 'lesson',
          sortKey: l.originalFilename,
          lesson: l
        })
      }
    }
  }
  if (props.module.attachments) {
    for (const a of props.module.attachments) {
      if (
        !filter ||
        a.cleanTitle.toLowerCase().includes(filter) ||
        a.filename.toLowerCase().includes(filter) ||
        a.extension.toLowerCase().includes(filter)
      ) {
        items.push({
          id: a.id,
          type: 'attachment',
          sortKey: a.filename,
          attachment: a
        })
      }
    }
  }
  items.sort((a, b) => sharedCollator.compare(a.sortKey, b.sortKey))
  return items
})

const progress = computed(() => {
  const total = props.module.lessons.length
  if (total === 0) return 0
  return Math.round((props.module.completedLessonsCount / total) * 100)
})

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

async function handleOpenMaterial(att: Attachment) {
  emit('openResource', att.absolutePath)
  await window.api.openPath(att.absolutePath)
}

function handleShowInExplorer(att: Attachment) {
  window.api.openInExplorer(att.absolutePath)
}
</script>

<template>
  <!-- TOP-LEVEL SECTION (PASTA PAI - DEPTH 0) -->
  <div
    v-if="depth === 0 && hasMatches"
    class="mb-3 rounded-xl border border-zinc-800/90 bg-zinc-900/60 overflow-hidden shadow-sm transition-all"
  >
    <!-- Header Pasta Pai -->
    <button
      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left bg-zinc-850/70 hover:bg-zinc-800 border-b border-zinc-800/40 transition-colors group select-none"
      @click="expanded = !expanded"
    >
      <component
        :is="expanded ? ChevronDown : ChevronRight"
        class="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 shrink-0 transition-transform"
      />

      <!-- Section Indicator Tag -->
      <div class="w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-[10px] shrink-0">
        {{ (module.order >= 0 ? module.order + 1 : '★') }}
      </div>

      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-zinc-100 truncate group-hover:text-white transition-colors">
          {{ module.cleanTitle }}
        </div>
        <div class="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <template v-if="module.lessons.length > 0">
            <span>{{ module.completedLessonsCount }}/{{ module.lessons.length }} aulas</span>
            <span v-if="module.totalDurationMs">• {{ msToTime(module.totalDurationMs) }}</span>
          </template>
          <template v-if="module.attachments.length > 0">
            <span class="text-zinc-400">• {{ module.attachments.length }} {{ module.attachments.length === 1 ? 'material' : 'materiais' }}</span>
          </template>
          <template v-if="module.subModules && module.subModules.length > 0">
            <span class="text-indigo-400/90">• {{ module.subModules.length }} {{ module.subModules.length === 1 ? 'subpasta' : 'subpastas' }}</span>
          </template>
        </div>
      </div>

      <!-- Mini Progress bar -->
      <div v-if="module.lessons.length > 0" class="w-8 h-1.5 bg-zinc-800 rounded-full overflow-hidden shrink-0">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </button>

    <!-- Expanded Body Pasta Pai -->
    <div v-if="expanded" class="p-1.5 space-y-1 bg-zinc-900/30">
      <!-- Direct Items (Lessons and Files of this Parent Folder) -->
      <template v-for="item in sectionItems" :key="item.id">
        <!-- Video Row -->
        <LessonRow
          v-if="item.type === 'lesson' && item.lesson"
          :lesson="item.lesson"
          :is-active="item.lesson.id === activeLessonId"
          :is-playing="
            item.lesson.id === mpcActiveLessonId ||
            (!!mpcActiveFilePath && mpcActiveFilePath.toLowerCase().replace(/\\/g, '/').endsWith(item.lesson.relativePath.toLowerCase().replace(/\\/g, '/')))"
          @select="emit('selectLesson', item.lesson.id)"
          @play="emit('playLesson', item.lesson.id)"
          @toggle-complete="(val) => emit('toggleComplete', item.lesson!.id, val)"
          @open-resource="emit('openResource', $event)"
        />

        <!-- Material File Row -->
        <div
          v-else-if="item.type === 'attachment' && item.attachment"
          class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-800/60 cursor-pointer group text-zinc-300 transition-colors"
          :class="{
            'bg-indigo-950/70 border border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-400/50': isTargetAttachment(item.attachment)
          }"
          :title="`Abrir material: ${item.attachment.filename}`"
          @click="handleOpenMaterial(item.attachment)"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <component
              :is="getIconForKind(item.attachment.kind)"
              class="w-3.5 h-3.5 shrink-0"
              :class="{
                'text-rose-400': item.attachment.kind === 'pdf',
                'text-sky-400': item.attachment.kind === 'code',
                'text-amber-400': item.attachment.kind === 'archive',
                'text-emerald-400': item.attachment.kind === 'text',
                'text-zinc-400': item.attachment.kind === 'other'
              }"
            />
            <span class="truncate text-zinc-300 group-hover:text-white transition-colors" :class="{ 'text-indigo-200 font-medium': isTargetAttachment(item.attachment) }">
              {{ item.attachment.cleanTitle }}
            </span>
            <span v-if="item.attachment.sizeBytes" class="text-[10px] text-zinc-500 font-mono shrink-0">
              ({{ formatFileSize(item.attachment.sizeBytes) }})
            </span>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              class="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors"
              title="Mostrar arquivo no Windows Explorer"
              @click.stop="handleShowInExplorer(item.attachment)"
            >
              <FolderShowIcon class="w-3 h-3" />
            </button>
            <button
              class="p-1 rounded text-zinc-400 hover:text-indigo-300 hover:bg-zinc-700/60 transition-colors"
              title="Abrir no aplicativo padrão"
              @click.stop="handleOpenMaterial(item.attachment)"
            >
              <ExternalLink class="w-3 h-3" />
            </button>
          </div>
        </div>
      </template>

      <!-- Subfolders List (Recursive Child Modules) -->
      <div v-if="module.subModules && module.subModules.length > 0" class="pt-1 space-y-1">
        <ModuleAccordion
          v-for="sub in module.subModules"
          :key="sub.id"
          :module="sub"
          :active-lesson-id="activeLessonId"
          :mpc-active-lesson-id="mpcActiveLessonId"
          :mpc-active-file-path="mpcActiveFilePath"
          :depth="1"
          :filter-text="filterText"
          @select-lesson="emit('selectLesson', $event)"
          @play-lesson="emit('playLesson', $event)"
          @toggle-complete="(id: string, val: boolean) => emit('toggleComplete', id, val)"
          @open-resource="emit('openResource', $event)"
        />
      </div>
    </div>
  </div>

  <!-- NESTED SUBFOLDER (SUBPASTA - DEPTH > 0) -->
  <div
    v-else-if="hasMatches"
    class="my-1 rounded-lg border border-zinc-800/80 bg-zinc-950/50 border-l-2 border-l-amber-500/70 overflow-hidden shadow-sm"
    :style="{ marginLeft: `${(depth - 1) * 12 + 6}px` }"
  >
    <!-- Header Subpasta (Closed by default) -->
    <button
      class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left bg-zinc-900/60 hover:bg-zinc-850/80 transition-colors group select-none"
      @click="expanded = !expanded"
    >
      <component
        :is="expanded ? ChevronDown : ChevronRight"
        class="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 shrink-0"
      />

      <component
        :is="expanded ? FolderOpen : Folder"
        class="w-3.5 h-3.5 text-amber-400 shrink-0"
      />

      <div class="flex-1 min-w-0">
        <div class="text-[11px] font-semibold text-zinc-200 group-hover:text-amber-300 truncate transition-colors">
          {{ module.cleanTitle }}
        </div>
      </div>

      <!-- Pill com quantidade de itens da subpasta -->
      <span class="text-[9px] bg-zinc-800/80 border border-zinc-700/60 px-1.5 py-0.5 rounded text-zinc-400 font-mono shrink-0">
        {{ sectionItems.length + (module.subModules?.length || 0) }} itens
      </span>
    </button>

    <!-- Expanded Body Subpasta -->
    <div v-if="expanded" class="p-1 space-y-0.5 bg-black/20 border-t border-zinc-800/40">
      <template v-for="item in sectionItems" :key="item.id">
        <!-- Video Row -->
        <LessonRow
          v-if="item.type === 'lesson' && item.lesson"
          :lesson="item.lesson"
          :is-active="item.lesson.id === activeLessonId"
          :is-playing="
            item.lesson.id === mpcActiveLessonId ||
            (!!mpcActiveFilePath && mpcActiveFilePath.toLowerCase().replace(/\\/g, '/').endsWith(item.lesson.relativePath.toLowerCase().replace(/\\/g, '/')))"
          @select="emit('selectLesson', item.lesson.id)"
          @play="emit('playLesson', item.lesson.id)"
          @toggle-complete="(val) => emit('toggleComplete', item.lesson!.id, val)"
          @open-resource="emit('openResource', $event)"
        />

        <!-- Material File Row -->
        <div
          v-else-if="item.type === 'attachment' && item.attachment"
          class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-800/60 cursor-pointer group text-zinc-300 transition-colors"
          :class="{
            'bg-indigo-950/70 border border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-400/50': isTargetAttachment(item.attachment)
          }"
          :title="`Abrir material: ${item.attachment.filename}`"
          @click="handleOpenMaterial(item.attachment)"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <component
              :is="getIconForKind(item.attachment.kind)"
              class="w-3.5 h-3.5 shrink-0"
              :class="{
                'text-rose-400': item.attachment.kind === 'pdf',
                'text-sky-400': item.attachment.kind === 'code',
                'text-amber-400': item.attachment.kind === 'archive',
                'text-emerald-400': item.attachment.kind === 'text',
                'text-zinc-400': item.attachment.kind === 'other'
              }"
            />
            <span class="truncate text-zinc-300 group-hover:text-white transition-colors" :class="{ 'text-indigo-200 font-medium': isTargetAttachment(item.attachment) }">
              {{ item.attachment.cleanTitle }}
            </span>
            <span v-if="item.attachment.sizeBytes" class="text-[10px] text-zinc-500 font-mono shrink-0">
              ({{ formatFileSize(item.attachment.sizeBytes) }})
            </span>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              class="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors"
              title="Mostrar arquivo no Windows Explorer"
              @click.stop="handleShowInExplorer(item.attachment)"
            >
              <FolderShowIcon class="w-3 h-3" />
            </button>
            <button
              class="p-1 rounded text-zinc-400 hover:text-indigo-300 hover:bg-zinc-700/60 transition-colors"
              title="Abrir no aplicativo padrão"
              @click.stop="handleOpenMaterial(item.attachment)"
            >
              <ExternalLink class="w-3 h-3" />
            </button>
          </div>
        </div>
      </template>

      <!-- Deeper Nested Subfolders -->
      <div v-if="module.subModules && module.subModules.length > 0" class="pt-0.5 space-y-0.5">
        <ModuleAccordion
          v-for="sub in module.subModules"
          :key="sub.id"
          :module="sub"
          :active-lesson-id="activeLessonId"
          :mpc-active-lesson-id="mpcActiveLessonId"
          :mpc-active-file-path="mpcActiveFilePath"
          :depth="depth + 1"
          :filter-text="filterText"
          @select-lesson="emit('selectLesson', $event)"
          @play-lesson="emit('playLesson', $event)"
          @toggle-complete="(id: string, val: boolean) => emit('toggleComplete', id, val)"
          @open-resource="emit('openResource', $event)"
        />
      </div>
    </div>
  </div>
</template>
