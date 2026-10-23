<script setup lang="ts">
import { ref } from 'vue'
import { FolderPlus, Loader2 } from 'lucide-vue-next'
import { useCourseStore } from '../../stores/courseStore'

const emit = defineEmits<{ imported: [courseId: string] }>()
const courseStore = useCourseStore()
const importing = ref(false)

async function handleImport() {
  if (importing.value) return
  importing.value = true
  try {
    const folderPath = await window.api.selectFolder()
    if (folderPath) {
      const course = await courseStore.importCourse(folderPath)
      if (course) {
        emit('imported', course.id)
      }
    }
  } catch (e) {
    console.error('Import failed:', e)
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <button
    class="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-sm font-medium text-white rounded-lg transition-all shadow-sm"
    :disabled="importing"
    @click="handleImport"
  >
    <component :is="importing ? Loader2 : FolderPlus" class="w-4 h-4" :class="{ 'animate-spin': importing }" />
    <span>{{ importing ? 'Importando...' : 'Importar Pasta' }}</span>
  </button>
</template>

