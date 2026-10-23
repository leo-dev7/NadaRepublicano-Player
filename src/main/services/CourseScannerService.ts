/**
 * CourseScannerService – scans a folder tree and builds a Course structure.
 */

import { readdirSync, statSync, existsSync } from 'fs'
import { join, relative, extname, basename } from 'path'
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
  return createHash('sha256').update(relativePath).digest('hex').slice(0, 16)
}

/**
 * Formats a title from a folder/file name using cleanTitle.
 * Falls back to the raw name if cleaning produces empty string.
 */
function titleFromPath(name: string): string {
  return cleanTitle(name) || name
}

export class CourseScannerService {
  constructor(private storage: StorageService) {}

  async scanFolder(rootPath: string): Promise<Course> {
    const rootName = basename(rootPath)
    const courseId = makeId(rootPath)

    // Load existing progress if available
    const hub = this.storage.loadCourseHub(rootPath)

    // Check if root has subdirectories
    const rootEntries = readdirSync(rootPath, { withFileTypes: true })
    const subdirs = rootEntries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => naturalSortComparator(a.name, b.name))

    let modules: Module[]

    if (subdirs.length > 0) {
      // Each subdirectory is a module
      modules = subdirs.map((dir, index) => {
        const modulePath = join(rootPath, dir.name)
        const relPath = relative(rootPath, modulePath)
        return this.buildModule(rootPath, relPath, dir.name, index, hub?.progress)
      })
    } else {
      // Single default module from root files
      modules = [this.buildModule(rootPath, '.', rootName, 0, hub?.progress)]
    }

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

  private buildModule(
    rootPath: string,
    relModulePath: string,
    folderName: string,
    order: number,
    progress?: Record<string, { lastPositionMs: number; durationMs: number; isCompleted: boolean; completedAt?: string }>
  ): Module {
    const absoluteModulePath = relModulePath === '.' ? rootPath : join(rootPath, relModulePath)
    const moduleId = makeId(relModulePath)

    const entries = readdirSync(absoluteModulePath, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith('.'))

    // Separate video files (lessons) from other files
    const videoEntries = entries.filter((e) => isVideoFile(e.name))
    const otherEntries = entries.filter((e) => !isVideoFile(e.name))

    // Sort videos naturally
    videoEntries.sort((a, b) => naturalSortComparator(a.name, b.name))

    // Build lessons
    const lessons: Lesson[] = videoEntries.map((entry, idx) => {
      const relPath = relModulePath === '.'
        ? entry.name
        : join(relModulePath, entry.name)
      const absPath = join(absoluteModulePath, entry.name)
      const lessonId = makeId(relPath)
      const prefix = getFilePrefix(entry.name)

      // Find matching subtitle
      const matchingSub = otherEntries.find(
        (o) => isSubtitleFile(o.name) && getFilePrefix(o.name) === prefix
      )
      const subtitleRelPath = matchingSub
        ? relModulePath === '.'
          ? matchingSub.name
          : join(relModulePath, matchingSub.name)
        : undefined

      // Find matching attachments (non-video, non-subtitle with same prefix)
      const attachmentEntries = otherEntries.filter(
        (o) => !isSubtitleFile(o.name) && getFilePrefix(o.name) === prefix
      )

      const attachments: Attachment[] = attachmentEntries.map((a) => {
        const aRelPath = relModulePath === '.'
          ? a.name
          : join(relModulePath, a.name)
        const aAbsPath = join(absoluteModulePath, a.name)
        const ext = extname(a.name).toLowerCase()
        let size = 0
        try {
          size = statSync(aAbsPath).size
        } catch {
          /* ignore */
        }

        return {
          id: makeId(aRelPath),
          lessonId,
          filename: a.name,
          cleanTitle: titleFromPath(a.name),
          relativePath: aRelPath,
          absolutePath: aAbsPath,
          extension: ext,
          kind: getAttachmentKind(ext),
          sizeBytes: size
        }
      })

      const prog = progress?.[lessonId]
      const noteExists = this.storage.loadNote(rootPath, lessonId) !== ''

      return {
        id: lessonId,
        moduleId,
        originalFilename: entry.name,
        cleanTitle: titleFromPath(entry.name),
        relativePath: relPath,
        absolutePath: absPath,
        extension: extname(entry.name).toLowerCase(),
        order: idx,
        durationMs: prog?.durationMs ?? 0,
        lastPositionMs: prog?.lastPositionMs ?? 0,
        isCompleted: prog?.isCompleted ?? false,
        completedAt: prog?.completedAt,
        subtitlePath: subtitleRelPath
          ? join(rootPath, subtitleRelPath)
          : undefined,
        attachments,
        hasNotes: noteExists
      } satisfies Lesson
    })

    // Module-level attachments (files that don't match any lesson prefix)
    const lessonPrefixes = new Set(videoEntries.map((e) => getFilePrefix(e.name)))
    const moduleAttachmentEntries = otherEntries.filter(
      (o) => !isSubtitleFile(o.name) && !lessonPrefixes.has(getFilePrefix(o.name))
    )

    const moduleAttachments: Attachment[] = moduleAttachmentEntries.map((a) => {
      const aRelPath = relModulePath === '.'
        ? a.name
        : join(relModulePath, a.name)
      const aAbsPath = join(absoluteModulePath, a.name)
      const ext = extname(a.name).toLowerCase()
      let size = 0
      try {
        size = statSync(aAbsPath).size
      } catch {
        /* ignore */
      }
      return {
        id: makeId(aRelPath),
        filename: a.name,
        cleanTitle: titleFromPath(a.name),
        relativePath: aRelPath,
        absolutePath: aAbsPath,
        extension: ext,
        kind: getAttachmentKind(ext),
        sizeBytes: size
      }
    })

    const totalDurationMs = lessons.reduce((sum, l) => sum + l.durationMs, 0)
    const completedLessonsCount = lessons.filter((l) => l.isCompleted).length

    return {
      id: moduleId,
      title: titleFromPath(folderName),
      cleanTitle: titleFromPath(folderName),
      relativePath: relModulePath,
      order,
      lessons,
      attachments: moduleAttachments,
      totalDurationMs,
      completedLessonsCount
    }
  }
}
