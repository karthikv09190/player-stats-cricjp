import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/player-stats-cricjp/',
  server: { port: parseInt(process.env.PORT || '3000') },
})
