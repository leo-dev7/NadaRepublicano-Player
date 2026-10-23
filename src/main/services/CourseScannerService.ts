/**
 * CourseScannerService – recursively scans course directory trees at any depth
 * and builds a clean Course / Module / Lesson structure.
 */

import { readdirSync, statSync, existsSync } from 'fs'
import { join, relative, extname, basename, dirname } from 'path'
import { createHash } from 'crypto'

import type { Course, Module, Lesson, Attachment } from '../../shared/types/course'
import { getAttachmentKind } from '../../shared/constants/extensions'
import { cleanTitle, naturalSortComparator } from '../utils/cleanTitles'
import { isVideoFile, isSubtitleFile, getFilePrefix } from '../utils/fileTypes'
import { StorageService } from './StorageService'

/**
 * Creates a deterministic ID from a relative path.
 */
function makeId(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/')
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

function titleFromPath(name: string): string {
  return cleanTitle(name) || name
}

function isGenericLessonName(name: string): boolean {
  const base = name.replace(/\.[a-z0-9]+$/i, '').trim().toLowerCase()
  return ['video', 'aula', 'lesson', '1', '01', 'main', 'index', 'part1', 'part 1'].includes(base)
}

interface FileEntry {
  absolutePath: string
  relativePath: string
  fileName: string
  extension: string
  parentRelDir: string
  topDir: string
}

export class CourseScannerService {
  constructor(private storage: StorageService) {}

  async scanFolder(rootPath: string): Promise<Course> {
    const rootName = basename(rootPath)
    const courseId = makeId(rootPath)

    // Load existing progress from .course-hub.json if available
    const hub = this.storage.loadCourseHub(rootPath)
    const progressMap = hub?.progress || {}

    // Recursively discover all files
    const allFiles: FileEntry[] = []
    this.scanRecursive(rootPath, rootPath, allFiles)

    // Separate videos, subtitles and attachments
    const videoFiles = allFiles.filter((f) => isVideoFile(f.fileName))
    const subtitleFiles = allFiles.filter((f) => isSubtitleFile(f.fileName))
    const attachmentFiles = allFiles.filter(
      (f) => !isVideoFile(f.fileName) && !isSubtitleFile(f.fileName)
    )

    // Group videos into modules based on their topDir
    // If topDir is '.', they reside in the course root
    const moduleGroups = new Map<string, FileEntry[]>()

    for (const v of videoFiles) {
      const groupKey = v.topDir
      if (!moduleGroups.has(groupKey)) {
        moduleGroups.set(groupKey, [])
      }
      moduleGroups.get(groupKey)!.push(v)
    }

    // Sort module keys naturally
    const sortedGroupKeys = Array.from(moduleGroups.keys()).sort((a, b) => {
      if (a === '.') return -1
      if (b === '.') return 1
      return naturalSortComparator(a, b)
    })

    // If no videos found, return empty course structure
    if (sortedGroupKeys.length === 0) {
      return {
        id: courseId,
        title: titleFromPath(rootName),
        cleanTitle: titleFromPath(rootName),
        rootPath,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        totalDurationMs: 0,
        completedLessonsCount: 0,
        totalLessonsCount: 0,
        modules: []
      }
    }

    // Build modules
    const modules: Module[] = sortedGroupKeys.map((groupKey, modIndex) => {
      const modVideos = moduleGroups.get(groupKey)!
      // Sort videos naturally by relativePath to maintain multi-level numeric order
      modVideos.sort((a, b) => naturalSortComparator(a.relativePath, b.relativePath))

      const moduleId = makeId(groupKey)
      const moduleFolderTitle = groupKey === '.' ? 'Aulas do Curso' : groupKey

      const lessons: Lesson[] = modVideos.map((video, lessonIdx) => {
        const lessonId = makeId(video.relativePath)
        const parentFolderName = basename(video.parentRelDir)

        // Resolve clean lesson title
        let displayTitle = cleanTitle(video.fileName)
        if (
          isGenericLessonName(video.fileName) &&
          parentFolderName &&
          parentFolderName !== '.' &&
          parentFolderName !== groupKey
        ) {
          displayTitle = cleanTitle(parentFolderName)
        }

        // Find subtitles in the same directory
        const sameDirSubs = subtitleFiles.filter((s) => s.parentRelDir === video.parentRelDir)
        const videoPrefix = getFilePrefix(video.fileName)
        const matchingSub =
          sameDirSubs.find((s) => getFilePrefix(s.fileName) === videoPrefix) ||
          (sameDirSubs.length === 1 ? sameDirSubs[0] : undefined)

        // Find attachments in the same directory
        const sameDirAttachments = attachmentFiles.filter(
          (a) => a.parentRelDir === video.parentRelDir
        )
        const matchingAttachments = sameDirAttachments.filter((a) => {
          if (sameDirAttachments.length <= 3) return true
          return getFilePrefix(a.fileName) === videoPrefix
        })

        const attachments: Attachment[] = matchingAttachments.map((att) => {
          let size = 0
          try {
            size = statSync(att.absolutePath).size
          } catch {
            // ignore
          }
          return {
            id: makeId(att.relativePath),
            lessonId,
            filename: att.fileName,
            cleanTitle: titleFromPath(att.fileName),
            relativePath: att.relativePath,
            absolutePath: att.absolutePath,
            extension: att.extension,
            kind: getAttachmentKind(att.extension),
            sizeBytes: size
          }
        })

        const prog = progressMap[lessonId]
        const hasNotes = this.storage.loadNote(rootPath, lessonId).trim().length > 0

        return {
          id: lessonId,
          moduleId,
          originalFilename: video.fileName,
          cleanTitle: displayTitle,
          relativePath: video.relativePath,
          absolutePath: video.absolutePath,
          extension: video.extension,
          order: lessonIdx,
          durationMs: prog?.durationMs ?? 0,
          lastPositionMs: prog?.lastPositionMs ?? 0,
          isCompleted: prog?.isCompleted ?? false,
          completedAt: prog?.completedAt,
          subtitlePath: matchingSub?.absolutePath,
          attachments,
          hasNotes
        } satisfies Lesson
      })

      // Attachments belonging to the module root
      const moduleRootAttachments = attachmentFiles.filter(
        (a) => a.topDir === groupKey && (a.parentRelDir === groupKey || a.parentRelDir === '.')
      )

      const moduleAttachments: Attachment[] = moduleRootAttachments.map((att) => {
        let size = 0
        try {
          size = statSync(att.absolutePath).size
        } catch {
          // ignore
        }
        return {
          id: makeId(att.relativePath),
          filename: att.fileName,
          cleanTitle: titleFromPath(att.fileName),
          relativePath: att.relativePath,
          absolutePath: att.absolutePath,
          extension: att.extension,
          kind: getAttachmentKind(att.extension),
          sizeBytes: size
        }
      })

      const totalDurationMs = lessons.reduce((sum, l) => sum + l.durationMs, 0)
      const completedLessonsCount = lessons.filter((l) => l.isCompleted).length

      return {
        id: moduleId,
        title: titleFromPath(moduleFolderTitle),
        cleanTitle: titleFromPath(moduleFolderTitle),
        relativePath: groupKey,
        order: modIndex,
        lessons,
        attachments: moduleAttachments,
        totalDurationMs,
        completedLessonsCount
      } satisfies Module
    })

    const totalDurationMs = modules.reduce((sum, m) => sum + m.totalDurationMs, 0)
    const completedLessonsCount = modules.reduce((sum, m) => sum + m.completedLessonsCount, 0)
    const totalLessonsCount = modules.reduce((sum, m) => sum + m.lessons.length, 0)

    const course: Course = {
      id: courseId,
      title: titleFromPath(rootName),
      cleanTitle: titleFromPath(rootName),
      rootPath,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      lastLessonId: hub?.lastLessonId,
      lastPositionMs: hub?.lastPositionMs,
      totalDurationMs,
      completedLessonsCount,
      totalLessonsCount,
      modules
    }

    return course
  }

  /**
   * Recursively walks currentDir collecting all files.
   */
  private scanRecursive(rootPath: string, currentDir: string, list: FileEntry[]): void {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === '$RECYCLE.BIN' ||
          entry.name === 'System Volume Information'
        ) {
          continue
        }

        const fullPath = join(currentDir, entry.name)
        if (entry.isDirectory()) {
          this.scanRecursive(rootPath, fullPath, list)
        } else if (entry.isFile()) {
          const relPath = relative(rootPath, fullPath)
          const parentRel = dirname(relPath)
          const parts = relPath.split(/[/\\]/)
          const topDir = parts.length > 1 ? parts[0] : '.'

          list.push({
            absolutePath: fullPath,
            relativePath: relPath,
            fileName: entry.name,
            extension: extname(entry.name).toLowerCase(),
            parentRelDir: parentRel,
            topDir
          })
        }
      }
    } catch (err) {
      console.warn('[CourseScanner] Error reading directory:', currentDir, err)
    }
  }
}
