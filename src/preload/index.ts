import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types/ipc'
import type {
  LessonProgressPayload,
  LessonTogglePayload,
  NoteGetPayload,
  NoteSavePayload,
  MpcOpenFilePayload,
  MpcCommandPayload,
  MpcSeekPayload,
  MpcSnapshotPayload,
  MpcSnapshotResult,
  FileReadTextPayload
} from '../shared/types/ipc'
import type { Course, LessonNote } from '../shared/types/course'
import type { MpcLiveState } from '../shared/types/mpc'
import type { AppSettings } from '../shared/types/settings'

const api = {
  // ── Course ──
  importCourse: (folderPath: string): Promise<Course> =>
    ipcRenderer.invoke(IPC_CHANNELS.COURSE_IMPORT, folderPath),
  getAllCourses: (): Promise<Course[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.COURSE_GET_ALL),
  getCourse: (courseId: string): Promise<Course | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.COURSE_GET, courseId),
  deleteCourse: (courseId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.COURSE_DELETE, courseId),
  rescanCourse: (courseId: string): Promise<Course> =>
    ipcRenderer.invoke(IPC_CHANNELS.COURSE_RESCAN, courseId),
  getLastCourse: (): Promise<{ course: Course; lessonId?: string; positionMs?: number } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.COURSE_GET_LAST),

  // ── Lesson ──
  setLessonProgress: (payload: LessonProgressPayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.LESSON_SET_PROGRESS, payload),
  toggleLessonComplete: (payload: LessonTogglePayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.LESSON_TOGGLE_COMPLETE, payload),

  // ── Notes ──
  getNote: (payload: NoteGetPayload): Promise<LessonNote> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTE_GET, payload),
  saveNote: (payload: NoteSavePayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTE_SAVE, payload),

  // ── MPC ──
  mpcOpenFile: (payload: MpcOpenFilePayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.MPC_OPEN_FILE, payload),
  mpcCommand: (payload: MpcCommandPayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.MPC_COMMAND, payload),
  mpcSeek: (payload: MpcSeekPayload): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.MPC_SEEK, payload),
  mpcSnapshot: (payload: MpcSnapshotPayload): Promise<MpcSnapshotResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.MPC_SNAPSHOT, payload),
  mpcDetect: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.MPC_DETECT),
  onMpcStateUpdate: (callback: (state: MpcLiveState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: MpcLiveState) => callback(state)
    ipcRenderer.on(IPC_CHANNELS.MPC_STATE_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MPC_STATE_UPDATE, handler)
  },

  // ── Settings ──
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // ── Shell & External Apps ──
  openInExplorer: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_IN_EXPLORER, filePath),
  openInVSCode: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_IN_VSCODE, folderPath),
  openInObsidian: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_IN_OBSIDIAN, folderPath),
  snapAssist: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_SNAP_ASSIST),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_COPY, text),
  saveSnapshotBase64: (payload: { courseRootPath: string; lessonId: string; positionMs: number; dataUrl: string }): Promise<{ savePath: string; relativePath: string; filename: string; obsidianLink: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SNAPSHOT_SAVE_BASE64, payload),

  // ── File ──
  readTextFile: (payload: FileReadTextPayload): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_READ_TEXT, payload),
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_FOLDER),

  // ── Watcher ──
  onWatcherChanged: (callback: (courseId: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, courseId: string) => callback(courseId)
    ipcRenderer.on(IPC_CHANNELS.WATCHER_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WATCHER_CHANGED, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
