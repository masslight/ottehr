import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Reporter, TestModule } from 'vitest/node';

// Diagnostic for the --no-isolate abort: the run dies mid-suite with a worker whose IPC channel
// closes, and the dying worker can't say who it was. This reporter runs in the MAIN vitest
// process — which survives the crash long enough to print the ThreadTermination rejection — and
// journals every test file's start/end to disk. At an abort, files that started but never ended
// are the in-flight set, in start order; the one that immediately precedes the cascade and never
// finishes is the trigger. The CI timing-digest step prints the analysis.

const OUT = path.resolve(process.cwd(), 'test-results/file-lifecycle.jsonl');

const write = (event: string, moduleId: string): void => {
  try {
    mkdirSync(path.dirname(OUT), { recursive: true });
    appendFileSync(
      OUT,
      JSON.stringify({ event, file: moduleId.replace(/^.*\/test\/integration\//, ''), t: Date.now() }) + '\n'
    );
  } catch {
    // best-effort diagnostics
  }
};

export default class FileLifecycleReporter implements Reporter {
  onTestModuleStart(testModule: TestModule): void {
    write('start', testModule.moduleId);
  }

  onTestModuleEnd(testModule: TestModule): void {
    write('end', testModule.moduleId);
  }
}
