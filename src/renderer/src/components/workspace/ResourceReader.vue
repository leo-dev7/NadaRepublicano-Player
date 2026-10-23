<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import { FolderOpen, FileCode, FileText, File, ExternalLink } from 'lucide-vue-next'
import type { Course, Lesson, Attachment } from '@shared/types/course'
import { CODE_EXTENSIONS, TEXT_READABLE_EXTENSIONS } from '@shared/constants/extensions'

const props = defineProps<{
  course: Course | null
  lesson: Lesson | null
  selectedPath: string | null
}>()

const fileContent = ref('')
const isLoading = ref(false)
const activeFile = ref<Attachment | null>(null)

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

const attachments = computed((): Attachment[] => {
  if (!props.lesson) return []
  return props.lesson.attachments
})

const isTextFile = computed(() => {
  if (!activeFile.value) return false
  return TEXT_READABLE_EXTENSIONS.has(activeFile.value.extension.toLowerCase())
})

const isCodeFile = computed(() => {
  if (!activeFile.value) return false
  return CODE_EXTENSIONS.has(activeFile.value.extension.toLowerCase())
})

const isPdf = computed(() => {
  return activeFile.value?.extension.toLowerCase() === '.pdf'
})

const renderedContent = computed(() => {
  if (!fileContent.value) return ''
  const ext = activeFile.value?.extension.toLowerCase() || ''
  if (ext === '.md' || ext === '.mdx') {
    return marked.parse(fileContent.value) as string
  }
  if (isCodeFile.value) {
    const rawLang = ext.replace('.', '')
    const lang = hljs.getLanguage(rawLang) ? rawLang : 'plaintext'
    return `<pre class="hljs leading-relaxed"><code>${hljs.highlight(fileContent.value, { language: lang }).value}</code></pre>`
  }
  return `<pre class="whitespace-pre-wrap font-mono text-xs text-zinc-300 leading-relaxed">${fileContent.value}</pre>`
})

watch(
  () => props.selectedPath,
  async (path) => {
    if (!path) {
      if (attachments.value.length > 0) {
        await openFile(attachments.value[0])
      }
      return
    }
    const att = attachments.value.find((a) => a.absolutePath === path)
    if (att) await openFile(att)
  },
  { immediate: true }
)

watch(
  () => props.lesson,
  async (newLesson) => {
    if (newLesson && newLesson.attachments.length > 0) {
      await openFile(newLesson.attachments[0])
    } else {
      activeFile.value = null
      fileContent.value = ''
    }
  }
)

async function openFile(attachment: Attachment) {
  activeFile.value = attachment
  if (TEXT_READABLE_EXTENSIONS.has(attachment.extension.toLowerCase())) {
    isLoading.value = true
    try {
      fileContent.value = await window.api.readTextFile({ filePath: attachment.absolutePath })
    } catch {
      fileContent.value = '// Erro ao ler o conteúdo do arquivo.'
    } finally {
      isLoading.value = false
    }
  } else {
    fileContent.value = ''
  }
}

function openInExplorer(path: string) {
  window.api.openInExplorer(path)
}
</script>

<template>
  <div class="flex h-full bg-zinc-950 overflow-hidden">
    <!-- Attachments Sidebar -->
    <div class="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
      <div class="px-3 py-2 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        Arquivos da Aula
      </div>
      <div class="flex-1 overflow-y-auto py-1">
        <div v-if="attachments.length === 0" class="p-4 text-xs text-zinc-500 text-center">
          Nenhum material de apoio encontrado para esta aula.
        </div>
        <button
          v-for="att in attachments"
          :key="att.id"
          class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors group"
          :class="
            activeFile?.id === att.id
              ? 'bg-zinc-800 text-indigo-400 font-medium'
              : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
          "
          @click="openFile(att)"
        >
          <component
            :is="att.kind === 'code' ? FileCode : att.kind === 'pdf' ? FileText : File"
            class="w-3.5 h-3.5 shrink-0"
            :class="activeFile?.id === att.id ? 'text-indigo-400' : 'text-zinc-500'"
          />
          <span class="truncate flex-1">{{ att.filename }}</span>
        </button>
      </div>
    </div>

    <!-- Viewer Area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div
        v-if="activeFile"
        class="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 shrink-0"
      >
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono text-zinc-300 font-medium">{{ activeFile.filename }}</span>
          <span class="text-[10px] text-zinc-500 font-mono">
            ({{ Math.round(activeFile.sizeBytes / 1024) }} KB)
          </span>
        </div>
        <button
          class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 hover:bg-zinc-800 rounded transition-colors"
          @click="openInExplorer(activeFile.absolutePath)"
        >
          <FolderOpen class="w-3.5 h-3.5" />
          <span>Abrir no Explorer</span>
        </button>
      </div>

      <div class="flex-1 overflow-auto p-4">
        <div v-if="!activeFile" class="flex items-center justify-center h-full text-zinc-500 text-xs">
          Selecione um anexo à esquerda para visualizar
        </div>

        <div v-else-if="isLoading" class="flex items-center justify-center h-full text-zinc-500 text-xs">
          Carregando arquivo...
        </div>

        <div v-else-if="isPdf" class="h-full w-full flex flex-col items-center justify-center text-center gap-3">
          <FileText class="w-12 h-12 text-rose-500/80" />
          <p class="text-sm text-zinc-300">Documento PDF: {{ activeFile.filename }}</p>
          <button
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
            @click="openInExplorer(activeFile.absolutePath)"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span>Abrir PDF Externamente</span>
          </button>
        </div>

        <div
          v-else-if="isTextFile || isCodeFile"
          class="prose prose-invert max-w-none text-xs"
          v-html="renderedContent"
        />

        <div v-else class="flex flex-col items-center justify-center h-full gap-3 text-zinc-500">
          <File class="w-12 h-12 text-zinc-600" />
          <p class="text-sm text-zinc-300">{{ activeFile.filename }}</p>
          <button
            class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
            @click="openInExplorer(activeFile.absolutePath)"
          >
            <FolderOpen class="w-3.5 h-3.5" />
            <span>Abrir no Explorer</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

