import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '@shared/types/settings'
import { DEFAULT_SETTINGS } from '@shared/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  async function load() {
    try {
      const res = await window.api.getSettings()
      if (res) {
        settings.value = { ...DEFAULT_SETTINGS, ...res }
      }
    } catch {
      settings.value = { ...DEFAULT_SETTINGS }
    } finally {
      loaded.value = true
    }
  }

  async function update(partial: Partial<AppSettings>) {
    await window.api.setSettings(partial)
    settings.value = { ...settings.value, ...partial }
  }

  return { settings, loaded, load, update }
})

