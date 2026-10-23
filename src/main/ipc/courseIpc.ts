/**
 * Course-related IPC handlers.
 */

import { ipcMain, dialog, shell } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { execFile } from 'child_process'

import { IPC_CHANNELS } from '../../shared/types/ipc'
import type {
  LessonProgressPayload,
  LessonTogglePayload,
  NoteGetPayload,
  NoteSavePayload,
  FileReadTextPayload
} from '../../shared/types/ipc'
import type { Course, CourseHubStorageFile } from '../../shared/types/course'
import type { CourseScannerService } from '../services/CourseScannerService'
import type { StorageService, CourseListEntry } from '../services/StorageService'

export function registerCourseIpc(
  scanner: CourseScannerService,
  storage: StorageService
): void {
  function findEntry(courseId: string): CourseListEntry | undefined {
    const list = storage.getCourseList()
    return list.find((c) => c.id === courseId || scanner.isMatchingCourseId(c.rootPath, courseId))
  }

  // ── Course CRUD ──────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.COURSE_IMPORT,
    async (_event, rootPath: string): Promise<Course> => {
      const course = await scanner.scanFolder(rootPath)
      storage.addCourseToList({ id: course.id, title: course.title, rootPath: course.rootPath })

      // Initialize hub file if it doesn't exist
      const existingHub = storage.loadCourseHub(rootPath)
      if (!existingHub) {
        const hub: CourseHubStorageFile = {
          version: 1,
          courseId: course.id,
          title: course.title,
          progress: {},
          notesSummary: {}
        }
        storage.saveCourseHub(rootPath, hub)
      }

      return course
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COURSE_GET_RECENT,
    async (): Promise<CourseListEntry[]> => {
      const list = storage.getCourseList()
      let changed = false
      const valid = list.filter((e) => existsSync(e.rootPath))
      for (const entry of valid) {
        const canonicalId = scanner.getCourseId(entry.rootPath)
        if (entry.id !== canonicalId) {
          entry.id = canonicalId
          changed = true
        }
      }
      if (changed) {
        storage.saveCourseList(list)
      }
      return valid
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COURSE_GET_ALL,
    async (): Promise<Course[]> => {
      const list = storage.getCourseList()
      let changed = false
      const results: Course[] = []

      for (const entry of list) {
        try {
          if (existsSync(entry.rootPath)) {
            const course = await scanner.scanFolder(entry.rootPath)
            if (entry.id !== course.id) {
              entry.id = course.id
              changed = true
            }
            results.push(course)
          }
        } catch (err) {
          console.warn('[courseIpc] Failed to scan course:', entry.rootPath, err)
        }
      }

      if (changed) {
        storage.saveCourseList(list)
      }
      return results
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COURSE_GET,
    async (_event, courseId: string): Promise<Course | null> => {
      const entry = findEntry(courseId)
      if (!entry) return null

      const course = await scanner.scanFolder(entry.rootPath)
      storage.updateCourseAccess(course.id, entry.rootPath)
      return course
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COURSE_DELETE,
    async (_event, courseId: string): Promise<void> => {
      const entry = findEntry(courseId)
      if (entry) {
        scanner.invalidateCache(entry.rootPath)
        storage.removeCourseFromList(entry.id)
      } else {
        storage.removeCourseFromList(courseId)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COURSE_RESCAN,
    async (_event, courseId: string): Promise<Course | null> => {
      const entry = findEntry(courseId)
      if (!entry) return null
      return scanner.scanFolder(entry.rootPath, true)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COURSE_GET_LAST,
    async (): Promise<{ course: Course; lessonId?: string; positionMs?: number } | null> => {
      const list = storage.getCourseList()
      if (list.length === 0) return null

      // Sort by lastAccessedAt descending
      const sorted = [...list].sort(
        (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
      )
      for (const entry of sorted) {
        try {
          if (existsSync(entry.rootPath)) {
            const course = await scanner.scanFolder(entry.rootPath)
            return {
              course,
              lessonId: course.lastLessonId,
              positionMs: course.lastPositionMs
            }
          }
        } catch (err) {
          console.warn('[courseIpc] Failed to load last course:', entry.rootPath, err)
        }
      }
      return null
    }
  )

  // ── Lesson progress ──────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.LESSON_SET_PROGRESS,
    async (_event, payload: LessonProgressPayload): Promise<void> => {
      const entry = findEntry(payload.courseId)
      if (!entry) return

      const hub = storage.loadCourseHub(entry.rootPath) ?? {
        version: 1,
        courseId: payload.courseId,
        title: entry.title,
        progress: {},
        notesSummary: {}
      }

      const existing = hub.progress[payload.lessonId]
      hub.progress[payload.lessonId] = {
        lastPositionMs: payload.positionMs,
        durationMs: payload.durationMs,
        isCompleted: existing?.isCompleted ?? false,
        completedAt: existing?.completedAt
      }

      hub.lastLessonId = payload.lessonId
      hub.lastPositionMs = payload.positionMs

      storage.saveCourseHub(entry.rootPath, hub)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LESSON_TOGGLE_COMPLETE,
    async (_event, payload: LessonTogglePayload): Promise<void> => {
      const entry = findEntry(payload.courseId)
      if (!entry) return

      const hub = storage.loadCourseHub(entry.rootPath) ?? {
        version: 1,
        courseId: payload.courseId,
        title: entry.title,
        progress: {},
        notesSummary: {}
      }

      const existing = hub.progress[payload.lessonId] ?? {
        lastPositionMs: 0,
        durationMs: 0,
        isCompleted: false
      }

      hub.progress[payload.lessonId] = {
        ...existing,
        isCompleted: payload.completed,
        completedAt: payload.completed ? new Date().toISOString() : undefined
      }

      storage.saveCourseHub(entry.rootPath, hub)
    }
  )

  // ── Notes ────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NOTE_GET,
    async (_event, payload: NoteGetPayload): Promise<string> => {
      const entry = findEntry(payload.courseId)
      if (!entry) return ''
      return storage.loadNote(entry.rootPath, payload.lessonId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE_SAVE,
    async (_event, payload: NoteSavePayload): Promise<void> => {
      const entry = findEntry(payload.courseId)
      if (!entry) return

      storage.saveNote(entry.rootPath, payload.lessonId, payload.content)

      // Update notes summary in hub
      const hub = storage.loadCourseHub(entry.rootPath)
      if (hub) {
        hub.notesSummary[payload.lessonId] = {
          updatedAt: new Date().toISOString(),
          snapshotsCount: hub.notesSummary[payload.lessonId]?.snapshotsCount ?? 0
        }
        storage.saveCourseHub(entry.rootPath, hub)
      }
    }
  )

  // ── File helpers ─────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.FILE_READ_TEXT,
    async (_event, payload: FileReadTextPayload): Promise<string> => {
      try {
        return readFileSync(payload.filePath, 'utf-8')
      } catch {
        return ''
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SELECT_FOLDER,
    async (): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  // ── Shell helpers ────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.SHELL_OPEN_PATH,
    async (_event, filePath: string): Promise<string> => {
      return shell.openPath(filePath)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SHELL_OPEN_IN_EXPLORER,
    async (_event, filePath: string): Promise<void> => {
      shell.showItemInFolder(filePath)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SHELL_OPEN_IN_VSCODE,
    async (_event, folderPath: string): Promise<void> => {
      const settings = storage.getSettings()
      const command = settings.vscodeCommand || 'code'

      execFile(command, [folderPath], (err) => {
        if (err) {
          console.warn('[courseIpc] Failed to open VS Code:', err.message)
        }
      })
    }
  )
}
