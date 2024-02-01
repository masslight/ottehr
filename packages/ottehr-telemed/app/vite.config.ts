import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  envDir: './env',
  plugins: [react()],
  test: {
    coverage: {
      reporter: ['lcov', 'text', 'html'],
    },
  },
});
