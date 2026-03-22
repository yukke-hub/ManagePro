import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      '@fullcalendar/core',
      '@fullcalendar/react',
      '@fullcalendar/daygrid',
      '@fullcalendar/timegrid',
      '@fullcalendar/interaction',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/@fullcalendar\//, /node_modules/],
    },
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('@tldraw/tldraw') !== -1 || id.indexOf('tldraw') !== -1) {
            return 'tldraw'
          }
          if (id.indexOf('@fullcalendar/') !== -1) {
            return 'calendar'
          }
          if (id.indexOf('node_modules') !== -1) {
            return 'vendor'
          }
        },
      },
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
        warn(warning)
      },
    },
  },
})