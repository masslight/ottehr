import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import * as path from 'path';
import { defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';
import viteTsconfigPaths from 'vite-tsconfig-paths';

export default ({ mode }) => {
  const envDir = './env';
  const env = loadEnv(mode, path.join(process.cwd(), envDir), '');

  return defineConfig({
    envDir: envDir,
    publicDir: 'public',
    plugins: [react(), viteTsconfigPaths(), svgr()],
    server: {
      open: true,
      port: env.PORT ? parseInt(env.PORT) : undefined,
    },
    optimizeDeps: {
      exclude: ['js-big-decimal'],
    },
    build: {
      outDir: './build',
      target: browserslistToEsbuild(),
    },
  });
};
