<script setup lang="ts">
import { ref, computed } from 'vue'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'
import { Clock, Bold, Italic, Code, Heading2, Eye, Edit3 } from 'lucide-vue-next'
import { useTimeFormat } from '../../composables/useTimeFormat'
import { useMarkdownShortcuts } from '../../composables/useMarkdownShortcuts'
import type { Course, Lesson } from '@shared/types/course'

const props = defineProps<{
  content: string
  lesson: Lesson | null
  course: Course | null
  mpcPositionMs: number
}>()

const emit = defineEmits<{
  'update:content': [value: string]
  seek: [ms: number]
}>()

const { timestampToMs } = useTimeFormat()
const mdShortcuts = useMarkdownShortcuts()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mode = ref<'split' | 'edit' | 'preview'>('split')

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  })
)

const renderedHtml = computed(() => {
  let html = marked.parse(props.content || '') as string
  // Replace [mm:ss] or [hh:mm:ss] with interactive buttons
  html = html.replace(
    /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
    '<button class="timestamp-link" data-ts="$1">⏱ [$1]</button>'
  )
  return html
})

function handlePreviewClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.timestamp-link') as HTMLElement | null
  if (target) {
    const ts = target.getAttribute('data-ts')
    if (ts) {
      emit('seek', timestampToMs(ts))
    }
  }
}

function insertTimestamp() {
  if (!textareaRef.value) return
  const newContent = mdShortcuts.insertTimestamp(textareaRef.value, props.mpcPositionMs)
  emit('update:content', newContent)
}

function wrapWith(wrapper: string) {
  if (!textareaRef.value) return
  const newContent = mdShortcuts.wrapSelection(textareaRef.value, wrapper)
  emit('update:content', newContent)
}

function insertHeading() {
  if (!textareaRef.value) return
  const newContent = mdShortcuts.insertAtCursor(textareaRef.value, '\n### ')
  emit('update:content', newContent)
}

function handleInput(e: Event) {
  emit('update:content', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="flex flex-col h-full bg-zinc-950 overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-indigo-400"
        title="Inserir Timestamp Atual"
        @click="insertTimestamp"
      >
        <Clock class="w-4 h-4" />
      </button>
      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
        title="Negrito"
        @click="wrapWith('**')"
      >
        <Bold class="w-4 h-4" />
      </button>
      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
        title="Itálico"
        @click="wrapWith('*')"
      >
        <Italic class="w-4 h-4" />
      </button>
      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
        title="Código"
        @click="wrapWith('`')"
      >
        <Code class="w-4 h-4" />
      </button>
      <button
        class="btn-icon !p-1.5 text-zinc-400 hover:text-white"
        title="Título"
        @click="insertHeading"
      >
        <Heading2 class="w-4 h-4" />
      </button>

      <div class="flex-1" />

      <!-- Mode Selector -->
      <div class="flex items-center bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-700/60 text-xs">
        <button
          class="px-2 py-0.5 rounded transition-colors"
          :class="mode === 'edit' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
          @click="mode = 'edit'"
        >
          Editar
        </button>
        <button
          class="px-2 py-0.5 rounded transition-colors"
          :class="mode === 'split' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
          @click="mode = 'split'"
        >
          Lado a Lado
        </button>
        <button
          class="px-2 py-0.5 rounded transition-colors"
          :class="mode === 'preview' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
          @click="mode = 'preview'"
        >
          Visualizar
        </button>
      </div>
    </div>

    <!-- Editor / Preview Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Editor -->
      <div
        v-if="mode === 'edit' || mode === 'split'"
        class="h-full overflow-hidden flex flex-col"
        :class="mode === 'split' ? 'w-1/2 border-r border-zinc-800' : 'w-full'"
      >
        <textarea
          ref="textareaRef"
          :value="content"
          class="flex-1 w-full resize-none bg-zinc-950 text-sm text-zinc-200 font-mono leading-relaxed p-4 focus:outline-none placeholder-zinc-600 overflow-y-auto"
          placeholder="Escreva suas anotações para esta aula... Use atalhos ou clique em ⏱ para inserir timestamps clicáveis [mm:ss]."
          spellcheck="false"
          @input="handleInput"
        />
      </div>

      <!-- Preview -->
      <div
        v-if="mode === 'preview' || mode === 'split'"
        class="h-full overflow-y-auto p-5"
        :class="mode === 'split' ? 'w-1/2' : 'w-full'"
        @click="handlePreviewClick"
      >
        <div
          v-if="content && content.trim().length > 0"
          class="prose prose-invert prose-zinc max-w-none text-sm leading-relaxed"
          v-html="renderedHtml"
        />
        <div v-else class="text-xs text-zinc-600 italic">
          Nenhuma anotação ainda. Escreva no editor à esquerda ou use Alt+S / Alt+B no teclado enquanto assiste no MPC.
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.timestamp-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  background-color: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border-radius: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.15s ease-in-out;
  cursor: pointer;
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.timestamp-link:hover {
  background-color: rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
  border-color: rgba(99, 102, 241, 0.5);
  transform: translateY(-1px);
}
</style>

