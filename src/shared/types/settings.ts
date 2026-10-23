export interface AppSettings {
  mpcCustomPath: string
  mpcPlayerType: 'mpc-hc' | 'mpc-be' | 'auto'
  webServerPort: number
  autoConfigRegistry: boolean
  pollingIntervalMs: number
  autoPlayNext: boolean
  autoCompletePercent: number
  autoPlayNextPercent: number
  snapAssistRatio: number
  theme: 'dark'
  vscodeCommand: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  mpcCustomPath: '',
  mpcPlayerType: 'auto',
  webServerPort: 13579,
  autoConfigRegistry: true,
  pollingIntervalMs: 1000,
  autoPlayNext: true,
  autoCompletePercent: 90,
  autoPlayNextPercent: 99,
  snapAssistRatio: 0.5,
  theme: 'dark',
  vscodeCommand: 'code'
}
