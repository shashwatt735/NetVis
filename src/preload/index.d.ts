// Full ElectronAPI type is defined in src/shared/ipc-types.ts (Task 11).
import type { ElectronAPI } from '../shared/ipc-types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
