/**
 * Logger — structured JSON logging for the NetVis main process.
 *
 * Two-phase design:
 *   Phase 1 (before app.whenReady): console.error fallback only.
 *   Phase 2 (after initLogger() is called): pino writes JSON lines
 *             to userData/netvis.log with 10 MB rotation.
 *
 * LOG-SEC-01: payload content MUST NEVER appear in any log entry.
 * Enforced by convention — callers must never pass packet field values.
 *
 * Requirements: Req 13.1, Req 13.2, Req 13.3, Req 13.5
 */

import pino from 'pino'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

// Module-level instance — null until initLogger() is called.
let _logger: pino.Logger | null = null

/**
 * Initializes the file-backed pino logger.
 * Must be called inside app.whenReady() after app.getPath() is available.
 *
 * @param logPath - Absolute path to the log file (from app.getPath('userData')).
 * @param isDev   - When true, DEBUG entries are written; false suppresses them.
 */
export function initLogger(logPath: string, isDev: boolean): void {
  // pino-roll handles rotation: new file when size exceeds 10 MB, keep 2 files.
  const transport = pino.transport({
    target: 'pino-roll',
    options: {
      file: logPath,
      size: '10m', // rotate when file exceeds 10 MB (Req 13.5)
      frequency: 'daily',
      mkdir: true
    }
  })

  _logger = pino(
    {
      level: isDev ? 'debug' : 'info', // Req 13.3: suppress DEBUG in production
      timestamp: pino.stdTimeFunctions.isoTime,
      // Rename pino's default 'msg' key — keep it as 'message' for clarity
      messageKey: 'message',
      formatters: {
        level(label) {
          // Emit level as a string ("info") not a number (30)
          return { level: label }
        }
      }
    },
    transport
  )
}

/**
 * Returns true if the file logger has been initialized.
 * Used by the uncaughtException handler to decide which output to use.
 */
export function isLoggerReady(): boolean {
  return _logger !== null
}

/**
 * Core logging function. Routes to the file logger if ready,
 * otherwise falls back to console.error so no log entry is silently lost.
 *
 * LOG-SEC-01: never pass packet payload bytes, field values from
 * application-layer protocols, or raw Buffer contents as the message
 * or any context field.
 *
 * @param level     - Severity: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
 * @param component - Name of the calling module, e.g. 'CaptureEngine'
 * @param message   - Plain-English description. No payload content.
 * @param extra     - Optional additional metadata (timestamps, counts, error codes only).
 */
export function log(
  level: LogLevel,
  component: string,
  message: string,
  extra?: Record<string, string | number | boolean>
): void {
  const entry = { component, ...extra }

  if (_logger) {
    _logger[level](entry, message)
  } else {
    // Phase 1 fallback — structured enough to be readable, uses stderr
    console.error(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        component,
        message,
        ...extra
      })
    )
  }
}

// Convenience wrappers — callers use these rather than log() directly.
export const Logger = {
  debug: (component: string, message: string, extra?: Record<string, string | number | boolean>) =>
    log('debug', component, message, extra),

  info: (component: string, message: string, extra?: Record<string, string | number | boolean>) =>
    log('info', component, message, extra),

  warn: (component: string, message: string, extra?: Record<string, string | number | boolean>) =>
    log('warn', component, message, extra),

  error: (component: string, message: string, extra?: Record<string, string | number | boolean>) =>
    log('error', component, message, extra),

  fatal: (component: string, message: string, extra?: Record<string, string | number | boolean>) =>
    log('fatal', component, message, extra)
}

/**
 * Installs a global uncaughtException handler that logs the error
 * before the process exits. Must be called once during app initialization.
 *
 * Requirement: Req 13.2 — log exception type, message, and stack trace.
 */
export function installUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (err: Error) => {
    log('fatal', 'UncaughtException', `Unhandled exception: ${err.message}`, {
      errorType: err.name,
      stack: err.stack || 'no stack trace available'
    })
    // Give the logger time to flush before exiting
    setTimeout(() => {
      process.exit(1)
    }, 500)
  })
}
