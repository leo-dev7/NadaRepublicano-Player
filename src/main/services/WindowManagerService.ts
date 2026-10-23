/**
 * WindowManagerService – manages window positioning for snap-assist layout.
 */

import { BrowserWindow, screen } from 'electron'

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800
const MIN_WIDTH = 900
const MIN_HEIGHT = 600

export class WindowManagerService {
  /**
   * Positions the Electron BrowserWindow on the left portion of the primary display.
   * @param mainWindow - The app's main window
   * @param ratio - Fraction of screen width for the app (0.0 – 1.0), e.g. 0.5
   */
  snapAssist(mainWindow: BrowserWindow, ratio: number): void {
    const { workArea } = screen.getPrimaryDisplay()
    const appWidth = Math.round(workArea.width * ratio)

    mainWindow.setBounds({
      x: workArea.x,
      y: workArea.y,
      width: appWidth,
      height: workArea.height
    })
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
