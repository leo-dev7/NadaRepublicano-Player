/** MPC-HC / MPC-BE wm_command codes for /command.html */
export const MPC_COMMANDS = {
  PLAY_PAUSE: 889,
  STOP: 890,
  SPEED_UP: 895,
  SPEED_DOWN: 894,
  SPEED_NORMAL: 896,
  ALWAYS_ON_TOP: 884,
  FULLSCREEN: 830,
  NEXT_SUBTITLE: 954,
  NEXT_AUDIO: 952,
  SEEK: -1
} as const

export type MpcCommandCode = typeof MPC_COMMANDS[keyof typeof MPC_COMMANDS]

export const MPC_WEB_PORT_DEFAULT = 13579
export const MPC_BASE_URL = (port: number) => `http://127.0.0.1:${port}`
export const MPC_VARIABLES_URL = (port: number) => `${MPC_BASE_URL(port)}/variables.html`
export const MPC_COMMAND_URL = (port: number) => `${MPC_BASE_URL(port)}/command.html`
export const MPC_SNAPSHOT_URL = (port: number) => `${MPC_BASE_URL(port)}/snapshot.jpg`
