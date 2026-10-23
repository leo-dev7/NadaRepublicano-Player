<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useCourseStore } from './stores/courseStore'
import { useMpcStore } from './stores/mpcStore'
import { useSettingsStore } from './stores/settingsStore'
import TitleBar from './components/common/TitleBar.vue'
import CommandPalette from './components/common/CommandPalette.vue'
import DropZoneOverlay from './components/common/DropZoneOverlay.vue'
import HeroContinueCard from './components/dashboard/HeroContinueCard.vue'
import CourseCard from './components/dashboard/CourseCard.vue'
import ImportFolderCard from './components/dashboard/ImportFolderCard.vue'
import LiveSyncTopBar from './components/workspace/LiveSyncTopBar.vue'
import CurriculumSidebar from './components/workspace/CurriculumSidebar.vue'
import MarkdownNotebook from './components/workspace/MarkdownNotebook.vue'
import ResourceReader from './components/workspace/ResourceReader.vue'
import SettingsModal from './components/settings/SettingsModal.vue'

const courseStore = useCourseStore()
const mpcStore = useMpcStore()
const settingsStore = useSettingsStore()

const showCommandPalette = ref(false)
const showSettings = ref(false)
const isDragging = ref(false)
const workspaceTab = ref<'notes' | 'resources'>('notes')
const selectedResourcePath = ref<string | null>(null)

let unwatchWatcher: (() => void) | null = null

