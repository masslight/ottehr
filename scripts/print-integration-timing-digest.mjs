#!/usr/bin/env node
// Prints a compact per-file timing digest of the zambdas integration suite from the vitest JSON
// report (test-results/integration-report.json). The suite's wall time is dominated by per-file
// serial chains of backend round-trips, so this surfaces where the time concentrates: per-file
// duration percentiles, the slowest files (split into hook/setup time vs test time), and how much
// of the total the tail owns. Runs in CI right after the suite so the numbers live in the job log.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPORT_PATH =
  process.argv[2] ?? 'packages/zambdas/test-results/integration-report.json';
const PENDING_PATH = path.join(path.dirname(REPORT_PATH), 'pending-network.jsonl');

// Littered-network report (written by test/helpers/pending-network-tracker.setup.ts): requests
// still in flight >500ms after a test file finished. These are the --no-isolate blockers. Printed
// first — and unconditionally — because a run that crashes mid-suite (the failure mode the tracker
// exists to explain) writes this file but never gets to write the timing report below.
let pendingLines = [];
try {
  pendingLines = readFileSync(PENDING_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
} catch {
  // no report file — either no leaks or tracker not active
}

const crashes = pendingLines.filter((e) => e.type === 'unhandledRejection' || e.type === 'uncaughtException');
const litter = pendingLines.filter((e) => e.type === 'pending' || e.type === undefined);

if (crashes.length > 0) {
  console.log(`::group::Worker crash events — ${crashes.length} unhandled rejection(s)/exception(s)`);
  for (const e of crashes) {
    console.log(`\n[${e.type}] during ${e.testPath}: ${e.message}`);
    for (const frame of e.stack ?? []) console.log(`      ${frame}`);
  }
  console.log('::endgroup::');
}

if (litter.length === 0) {
  console.log('Pending-network report: no littered requests detected (or tracker not active).');
} else {
  console.log(`::group::Littered network requests — ${litter.length} left in flight`);
  const byFile = new Map();
  for (const e of litter) {
    const list = byFile.get(e.testPath) ?? [];
    list.push(e);
    byFile.set(e.testPath, list);
  }
  for (const [file, entries] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${file} — ${entries.length} pending request(s):`);
    const seen = new Set();
    for (const e of entries) {
      const key = `${e.method} ${e.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  ${e.method} ${e.url} (in flight ${(e.ageMs / 1000).toFixed(1)}s)`);
      for (const frame of e.stack ?? []) console.log(`      ${frame}`);
    }
  }
  console.log('::endgroup::');
}

let report;
try {
  report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
} catch {
  console.log(`No integration report found at ${REPORT_PATH} — nothing to digest.`);
  process.exit(0);
}

const files = (report.testResults ?? [])
  .map((tr) => {
    const durationMs = (tr.endTime ?? 0) - (tr.startTime ?? 0);
    const tests = tr.assertionResults ?? [];
    const testMs = tests.reduce((sum, a) => sum + (a.duration ?? 0), 0);
    return {
      name: (tr.name ?? '?').replace(/^.*\/test\/integration\//, ''),
      durationMs,
      // Time inside the file's window not attributed to test bodies — beforeAll graph setup,
      // afterAll cleanup, and between-test overhead.
      hookMs: Math.max(0, durationMs - testMs),
      testMs,
      testCount: tests.length,
      failed: tests.some((a) => a.status === 'failed'),
    };
  })
  .sort((a, b) => b.durationMs - a.durationMs);

if (files.length === 0) {
  console.log('Integration report contains no test results.');
  process.exit(0);
}

const s = (ms) => `${(ms / 1000).toFixed(1)}s`;
const durations = files.map((f) => f.durationMs);
const totalMs = durations.reduce((a, b) => a + b, 0);
const pct = (q) => durations.slice().sort((a, b) => a - b)[Math.min(durations.length - 1, Math.floor(q * durations.length))];
const share = (n) => ((durations.slice(0, n).reduce((a, b) => a + b, 0) / totalMs) * 100).toFixed(0);

console.log('::group::Integration per-file timing digest');
console.log(`Files: ${files.length}   Tests: ${report.numTotalTests}   Failed: ${report.numFailedTests}`);
console.log(
  `Sum of file durations: ${s(totalMs)} (÷12 workers ≈ ${s(totalMs / 12)} theoretical floor, excludes collect/transform)`
);
console.log(`Per-file duration: p50 ${s(pct(0.5))}   p90 ${s(pct(0.9))}   max ${s(durations[0])}`);
console.log(`Share of total time: top 10 files ${share(10)}%   top 20 ${share(20)}%   top 40 ${share(40)}%`);
console.log('');
console.log('Slowest 40 files (duration = hooks/setup + test bodies):');
for (const f of files.slice(0, 40)) {
  const flag = f.failed ? ' [FAILED]' : '';
  console.log(
    `  ${s(f.durationMs).padStart(7)}  (hooks ${s(f.hookMs).padStart(6)} | tests ${s(f.testMs).padStart(6)} | n=${f.testCount})  ${f.name}${flag}`
  );
}
console.log('::endgroup::');
