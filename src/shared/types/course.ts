export interface CourseListEntry {
  id: string
  title: string
  rootPath: string
  lastAccessedAt: string
}

export type AttachmentKind = 'pdf' | 'code' | 'archive' | 'text' | 'other'

export interface Attachment {
  id: string
  lessonId?: string
  filename: string
  cleanTitle: string
  relativePath: string
  absolutePath: string
  extension: string
  kind: AttachmentKind
  sizeBytes: number
}

export interface Lesson {
  id: string
  moduleId: string
  originalFilename: string
  cleanTitle: string
  relativePath: string
  absolutePath: string
  extension: string
  order: number
  durationMs: number
  lastPositionMs: number
  isCompleted: boolean
  completedAt?: string
  subtitlePath?: string
  attachments: Attachment[]
  hasNotes: boolean
}

export interface Module {
  id: string
  title: string
  cleanTitle: string
  relativePath: string
  order: number
  lessons: Lesson[]
  attachments: Attachment[]
  subModules?: Module[]
  totalDurationMs: number
  completedLessonsCount: number
}

export interface CourseMetadata {
  description?: string
  category?: string
  tags?: string[]
  coverImagePath?: string
}

export interface Course {
  id: string
  title: string
  cleanTitle: string
  rootPath: string
  createdAt: string
  lastAccessedAt: string
  lastLessonId?: string
  lastPositionMs?: number
  totalDurationMs: number
  completedLessonsCount: number
  totalLessonsCount: number
  modules: Module[]
  attachments?: Attachment[]
  metadata?: CourseMetadata
}

export interface CourseHubStorageFile {
  version: number
  courseId: string
  title: string
  lastLessonId?: string
  lastPositionMs?: number
  progress: Record<string, {
    lastPositionMs: number
    durationMs: number
    isCompleted: boolean
    completedAt?: string
  }>
  notesSummary: Record<string, { updatedAt: string; snapshotsCount: number }>
}

export interface LessonNote {
  lessonId: string
  courseId: string
  markdownContent: string
  snapshots: Array<{
    id: string
    timestampMs: number
    timeFormatted: string
    relativePath: string
    absolutePath: string
  }>
  updatedAt: string
}
