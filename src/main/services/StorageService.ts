/**
 * StorageService – hybrid persistence using electron-store for global data
 * and .course-hub.json / .course-hub/ directory inside each course root.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import Store from 'electron-store'

// Resolve CJS/ESM interop where require('electron-store') is { default: [class ElectronStore] }
const ElectronStore = (typeof Store === 'function'
  ? Store
  : (Store as unknown as { default: typeof Store }).default) as typeof Store

import type { CourseHubStorageFile } from '../../shared/types/course'
import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/types/settings'

// ── CourseListEntry ──────────────────────────────────────────────
export interface CourseListEntry {
  id: string
  title: string
  rootPath: string
  lastAccessedAt: string
}

// ── Schema for electron-store ────────────────────────────────────
interface StoreSchema {
  courses: CourseListEntry[]
  settings: AppSettings
}

const COURSE_HUB_DIR = '.course-hub'
const COURSE_HUB_FILE = '.course-hub.json'
const NOTES_DIR = 'notes'
const SNAPSHOTS_DIR = 'snapshots'

export class StorageService {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new ElectronStore<StoreSchema>({
      name: 'course-hub',
      projectName: 'udemy-pobre',
      defaults: {
        courses: [],
        settings: { ...DEFAULT_SETTINGS }
      }
    })
  }

  // ── Course list (global electron-store) ──────────────────────

  getCourseList(): CourseListEntry[] {
    return this.store.get('courses', [])
  }

  addCourseToList(course: { id: string; title: string; rootPath: string }): void {
    const list = this.getCourseList()
    const existing = list.findIndex((c) => c.id === course.id)

    const entry: CourseListEntry = {
      id: course.id,
      title: course.title,
      rootPath: course.rootPath,
      lastAccessedAt: new Date().toISOString()
    }

    if (existing >= 0) {
      list[existing] = entry
    } else {
      list.push(entry)
    }

    this.store.set('courses', list)
  }

  removeCourseFromList(courseId: string): void {
    const list = this.getCourseList().filter((c) => c.id !== courseId)
    this.store.set('courses', list)
  }

  updateCourseAccess(courseId: string): void {
    const list = this.getCourseList()
    const entry = list.find((c) => c.id === courseId)
    if (entry) {
      entry.lastAccessedAt = new Date().toISOString()
      this.store.set('courses', list)
    }
  }

  // ── Course hub (portable per-course JSON) ────────────────────

  private courseHubPath(courseRootPath: string): string {
    return join(courseRootPath, COURSE_HUB_FILE)
  }

  private courseHubDir(courseRootPath: string): string {
    return join(courseRootPath, COURSE_HUB_DIR)
  }

  private ensureCourseHubDir(courseRootPath: string): void {
    const dir = this.courseHubDir(courseRootPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  loadCourseHub(courseRootPath: string): CourseHubStorageFile | null {
    const filePath = this.courseHubPath(courseRootPath)
    try {
      if (!existsSync(filePath)) return null
      const raw = readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as CourseHubStorageFile
    } catch {
      console.warn('[StorageService] Failed to load course hub:', filePath)
      return null
    }
  }

  saveCourseHub(courseRootPath: string, data: CourseHubStorageFile): void {
    try {
      const filePath = this.courseHubPath(courseRootPath)
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[StorageService] Failed to save course hub:', (err as Error).message)
    }
  }

  // ── Notes (markdown files inside .course-hub/notes/) ─────────

  private notesDir(courseRootPath: string): string {
    return join(this.courseHubDir(courseRootPath), NOTES_DIR)
  }

  private notePath(courseRootPath: string, lessonId: string): string {
    return join(this.notesDir(courseRootPath), `${lessonId}.md`)
  }

  loadNote(courseRootPath: string, lessonId: string): string {
    const filePath = this.notePath(courseRootPath, lessonId)
    try {
      if (!existsSync(filePath)) return ''
      return readFileSync(filePath, 'utf-8')
    } catch {
      return ''
    }
  }

  saveNote(courseRootPath: string, lessonId: string, content: string): void {
    try {
      const dir = this.notesDir(courseRootPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.notePath(courseRootPath, lessonId), content, 'utf-8')
    } catch (err) {
      console.error('[StorageService] Failed to save note:', (err as Error).message)
    }
  }

  // ── Snapshots directory helper ───────────────────────────────

  snapshotsDir(courseRootPath: string): string {
    const dir = join(this.courseHubDir(courseRootPath), SNAPSHOTS_DIR)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  // ── Settings ─────────────────────────────────────────────────

  getSettings(): AppSettings {
    return this.store.get('settings', { ...DEFAULT_SETTINGS })
  }

  setSettings(partial: Partial<AppSettings>): void {
    const current = this.getSettings()
    this.store.set('settings', { ...current, ...partial })
  }
}
