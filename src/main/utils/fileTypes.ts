/**
 * File-type helpers for the main process.
 * Re-exports shared extension sets and adds path-based utilities.
 */

import { extname, basename } from 'path'
import {
  VIDEO_EXTENSIONS,
  SUBTITLE_EXTENSIONS,
  getAttachmentKind
} from '../../shared/constants/extensions'

export { VIDEO_EXTENSIONS, SUBTITLE_EXTENSIONS, getAttachmentKind }

/**
 * Returns true if the file has a video extension.
 */
export function isVideoFile(filename: string): boolean {
  return VIDEO_EXTENSIONS.has(extname(filename).toLowerCase())
}

/**
 * Returns true if the file has a subtitle extension.
 */
export function isSubtitleFile(filename: string): boolean {
  return SUBTITLE_EXTENSIONS.has(extname(filename).toLowerCase())
}

/**
 * Extracts the numeric/name prefix from a filename for matching related files.
 * For example:
 *   "01 - Intro.mp4"     → "01 - Intro"
 *   "01 - Intro.srt"     → "01 - Intro"
 *   "Lecture 3.mp4"       → "Lecture 3"
 */
export function getFilePrefix(filename: string): string {
  const base = basename(filename)
  const ext = extname(base)
  return ext ? base.slice(0, -ext.length) : base
}

const IGNORED_SYSTEM_FILES = new Set([
  'desktop.ini',
  'thumbs.db',
  'ehthumbs.db',
  'ehthumbs_vista.db',
  '.ds_store',
  'autorun.inf',
  'folder.ico',
  'icon\r'
])

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '$recycle.bin',
  'system volume information',
  '.course-hub',
  '.git',
  '.idea',
  '.vscode',
  '.gemini',
  '.antigravity'
])

export function isSystemOrJunkFile(filename: string): boolean {
  const lower = basename(filename).toLowerCase().trim()
  if (lower.startsWith('.')) return true
  if (IGNORED_SYSTEM_FILES.has(lower)) return true
  if (lower.endsWith('.tmp') || lower.endsWith('.crdownload') || lower.endsWith('.part')) return true
  if (lower.endsWith('.lnk') || lower.endsWith('.url')) return true
  return false
}

export function isIgnoredDirectory(name: string): boolean {
  const lower = name.toLowerCase().trim()
  if (lower.startsWith('.')) return true
  if (IGNORED_DIRECTORIES.has(lower)) return true
  return false
}
