/**
 * MpcBridgeService – core MPC-HC / MPC-BE integration.
 * Discovers the player, manages its web interface polling, and sends commands.
 */

import { spawn, execFile } from 'child_process'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

import type { MpcLiveState, MpcPlaybackState } from '../../shared/types/mpc'
import { MPC_VARIABLES_URL, MPC_COMMAND_URL, MPC_SNAPSHOT_URL } from '../../shared/constants/mpcCommands'
import { configureMpcRegistry } from '../utils/mpcRegistry'

const execFileAsync = promisify(execFile)

/** Map MPC state string to our enum */
function mapState(stateStr: string): MpcPlaybackState {
  switch (stateStr) {
    case '2':
      return 'playing'
    case '1':
      return 'paused'
    case '0':
    case '-1':
      return 'stopped'
    default:
      return 'stopped'
  }
}

/** Format milliseconds as HH:MM:SS */
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Query a Windows Registry value */
async function queryRegistry(key: string, valueName?: string): Promise<string | null> {
  try {
    const args = ['query', key]
    if (valueName) {
      args.push('/v', valueName)
    } else {
      args.push('/ve')
    }
    const { stdout } = await execFileAsync('reg.exe', args)
    const match = stdout.match(/REG_SZ\s+(.+)/i)
    if (match?.[1]) {
      const p = match[1].trim()
      if (existsSync(p)) return p
    }
  } catch {
    // Registry key or value not found
  }
  return null
}

/** Standard and common installation paths to check */
function getCandidatePaths(): string[] {
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const userProfile = process.env['USERPROFILE'] || ''
  const localAppData = process.env['LOCALAPPDATA'] || ''

  const paths: string[] = [
    // K-Lite Codec Pack (very common on Windows)
    join(programFilesX86, 'K-Lite Codec Pack', 'MPC-HC64', 'mpc-hc64.exe'),
    join(programFilesX86, 'K-Lite Codec Pack', 'MPC-HC', 'mpc-hc.exe'),
    join(programFiles, 'K-Lite Codec Pack', 'MPC-HC64', 'mpc-hc64.exe'),
    join(programFiles, 'K-Lite Codec Pack', 'MPC-HC', 'mpc-hc.exe'),
    join(programFilesX86, 'K-Lite Codec Pack', 'MPC-BE64', 'mpc-be64.exe'),
    join(programFiles, 'K-Lite Codec Pack', 'MPC-BE64', 'mpc-be64.exe'),

    // Standard MPC-HC & MPC-BE
    join(programFiles, 'MPC-HC', 'mpc-hc64.exe'),
    join(programFilesX86, 'MPC-HC', 'mpc-hc.exe'),
    join(programFiles, 'MPC-BE x64', 'mpc-be64.exe'),
    join(programFilesX86, 'MPC-BE', 'mpc-be.exe'),
    join(programFiles, 'MPC-BE', 'mpc-be64.exe'),

    // LocalAppData / Programs
    join(localAppData, 'Programs', 'MPC-HC', 'mpc-hc64.exe'),
    join(localAppData, 'Programs', 'MPC-BE', 'mpc-be64.exe'),
    join(localAppData, 'Programs', 'K-Lite Codec Pack', 'MPC-HC64', 'mpc-hc64.exe')
  ]

  if (userProfile) {
    paths.push(
      join(userProfile, 'scoop', 'apps', 'mpc-hc', 'current', 'mpc-hc64.exe'),
      join(userProfile, 'scoop', 'apps', 'mpc-be', 'current', 'mpc-be64.exe'),
      join(userProfile, 'scoop', 'shims', 'mpc-hc64.exe'),
      join(userProfile, 'scoop', 'shims', 'mpc-be64.exe')
    )
  }

  return paths
}

interface MpcBridgeOptions {
  port: number
  pollingIntervalMs: number
  customPath: string
  playerType: 'mpc-hc' | 'mpc-be' | 'auto'
  autoConfigRegistry: boolean
}

