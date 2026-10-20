// Packages the desktop app from a clean folder outside the monorepo: run inside it, electron-builder walks up and
// bundles the whole workspace's node_modules. The app itself is three files (main, preload, the built studio page).
//   npm run dist   (after `npm run build` in apps/report-studio)
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf-8'));
const stage = mkdtempSync(path.join(tmpdir(), 'report-studio-desktop-'));
try {
  cpSync(path.join(here, 'main.cjs'), path.join(stage, 'main.cjs'));
  cpSync(path.join(here, 'preload.cjs'), path.join(stage, 'preload.cjs'));
  cpSync(path.join(here, 'tabs.html'), path.join(stage, 'tabs.html'));
  cpSync(path.join(here, 'tabs-preload.cjs'), path.join(stage, 'tabs-preload.cjs'));
  cpSync(path.join(here, '..', 'dist', 'index.html'), path.join(stage, 'studio.html'));
  const { devDependencies, scripts, ...app } = pkg;
  writeFileSync(path.join(stage, 'package.json'), JSON.stringify(app, null, 2));
  const config = {
    ...pkg.build,
    electronVersion: devDependencies.electron,
    electronDist: undefined,
    directories: { output: path.join(here, 'release') },
  };
  writeFileSync(path.join(stage, 'builder.json'), JSON.stringify(config, null, 2));
  execFileSync(
    path.join(here, 'node_modules', '.bin', 'electron-builder'),
    ['--projectDir', stage, '--config', path.join(stage, 'builder.json'), '--mac', '--win', '--publish', 'never'],
    { stdio: 'inherit' }
  );
} finally {
  rmSync(stage, { recursive: true, force: true });
}
