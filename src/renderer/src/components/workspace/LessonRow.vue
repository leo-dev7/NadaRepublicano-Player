<script setup lang="ts">
import { computed } from 'vue'
import { Paperclip, StickyNote, Play } from 'lucide-vue-next'
import type { Lesson } from '@shared/types/course'

const props = defineProps<{
  lesson: Lesson
  isActive: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  select: []
  play: []
  toggleComplete: [value: boolean]
  openResource: [path: string]
}>()

const miniProgress = computed(() => {
  if (props.lesson.durationMs <= 0) return 0
  return Math.min(100, Math.round((props.lesson.lastPositionMs / props.lesson.durationMs) * 100))
})
</script>

<template>
  <div
    class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors group select-none text-xs"
    :class="[
      isActive
        ? 'bg-zinc-800 text-zinc-100 font-medium'
        : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
    ]"
    @click="emit('select')"
    @dblclick="emit('play')"
  >
    <!-- Checkbox -->
    <button
      class="shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all"
      :class="
        lesson.isCompleted
          ? 'bg-emerald-500 border-emerald-500'
          : 'border-zinc-600 hover:border-zinc-400 bg-zinc-900/50'
      "
      title="Marcar como concluída"
      @click.stop="emit('toggleComplete', !lesson.isCompleted)"
    >
      <svg
        v-if="lesson.isCompleted"
        class="w-2.5 h-2.5 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="3"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>

    <!-- Title -->
    <span
      class="flex-1 truncate"
      :class="{
        'line-through text-zinc-500': lesson.isCompleted && !isActive,
        'text-indigo-400 font-semibold': isPlaying
      }"
    >
      {{ lesson.cleanTitle }}
    </span>

    <!-- Playing in MPC indicator -->
    <div v-if="isPlaying" class="shrink-0 flex items-center gap-1" title="Reproduzindo no MPC">
      <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
      <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
    </div>

    <!-- Play icon on hover -->
    <button
      v-else
      class="shrink-0 p-1 rounded text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      title="Abrir no MPC"
      @click.stop="emit('play')"
    >
      <Play class="w-3 h-3 fill-current" />
    </button>

    <!-- Badges (attachments, notes) -->
    <div class="shrink-0 flex items-center gap-1.5">
      <span
        v-if="lesson.attachments.length > 0"
        class="text-[10px] text-zinc-500 flex items-center gap-0.5"
        :title="`${lesson.attachments.length} materiais de apoio`"
      >
        <Paperclip class="w-2.5 h-2.5" />
        {{ lesson.attachments.length }}
      </span>
      <StickyNote
        v-if="lesson.hasNotes"
        class="w-3 h-3 text-amber-500/70"
        title="Possui anotações"
      />
    </div>

    <!-- Mini Progress bar -->
    <div
      v-if="miniProgress > 0 && !lesson.isCompleted"
      class="shrink-0 w-5 h-1 bg-zinc-800 rounded-full overflow-hidden"
      :title="`${miniProgress}% assistido`"
    >
      <div
        class="h-full bg-indigo-500/70 rounded-full"
        :style="{ width: `${miniProgress}%` }"
      />
    </div>
  </div>
</template>

