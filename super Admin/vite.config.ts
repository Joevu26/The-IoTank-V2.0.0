import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: 'node_modules/.vite_clean',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../src')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5174,
    fs: {
      allow: ['..']
    }
  }
})