export class MpcBridgeService {
  private port: number
  private pollingIntervalMs: number
  private customPath: string
  private playerType: 'mpc-hc' | 'mpc-be' | 'auto'
  private autoConfigRegistry: boolean

  private detectedPath: string | null = null
  private detectedType: 'mpc-hc' | 'mpc-be' | null = null
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private currentState: MpcLiveState = this.disconnectedState()
  private activeLessonId: string | undefined

  constructor(options: MpcBridgeOptions) {
    this.port = options.port
    this.pollingIntervalMs = options.pollingIntervalMs
    this.customPath = options.customPath
    this.playerType = options.playerType
    this.autoConfigRegistry = options.autoConfigRegistry
  }

  /**
   * Initialize: detect player and optionally configure registry.
   */
  async init(): Promise<void> {
    this.detectedPath = await this.detectPlayer()

    if (this.detectedPath) {
      // Determine type from path
      const lower = this.detectedPath.toLowerCase()
      if (lower.includes('mpc-hc')) {
        this.detectedType = 'mpc-hc'
      } else if (lower.includes('mpc-be')) {
        this.detectedType = 'mpc-be'
      }
    }

    if (this.autoConfigRegistry && this.detectedType) {
      await configureMpcRegistry(this.detectedType, this.port)
    }
  }

  getDetectedPath(): string | null {
    return this.detectedPath
  }

  /**
   * Auto-discover MPC executable on this system.
   */
  async detectPlayer(): Promise<string | null> {
    // 1. Check custom path first
    if (this.customPath && existsSync(this.customPath)) {
      this.detectedPath = this.customPath
      return this.customPath
    }

    // 2. Query Windows Registry for MPC-HC and MPC-BE install paths
    const regQueries = [
      { key: 'HKCU\\Software\\MPC-HC\\MPC-HC', val: 'ExePath' },
      { key: 'HKLM\\Software\\MPC-HC\\MPC-HC', val: 'ExePath' },
      { key: 'HKCU\\Software\\MPC-BE\\MPC-BE', val: 'ExePath' },
      { key: 'HKLM\\Software\\MPC-BE\\MPC-BE', val: 'ExePath' },
      { key: 'HKCU\\Software\\MPC-BE', val: 'ExePath' },
      { key: 'HKLM\\Software\\MPC-BE', val: 'ExePath' }
    ]
    for (const q of regQueries) {
      const found = await queryRegistry(q.key, q.val)
      if (found) {
        this.detectedPath = found
        return found
      }
    }

    // 3. Check standard and common installation paths (including K-Lite)
    const candidates = getCandidatePaths()
    for (const p of candidates) {
      if (existsSync(p)) {
        this.detectedPath = p
        return p
      }
    }

    // 4. Try Windows Registry App Paths (both HKLM and HKCU)
    const regNames = ['mpc-hc64.exe', 'mpc-hc.exe', 'mpc-be64.exe', 'mpc-be.exe']
    for (const name of regNames) {
      const foundHklm = await queryRegistry(`HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${name}`)
      if (foundHklm) {
        this.detectedPath = foundHklm
        return foundHklm
      }
      const foundHkcu = await queryRegistry(`HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${name}`)
      if (foundHkcu) {
        this.detectedPath = foundHkcu
        return foundHkcu
      }
    }

    return null
  }

