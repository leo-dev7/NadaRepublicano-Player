/**
 * Utility to sanitize display names from downloaded course files/folders.
 */

/** Patterns commonly injected by download tools / release groups */
const BRACKET_TAG_PATTERN =
  /\s*[\[\(]\s*(?:1080p|720p|480p|360p|2160p|4K|HDR|Dual[- ]?Audio|WEB[- ]?DL|WEB[- ]?Rip|BRRip|BluRay|BDRip|DVDRip|HDTV|HEVC|x264|x265|H\.?264|H\.?265|AAC|AC3|DTS|10bit|Hi10P|FLAC|5\.1|AMZN|NF|REPACK|PROPER|SDH|CC|ENG|www\..+?|FreeCourseWeb\.com|DownloadFreeCourse\.com|\.com|\.net|\.org)[^\]\)]*[\]\)]/gi

/** Known file extensions to strip from display */
const EXTENSION_PATTERN = /\.[a-z0-9]{2,5}$/i

/** Repeated whitespace / dash cleanup */
const EXTRA_WHITESPACE = /\s{2,}/g
const TRAILING_DASH = /[\s\-_]+$/
const LEADING_DASH = /^[\s\-_]+/

/**
 * Cleans a filename or folder name for display.
 * Preserves leading numbering like "01 - " or "1.2 - ".
 */
export function cleanTitle(filename: string): string {
  let name = filename

  // Remove file extension
  name = name.replace(EXTENSION_PATTERN, '')

  // Remove bracket/parenthesis tags
  name = name.replace(BRACKET_TAG_PATTERN, '')

  // Replace underscores with spaces
  name = name.replace(/_/g, ' ')

  // Replace dots that look like word separators (but not leading numbers like "1.2")
  // Only replace dots surrounded by letters
  name = name.replace(/(?<=[a-zA-Z])\.(?=[a-zA-Z])/g, ' ')

  // Clean up whitespace and trailing dashes
  name = name.replace(EXTRA_WHITESPACE, ' ')
  name = name.replace(TRAILING_DASH, '')
  name = name.replace(LEADING_DASH, '')
  name = name.trim()

  return name || filename
}

/**
 * Natural sort comparator using Intl.Collator for proper numeric ordering.
 * e.g., "2 - Foo" comes before "10 - Bar".
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
export const naturalSortComparator: (a: string, b: string) => number = collator.compare
