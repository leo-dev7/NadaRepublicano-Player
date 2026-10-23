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
