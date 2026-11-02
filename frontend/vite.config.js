import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the Django server runs on :8000; the browser only talks to Vite,
// which forwards API, admin, static and media requests (same-origin, no CORS needed).
const DJANGO = process.env.DJANGO_URL || 'http://127.0.0.1:8000'
const proxy = Object.fromEntries(
  ['/api', '/admin', '/static', '/media'].map((path) => [path, { target: DJANGO }]),
)

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: {
    rollupOptions: {
      output: {
        // separate, long-cached files for the big libraries
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          chart: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
})
