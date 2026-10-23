/**
 * MPC-related IPC handlers.
 */

import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '../../shared/types/ipc'
import type {
  MpcOpenFilePayload,
  MpcCommandPayload,
  MpcSeekPayload,
  MpcSnapshotPayload,
  MpcSnapshotResult
} from '../../shared/types/ipc'
import type { MpcBridgeService } from '../services/MpcBridgeService'
import type { StorageService } from '../services/StorageService'
import { join, relative } from 'path'

export function registerMpcIpc(
  mpcBridge: MpcBridgeService,
  storage?: StorageService
): void {
  ipcMain.handle(
    IPC_CHANNELS.MPC_OPEN_FILE,
    async (_event, payload: MpcOpenFilePayload): Promise<void> => {
      await mpcBridge.openFile(
        payload.filePath,
        payload.startMs ?? 0,
        payload.lessonId
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MPC_COMMAND,
    async (_event, payload: MpcCommandPayload): Promise<void> => {
      await mpcBridge.sendCommand(payload.command)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MPC_SEEK,
    async (_event, payload: MpcSeekPayload): Promise<void> => {
      await mpcBridge.seek(payload.positionMs)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MPC_SNAPSHOT,
    async (_event, payload: MpcSnapshotPayload): Promise<MpcSnapshotResult> => {
      // Build snapshot filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `${payload.lessonId}_${payload.positionMs}_${timestamp}.jpg`

      // Ensure snapshots directory exists
      const snapshotsDir = storage
        ? storage.snapshotsDir(payload.courseRootPath)
        : join(payload.courseRootPath, '.course-hub', 'snapshots')

      const savePath = join(snapshotsDir, filename)
      const snapshotPath = await mpcBridge.takeSnapshot(savePath)
      const relativePath = relative(payload.courseRootPath, snapshotPath)

      // Format time for markdown
      const totalSec = Math.floor(payload.positionMs / 1000)
      const h = Math.floor(totalSec / 3600)
      const m = Math.floor((totalSec % 3600) / 60)
      const s = totalSec % 60
      const timeFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

      const markdownSnippet = `![Snapshot at ${timeFormatted}](${relativePath.replace(/\\/g, '/')})\n`

      return {
        snapshotPath,
        relativePath,
        markdownSnippet
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MPC_DETECT,
    async (): Promise<string | null> => {
      return mpcBridge.detectPlayer()
    }
  )
}
