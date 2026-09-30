/**
 * Imports each bundled Zambda in its own Node process, the way Lambda loads it on a cold start,
 * and reports the ones that throw while loading or don't export an `index` handler.
 *
 * A bundle can build cleanly and still fail the moment it's imported: a CommonJS dependency
 * calling require() inside the ES module, say, or a top-level await that rejects. Checking
 * before zipping keeps a Zambda that can't start from being deployed.
 *
 * Kept separate from bundle.ts so the check can be unit tested.
 */
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

// Runs as an ES module entry point, like Lambda's own runtime. A CommonJS `node -e` would put
// `require` on globalThis, where the imported bundle would find it, and every "Dynamic require of
// ... is not supported" failure this check exists to catch would pass. It prints only the stack:
// left uncaught, Node would also print the offending source line, which in a minified bundle is
// the whole file.
const LOAD_BUNDLE = [
  "const { pathToFileURL } = await import('node:url');",
  'try {',
  '  const bundle = await import(pathToFileURL(process.argv[1]).href);',
  "  if (typeof bundle.index !== 'function') throw new Error('does not export an index handler');",
  '} catch (error) {',
  '  console.error(error instanceof Error ? error.stack : String(error));',
  '  process.exit(1);',
  '}',
].join('\n');

export interface BundleLoadFailure {
  bundlePath: string;
  error: string;
}

const loadInFreshProcess = (bundlePath: string): Promise<string | undefined> =>
  new Promise((resolve) => {
    // Only PATH, as in a Lambda sandbox; in particular not the tsx loader the build's NODE_OPTIONS carries.
    const child = spawn(process.execPath, ['--input-type=module', '--eval', LOAD_BUNDLE, path.resolve(bundlePath)], {
      env: { PATH: process.env.PATH },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', (error) => resolve(String(error)));
    child.on('close', (code) => resolve(code === 0 ? undefined : stderr.trim() || `exited with code ${code}`));
  });

export const findBundlesThatFailToLoad = async (
  bundlePaths: string[],
  concurrency = os.availableParallelism()
): Promise<BundleLoadFailure[]> => {
  const failures: BundleLoadFailure[] = [];
  const queue = [...bundlePaths];
  const worker = async (): Promise<void> => {
    for (let bundlePath = queue.shift(); bundlePath; bundlePath = queue.shift()) {
      const error = await loadInFreshProcess(bundlePath);
      if (error) failures.push({ bundlePath, error });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return failures;
};
