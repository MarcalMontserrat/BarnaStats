import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.VITE_BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (
            id.includes('/node_modules/recharts/') ||
            id.includes('\\node_modules\\recharts\\')
          ) {
            return 'recharts'
          }

          if (
            id.includes('/node_modules/react/') ||
            id.includes('\\node_modules\\react\\') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('\\node_modules\\react-dom\\') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('\\node_modules\\scheduler\\')
          ) {
            return 'react-vendor'
          }

          return 'vendor'
        }
      }
    }
  }
})
