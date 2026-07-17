#!/usr/bin/env node
// Prints a concise, one-line-per-suite summary of the most recent `turbo --summarize` run.
// Turbo's `--output-logs=errors-only` hides successful/cached output, which makes it hard
// to tell from CI logs which test suites actually ran versus were restored from cache.
// This reads the run summary JSON turbo writes to `.turbo/runs/` and prints, per suite,
// whether it executed or was a cache hit, its status, and how long it took.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RUNS_DIR = '.turbo/runs';

function latestSummaryFile() {
  let entries;
  try {
    entries = readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return null;
  }
  if (entries.length === 0) return null;
  return entries
    .map((f) => join(RUNS_DIR, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

const file = latestSummaryFile();
if (!file) {
  console.log('No turbo run summary found in .turbo/runs — nothing to report.');
  process.exit(0);
}

const summary = JSON.parse(readFileSync(file, 'utf8'));
const tasks = summary.tasks ?? [];

const fmtDuration = (ms) => {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '?';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
};

let failed = 0;
let executed = 0;
let cached = 0;

console.log('::group::Test suite run summary');
console.log(`Suites: ${tasks.length}`);
console.log('');

const lines = tasks
  .slice()
  .sort((a, b) => (a.taskId || '').localeCompare(b.taskId || ''))
  .map((t) => {
    const taskId = t.taskId ?? `${t.package ?? '?'}#${t.task ?? '?'}`;
    const exitCode = t.execution?.exitCode;
    const cacheHit = t.cache?.status === 'HIT';
    const ok = exitCode === 0 || exitCode === undefined;

    if (!ok) failed++;
    else if (cacheHit) cached++;
    else executed++;

    const icon = ok ? '✓' : '✗';
    const source = cacheHit ? 'cached' : 'executed';
    let timing;
    if (cacheHit && typeof t.cache?.timeSaved === 'number') {
      timing = `saved ${fmtDuration(t.cache.timeSaved)}`;
    } else if (t.execution?.startTime && t.execution?.endTime) {
      timing = fmtDuration(t.execution.endTime - t.execution.startTime);
    } else {
      timing = '';
    }
    return `${icon} ${taskId} — ${source}${timing ? ` (${timing})` : ''}`;
  });

for (const line of lines) console.log(line);

console.log('');
console.log(`Totals: ${executed} executed, ${cached} cached, ${failed} failed`);
console.log('::endgroup::');

if (failed > 0) {
  console.log(`::error::${failed} test suite(s) failed — see the "Spec tests with coverage" step for details.`);
}
