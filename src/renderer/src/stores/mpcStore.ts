import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MpcLiveState } from '@shared/types/mpc'

export const useMpcStore = defineStore('mpc', () => {
  const state = ref<MpcLiveState>({
    connected: false,
    state: 'disconnected',
    positionMs: 0,
    durationMs: 0,
    positionFormatted: '0:00',
    durationFormatted: '0:00',
    percent: 0,
    playbackRate: 1.0,
    volume: 100,
    muted: false,
    alwaysOnTop: false,
    autoplayNext: true
  })

  const isPlaying = computed(() => state.value.state === 'playing')
  const isPaused = computed(() => state.value.state === 'paused')
  const isConnected = computed(() => state.value.connected)
  const progressPercent = computed(() => state.value.percent)

  let unsubscribe: (() => void) | null = null

  function startListening() {
    if (unsubscribe) return
    unsubscribe = window.api.onMpcStateUpdate((newState: MpcLiveState) => {
      state.value = newState
    })
  }

  function stopListening() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  function setAutoplayNext(value: boolean) {
    state.value.autoplayNext = value
  }

  return {
    state,
    isPlaying,
    isPaused,
    isConnected,
    progressPercent,
    startListening,
    stopListening,
    setAutoplayNext
  }
})

