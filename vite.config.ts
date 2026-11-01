import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/baseball-hck/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
