import { MPC_COMMANDS } from '@shared/constants/mpcCommands'

export function useMpcControls() {
  async function playPause() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.PLAY_PAUSE })
  }
  async function stop() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.STOP })
  }
  async function speedUp() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.SPEED_UP })
  }
  async function speedDown() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.SPEED_DOWN })
  }
  async function speedNormal() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.SPEED_NORMAL })
  }
  async function toggleAlwaysOnTop() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.ALWAYS_ON_TOP })
  }
  async function toggleFullscreen() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.FULLSCREEN })
  }
  async function nextSubtitle() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.NEXT_SUBTITLE })
  }
  async function nextAudio() {
    await window.api.mpcCommand({ command: MPC_COMMANDS.NEXT_AUDIO })
  }
  async function seek(positionMs: number) {
    await window.api.mpcSeek({ positionMs })
  }

  return {
    playPause, stop, speedUp, speedDown, speedNormal,
    toggleAlwaysOnTop, toggleFullscreen, nextSubtitle, nextAudio, seek
  }
}
