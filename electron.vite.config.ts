import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const phase = process.env.VITE_PHASE ?? '1'

  return {
    main: {
      define: {
        __DEV_OVERLAY__: JSON.stringify(isDev)
      }
    },
    preload: {},
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react()],
      define: {
        __DEV_OVERLAY__: JSON.stringify(isDev),
        __VITE_PHASE__: JSON.stringify(Number(phase))
      }
    }
  }
})
