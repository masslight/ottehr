import * as fs from 'fs';
import * as path from 'path';
import type { Plugin, ViteDevServer } from 'vite';

/** Optional file at repo root; when touched, dev server restarts (e.g. external profile switch). */
export const DEV_STAMP_FILENAME = '.dev-overlay-stamp';

export function devStampRestartPlugin(repoRoot: string): Plugin {
  const stampPath =
    process.env.VITE_DEV_STAMP_FILE?.trim() || path.join(repoRoot, DEV_STAMP_FILENAME);

  const restart = (server: ViteDevServer): void => {
    console.log('\n[vite] dev stamp changed — restarting dev server…\n');
    void server.restart();
  };

  return {
    name: 'dev-stamp-restart',
    configureServer(server) {
      const on = (file: string) => {
        if (path.resolve(file) === path.resolve(stampPath)) restart(server);
      };
      if (fs.existsSync(stampPath)) server.watcher.add(stampPath);
      server.watcher.on('change', on);
      server.watcher.on('add', (file) => {
        if (path.resolve(file) === path.resolve(stampPath)) server.watcher.add(stampPath);
        on(file);
      });
    },
  };
}
