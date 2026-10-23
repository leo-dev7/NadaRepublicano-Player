export type MpcPlaybackState = 'stopped' | 'paused' | 'playing' | 'disconnected'

export interface MpcLiveState {
  connected: boolean
  playerExecutable?: string
  activeFilePath?: string
  activeLessonId?: string
  state: MpcPlaybackState
  positionMs: number
  durationMs: number
  positionFormatted: string
  durationFormatted: string
  percent: number
  playbackRate: number
  volume: number
  muted: boolean
  alwaysOnTop: boolean
  autoplayNext: boolean
}
