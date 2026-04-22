import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const phase = process.env.VITE_PHASE ?? '2'

  return {
    main: {
      define: {
        __DEV_OVERLAY__: JSON.stringify(isDev)
      },
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/main/index.ts'),
            'capture-worker': resolve(__dirname, 'src/main/capture/capture-worker.ts')
          },
          output: {
            entryFileNames: '[name].js'
          }
        }
      }
    },
    preload: {},
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react(), tailwindcss()],
      define: {
        __DEV_OVERLAY__: JSON.stringify(isDev),
        __VITE_PHASE__: JSON.stringify(Number(phase))
      }
    }
  }
})
