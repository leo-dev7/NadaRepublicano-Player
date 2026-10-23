<script setup lang="ts">
import { BookOpen, Search, Settings } from 'lucide-vue-next'
import type { MpcPlaybackState } from '@shared/types/mpc'

const props = defineProps<{
  mpcConnected: boolean
  mpcState: MpcPlaybackState
}>()

const emit = defineEmits<{
  openCommandPalette: []
  openSettings: []
  goDashboard: []
}>()
</script>

<template>
  <div
    class="h-9 flex items-center justify-between px-3 bg-surface border-b border-zinc-800 shrink-0 select-none app-drag"
  >
    <!-- Left -->
    <div class="flex items-center gap-2 app-no-drag">
      <button
        class="flex items-center gap-1.5 text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
        @click="emit('goDashboard')"
      >
        <BookOpen class="w-4 h-4 text-indigo-400" />
        <span>Course Hub</span>
      </button>
    </div>

    <!-- Center -->
    <button
      class="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 hover:bg-zinc-800 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors app-no-drag"
      @click="emit('openCommandPalette')"
    >
      <Search class="w-3.5 h-3.5 text-zinc-400" />
      <span>Buscar...</span>
      <kbd class="text-[10px] bg-zinc-700/50 px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
    </button>

    <!-- Right -->
    <div class="flex items-center gap-3 pr-24 app-no-drag">
      <!-- MPC Status -->
      <div class="flex items-center gap-1.5 text-xs">
        <div
          class="w-2 h-2 rounded-full transition-colors"
          :class="props.mpcConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'"
        />
        <span :class="props.mpcConnected ? 'text-emerald-400' : 'text-zinc-500'">
          {{ props.mpcConnected ? 'MPC Conectado' : 'MPC Offline' }}
        </span>
      </div>

      <button class="btn-icon !p-1 text-zinc-400 hover:text-zinc-200" title="Configurações" @click="emit('openSettings')">
        <Settings class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-drag {
  -webkit-app-region: drag;
}
.app-no-drag {
  -webkit-app-region: no-drag;
}
</style>

