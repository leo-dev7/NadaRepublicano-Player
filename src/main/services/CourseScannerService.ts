/**
 * CourseScannerService – recursively scans course directory trees at any depth
 * and builds a clean Course / Module / Lesson structure that mirrors the real
 * subfolder hierarchy, keeping videos and their respective materials together.
 */

import { readdirSync, statSync, existsSync } from 'fs'
import { join, relative, extname, basename } from 'path'
import { createHash } from 'crypto'

import type { Course, Module, Lesson, Attachment } from '../../shared/types/course'
import { getAttachmentKind } from '../../shared/constants/extensions'
import { cleanTitle, naturalSortComparator } from '../utils/cleanTitles'
import {
  isVideoFile,
  isSubtitleFile,
  getFilePrefix,
  isSystemOrJunkFile,
  isIgnoredDirectory
} from '../utils/fileTypes'
import { StorageService } from './StorageService'

/**
 * Normalizes a path by removing trailing slashes and converting backslashes to forward slashes.
 */
export function normalizeCoursePath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Deterministic canonical ID for course and resource paths (case-insensitive on Windows).
 */
export function computeCourseId(rootPath: string): string {
  return createHash('sha256').update(normalizeCoursePath(rootPath).toLowerCase()).digest('hex').slice(0, 16)
}

export function computeLegacyCourseId(rootPath: string): string {
  return createHash('sha256').update(rootPath).digest('hex').slice(0, 16)
}

export function computeSlashCourseId(rootPath: string): string {
  return createHash('sha256').update(rootPath.replace(/\\/g, '/')).digest('hex').slice(0, 16)
}

/**
 * Creates a deterministic ID from a relative or absolute path.
 */
