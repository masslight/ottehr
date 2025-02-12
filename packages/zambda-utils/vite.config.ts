import { resolve } from 'path';
import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [viteTsconfigPaths()],
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/main.ts'),
      formats: ['es'],
    },
  },
});
