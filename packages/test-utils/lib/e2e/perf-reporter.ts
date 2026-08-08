import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Prints a compact performance profile at the end of a Playwright run.
 *
 * The stock reporters tell you whether the suite passed, not where its wall clock went. The two
 * numbers that actually drive E2E CI time are (a) total test-seconds — the work the suite does,
 * which per-test setup duplication inflates — and (b) how well that work packs into the available
 * workers, which serial describes and a long tail of slow tests degrade. This reporter reports both,
 * plus the per-file and per-test breakdowns needed to decide which of the two to attack.
 *
 * Output goes to stdout, so it lands in the CI job log and needs no artifact download.
 */

interface FileStat {
  count: number;
  duration: number;
}

interface TestStat {
  title: string;
  file: string;
  line: number;
  duration: number;
  workerIndex: number;
}

const SLOWEST_TESTS_TO_PRINT = 20;
const SLOWEST_FILES_TO_PRINT = 20;

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function minutes(ms: number): string {
  return `${(ms / 60000).toFixed(2)}m`;
}

export default class PerfReporter implements Reporter {
  #workers = 0;
  #runStart = 0;
  #files = new Map<string, FileStat>();
  #tests: TestStat[] = [];
  // Busy time per worker index. Retries and hooks run on a worker too, so this sums every result.
  #workerBusy = new Map<number, number>();
  #rootDir = '';

  onBegin(config: FullConfig, _suite: Suite): void {
    this.#workers = config.workers;
    this.#rootDir = config.rootDir;
    this.#runStart = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Skipped tests never ran, so counting them would understate the average cost of a real test.
    if (result.status === 'skipped') return;

    const file = test.location.file.startsWith(this.#rootDir)
      ? test.location.file.slice(this.#rootDir.length + 1)
      : test.location.file;

    const fileStat = this.#files.get(file) ?? { count: 0, duration: 0 };
    fileStat.count += 1;
    fileStat.duration += result.duration;
    this.#files.set(file, fileStat);

    this.#workerBusy.set(result.workerIndex, (this.#workerBusy.get(result.workerIndex) ?? 0) + result.duration);

    this.#tests.push({
      title: test.titlePath().slice(3).join(' › '),
      file,
      line: test.location.line,
      duration: result.duration,
      workerIndex: result.workerIndex,
    });
  }

  onEnd(_result: FullResult): void {
    if (this.#tests.length === 0) return;

    const wallClock = Date.now() - this.#runStart;
    const totalWork = this.#tests.reduce((sum, t) => sum + t.duration, 0);
    // With perfect packing and no per-worker overhead, the run cannot finish sooner than this.
    const floor = totalWork / this.#workers;
    const efficiency = (floor / wallClock) * 100;

    const lines: string[] = [];
    lines.push('');
    lines.push('──────────────── E2E performance profile ────────────────');
    lines.push(`  workers:            ${this.#workers}`);
    lines.push(`  tests run:          ${this.#tests.length}`);
    lines.push(`  total test time:    ${seconds(totalWork)} (${minutes(totalWork)})`);
    lines.push(`  wall clock:         ${seconds(wallClock)} (${minutes(wallClock)})`);
    lines.push(`  perfect-packing floor: ${seconds(floor)} — wall clock is ${(wallClock / floor).toFixed(2)}x it`);
    lines.push(`  packing efficiency: ${efficiency.toFixed(0)}%`);
    lines.push('');

    lines.push('  Worker utilization (busy time / wall clock):');
    for (const [index, busy] of [...this.#workerBusy.entries()].sort((a, b) => a[0] - b[0])) {
      const pct = ((busy / wallClock) * 100).toFixed(0);
      lines.push(`    worker ${String(index).padStart(2)}: ${seconds(busy).padStart(8)}  ${pct.padStart(3)}%`);
    }
    lines.push('');

    lines.push(`  Slowest files (of ${this.#files.size}), by total test time:`);
    const files = [...this.#files.entries()].sort((a, b) => b[1].duration - a[1].duration);
    for (const [file, stat] of files.slice(0, SLOWEST_FILES_TO_PRINT)) {
      const share = ((stat.duration / totalWork) * 100).toFixed(1);
      lines.push(
        `    ${seconds(stat.duration).padStart(8)}  ${String(stat.count).padStart(3)} tests  ` +
          `avg ${seconds(stat.duration / stat.count).padStart(7)}  ${share.padStart(4)}%  ${file}`
      );
    }
    lines.push('');

    lines.push(`  Slowest ${SLOWEST_TESTS_TO_PRINT} tests:`);
    for (const t of [...this.#tests].sort((a, b) => b.duration - a.duration).slice(0, SLOWEST_TESTS_TO_PRINT)) {
      lines.push(`    ${seconds(t.duration).padStart(8)}  ${t.file}:${t.line} › ${t.title}`);
    }
    lines.push('─────────────────────────────────────────────────────────');
    lines.push('');

    console.log(lines.join('\n'));
  }
}
