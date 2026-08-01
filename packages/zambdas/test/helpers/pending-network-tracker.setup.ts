import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, expect } from 'vitest';

// Diagnostic for the --no-isolate blocker: some integration test file leaves network requests in
// flight (fired without being awaited, or abandoned by a timed-out/retried test). With per-file
// isolation each file's worker process is thrown away and the leak is invisible; with a shared
// worker (--no-isolate) those pending promises get rejected at pool teardown and abort the run
// (tinypool ThreadTermination surfacing as an unhandled rejection).
//
// This setup file wraps fetch in every integration worker and records each request with the test
// file that issued it (captured at call time) and its call-site stack. Anything still in flight
// past a threshold is appended to test-results/pending-network.jsonl (vitest runs with
// silent:true, so a file is the reliable channel; the CI timing-digest step prints it).
// Worker-side unhandled rejections/exceptions are captured to the same file so a crash is
// attributable. Detection only: it never fails a run.
//
// Reporting deliberately does NOT depend on vitest hooks alone: with --no-isolate, setup modules
// stay cached per worker, so hooks registered at import time may bind only to the worker's first
// file. The interval sweeper below works in both isolation modes; the afterAll is a best-effort
// end-of-file snapshot for the isolated mode.
//
// Registered LAST in setupFiles so it wraps the no-network guard and sees every call.

interface PendingEntry {
  url: string;
  method: string;
  startedAt: number;
  testPath: string;
  stack: string[];
  reported: boolean;
}

const REPORT_PATH = path.resolve(process.cwd(), 'test-results/pending-network.jsonl');
// A request still unsettled this long after it was issued is litter for our purposes — real
// integration round-trips settle in well under a second, and vitest's own hooks would have moved
// the file along by now.
const IN_FLIGHT_REPORT_MS = 5000;
const SWEEP_INTERVAL_MS = 2000;

// Keep only frames that point into our own code — the app frames are what identify the litterer.
const trimStack = (stack: string | undefined): string[] =>
  (stack ?? '')
    .split('\n')
    .filter((line) => /\/(test|src)\//.test(line) && !line.includes('pending-network-tracker'))
    .map((line) => line.trim())
    .slice(0, 8);

const shortTestPath = (): string =>
  (expect.getState?.()?.testPath ?? 'unknown').replace(/^.*\/packages\/zambdas\//, '');

const appendReport = (entries: object[]): void => {
  if (entries.length === 0) return;
  try {
    mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    appendFileSync(REPORT_PATH, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } catch {
    // best-effort diagnostics — never fail the suite over the report file
  }
};

// Everything below must survive setup-module caching under --no-isolate: register global state
// exactly once per worker process.
const STATE_FLAG = Symbol.for('ottehr.pendingNetworkTracker.state');
const globalState = globalThis as Record<symbol, unknown>;

if (!globalState[STATE_FLAG]) {
  const pending = new Map<number, PendingEntry>();
  globalState[STATE_FLAG] = pending;
  let nextId = 0;

  const urlOf = (input: Parameters<typeof fetch>[0]): string =>
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

  const wrappedFetch = globalThis.fetch;
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const id = nextId++;
    pending.set(id, {
      url: urlOf(input).slice(0, 200),
      method: (init?.method ?? 'GET').toUpperCase(),
      startedAt: Date.now(),
      testPath: shortTestPath(),
      stack: trimStack(new Error().stack),
      reported: false,
    });
    const result = wrappedFetch(input, init);
    // .finally() derives a new promise; swallow its rejection so the tracker never converts a
    // handled failure into an unhandled one. The caller still gets the original promise.
    result.finally(() => pending.delete(id)).catch(() => undefined);
    return result;
  }) as typeof fetch;

  // Sweeper: report anything in flight past the threshold, once. unref() so the timer never keeps
  // the worker alive.
  const sweep = (): void => {
    const now = Date.now();
    const stale: object[] = [];
    for (const e of pending.values()) {
      if (!e.reported && now - e.startedAt >= IN_FLIGHT_REPORT_MS) {
        e.reported = true;
        stale.push({
          type: 'pending',
          testPath: e.testPath,
          url: e.url,
          method: e.method,
          ageMs: now - e.startedAt,
          stack: e.stack,
        });
      }
    }
    appendReport(stale);
  };
  setInterval(sweep, SWEEP_INTERVAL_MS).unref();

  // Crash capture: with --no-isolate a rejection that escapes a test file surfaces later —
  // possibly while another file is running, or at pool teardown where it aborts the whole run.
  const record = (type: string) => (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    appendReport([
      { type, testPath: shortTestPath(), message: err.message.slice(0, 300), stack: trimStack(err.stack) },
    ]);
  };
  process.on('unhandledRejection', record('unhandledRejection'));
  process.on('uncaughtException', record('uncaughtException'));
}

// Best-effort end-of-file snapshot (fires reliably under per-file isolation; under --no-isolate it
// may only bind to the worker's first file — the sweeper above covers the rest). Setup-file
// afterAll hooks run LAST, i.e. after the test file's own afterAll cleanup.
afterAll(async () => {
  const pending = globalState[STATE_FLAG] as Map<number, PendingEntry>;
  if (pending.size === 0) return;
  // Grace period: a request that settles moments after the last test isn't the hazard we're
  // hunting; only report what's still in flight after a real chance to finish.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const now = Date.now();
  const leftovers: object[] = [];
  for (const e of pending.values()) {
    if (e.reported) continue;
    e.reported = true;
    leftovers.push({
      type: 'pending',
      testPath: e.testPath,
      url: e.url,
      method: e.method,
      ageMs: now - e.startedAt,
      stack: e.stack,
    });
  }
  appendReport(leftovers);
});