  /**
   * Open a file in MPC. Spawns a detached process.
   */
  async openFile(filePath: string, startMs: number = 0, lessonId?: string): Promise<void> {
    let exePath = this.detectedPath
    if (!exePath) {
      exePath = await this.detectPlayer()
    }
    if (!exePath) {
      throw new Error('MPC player not found. Please configure the path in settings.')
    }

    this.activeLessonId = lessonId

    const args: string[] = [filePath]
    if (startMs > 0) {
      args.push('/start', String(startMs))
    }

    const child = spawn(exePath, args, {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
  }

  /**
   * Send a command to MPC via its web interface.
   */
  async sendCommand(command: number): Promise<void> {
    const url = `${MPC_COMMAND_URL(this.port)}?wm_command=${command}`
    try {
      await fetch(url, { signal: AbortSignal.timeout(3000) })
    } catch {
      console.warn('[MpcBridge] Failed to send command:', command)
    }
  }

  /**
   * Seek to a specific position in milliseconds.
   */
  async seek(positionMs: number): Promise<void> {
    const timeStr = formatTime(positionMs)
    const url = `${MPC_COMMAND_URL(this.port)}?wm_command=-1&position=${timeStr}`
    try {
      await fetch(url, { signal: AbortSignal.timeout(3000) })
    } catch {
      console.warn('[MpcBridge] Failed to seek to:', timeStr)
    }
  }

  /**
   * Take a snapshot and save it to disk.
   */
  async takeSnapshot(savePath: string): Promise<string> {
    const url = MPC_SNAPSHOT_URL(this.port)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const buffer = Buffer.from(await response.arrayBuffer())
      writeFileSync(savePath, buffer)
      return savePath
    } catch (err) {
      throw new Error(`Failed to take snapshot: ${(err as Error).message}`)
    }
  }

  /**
   * Start polling MPC's web interface for live state.
   */
  startPolling(onState: (state: MpcLiveState) => void): void {
    if (this.pollingTimer) this.stopPolling()

    const poll = async (): Promise<void> => {
      try {
        const state = await this.fetchState()
        this.currentState = state
        onState(state)
      } catch {
        // If fetch fails, MPC is not running or unreachable
        const dc = this.disconnectedState()
        if (this.currentState.connected) {
          this.currentState = dc
          onState(dc)
        }
      }
    }

    // Trigger immediately so UI connects right away without waiting for interval
    poll()
    this.pollingTimer = setInterval(poll, this.pollingIntervalMs)
  }

  /**
   * Stop the polling loop.
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  /**
   * Get the current cached state.
   */
  getState(): MpcLiveState {
    return this.currentState
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.stopPolling()
  }

  // ── Private helpers ────────────────────────────────────────────

  private disconnectedState(): MpcLiveState {
    return {
      connected: false,
      state: 'disconnected',
      positionMs: 0,
      durationMs: 0,
      positionFormatted: '00:00:00',
      durationFormatted: '00:00:00',
      percent: 0,
      playbackRate: 1,
      volume: 100,
      muted: false,
      alwaysOnTop: false,
      autoplayNext: false
    }
  }

  private async fetchState(): Promise<MpcLiveState> {
    const url = MPC_VARIABLES_URL(this.port)
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const vars = this.parseVariablesHtml(html)

    const positionMs = parseInt(vars['position'] || '0', 10)
    const durationMs = parseInt(vars['duration'] || '0', 10)
    const state = mapState(vars['state'] || '-1')
    const playbackRate = parseFloat(vars['playbackrate'] || '1')
    const volume = parseInt(vars['volumelevel'] || '100', 10)
    const muted = vars['muted'] === '1'
    const percent = durationMs > 0 ? (positionMs / durationMs) * 100 : 0
    const filePath = vars['filepath'] || vars['file'] || ''

    return {
      connected: true,
      playerExecutable: this.detectedPath ?? undefined,
      activeFilePath: filePath || undefined,
      activeLessonId: this.activeLessonId,
      state,
      positionMs,
      durationMs,
      positionFormatted: formatTime(positionMs),
      durationFormatted: formatTime(durationMs),
      percent,
      playbackRate,
      volume,
      muted,
      alwaysOnTop: false,
      autoplayNext: false
    }
  }

  /**
   * Parse MPC's variables.html which contains `<p id="name">value</p>` elements.
   */
  private parseVariablesHtml(html: string): Record<string, string> {
    const result: Record<string, string> = {}
    const regex = /<p id="(\w+)">([^<]*)<\/p>/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(html)) !== null) {
      result[match[1].toLowerCase()] = match[2]
    }

    return result
  }
}
