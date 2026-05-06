#!/usr/bin/env node
/**
 * scripts/doctor-env.mjs
 *
 * Used by: npm run doctor
 *
 * Reports the health of the local development environment for NetVis.
 * Covers everything needed for both core development and live capture development.
 *
 * Core development (UI, PCAP import, replay, learning, visualizations):
 *   → Node.js, npm only
 *
 * Live capture development (additionally requires):
 *   → Python, Visual Studio Build Tools 2022, MSVC v143, Windows SDK, Npcap
 */

import { execSync, execFileSync } from 'child_process'
import { createRequire } from 'module'
import * as fs from 'fs'
import * as path from 'path'

const require = createRequire(import.meta.url)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(label, detail) {
  console.log(`  ✔  ${label}${detail ? `  (${detail})` : ''}`)
}

function warn(label, detail) {
  console.warn(`  ⚠  ${label}${detail ? `  (${detail})` : ''}`)
}

function fail(label, detail, hint) {
  console.error(`  ✘  ${label}${detail ? `  (${detail})` : ''}`)
  if (hint) console.error(`       → ${hint}`)
}

function section(title) {
  console.log('')
  console.log(`  ${title}`)
  console.log(`  ${'─'.repeat(title.length)}`)
}

function tryExec(cmd, args = []) {
  try {
    const isWin = process.platform === 'win32'
    const actualCmd = isWin && cmd === 'npm' ? 'npm.cmd' : cmd
    return execFileSync(actualCmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

function tryExecShell(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────

console.log('')
console.log('  NetVis — Environment Doctor')
console.log('  ════════════════════════════')
console.log(`  Platform : ${process.platform} ${process.arch}`)
console.log(`  Time     : ${new Date().toISOString()}`)

// ─── 1. Node.js ───────────────────────────────────────────────────────────────

section('Core: Node.js')

const nodeVersion = process.versions.node
const [nodeMajor] = nodeVersion.split('.').map(Number)

if (nodeMajor >= 22 && nodeMajor < 25) {
  ok(`Node.js ${nodeVersion}`, 'within supported range 22–24')
} else if (nodeMajor < 22) {
  fail(`Node.js ${nodeVersion}`, 'too old', 'Install Node 22 LTS via https://nodejs.org or nvm')
} else {
  warn(`Node.js ${nodeVersion}`, 'above tested range — may work, prefer Node 22 or 24')
}

// ─── 2. npm ───────────────────────────────────────────────────────────────────

section('Core: npm')

const npmVersion = tryExecShell('npm --version 2>&1')
if (npmVersion) {
  const [npmMajor] = npmVersion.split('.').map(Number)
  if (npmMajor >= 10 && npmMajor < 12) {
    ok(`npm ${npmVersion}`, 'within supported range 10–11')
  } else {
    warn(`npm ${npmVersion}`, 'outside tested range 10–11')
  }
} else {
  fail('npm not found', null, 'Reinstall Node.js from https://nodejs.org')
}

// ─── 3. cap module ────────────────────────────────────────────────────────────

section('Live capture: cap module')

if (process.platform === 'win32') {
  const windir = process.env.WINDIR ?? 'C:\\Windows'
  const npcapPaths = [path.join(windir, 'System32', 'Npcap'), path.join(windir, 'SysWOW64', 'Npcap')]
  const currentPath = process.env.PATH ?? ''
  const missingPaths = npcapPaths.filter((p) => fs.existsSync(p) && !currentPath.toLowerCase().includes(p.toLowerCase()))
  if (missingPaths.length > 0) {
    process.env.PATH = `${missingPaths.join(path.delimiter)}${path.delimiter}${currentPath}`
  }
}

try {
  require('cap')
  ok('cap loaded successfully', 'live capture available')
} catch (err) {
  if (err.message && err.message.includes('NODE_MODULE_VERSION')) {
    ok('cap compiled successfully', 'live capture available (Electron ABI detected)')
  } else if (err.code === 'MODULE_NOT_FOUND') {
    warn('cap not installed', 'live capture disabled — run: npm run rebuild:native')
  } else {
    fail('cap installed but failed to load', err.message, 'Run: npm run rebuild:native')
  }
}

// ─── 4. Python ────────────────────────────────────────────────────────────────

section('Live capture build tools: Python')

const pythonCandidates = ['python', 'python3', 'py']
let pythonFound = null
let pythonVersion = null

for (const cmd of pythonCandidates) {
  const ver = tryExecShell(`${cmd} --version 2>&1`)
  if (ver && ver.toLowerCase().startsWith('python')) {
    pythonFound = cmd
    pythonVersion = ver
    break
  }
}

if (pythonFound) {
  // node-gyp requires Python 3.6–3.12 (3.13+ may have compatibility issues)
  const match = pythonVersion.match(/Python (\d+)\.(\d+)/)
  if (match) {
    const [, major, minor] = match.map(Number)
    if (major === 3 && minor >= 6 && minor <= 12) {
      ok(`${pythonVersion}`, `via '${pythonFound}'`)
    } else if (major === 3 && minor > 12) {
      warn(`${pythonVersion}`, `Python 3.13+ may have node-gyp compatibility issues — Python 3.11 recommended`)
    } else {
      fail(`${pythonVersion}`, 'Python 3.6–3.12 required for node-gyp', 'Install from https://python.org')
    }
  } else {
    ok(pythonVersion, `via '${pythonFound}'`)
  }
} else {
  fail('Python not found', null, 'Install Python 3.11 from https://python.org and add to PATH')
}

// ─── 5. Visual Studio Build Tools (Windows only) ─────────────────────────────

if (process.platform === 'win32') {
  section('Live capture build tools: Visual Studio (Windows)')

  const vsPaths = [
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\Community',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise'
  ]

  const vsFound = vsPaths.find((p) => fs.existsSync(p))
  if (vsFound) {
    const is2022 = vsFound.includes('2022')
    ok(`Visual Studio ${is2022 ? '2022' : '2019'} found`, vsFound)

    // Check for MSVC toolset (v142 or v143)
    const msvcBase = path.join(vsFound, 'VC', 'Tools', 'MSVC')
    if (fs.existsSync(msvcBase)) {
      const toolsets = fs.readdirSync(msvcBase).filter((d) => d.startsWith('14.2') || d.startsWith('14.3'))
      if (toolsets.length > 0) {
        ok(`MSVC toolset found`, toolsets[toolsets.length - 1])
      } else {
        const allToolsets = fs.existsSync(msvcBase) ? fs.readdirSync(msvcBase) : []
        if (allToolsets.length > 0) {
          warn(`MSVC found but no v142/v143 toolset`, `found: ${allToolsets.join(', ')}`)
        } else {
          fail('No MSVC toolsets found', null, 'Install "Desktop development with C++" in Visual Studio Installer')
        }
      }
    } else {
      fail('MSVC toolset directory missing', null, 'Install "Desktop development with C++" in Visual Studio Installer')
    }

    // Check for Windows SDK via registry
    const sdkReg = tryExecShell(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots" /v KitsRoot10 2>nul'
    )
    if (sdkReg && sdkReg.includes('KitsRoot10')) {
      // Extract version folders
      const sdkRoot = sdkReg.match(/REG_SZ\s+(.+)/)
      if (sdkRoot) {
        const sdkPath = sdkRoot[1].trim()
        const libPath = path.join(sdkPath, 'Lib')
        if (fs.existsSync(libPath)) {
          const sdkVersions = fs.readdirSync(libPath).filter((d) => d.match(/^10\./))
          if (sdkVersions.length > 0) {
            ok(`Windows SDK found`, sdkVersions[sdkVersions.length - 1])
          } else {
            fail('Windows SDK Lib directory empty', null, 'Install Windows 10/11 SDK via Visual Studio Installer')
          }
        } else {
          warn('Windows SDK root found but Lib directory missing')
        }
      } else {
        ok('Windows SDK registry entry found')
      }
    } else {
      fail(
        'Windows SDK not found',
        'this was the exact blocker in the reported install failure',
        'In Visual Studio Installer → Modify → "Desktop development with C++" → check "Windows 10/11 SDK"'
      )
    }
  } else {
    fail(
      'Visual Studio 2019/2022 Build Tools not found',
      null,
      'Install from https://visualstudio.microsoft.com/visual-cpp-build-tools/'
    )
    warn('Without VS Build Tools, native addon rebuild will fail')
  }

  // ─── 6. Npcap (Windows only) ───────────────────────────────────────────────

  section('Live capture runtime: Npcap (Windows)')

  const windir = process.env.WINDIR ?? 'C:\\Windows'
  const npcapPaths = [
    path.join(windir, 'System32', 'Npcap'),
    path.join(windir, 'SysWOW64', 'Npcap')
  ]

  const npcapDir = npcapPaths.find((p) => fs.existsSync(p))
  if (npcapDir) {
    const wpcap = path.join(npcapDir, 'wpcap.dll')
    if (fs.existsSync(wpcap)) {
      ok('Npcap installed', `wpcap.dll found at ${npcapDir}`)
    } else {
      warn('Npcap directory exists but wpcap.dll missing', 'try reinstalling Npcap')
    }
  } else {
    const legacyWpcap = path.join(windir, 'System32', 'wpcap.dll')
    if (fs.existsSync(legacyWpcap)) {
      warn('WinPcap found instead of Npcap', 'Npcap is preferred — install from https://npcap.com')
    } else {
      fail(
        'Npcap not installed',
        'required for live packet capture at runtime',
        'Install from https://npcap.com (free for personal use)'
      )
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('')
console.log('  ─────────────────────────────────────────────────────────')
console.log('  Core development (UI, PCAP import, replay, learning):')
console.log('    Only Node.js + npm required. ✔ if those passed above.')
console.log('')
console.log('  Live capture development (additionally requires):')
console.log('    Python + VS Build Tools + MSVC v142/v143 + Windows SDK + Npcap')
console.log('')
console.log('  After fixing missing tools, run: npm run rebuild:native')
console.log('  ─────────────────────────────────────────────────────────')
console.log('')
