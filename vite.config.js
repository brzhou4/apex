import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // PORT is set by tooling (e.g. preview runners); default to 3011 locally.
    port: Number(process.env.PORT) || 3011,
    // Forward goal-parser calls to the Claude-backed API server (run `npm run server`).
    proxy: { '/api': 'http://localhost:8787' },
  },
})
