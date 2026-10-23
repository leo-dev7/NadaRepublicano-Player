import { ref } from 'vue'
import { useTimeFormat } from './useTimeFormat'

export function useMarkdownShortcuts() {
  const { msToTimestamp } = useTimeFormat()

  function insertAtCursor(textarea: HTMLTextAreaElement, text: string): string {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = textarea.value.substring(0, start)
    const after = textarea.value.substring(end)
    const newValue = before + text + after
    return newValue
  }

  function wrapSelection(textarea: HTMLTextAreaElement, wrapper: string): string {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = textarea.value.substring(start, end)
    const before = textarea.value.substring(0, start)
    const after = textarea.value.substring(end)
    return before + wrapper + selected + wrapper + after
  }

  function insertTimestamp(textarea: HTMLTextAreaElement, positionMs: number): string {
    const ts = msToTimestamp(positionMs)
    return insertAtCursor(textarea, `[${ts}] `)
  }

  function insertBookmark(textarea: HTMLTextAreaElement, positionMs: number): string {
    const ts = msToTimestamp(positionMs)
    return insertAtCursor(textarea, `\n🔖 **[${ts}] Bookmark de Revisão**\n`)
  }

  function insertSnapshot(textarea: HTMLTextAreaElement, positionMs: number, imagePath: string): string {
    const ts = msToTimestamp(positionMs)
    return insertAtCursor(textarea, `\n### [${ts}] Captura de Tela\n![](${imagePath})\n`)
  }

  return { insertAtCursor, wrapSelection, insertTimestamp, insertBookmark, insertSnapshot }
}
