import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/v3.1/tools/mms_2.0/',
  plugins: [react()],
  test: {
    // Núcleo de cálculo é JS puro — nenhum teste desta suíte toca DOM.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
})
