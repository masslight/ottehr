// Pre-bundles synthesize-visit.ts ONCE per orchestrator run so the per-visit
// child process is a plain `node <bundle.js>` instead of `npx tsx <ts file>`.
// The dominant per-visit cost was NOT the process spawn — it was tsx/esbuild
// re-transpiling the ~3,500-line harness + its imports on EVERY spawn (~2-4s
// CPU each), paid once per visit (~2,560× in a population run, 40× per census).
// Bundling once up front eliminates that entirely while keeping process
// isolation, the bounded worker pool, argv shape, env injection, and stdout
// byte-for-byte identical (the census scrapes `Appointment:`/`Encounter:` ids
// from the child's stdout).
//
// Robustness: if the one-time build fails for any reason, we log a clear
// warning and fall back to the current `npx tsx` invocation — correctness over
// speed, never a broken run. The temp dir is cleaned up on either path.

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const SYNTH_ENTRY = resolve(__dirname, '..', 'synthesize-visit.ts');

export interface HarnessCommand {
  /** Executable for spawn(): 'node' (pre-built bundle) or 'npx' (tsx fallback). */
  command: string;
  /** Argv prefix before the per-visit args: ['<bundle.js>'] or ['tsx', '<synthesize-visit.ts>']. */
  argsPrefix: string[];
  /** True when the pre-built bundle is in use (false = tsx fallback). */
  bundled: boolean;
  /** Removes the temp bundle dir. Idempotent; safe to call from a finally block. */
  cleanup: () => void;
}

const TSX_FALLBACK: Omit<HarnessCommand, 'cleanup'> = {
  command: 'npx',
  argsPrefix: ['tsx', SYNTH_ENTRY],
  bundled: false,
};

/**
 * Builds the synthesize-visit harness into a single CJS bundle in a fresh temp
 * dir and returns the spawn command for it. Never throws: on any build failure
 * it warns and returns the `npx tsx` fallback (with a no-op-safe cleanup).
 * Call `cleanup()` in a finally block at the end of the run.
 */
export async function prepareHarnessCommand(): Promise<HarnessCommand> {
  let dir: string | undefined;
  const cleanup = (): void => {
    if (!dir) return;
    try {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    } catch (e) {
      // Non-fatal (it's a temp dir the OS will reap), but never silent.
      console.warn(`⚠ could not remove harness bundle dir ${dir}: ${e instanceof Error ? e.message : e}`);
    }
  };

  try {
    // Late import: if esbuild itself is missing/broken we still fall back.
    const esbuild = await import('esbuild');
    dir = mkdtempSync(join(tmpdir(), 'synth-harness-'));
    const outfile = join(dir, 'synthesize-visit.js');
    const started = Date.now();
    // Mirrors packages/zambdas/bundle.ts (platform node, bundle, @aws-sdk/*
    // external); cjs because the harness has no top-level await and cjs runs
    // under plain `node` with no extension/package.json ceremony. No minify:
    // build speed + readable stack traces matter more than bundle size here.
    await esbuild.build({
      entryPoints: [SYNTH_ENTRY],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node18',
      external: ['@aws-sdk/*'],
      sourcemap: false,
      logLevel: 'warning',
    });
    console.log(`[harness] pre-built synthesize-visit bundle in ${Date.now() - started}ms → ${outfile}`);
    return { command: 'node', argsPrefix: [outfile], bundled: true, cleanup };
  } catch (e) {
    console.warn(
      `⚠ [harness] failed to pre-build synthesize-visit bundle — falling back to per-visit npx tsx ` +
        `(slower but correct): ${e instanceof Error ? e.message : e}`
    );
    cleanup(); // remove the half-made temp dir, if any
    return { ...TSX_FALLBACK, cleanup };
  }
}
