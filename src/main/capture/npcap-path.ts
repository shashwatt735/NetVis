import * as fs from 'fs'
import * as path from 'path'

/**
 * Ensure Npcap DLL directories are present in PATH for this process.
 *
 * Some Windows installs place wpcap.dll/Packet.dll under System32\Npcap
 * without adding that folder to PATH. Native addon loading can then fail
 * even when the Npcap service is installed and running.
 */
export function ensureNpcapDllPath(): void {
  if (process.platform !== 'win32') return

  const windir = process.env.WINDIR ?? 'C:\\Windows'
  const candidates = [
    path.join(windir, 'System32', 'Npcap'),
    path.join(windir, 'SysWOW64', 'Npcap')
  ]

  const currentPath = process.env.PATH ?? ''
  const parts = currentPath
    .split(path.delimiter)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  const existing = new Set(parts.map((p) => p.toLowerCase()))

  const additions = candidates.filter(
    (candidate) => fs.existsSync(candidate) && !existing.has(candidate.toLowerCase())
  )

  if (additions.length > 0) {
    process.env.PATH = `${additions.join(path.delimiter)}${path.delimiter}${currentPath}`
  }
}
