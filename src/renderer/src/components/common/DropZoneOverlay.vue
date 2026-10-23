<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'

defineProps<{ visible: boolean }>()
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-none select-none"
    >
      <div class="flex flex-col items-center gap-4 text-center p-10 rounded-2xl border-2 border-dashed border-indigo-500 bg-indigo-950/20 shadow-2xl">
        <FolderOpen class="w-16 h-16 text-indigo-400 animate-bounce" />
        <div>
          <p class="text-xl font-bold text-zinc-100">Solte a pasta do curso aqui</p>
          <p class="text-sm text-zinc-400 mt-1">O Course Hub irá catalogar as aulas e recuperar o progresso automaticamente</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

