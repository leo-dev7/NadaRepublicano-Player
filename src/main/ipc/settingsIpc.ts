/**
 * Settings-related IPC handlers.
 */

import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '../../shared/types/ipc'
import type { AppSettings } from '../../shared/types/settings'
import type { StorageService } from '../services/StorageService'

export function registerSettingsIpc(storage: StorageService): void {
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    async (): Promise<AppSettings> => {
      return storage.getSettings()
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    async (_event, partial: Partial<AppSettings>): Promise<AppSettings> => {
      storage.setSettings(partial)
      return storage.getSettings()
    }
  )
}
