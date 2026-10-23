/**
 * Main entry point for the Electron app.
 * Initializes all services, registers IPC handlers, and creates the main window.
 */

import { join } from 'path'
import { app, BrowserWindow, ipcMain, screen } from 'electron'

import { IPC_CHANNELS } from '../shared/types/ipc'
import type { MpcLiveState } from '../shared/types/mpc'

import { StorageService } from './services/StorageService'
import { CourseScannerService } from './services/CourseScannerService'
import { MpcBridgeService } from './services/MpcBridgeService'
import { FileWatcherService } from './services/FileWatcherService'
import { ShortcutService } from './services/ShortcutService'
import { WindowManagerService } from './services/WindowManagerService'

import { registerCourseIpc } from './ipc/courseIpc'
import { registerMpcIpc } from './ipc/mpcIpc'
import { registerSettingsIpc } from './ipc/settingsIpc'

// ── Services (module-level for cleanup access) ─────────────────
let mainWindow: BrowserWindow | null = null
let storageService: StorageService
let scannerService: CourseScannerService
let mpcBridge: MpcBridgeService
let fileWatcher: FileWatcherService
let shortcutService: ShortcutService
let windowManager: WindowManagerService

// Track the currently playing lesson for auto-complete / auto-next
let currentCourseId: string | null = null
let autoCompleteTriggered = false
let autoPlayNextTriggered = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#09090b',
      symbolColor: '#a1a1aa',
      height: 36
    },
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function initServices(): Promise<void> {
  // 1. Storage
  storageService = new StorageService()

  // 2. Course Scanner
  scannerService = new CourseScannerService(storageService)

  // 3. MPC Bridge
  const settings = storageService.getSettings()
  mpcBridge = new MpcBridgeService({
    port: settings.webServerPort,
    pollingIntervalMs: settings.pollingIntervalMs,
    customPath: settings.mpcCustomPath,
    playerType: settings.mpcPlayerType === 'auto' ? 'auto' : settings.mpcPlayerType,
    autoConfigRegistry: settings.autoConfigRegistry
  })
  await mpcBridge.init()
  const detected = mpcBridge.getDetectedPath()
  if (detected && !settings.mpcCustomPath) {
    storageService.setSettings({ mpcCustomPath: detected })
  }

  // 4. File Watcher
  fileWatcher = new FileWatcherService()

  // 5. Shortcut Service
  shortcutService = new ShortcutService()

  // 6. Window Manager
  windowManager = new WindowManagerService()
}

function registerIpcHandlers(): void {
  registerCourseIpc(scannerService, storageService)
  registerMpcIpc(mpcBridge, storageService)
  registerSettingsIpc(storageService)

  // Snap assist needs direct window reference
  ipcMain.handle(
    IPC_CHANNELS.SHELL_SNAP_ASSIST,
    async (_event, ratio: number): Promise<void> => {
      if (!mainWindow) return
      if (ratio <= 0) {
        windowManager.resetPosition(mainWindow)
      } else {
        windowManager.snapAssist(mainWindow, ratio)
      }
    }
  )
}

function startMpcPolling(): void {
  const settings = storageService.getSettings()

  mpcBridge.startPolling((state: MpcLiveState) => {
    // Forward state to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.MPC_STATE_UPDATE, state)
    }

    // Auto-complete logic
    if (
      state.connected &&
      state.durationMs > 0 &&
      state.activeLessonId &&
      state.percent >= settings.autoCompletePercent
    ) {
      if (!autoCompleteTriggered) {
        autoCompleteTriggered = true
        markCurrentLessonComplete(state)
      }
    }

    // Auto-play next logic
    if (
      settings.autoPlayNext &&
      state.connected &&
      state.durationMs > 0 &&
      state.activeLessonId &&
      state.percent >= settings.autoPlayNextPercent
    ) {
      if (!autoPlayNextTriggered) {
        autoPlayNextTriggered = true
        playNextLesson(state)
      }
    }

    // Reset triggers when a new file starts playing
    if (state.percent < 5) {
      autoCompleteTriggered = false
      autoPlayNextTriggered = false
    }
  })
}

