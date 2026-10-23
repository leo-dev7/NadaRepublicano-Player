/**
 * FileWatcherService – watches course directories for file changes using chokidar.
 */

import chokidar, { type FSWatcher } from 'chokidar'

const DEBOUNCE_MS = 500

interface WatchEntry {
  watcher: FSWatcher
  courseId: string
  timer: ReturnType<typeof setTimeout> | null
}

export class FileWatcherService {
  private watchers: Map<string, WatchEntry> = new Map()

  /**
   * Starts watching a course root path. Debounces changes and
   * calls `onChange` when files are added, removed, or modified.
   */
  watch(
    courseRootPath: string,
    courseId: string,
    onChange: (courseId: string) => void
  ): void {
    // Don't double-watch
    if (this.watchers.has(courseRootPath)) {
      return
    }

    const watcher = chokidar.watch(courseRootPath, {
      ignored: [
        /(^|[/\\])\.course-hub([/\\]|$)/,
        /(^|[/\\])\.git([/\\]|$)/,
        /\.tmp$/,
        /~$/,
        /\.swp$/,
        /Thumbs\.db$/,
        /desktop\.ini$/
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 5,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    const entry: WatchEntry = { watcher, courseId, timer: null }

    const debouncedCallback = (): void => {
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(() => {
        onChange(courseId)
      }, DEBOUNCE_MS)
    }

    watcher
      .on('add', debouncedCallback)
      .on('unlink', debouncedCallback)
      .on('change', debouncedCallback)
      .on('error', (err: unknown) => {
        console.warn('[FileWatcherService] Watcher error:', err instanceof Error ? err.message : String(err))
      })

    this.watchers.set(courseRootPath, entry)
  }

  /**
   * Stops watching a specific course root path.
   */
  unwatch(courseRootPath: string): void {
    const entry = this.watchers.get(courseRootPath)
    if (entry) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.watcher.close().catch(() => {})
      this.watchers.delete(courseRootPath)
    }
  }

  /**
   * Stops all active watchers.
   */
  unwatchAll(): void {
    for (const [, entry] of this.watchers) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.watcher.close().catch(() => {})
    }
    this.watchers.clear()
  }
}
