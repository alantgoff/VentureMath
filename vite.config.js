import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project Pages site: https://alantgoff.github.io/VentureMath/
export default defineConfig({
  base: '/VentureMath/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
