<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { X, Search, Check, RefreshCw } from 'lucide-vue-next'
import { useSettingsStore } from '../../stores/settingsStore'

const emit = defineEmits<{ close: [] }>()
const settingsStore = useSettingsStore()

const form = ref({ ...settingsStore.settings })
const detectedPath = ref<string | null>(null)
const detecting = ref(false)
const saved = ref(false)

onMounted(async () => {
  form.value = { ...settingsStore.settings }
  if (!form.value.mpcCustomPath) {
    await detectMpc()
  }
})

async function detectMpc() {
  detecting.value = true
  try {
    const path = await window.api.mpcDetect()
    if (path) {
      detectedPath.value = path
      form.value.mpcCustomPath = path
    } else {
      detectedPath.value = 'Nenhum executável do MPC foi detectado automaticamente nos caminhos padrão.'
    }
  } catch {
    detectedPath.value = 'Falha ao buscar MPC.'
  } finally {
    detecting.value = false
  }
}

async function save() {
  await settingsStore.update(form.value)
  saved.value = true
  setTimeout(() => {
    saved.value = false
    emit('close')
  }, 400)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />
    <div class="relative w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden animate-fade-in select-none">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 class="text-base font-semibold text-zinc-100">Configurações do Player & App</h2>
        <button class="btn-icon !p-1 text-zinc-400 hover:text-white" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
        <!-- MPC Path -->
        <div>
          <label class="block font-medium text-zinc-300 mb-1.5">Caminho do MPC (mpc-hc64.exe / mpc-be64.exe)</label>
          <div class="flex gap-2">
            <input
              v-model="form.mpcCustomPath"
              class="input-base flex-1 font-mono text-xs"
              placeholder="Ex: C:\Program Files\MPC-HC\mpc-hc64.exe"
            />
            <button
              class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center gap-1.5 shrink-0 transition-colors"
              :disabled="detecting"
              @click="detectMpc"
            >
              <component :is="detecting ? RefreshCw : Search" class="w-3.5 h-3.5" :class="{ 'animate-spin': detecting }" />
              <span>Detectar</span>
            </button>
          </div>
          <p v-if="detectedPath" class="text-[11px] text-emerald-400 mt-1">
            {{ detectedPath }}
          </p>
        </div>

        <!-- Player Type -->
        <div>
          <label class="block font-medium text-zinc-300 mb-1.5">Variante do Player</label>
          <select v-model="form.mpcPlayerType" class="input-base text-xs">
            <option value="auto">Auto-detectar</option>
            <option value="mpc-hc">MPC-HC (Media Player Classic Home Cinema)</option>
            <option value="mpc-be">MPC-BE (Media Player Classic Black Edition)</option>
          </select>
        </div>

        <!-- Port -->
        <div>
          <label class="block font-medium text-zinc-300 mb-1.5">Porta da Web Interface (Padrão: 13579)</label>
          <input v-model.number="form.webServerPort" type="number" class="input-base w-32 font-mono" />
        </div>

        <!-- Auto-configure Registry -->
        <label class="flex items-start gap-2.5 cursor-pointer pt-1">
          <input
            v-model="form.autoConfigRegistry"
            type="checkbox"
            class="mt-0.5 w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-indigo-500 focus:ring-indigo-500"
          />
          <div>
            <span class="text-zinc-200 font-medium">Configurar Registro do Windows automaticamente</span>
            <p class="text-zinc-500 text-[11px] mt-0.5">
              Habilita automaticamente a Web Interface no registro do MPC (EnableWebServer=1) para funcionamento zero-atrito.
            </p>
          </div>
        </label>

        <!-- Autoplay next -->
        <label class="flex items-start gap-2.5 cursor-pointer">
          <input
            v-model="form.autoPlayNext"
            type="checkbox"
            class="mt-0.5 w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-indigo-500 focus:ring-indigo-500"
          />
          <div>
            <span class="text-zinc-200 font-medium">Autoplay da Próxima Aula</span>
            <p class="text-zinc-500 text-[11px] mt-0.5">
              Ao terminar um vídeo (99%), abre automaticamente a próxima aula no MPC sem intervenção.
            </p>
          </div>
        </label>

        <!-- Auto-complete threshold -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="font-medium text-zinc-300">Marcar aula como concluída automaticamente em:</label>
            <span class="font-mono text-indigo-400 font-semibold">{{ form.autoCompletePercent }}%</span>
          </div>
          <input
            v-model.number="form.autoCompletePercent"
            type="range"
            min="50"
            max="100"
            step="5"
            class="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        <!-- VS Code Command -->
        <div>
          <label class="block font-medium text-zinc-300 mb-1.5">Comando CLI do VS Code / Cursor</label>
          <input v-model="form.vscodeCommand" class="input-base w-36 font-mono" placeholder="code" />
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end items-center gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">
        <button class="btn-ghost" @click="emit('close')">Cancelar</button>
        <button class="btn-primary flex items-center gap-1.5" @click="save">
          <Check v-if="saved" class="w-4 h-4" />
          <span>{{ saved ? 'Salvo!' : 'Salvar Alterações' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

