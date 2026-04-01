import type { CaptureError, CaptureErrorCode } from '../../shared/capture-types'

/**
 * Maps any raw error from cap, fs, or pcap-parser into a structured
 * CaptureError with a user-facing message and optional platform hint.
 * The original error is attached as `cause` — logged, never shown to user.
 */
export function mapError(
  err: Error,
  code: CaptureErrorCode = 'UNKNOWN',
  context?: string
): CaptureError {
  return {
    code,
    message: buildUserMessage(err, code, context),
    platformHint: buildPlatformHint(code),
    cause: err
  }
}

function buildUserMessage(err: Error, code: CaptureErrorCode, context?: string): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'NetVis needs administrator access to capture packets.'
    case 'INTERFACE_NOT_FOUND':
      return `Interface "${context ?? 'unknown'}" was not found on this system.`
    case 'INTERFACE_LOST':
      return `The network interface "${context ?? 'unknown'}" was disconnected during capture.`
    case 'FILE_NOT_FOUND':
      return `File not found: ${context ?? err.message}`
    case 'FILE_INVALID_FORMAT':
      return 'The selected file is not a valid PCAP or PCAPNG file.'
    case 'LIBRARY_UNAVAILABLE':
      return 'The packet capture library could not be loaded. Live capture is unavailable.'
    case 'DRAIN_TIMEOUT':
      return 'Capture took too long to stop. Some packets may have been lost.'
    default:
      return err.message || 'An unexpected error occurred.'
  }
}

function buildPlatformHint(code: CaptureErrorCode): string | undefined {
  if (code !== 'PERMISSION_DENIED' && code !== 'LIBRARY_UNAVAILABLE') return undefined

  switch (process.platform) {
    case 'win32':
      return 'Run NetVis as Administrator, and ensure Npcap is installed from npcap.com.'
    case 'linux':
      return 'Run: sudo setcap cap_net_raw,cap_net_admin=eip /path/to/netvis'
    case 'darwin':
      return 'Run NetVis with sudo, or grant terminal full disk access in System Preferences. (SMJobBless privileged helper is planned for a future release.)'
    default:
      return undefined
  }
}
