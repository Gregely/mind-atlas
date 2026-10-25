import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built app also works when opened from any sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
});
