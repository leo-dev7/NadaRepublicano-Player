/**
 * Auto-configures MPC-HC / MPC-BE web server via the Windows Registry.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const REGISTRY_PATHS: Record<'mpc-hc' | 'mpc-be', string> = {
  'mpc-hc': 'HKCU\\Software\\MPC-HC\\MPC-HC\\Settings',
  'mpc-be': 'HKCU\\Software\\MPC-BE\\Settings'
}

interface RegistryValue {
  name: string
  type: 'REG_DWORD'
  value: number
}

async function setRegValue(keyPath: string, entry: RegistryValue): Promise<void> {
  await execFileAsync('reg.exe', [
    'add',
    keyPath,
    '/v',
    entry.name,
    '/t',
    entry.type,
    '/d',
    String(entry.value),
    '/f'
  ])
}

/**
 * Writes the registry keys needed for MPC's web interface.
 * Fails silently with a console warning so the app doesn't crash.
 */
export async function configureMpcRegistry(
  playerType: 'mpc-hc' | 'mpc-be',
  port: number
): Promise<void> {
  const keyPath = REGISTRY_PATHS[playerType]

  const values: RegistryValue[] = [
    { name: 'EnableWebServer', type: 'REG_DWORD', value: 1 },
    { name: 'WebServerPort', type: 'REG_DWORD', value: port },
    { name: 'WebServerLocalhostOnly', type: 'REG_DWORD', value: 1 }
  ]

  for (const entry of values) {
    try {
      await setRegValue(keyPath, entry)
    } catch (err) {
      console.warn(
        `[mpcRegistry] Failed to set ${entry.name} for ${playerType}:`,
        (err as Error).message
      )
    }
  }
}
