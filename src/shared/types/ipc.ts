import type { Course, LessonNote } from './course'
import type { MpcLiveState } from './mpc'
import type { AppSettings } from './settings'

// ── Channel names ──
export const IPC_CHANNELS = {
  // Course
  COURSE_IMPORT: 'course:import',
  COURSE_GET_ALL: 'course:get-all',
  COURSE_GET_RECENT: 'course:get-recent',
  COURSE_GET: 'course:get',
  COURSE_DELETE: 'course:delete',
  COURSE_RESCAN: 'course:rescan',
  COURSE_GET_LAST: 'course:get-last',

  // Lesson progress
  LESSON_SET_PROGRESS: 'lesson:set-progress',
  LESSON_TOGGLE_COMPLETE: 'lesson:toggle-complete',

  // Notes
  NOTE_GET: 'note:get',
  NOTE_SAVE: 'note:save',

  // MPC Bridge
  MPC_OPEN_FILE: 'mpc:open-file',
  MPC_COMMAND: 'mpc:command',
  MPC_SEEK: 'mpc:seek',
  MPC_STATE_UPDATE: 'mpc:state-update',
  MPC_SNAPSHOT: 'mpc:snapshot',
  MPC_SNAPSHOT_TO_CLIPBOARD: 'mpc:snapshot-to-clipboard',
  MPC_DETECT: 'mpc:detect',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Shell & External Apps
  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_OPEN_IN_EXPLORER: 'shell:open-in-explorer',
  SHELL_OPEN_IN_VSCODE: 'shell:open-in-vscode',
  SHELL_OPEN_IN_OBSIDIAN: 'shell:open-in-obsidian',
  SHELL_SNAP_ASSIST: 'shell:snap-assist',
  CLIPBOARD_COPY: 'clipboard:copy',
  SNAPSHOT_SAVE_BASE64: 'snapshot:save-base64',

  // File
  FILE_READ_TEXT: 'file:read-text',
  FILE_SELECT_FOLDER: 'file:select-folder',

  // File watcher events (main -> renderer)
  WATCHER_CHANGED: 'watcher:changed'
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]

// ── Payload types for invoke calls ──
export interface LessonProgressPayload {
  courseId: string
  lessonId: string
  positionMs: number
  durationMs: number
}

export interface LessonTogglePayload {
  courseId: string
  lessonId: string
  completed: boolean
}

export interface NoteGetPayload {
  courseId: string
  lessonId: string
}

export interface NoteSavePayload {
  courseId: string
  lessonId: string
  content: string
}

export interface MpcOpenFilePayload {
  filePath: string
  startMs?: number
  lessonId?: string
}

export interface MpcCommandPayload {
  command: number
  position?: string
}

export interface MpcSeekPayload {
  positionMs: number
}

export interface MpcSnapshotPayload {
  courseId: string
  lessonId: string
  positionMs: number
  courseRootPath: string
}

export interface MpcSnapshotResult {
  snapshotPath: string
  relativePath: string
  markdownSnippet: string
}

export interface FileReadTextPayload {
  filePath: string
}

export interface SaveSnapshotBase64Payload {
  courseRootPath: string
  lessonId: string
  positionMs: number
  dataUrl: string
}