function makeId(relativePath: string): string {
  const normalized = normalizeCoursePath(relativePath).toLowerCase()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

function titleFromPath(name: string): string {
  return cleanTitle(name) || name
}

function isGenericLessonName(name: string): boolean {
  const base = name.replace(/\.[a-z0-9]+$/i, '').trim().toLowerCase()
  return ['video', 'aula', 'lesson', '1', '01', 'main', 'index', 'part1', 'part 1'].includes(base)
}

interface ScannedFile {
  fileName: string
  filePath: string
  relPath: string
  extension: string
  isVideo: boolean
  isSubtitle: boolean
  isAttachment: boolean
}

interface ScannedDir {
  dirPath: string
  relDir: string
  dirName: string
  files: ScannedFile[]
  subDirs: ScannedDir[]
}

function countLessonsRecursive(modules: Module[]): { total: number; completed: number; duration: number } {
  let total = 0
  let completed = 0
  let duration = 0
  for (const m of modules) {
    total += m.lessons.length
    completed += m.lessons.filter((l) => l.isCompleted).length
    duration += m.lessons.reduce((sum, l) => sum + l.durationMs, 0)
    if (m.subModules && m.subModules.length > 0) {
      const sub = countLessonsRecursive(m.subModules)
      total += sub.total
      completed += sub.completed
      duration += sub.duration
    }
  }
  return { total, completed, duration }
}

interface CacheEntry {
  course: Course
  mtimeMs: number
  cachedAt: number
}

export class CourseScannerService {
  private cache = new Map<string, CacheEntry>()

  constructor(private storage: StorageService) {}

  getCourseId(rootPath: string): string {
    return computeCourseId(rootPath)
  }

  isMatchingCourseId(rootPath: string, testId: string): boolean {
    if (!testId || !rootPath) return false
    if (this.getCourseId(rootPath) === testId) return true
    if (computeSlashCourseId(rootPath) === testId) return true
    if (computeLegacyCourseId(rootPath) === testId) return true
    if (normalizeCoursePath(rootPath).toLowerCase() === normalizeCoursePath(testId).toLowerCase()) return true
    return false
  }

  invalidateCache(rootPath?: string): void {
    if (rootPath) {
      const key = normalizeCoursePath(rootPath).toLowerCase()
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  private getExistingNotesSet(courseRootPath: string): Set<string> {
    const notesDir = join(courseRootPath, '.course-hub', 'notes')
    try {
      if (!existsSync(notesDir)) return new Set()
      const files = readdirSync(notesDir)
      const set = new Set<string>()
      for (const f of files) {
        if (f.endsWith('.md')) {
          set.add(f.slice(0, -3).toLowerCase())
        }
      }
      return set
    } catch {
      return new Set()
    }
  }

  async scanFolder(rootPath: string, force = false): Promise<Course> {
    const cacheKey = normalizeCoursePath(rootPath).toLowerCase()
    let currentMtime = 0
    try {
      currentMtime = statSync(rootPath).mtimeMs
    } catch {
      /* ignore */
    }

    if (!force && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      if (cached.mtimeMs === currentMtime && Date.now() - cached.cachedAt < 30000) {
        return cached.course
      }
    }

    const rootName = basename(rootPath)
    const courseId = makeId(rootPath)

    // Load existing progress from .course-hub.json if available
    const hub = this.storage.loadCourseHub(rootPath)
    const progressMap = hub?.progress || {}
    const existingNotesSet = this.getExistingNotesSet(rootPath)

    // Recursively scan the full directory tree starting from root
    const rootNode = this.scanDirNode(rootPath, rootPath)

    if (!rootNode || (rootNode.files.length === 0 && rootNode.subDirs.length === 0)) {
      const emptyCourse: Course = {
        id: courseId,
        title: titleFromPath(rootName),
        cleanTitle: titleFromPath(rootName),
        rootPath,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        totalDurationMs: 0,
        completedLessonsCount: 0,
        totalLessonsCount: 0,
        modules: [],
        attachments: []
      }
      this.cache.set(cacheKey, { course: emptyCourse, mtimeMs: currentMtime, cachedAt: Date.now() })
      return emptyCourse
    }

    const modules: Module[] = []

    // 1. If there are direct subdirectories in root, each is a Module / Section
    if (rootNode.subDirs.length > 0) {
      // Sort subdirectories naturally
      rootNode.subDirs.sort((a, b) => naturalSortComparator(a.dirName, b.dirName))

      for (let i = 0; i < rootNode.subDirs.length; i++) {
        const subDir = rootNode.subDirs[i]
        const mod = this.nodeToModule(subDir, i, progressMap, rootPath, existingNotesSet)
        modules.push(mod)
      }

      // If there are direct video files in the root folder itself, put them in an "Aulas Iniciais" module
      const directRootVideos = rootNode.files.filter((f) => f.isVideo)
      if (directRootVideos.length > 0) {
        const directRootSubs = rootNode.files.filter((f) => f.isSubtitle)
        const directRootAtts = rootNode.files.filter((f) => f.isAttachment)

        const rootLessons = this.buildLessons(
          directRootVideos,
          directRootSubs,
          directRootAtts,
          '.',
          'Aulas Iniciais',
          progressMap,
          rootPath,
          existingNotesSet
        )

        const rootMod: Module = {
          id: makeId('.'),
          title: 'Aulas Iniciais',
          cleanTitle: 'Aulas Iniciais',
          relativePath: '.',
          order: -1,
          lessons: rootLessons,
          attachments: directRootAtts.map((att) => this.fileToAttachment(att)),
          totalDurationMs: rootLessons.reduce((sum, l) => sum + l.durationMs, 0),
          completedLessonsCount: rootLessons.filter((l) => l.isCompleted).length
        }
        modules.unshift(rootMod)
      }
    } else {
      // 2. If there are no subdirectories (all files are directly in the course root)
      const mod = this.nodeToModule(rootNode, 0, progressMap, rootPath, existingNotesSet)
      modules.push(mod)
    }

    // Direct root attachments that are not videos/subtitles
    const rootAttachments = rootNode.files
      .filter((f) => f.isAttachment)
      .map((att) => this.fileToAttachment(att))

    const stats = countLessonsRecursive(modules)

    const course: Course = {
      id: courseId,
      title: titleFromPath(rootName),
      cleanTitle: titleFromPath(rootName),
      rootPath,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      lastLessonId: hub?.lastLessonId,
      lastPositionMs: hub?.lastPositionMs,
      totalDurationMs: stats.duration,
      completedLessonsCount: stats.completed,
      totalLessonsCount: stats.total,
      modules,
      attachments: rootAttachments
    }

    this.cache.set(cacheKey, { course, mtimeMs: currentMtime, cachedAt: Date.now() })
    return course
  }

  /**
   * Recursively reads a directory and builds a ScannedDir tree.
   * Completely ignores desktop.ini, thumbs.db, hidden files, node_modules, etc.
   */
  private scanDirNode(rootPath: string, currentDir: string): ScannedDir | null {
    try {
      const relDir = relative(rootPath, currentDir).replace(/\\/g, '/') || '.'
      const dirName = basename(currentDir)
      const entries = readdirSync(currentDir, { withFileTypes: true })

      const files: ScannedFile[] = []
      const subDirs: ScannedDir[] = []

      // Sort entries naturally
      entries.sort((a, b) => naturalSortComparator(a.name, b.name))

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (isIgnoredDirectory(entry.name)) continue
          const subNode = this.scanDirNode(rootPath, join(currentDir, entry.name))
          if (subNode && (subNode.files.length > 0 || subNode.subDirs.length > 0)) {
            subDirs.push(subNode)
          }
        } else if (entry.isFile()) {
          // Strictly filter out desktop.ini, thumbs.db, shortcuts, tmp, and hidden junk
          if (isSystemOrJunkFile(entry.name)) continue

          const filePath = join(currentDir, entry.name)
          const relPath = relative(rootPath, filePath).replace(/\\/g, '/')
          const ext = extname(entry.name).toLowerCase()
          const isVideo = isVideoFile(entry.name)
          const isSubtitle = isSubtitleFile(entry.name)
          const isAttachment = !isVideo && !isSubtitle

          files.push({
            fileName: entry.name,
            filePath,
            relPath,
            extension: ext,
            isVideo,
            isSubtitle,
            isAttachment
          })
        }
      }

      return {
        dirPath: currentDir,
        relDir,
        dirName,
        files,
        subDirs
      }
    } catch (err) {
      console.warn('[CourseScanner] Error reading directory:', currentDir, err)
      return null
    }
  }

  /**
   * Converts a ScannedDir node into a Module (with nested subModules).
   */
  private nodeToModule(
    node: ScannedDir,
    order: number,
    progressMap: Record<string, any>,
    rootPath: string,
    existingNotesSet: Set<string>
  ): Module {
    const moduleId = makeId(node.relDir)
    const cleanDirTitle = titleFromPath(node.dirName)

    const videoFiles = node.files.filter((f) => f.isVideo)
    const subtitleFiles = node.files.filter((f) => f.isSubtitle)
    const attachmentFiles = node.files.filter((f) => f.isAttachment)

    // Build lessons directly present in this directory
    const lessons = this.buildLessons(
      videoFiles,
      subtitleFiles,
      attachmentFiles,
      node.relDir,
      cleanDirTitle,
      progressMap,
      rootPath,
      existingNotesSet
    )

    // All attachments directly inside this directory
    const moduleAttachments = attachmentFiles.map((att) => this.fileToAttachment(att))

    // Recursively build subModules for any subfolders inside this directory!
    const subModules: Module[] = []
    if (node.subDirs.length > 0) {
      node.subDirs.sort((a, b) => naturalSortComparator(a.dirName, b.dirName))
      for (let i = 0; i < node.subDirs.length; i++) {
        subModules.push(this.nodeToModule(node.subDirs[i], i, progressMap, rootPath, existingNotesSet))
      }
    }

    const directDuration = lessons.reduce((sum, l) => sum + l.durationMs, 0)
    const subDuration = subModules.reduce((sum, sm) => sum + sm.totalDurationMs, 0)

    const directCompleted = lessons.filter((l) => l.isCompleted).length
    const subCompleted = subModules.reduce((sum, sm) => sum + sm.completedLessonsCount, 0)

    return {
      id: moduleId,
      title: node.dirName,
      cleanTitle: cleanDirTitle,
      relativePath: node.relDir,
      order,
      lessons,
      attachments: moduleAttachments,
      subModules: subModules.length > 0 ? subModules : undefined,
      totalDurationMs: directDuration + subDuration,
      completedLessonsCount: directCompleted + subCompleted
    }
  }

  /**
   * Builds lessons from video files within a single folder.
   */
  private buildLessons(
    videoFiles: ScannedFile[],
    subtitleFiles: ScannedFile[],
    attachmentFiles: ScannedFile[],
    relDir: string,
    folderTitle: string,
    progressMap: Record<string, any>,
    rootPath: string,
    existingNotesSet: Set<string>
  ): Lesson[] {
    const moduleId = makeId(relDir)

    return videoFiles.map((video, idx) => {
      const lessonId = makeId(video.relPath)
      let displayTitle = cleanTitle(video.fileName)
      if (isGenericLessonName(video.fileName) && relDir !== '.') {
        displayTitle = folderTitle
      }

      const videoPrefix = getFilePrefix(video.fileName)
      const matchingSub =
        subtitleFiles.find((s) => getFilePrefix(s.fileName) === videoPrefix) ||
        (subtitleFiles.length === 1 ? subtitleFiles[0] : undefined)

      // Find attachments closely tied to this video (same prefix or single video in folder)
      const matchingAtts = attachmentFiles.filter((att) => {
        if (videoFiles.length <= 1) return true
        return videoPrefix && getFilePrefix(att.fileName) === videoPrefix
      })

      const attachments = matchingAtts.map((att) => this.fileToAttachment(att, lessonId))
      const slashLessonId = computeSlashCourseId(video.relPath)
      const legacyLessonId = computeLegacyCourseId(video.relPath)
      const prog = progressMap[lessonId] || progressMap[slashLessonId] || progressMap[legacyLessonId]
      const hasNotes =
        existingNotesSet.has(lessonId.toLowerCase()) ||
        existingNotesSet.has(slashLessonId.toLowerCase()) ||
        existingNotesSet.has(legacyLessonId.toLowerCase())

      return {
        id: lessonId,
        moduleId,
        originalFilename: video.fileName,
        cleanTitle: displayTitle,
        relativePath: video.relPath,
        absolutePath: video.filePath,
        extension: video.extension,
        order: idx,
        durationMs: prog?.durationMs ?? 0,
        lastPositionMs: prog?.lastPositionMs ?? 0,
        isCompleted: prog?.isCompleted ?? false,
        completedAt: prog?.completedAt,
        subtitlePath: matchingSub?.filePath,
        attachments,
        hasNotes
      }
    })
  }

  private fileToAttachment(file: ScannedFile, lessonId?: string): Attachment {
    let size = 0
    try {
      size = statSync(file.filePath).size
    } catch {}

    return {
      id: makeId(file.relPath),
      lessonId,
      filename: file.fileName,
      cleanTitle: cleanTitle(file.fileName) || file.fileName,
      relativePath: file.relPath,
      absolutePath: file.filePath,
      extension: file.extension,
      kind: getAttachmentKind(file.extension),
      sizeBytes: size
    }
  }
}