async function markCurrentLessonComplete(state: MpcLiveState): Promise<void> {
  if (!state.activeLessonId || !currentCourseId) return

  const list = storageService.getCourseList()
  const entry = list.find((c) => c.id === currentCourseId)
  if (!entry) return

  const hub = storageService.loadCourseHub(entry.rootPath)
  if (!hub) return

  const progress = hub.progress[state.activeLessonId] ?? {
    lastPositionMs: 0,
    durationMs: 0,
    isCompleted: false
  }

  hub.progress[state.activeLessonId] = {
    ...progress,
    lastPositionMs: state.positionMs,
    durationMs: state.durationMs,
    isCompleted: true,
    completedAt: new Date().toISOString()
  }

  storageService.saveCourseHub(entry.rootPath, hub)
}

async function playNextLesson(state: MpcLiveState): Promise<void> {
  if (!state.activeLessonId || !currentCourseId) return

  const list = storageService.getCourseList()
  const entry = list.find((c) => c.id === currentCourseId)
  if (!entry) return

  try {
    const course = await scannerService.scanFolder(entry.rootPath)
    const allLessons = course.modules.flatMap((m) => m.lessons)
    const currentIdx = allLessons.findIndex((l) => l.id === state.activeLessonId)

    if (currentIdx >= 0 && currentIdx < allLessons.length - 1) {
      const next = allLessons[currentIdx + 1]
      await mpcBridge.openFile(next.absolutePath, 0, next.id)
    }
  } catch (err) {
    console.error('[main] Failed to auto-play next lesson:', (err as Error).message)
  }
}

function registerShortcuts(): void {
  shortcutService.register({
    onSnapshot: async () => {
      const state = mpcBridge.getState()
      if (!state.connected || !state.activeLessonId || !currentCourseId) return

      const list = storageService.getCourseList()
      const entry = list.find((c) => c.id === currentCourseId)
      if (!entry) return

      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `${state.activeLessonId}_${state.positionMs}_${timestamp}.jpg`
        const snapshotsDir = storageService.snapshotsDir(entry.rootPath)
        const savePath = join(snapshotsDir, filename)

        await mpcBridge.takeSnapshot(savePath)

        // Notify renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.MPC_SNAPSHOT, {
            snapshotPath: savePath,
            lessonId: state.activeLessonId,
            positionMs: state.positionMs
          })
        }
      } catch (err) {
        console.error('[main] Snapshot shortcut failed:', (err as Error).message)
      }
    },

    onBookmark: () => {
      // Send bookmark event to renderer to handle in the UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        const state = mpcBridge.getState()
        mainWindow.webContents.send('shortcut:bookmark', {
          lessonId: state.activeLessonId,
          positionMs: state.positionMs
        })
      }
    },

    onNextLesson: async () => {
      const state = mpcBridge.getState()
      await playNextLesson(state)
    }
  })
}

function setupFileWatchers(): void {
  const courses = storageService.getCourseList()

  for (const course of courses) {
    fileWatcher.watch(course.rootPath, course.id, (courseId) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.WATCHER_CHANGED, { courseId })
      }
    })
  }
}

// ── Lifecycle ──────────────────────────────────────────────────

app.whenReady().then(async () => {
  await initServices()

  createWindow()
  registerIpcHandlers()
  startMpcPolling()
  registerShortcuts()
  setupFileWatchers()

  // Track which course is active when a file is opened
  ipcMain.on('course:set-active', (_event, courseId: string) => {
    currentCourseId = courseId
  })
})

app.on('window-all-closed', () => {
  cleanup()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanup()
})

function cleanup(): void {
  mpcBridge?.destroy()
  fileWatcher?.unwatchAll()
  shortcutService?.unregisterAll()
}
