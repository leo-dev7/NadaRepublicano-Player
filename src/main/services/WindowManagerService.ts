/**
 * WindowManagerService – manages window positioning for snap-assist layout.
 */

import { BrowserWindow, screen } from 'electron'
import { execFile } from 'child_process'

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800

export class WindowManagerService {
  /**
   * Positions the Electron BrowserWindow on the left portion of the screen,
   * and automatically docks the MPC player window on the right portion.
   */
  snapAssist(mainWindow: BrowserWindow, ratio: number = 0.4): void {
    const { workArea } = screen.getPrimaryDisplay()
    const appWidth = Math.round(workArea.width * ratio)
    const mpcWidth = workArea.width - appWidth
    const mpcX = workArea.x + appWidth
    const mpcY = workArea.y
    const mpcHeight = workArea.height

    mainWindow.setBounds({
      x: workArea.x,
      y: workArea.y,
      width: appWidth,
      height: workArea.height
    })

    // Position MPC window on right half of screen, with retry loop to catch newly spawned players
    const ps = `
      for ($i = 0; $i -lt 15; $i++) {
        $procs = Get-Process -Name "mpc-hc64","mpc-be64","mpc-hc","mpc-be" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }
        if ($procs) { break }
        Start-Sleep -Milliseconds 150
      }
      if ($procs) {
        $code = @'
          using System;
          using System.Runtime.InteropServices;
          public class WinSnapHelper {
            [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
            [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          }
'@
        Add-Type -TypeDefinition $code -Language CSharp -ErrorAction SilentlyContinue
        foreach ($p in $procs) {
          try {
            [WinSnapHelper]::ShowWindowAsync($p.MainWindowHandle, 9)
            [WinSnapHelper]::MoveWindow($p.MainWindowHandle, ${mpcX}, ${mpcY}, ${mpcWidth}, ${mpcHeight}, $true)
          } catch {}
        }
      }
    `
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], () => {})
  }

  /**
   * Centers the window and restores it to default dimensions.
   */
  resetPosition(mainWindow: BrowserWindow): void {
    const { workArea } = screen.getPrimaryDisplay()
    const width = Math.min(DEFAULT_WIDTH, workArea.width)
    const height = Math.min(DEFAULT_HEIGHT, workArea.height)
    const x = workArea.x + Math.round((workArea.width - width) / 2)
    const y = workArea.y + Math.round((workArea.height - height) / 2)

    mainWindow.setBounds({ x, y, width, height })
  }
}
