import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration optimized for seamless production build deployment
export default defineConfig({
  plugins: [
    react()
  ],
  build: {
    // Memastikan build tidak macet karena peringatan error TypeScript kecil
    chunkSizeWarningLimit: 1600,
  }
});