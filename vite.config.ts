import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /pitch-viewer/, not from /.
  // The deploy workflow sets BASE_PATH; locally it stays "/".
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    vue(),
    // Imports only the Vuetify components we actually use (tree-shaking).
    vuetify({ autoImport: true }),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
