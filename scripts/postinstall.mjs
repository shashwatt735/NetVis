#!/usr/bin/env node
/**
 * scripts/postinstall.mjs
 *
 * Replaces the hard "electron-builder install-app-deps" postinstall.
 *
 * Goal: npm install must succeed on every machine, including those without
 * Python, MSVC, or the Windows SDK. Live capture is optional; it only works
 * when native build tools are present.
 *
 * What this script does:
 *   1. Attempt "electron-builder install-app-deps" to rebuild cap against
 *      the installed Electron headers.
 *   2. If it succeeds → live capture will be available at runtime.
 *   3. If it fails  → print a clear, actionable warning and exit 0 so that
 *      npm install completes successfully. Live capture will be disabled at
 *      runtime with a clear in-app message.
 */

import { execSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// ─── Check whether cap is even installed ──────────────────────────────────────
// cap is an optionalDependency. If npm skipped it (build failed or --ignore-scripts),
// there is nothing to rebuild and we can exit immediately.

let capInstalled = false
try {
  require.resolve('cap')
  capInstalled = true
} catch {
  // cap was not installed — skipping rebuild
}

if (!capInstalled) {
  console.log('')
  console.log('  ℹ  cap was not installed (native build tools may be missing).')
  console.log('     Live packet capture will be disabled.')
  console.log('     PCAP import, replay, and all other features work normally.')
  console.log('')
  console.log('  To enable live capture, install the required tools and run:')
  console.log('     npm run setup:native')
  console.log('')
  process.exit(0)
}

// ─── cap is present — attempt to rebuild it against Electron headers ──────────

console.log('')
console.log('  ⚙  Rebuilding native addons against Electron headers…')

try {
  execSync('electron-builder install-app-deps', {
    stdio: 'inherit',
    env: process.env
  })
  console.log('')
  console.log('  ✔  Native addons rebuilt. Live capture is available.')
  console.log('')
} catch {
  console.log('')
  console.warn('  ⚠  Native addon rebuild failed. Live capture will be disabled.')
  console.warn('     This does NOT prevent the app from starting.')
  console.warn('')
  console.warn('  Common causes on Windows:')
  console.warn('    • Windows SDK missing — install via Visual Studio Installer')
  console.warn('    • MSVC v143 missing   — install "Desktop development with C++"')
  console.warn('    • Python not found    — install from python.org')
  console.warn('')
  console.warn('  To diagnose your environment:')
  console.warn('     npm run doctor')
  console.warn('')
  console.warn('  To retry the rebuild after fixing your tools:')
  console.warn('     npm run setup:native')
  console.warn('')
  // Exit 0 — do not fail npm install
  process.exit(0)
}
