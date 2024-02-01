import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
//import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import svgr from 'vite-plugin-svgr';
import * as path from 'path';

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
    build: {
      outDir: './build',
      target: browserslistToEsbuild(),
    },
  });
};
