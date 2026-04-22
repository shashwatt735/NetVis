// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
var __electron_vite_injected_dirname = "D:\\Project\\netvis-v2\\netvis";
var electron_vite_config_default = defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const phase = process.env.VITE_PHASE ?? "1";
  return {
    main: {
      define: {
        __DEV_OVERLAY__: JSON.stringify(isDev)
      },
      build: {
        rollupOptions: {
          input: {
            index: resolve(__electron_vite_injected_dirname, "src/main/index.ts"),
            "capture-worker": resolve(__electron_vite_injected_dirname, "src/main/capture/capture-worker.ts")
          },
          output: {
            entryFileNames: "[name].js"
          }
        }
      }
    },
    preload: {},
    renderer: {
      resolve: {
        alias: {
          "@renderer": resolve("src/renderer/src")
        }
      },
      plugins: [react(), tailwindcss()],
      define: {
        __DEV_OVERLAY__: JSON.stringify(isDev),
        __VITE_PHASE__: JSON.stringify(Number(phase))
      }
    }
  };
});
export {
  electron_vite_config_default as default
};
