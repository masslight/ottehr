import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { devStampRestartPlugin } from './vite/dev-stamp-restart';

const coreRoot = path.dirname(fileURLToPath(import.meta.url));

export default ({ mode }: { mode: string }) => {
  const envDir = './env';
  const env = loadEnv(mode, path.join(process.cwd(), envDir), '');

  return defineConfig({
    envDir: envDir,
    publicDir: 'public',
    plugins: [devStampRestartPlugin(coreRoot), react(), viteTsconfigPaths(), svgr()],
    server: {
      open: true,
      port: env.PORT ? parseInt(env.PORT) : undefined,
    },
    build: {
      outDir: './build',
      target: browserslistToEsbuild(),
      assetsInlineLimit: 0,
    },
    resolve: {
      preserveSymlinks: true,
    },
  });
};
