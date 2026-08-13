import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Project site lives at https://matheuschang.github.io/Tracklist-Ranking/,
// so the production build needs that sub-path as its base. Dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Tracklist-Ranking/' : '/',
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
}))
