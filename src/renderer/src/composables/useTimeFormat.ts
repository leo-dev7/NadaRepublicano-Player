export function useTimeFormat() {
  function msToTime(ms: number): string {
    if (ms <= 0) return '0:00'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  function msToTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  function timestampToMs(timestamp: string): number {
    const parts = timestamp.split(':').map(Number)
    if (parts.length === 3) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
    }
    if (parts.length === 2) {
      return (parts[0] * 60 + parts[1]) * 1000
    }
    return 0
  }

  function formatPercent(value: number): string {
    return `${Math.round(value)}%`
  }

  return { msToTime, msToTimestamp, timestampToMs, formatPercent }
}
