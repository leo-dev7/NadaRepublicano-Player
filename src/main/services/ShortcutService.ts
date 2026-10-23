/**
 * ShortcutService – registers global keyboard shortcuts via Electron.
 */

import { globalShortcut } from 'electron'

interface ShortcutCallbacks {
  onSnapshot: () => void
  onBookmark: () => void
  onNextLesson: () => void
}

export class ShortcutService {
  private registered = false

  /**
   * Register global shortcuts.
   */
  register(shortcuts: ShortcutCallbacks): void {
    if (this.registered) {
      this.unregisterAll()
    }

    try {
      globalShortcut.register('Alt+S', shortcuts.onSnapshot)
    } catch (err) {
      console.warn('[ShortcutService] Failed to register Alt+S:', (err as Error).message)
    }

    try {
      globalShortcut.register('Alt+B', shortcuts.onBookmark)
    } catch (err) {
      console.warn('[ShortcutService] Failed to register Alt+B:', (err as Error).message)
    }

    try {
      globalShortcut.register('Alt+N', shortcuts.onNextLesson)
    } catch (err) {
      console.warn('[ShortcutService] Failed to register Alt+N:', (err as Error).message)
    }

    this.registered = true
  }

  /**
   * Unregister all global shortcuts.
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.registered = false
  }
}
