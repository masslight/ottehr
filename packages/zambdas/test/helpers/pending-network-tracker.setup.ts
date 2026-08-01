import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, expect } from 'vitest';

// Diagnostic for the --no-isolate blocker: some integration test files leave network requests
// in flight when the file finishes ("littered" requests — fired without being awaited, or
// abandoned by a timed-out/retried test). With per-file isolation each file's worker state is
// thrown away and the leak is invisible; with a shared worker (--no-isolate) those pending
// promises get rejected at pool teardown and crash the run (tinypool ThreadTermination as an
// unhandled rejection).
//
// This setup file wraps fetch in every integration worker, records each request with its
// call-site stack, and — after a file's own afterAll cleanup has run — reports anything still
// pending to test-results/pending-network.jsonl (vitest runs with silent:true, so a file is the
// reliable channel; the CI timing-digest step prints it). Detection only: it never fails a run.
//
// Registered LAST in setupFiles so it wraps the no-network guard and sees every call.

interface PendingEntry {
  url: string;
  method: string;
  startedAt: number;
  stack: string[];
}

const pending = new Map<number, PendingEntry>();
let nextId = 0;

const REPORT_PATH = path.resolve(process.cwd(), 'test-results/pending-network.jsonl');

// Keep only frames that point into our own code — the app frames are what identify the litterer.
const trimStack = (stack: string | undefined): string[] =>
  (stack ?? '')
    .split('\n')
    .filter((line) => /\/(test|src)\//.test(line) && !line.includes('pending-network-tracker'))
    .map((line) => line.trim())
    .slice(0, 8);

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

const wrappedFetch = globalThis.fetch;
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const id = nextId++;
  pending.set(id, {
    url: urlOf(input).slice(0, 200),
    method: (init?.method ?? 'GET').toUpperCase(),
    startedAt: Date.now(),
    stack: trimStack(new Error().stack),
  });
  const result = wrappedFetch(input, init);
  // .finally() derives a new promise; swallow its rejection so the tracker never converts a
  // handled failure into an unhandled one. The caller still gets the original promise.
  result.finally(() => pending.delete(id)).catch(() => undefined);
  return result;
}) as typeof fetch;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Setup-file afterAll hooks run LAST (vitest runs afterAll in reverse registration order), i.e.
// after the test file's own afterAll cleanup — exactly the moment a shared worker would move on
// to the next file.
afterAll(async () => {
  if (pending.size === 0) return;
  // Grace period: a request that settles moments after the last test isn't the hazard we're
  // hunting; only report what's still in flight after a real chance to finish.
  await sleep(500);
  if (pending.size === 0) return;

  const testPath = expect.getState?.()?.testPath ?? 'unknown';
  const now = Date.now();
  const entries = [...pending.values()].map((e) => ({
    testPath: testPath.replace(/^.*\/packages\/zambdas\//, ''),
    url: e.url,
    method: e.method,
    ageMs: now - e.startedAt,
    stack: e.stack,
  }));
  try {
    mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    appendFileSync(REPORT_PATH, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } catch {
    // best-effort diagnostics — never fail the suite over the report file
  }
});
