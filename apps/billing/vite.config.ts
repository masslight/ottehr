import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { existsSync } from 'fs';
import * as path from 'path';
import { defineConfig, loadEnv, UserConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

export default ({ mode }: { mode: string }): UserConfig => {
  const envDir = './env';
  const env = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const tlsCert = existsSync(path.join(process.cwd(), envDir, 'cert.pem'));
  const tlsKey = existsSync(path.join(process.cwd(), envDir, 'key.pem'));

  return defineConfig({
    envDir,
    plugins: [react(), viteTsconfigPaths()],
    server: {
      open: !process.env.VITE_NO_OPEN,
      host: '0.0.0.0',
      port: env.PORT ? parseInt(env.PORT) : 5002,
      https: tlsCert && tlsKey ? { cert: './env/cert.pem', key: './env/key.pem' } : undefined,
    },
    build: {
      outDir: './build',
      target: browserslistToEsbuild(),
      sourcemap: true,
    },
  });
};
