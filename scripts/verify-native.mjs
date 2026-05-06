#!/usr/bin/env node
/**
 * scripts/verify-native.mjs
 *
 * Used by: npm run verify:native
 *          npm run build:win:native  (runs this before the build)
 *
 * Verifies that the native capture addon (cap) is compiled and ready for
 * Electron, and on Windows, that Npcap is installed. Exits non-zero with
 * a clear diagnosis if either check fails, preventing a broken packaged
 * build from being shipped.
 *
 * This script is NOT run during normal development — it's only needed before
 * creating a distributable. Developers without native tools can work on all
 * other features without it.
 *
 * Note on ABI mismatch: This script runs under system Node.js, but cap is
 * compiled for Electron's ABI via rebuild:native. A NODE_MODULE_VERSION
 * mismatch error is actually the SUCCESS case — it proves the binary was
 * compiled for Electron. The primary check is whether cap.node exists on disk.
 */

import { createRequire } from 'module'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const require = createRequire(import.meta.url)

let allPassed = true

function pass(label) {
  console.log(`  ✔  ${label}`)
}

function fail(label, detail) {
  console.error(`  ✘  ${label}`)
  if (detail) console.error(`       ${detail}`)
  allPassed = false
}

function warn(label, detail) {
  console.warn(`  ⚠  ${label}`)
  if (detail) console.warn(`       ${detail}`)
}

console.log('')
console.log('  NetVis — native addon verification')
console.log('  ───────────────────────────────────')
console.log('')

// ─── 1. cap binary existence ──────────────────────────────────────────────────
// Primary check: does the compiled .node binary exist on disk?
// This is more reliable than require() because require() will always fail
// with an ABI mismatch when cap is correctly compiled for Electron.

const capNodePath = path.join(
  path.dirname(import.meta.url.replace('file:///', '').replace('file://', '')),
  '..',
  'node_modules',
  'cap',
  'build',
  'Release',
  'cap.node'
)

// Normalize for Windows
const normalizedCapPath = path.resolve(capNodePath)

if (fs.existsSync(normalizedCapPath)) {
  // Binary exists. Now try to load it to distinguish ABI mismatch (good) from
  // genuine load failure (bad).
  if (process.platform === 'win32') {
    const windir = process.env.WINDIR ?? 'C:\\Windows'
    const npcapPaths = [path.join(windir, 'System32', 'Npcap'), path.join(windir, 'SysWOW64', 'Npcap')]
    const currentPath = process.env.PATH ?? ''
    const missingPaths = npcapPaths.filter(
      (p) => fs.existsSync(p) && !currentPath.toLowerCase().includes(p.toLowerCase())
    )
    if (missingPaths.length > 0) {
      process.env.PATH = `${missingPaths.join(path.delimiter)}${path.delimiter}${currentPath}`
    }
  }

  try {
    require('cap')
    pass('cap module loads successfully')
  } catch (err) {
    if (err.message && err.message.includes('NODE_MODULE_VERSION')) {
      pass('cap.node binary compiled for Electron ABI (correct)')
    } else {
      fail('cap.node binary exists but failed to load', err.message)
    }
  }
} else {
  fail('cap.node binary not found', `Expected at: ${normalizedCapPath}`)
  console.error('')
  console.error('  cap must be built before packaging. Run:')
  console.error('    npm run setup:native')
  console.error('')
  console.error('  If setup fails, run: npm run doctor')
  console.error('')
}

// ─── 2. Npcap (Windows only) ──────────────────────────────────────────────────

if (process.platform === 'win32') {
  const windir = process.env.WINDIR ?? 'C:\\Windows'
  const npcapPaths = [
    path.join(windir, 'System32', 'Npcap', 'wpcap.dll'),
    path.join(windir, 'SysWOW64', 'Npcap', 'wpcap.dll'),
    path.join(windir, 'System32', 'wpcap.dll')
  ]

  const found = npcapPaths.find((p) => fs.existsSync(p))
  if (found) {
    pass(`Npcap DLL found at ${found}`)
  } else {
    fail(
      'Npcap DLL not found',
      'Install Npcap from https://npcap.com — required for live packet capture in packaged builds'
    )
  }
} else {
  warn('Npcap check skipped (non-Windows platform)')
}

// ─── 3. Node version ──────────────────────────────────────────────────────────

const nodeVersion = process.versions.node
const [nodeMajor] = nodeVersion.split('.').map(Number)

if (nodeMajor >= 22 && nodeMajor < 25) {
  pass(`Node.js ${nodeVersion} is in the supported range (22–24)`)
} else {
  warn(`Node.js ${nodeVersion} is outside the recommended range (22–24)`, 'Use nvm to switch versions')
}

// ─── Result ───────────────────────────────────────────────────────────────────

console.log('')
if (allPassed) {
  console.log('  ✔  All checks passed. Ready to build.')
  console.log('')
  process.exit(0)
} else {
  console.error('  ✘  One or more checks failed. Fix the issues above before building.')
  console.error('     Run: npm run doctor   for a full environment report.')
  console.error('')
  process.exit(1)
}