onMounted(async () => {
  await settingsStore.load()
  await courseStore.loadCourses()
  mpcStore.startListening()

  unwatchWatcher = window.api.onWatcherChanged(async (courseId: string) => {
    if (courseStore.activeCourse?.id === courseId) {
      await courseStore.refreshActiveCourse()
    }
  })

  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  mpcStore.stopListening()
  if (unwatchWatcher) unwatchWatcher()
  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
  }
  if (e.key === 'Escape') {
    showCommandPalette.value = false
    showSettings.value = false
  }
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const item = files[0]
  // In Electron's renderer, dropped files have the absolute path property
  const folderPath = (item as any).path
  if (folderPath) {
    const course = await courseStore.importCourse(folderPath)
    if (course) {
      await courseStore.openCourse(course.id)
    }
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  if (!e.relatedTarget) {
    isDragging.value = false
  }
}

function openResource(path: string) {
  selectedResourcePath.value = path
  workspaceTab.value = 'resources'
}

function handleSnapAssist() {
  window.api.snapAssist()
}

function handleOpenVscode(path: string) {
  window.api.openInVSCode(path)
}

function handleOpenExplorer(path: string) {
  window.api.openInExplorer(path)
}

function handleSeek(ms: number) {
  window.api.mpcSeek({ positionMs: ms })
}
</script>

<template>
  <div
    class="h-screen w-screen flex flex-col overflow-hidden bg-surface text-zinc-100 select-none font-sans"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
  >
    <TitleBar
      :mpc-connected="mpcStore.isConnected"
      :mpc-state="mpcStore.state.state"
      @open-command-palette="showCommandPalette = true"
      @open-settings="showSettings = true"
      @go-dashboard="courseStore.goToDashboard()"
    />

    <!-- Dashboard View -->
    <div v-if="courseStore.view === 'dashboard'" class="flex-1 overflow-y-auto px-8 py-6">
      <div class="max-w-6xl mx-auto space-y-8">
        <!-- Hero card -->
        <HeroContinueCard @resume="(id: string) => courseStore.openCourse(id)" />

        <!-- Courses section -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-bold text-zinc-100">Biblioteca de Cursos</h2>
              <p class="text-xs text-zinc-400 mt-0.5">Pastas locais sincronizadas com seu player MPC</p>
            </div>
            <ImportFolderCard @imported="(id: string) => courseStore.openCourse(id)" />
          </div>

          <div v-if="courseStore.isLoading" class="text-center py-16 text-zinc-500 text-sm">
            Catalogando cursos locais...
          </div>

          <div
            v-else-if="courseStore.courses.length === 0"
            class="text-center py-20 px-4 rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 text-zinc-500 space-y-4"
          >
            <div class="text-5xl">📚</div>
            <div>
              <p class="text-base font-semibold text-zinc-300">Nenhum curso adicionado ainda</p>
              <p class="text-xs text-zinc-500 mt-1">
                Arraste uma pasta de curso do Windows Explorer para cá ou clique em "Importar Pasta" acima.
              </p>
            </div>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <CourseCard
              v-for="course in courseStore.courses"
              :key="course.id"
              :course="course"
              @open="courseStore.openCourse(course.id)"
              @delete="courseStore.deleteCourse(course.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Course Workspace View -->
    <div
      v-else-if="courseStore.view === 'workspace' && courseStore.activeCourse"
      class="flex-1 flex flex-col overflow-hidden"
    >
      <LiveSyncTopBar
        :course="courseStore.activeCourse"
        :lesson="courseStore.activeLesson"
        @snap-assist="handleSnapAssist"
        @open-vscode="handleOpenVscode(courseStore.activeCourse!.rootPath)"
        @open-explorer="handleOpenExplorer(courseStore.activeCourse!.rootPath)"
      />

      <div class="flex-1 flex overflow-hidden">
        <CurriculumSidebar
          :course="courseStore.activeCourse"
          :active-lesson-id="courseStore.activeLessonId"
          :mpc-active-lesson-id="mpcStore.state.activeLessonId"
          :mpc-active-file-path="mpcStore.state.activeFilePath"
          @select-lesson="courseStore.selectLesson($event)"
          @play-lesson="courseStore.playLesson($event)"
          @toggle-complete="(id: string, val: boolean) => courseStore.markLessonComplete(id, val)"
          @open-resource="openResource"
        />

        <div class="flex-1 flex flex-col overflow-hidden bg-zinc-950">
          <!-- Workspace Tabs -->
          <div class="flex items-center border-b border-zinc-800 bg-zinc-900/40 px-4 shrink-0">
            <button
              class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors relative"
              :class="workspaceTab === 'notes' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'"
              @click="workspaceTab = 'notes'"
            >
              Caderno de Estudos
              <div
                v-if="workspaceTab === 'notes'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
              />
            </button>
            <button
              class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors relative"
              :class="workspaceTab === 'resources' ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'"
              @click="workspaceTab = 'resources'"
            >
              Materiais de Apoio
              <span
                v-if="courseStore.activeLesson && courseStore.activeLesson.attachments.length > 0"
                class="ml-1.5 px-1.5 py-0.2 bg-zinc-800 text-[10px] rounded-full text-zinc-400"
              >
                {{ courseStore.activeLesson.attachments.length }}
              </span>
              <div
                v-if="workspaceTab === 'resources'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
              />
            </button>
          </div>

          <!-- Tab Views -->
          <div class="flex-1 overflow-hidden">
            <MarkdownNotebook
              v-if="workspaceTab === 'notes'"
              :content="courseStore.activeNoteContent"
              :lesson="courseStore.activeLesson"
              :course="courseStore.activeCourse"
              :mpc-position-ms="mpcStore.state.positionMs"
              @update:content="courseStore.saveNote($event)"
              @seek="handleSeek"
            />
            <ResourceReader
              v-else
              :course="courseStore.activeCourse"
              :lesson="courseStore.activeLesson"
              :selected-path="selectedResourcePath"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Drag & Drop Overlay -->
    <DropZoneOverlay :visible="isDragging" />

    <!-- Command Palette (Ctrl+K) -->
    <CommandPalette
      v-if="showCommandPalette"
      @close="showCommandPalette = false"
      @open-course="(id: string) => { showCommandPalette = false; courseStore.openCourse(id) }"
      @play-lesson="(id: string) => { showCommandPalette = false; courseStore.playLesson(id) }"
    />

    <!-- Settings Modal -->
    <SettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

