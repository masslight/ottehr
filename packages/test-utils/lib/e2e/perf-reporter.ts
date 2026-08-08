import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/**
 * Prints a compact performance profile at the end of a Playwright run.
 *
 * The stock reporters tell you whether the suite passed, not where its wall clock went. The two
 * numbers that actually drive E2E CI time are (a) total test-seconds — the work the suite does,
 * which per-test setup duplication inflates — and (b) how well that work packs into the available
 * workers, which serial describes and a long tail of slow tests degrade. This reporter reports both,
 * plus the per-file and per-test breakdowns needed to decide which of the two to attack.
 *
 * It also attributes each test's time across Playwright's step categories. Per-test totals alone
 * cannot distinguish a suite that got slower from an environment that got slower: a run once came in
 * 88% above the previous one with the same tests, the same attempt count and no retries, and there
 * was nothing in the output to say why. The category split answers that directly — `pw:api` time
 * rising means the app or the server serving it got slower, `expect` time rising means assertions
 * spent longer waiting for data to show up, and `hook` time rising means setup got more expensive.
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

interface StepStat {
  count: number;
  exclusive: number;
}

const SLOWEST_TESTS_TO_PRINT = 20;
const SLOWEST_FILES_TO_PRINT = 20;
const SLOWEST_OPERATIONS_TO_PRINT = 15;
const SLOWEST_HOOKS_TO_PRINT = 15;
// Categories worth grouping call-by-call. `hook` and `fixture` titles name the specific hook, which
// the per-file breakdown already localizes; `pw:api` and `expect` are where a run-over-run
// regression actually shows up.
const OPERATION_CATEGORIES = new Set(['pw:api', 'expect']);

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function minutes(ms: number): string {
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Playwright renders API steps as `page.goto(http://…)` or `locator.click`, and assertions as
 * `expect.toBeVisible`. The arguments are per-call noise; the callee is what's worth grouping by.
 */
function operationName(title: string): string {
  // `Click locator('#b')` → `Click`; `Expect "toHaveText" locator('#t')` → `Expect "toHaveText"`.
  // Cutting at the argument list leaves the locator builder dangling, and which element was clicked
  // is per-call detail the slowest-tests list already carries.
  const withoutArgs = title.split('(')[0].trim();
  const withoutLocator = withoutArgs.replace(/\s*\b(locator|frameLocator|getBy\w+)$/, '').trim();
  return withoutLocator.length > 58 ? `${withoutLocator.slice(0, 57)}…` : withoutLocator;
}

/**
 * Steps nest — an `expect` can contain the `pw:api` calls it retried — so summing raw durations
 * would count the same milliseconds under several categories at once. Exclusive time (a step's own
 * duration minus its children's) attributes each millisecond exactly once, which is what makes the
 * category totals add up to something comparable across runs.
 */
function walkSteps(steps: TestStep[], visit: (step: TestStep, exclusive: number) => void): void {
  for (const step of steps) {
    const childDuration = step.steps.reduce((sum, child) => sum + child.duration, 0);
    visit(step, Math.max(0, step.duration - childDuration));
    walkSteps(step.steps, visit);
  }
}

export default class PerfReporter implements Reporter {
  #workers = 0;
  #runStart = 0;
  #files = new Map<string, FileStat>();
  #tests: TestStat[] = [];
  // Busy time per worker index. Retries and hooks run on a worker too, so this sums every result.
  #workerBusy = new Map<number, number>();
  #categories = new Map<string, StepStat>();
  #operations = new Map<string, StepStat>();
  // Hook time keyed by file and hook, because "hooks are 27% of the suite" is not yet an action. A
  // hook that is expensive once per file is a different problem from one that is cheap but paid by
  // every worker, and only the per-file split tells them apart.
  #hooks = new Map<string, StepStat>();
  // Time inside a test that no step accounts for: test-body JavaScript, direct FHIR calls, hand
  // written waits. Accumulated per test and clamped there, because a single test can carry more step
  // time than its own duration (see #attributed below) and one such test would otherwise wipe out
  // the signal for every other.
  #testBody = 0;
  #attributed = 0;
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

    let attributedHere = 0;
    walkSteps(result.steps, (step, exclusive) => {
      attributedHere += exclusive;

      const category = this.#categories.get(step.category) ?? { count: 0, exclusive: 0 };
      category.count += 1;
      category.exclusive += exclusive;
      this.#categories.set(step.category, category);

      if (step.category === 'hook') {
        const hookKey = `${file} › ${step.title}`;
        const hook = this.#hooks.get(hookKey) ?? { count: 0, exclusive: 0 };
        hook.count += 1;
        hook.exclusive += exclusive;
        this.#hooks.set(hookKey, hook);
      }

      if (!OPERATION_CATEGORIES.has(step.category)) return;
      const key = `${step.category}  ${operationName(step.title)}`;
      const operation = this.#operations.get(key) ?? { count: 0, exclusive: 0 };
      operation.count += 1;
      operation.exclusive += exclusive;
      this.#operations.set(key, operation);
    });
    this.#attributed += attributedHere;
    this.#testBody += Math.max(0, result.duration - attributedHere);

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
    // A profile is only comparable to another profile from the same target. Which environment a run
    // landed on is chosen per run, so without it a run-over-run delta cannot be told apart from a
    // change of environment.
    lines.push(`  environment:        ${process.env.ENV ?? 'unknown'}`);
    lines.push(`  app under test:     ${process.env.WEBSITE_URL ?? 'unknown'}`);
    if (process.env.RUNNER_NAME) lines.push(`  runner:             ${process.env.RUNNER_NAME}`);
    if (process.env.GITHUB_SHA) lines.push(`  commit:             ${process.env.GITHUB_SHA.slice(0, 9)}`);
    // Set by scripts/run-e2e.ts. How the app was served is the single biggest lever on these numbers
    // — a dev server roughly doubles total test time versus a production bundle — so it belongs next
    // to them rather than thousands of log lines earlier where it may not survive a truncated fetch.
    lines.push(`  served from:        ${process.env.E2E_SERVE_MODE ?? 'unknown'}`);
    lines.push(`  tests run:          ${this.#tests.length}`);
    lines.push(`  total test time:    ${seconds(totalWork)} (${minutes(totalWork)})`);
    lines.push(`  wall clock:         ${seconds(wallClock)} (${minutes(wallClock)})`);
    lines.push(`  perfect-packing floor: ${seconds(floor)} — wall clock is ${(wallClock / floor).toFixed(2)}x it`);
    lines.push(`  packing efficiency: ${efficiency.toFixed(0)}%`);
    lines.push('');

    // Shares are of step time, not of total test time. The two differ on purpose: worker-scoped
    // fixture setup (launching a browser, say) is reported as a step of whichever test triggered it
    // but is not part of that test's duration, so step time can exceed test time. Dividing by test
    // time would print percentages over 100 and quietly misstate every row.
    const categories = [...this.#categories.entries()].sort((a, b) => b[1].exclusive - a[1].exclusive);
    const stepTime = this.#attributed + this.#testBody;
    lines.push('  Where the time went (exclusive, so each millisecond is counted once):');
    for (const [category, stat] of categories) {
      const share = ((stat.exclusive / stepTime) * 100).toFixed(1);
      lines.push(
        `    ${seconds(stat.exclusive).padStart(9)}  ${share.padStart(5)}%  ` +
          `${String(stat.count).padStart(6)} steps  ${category}`
      );
    }
    // A run that regresses here regressed outside the browser: data setup, FHIR calls made directly
    // from the test, hand-written waits. It is a lower bound — a test whose steps already exceed its
    // duration contributes zero rather than a negative.
    lines.push(
      `    ${seconds(this.#testBody).padStart(9)}  ${((this.#testBody / stepTime) * 100).toFixed(1).padStart(5)}%  ` +
        `${'—'.padStart(6)} steps  (test body, outside any step; lower bound)`
    );
    lines.push(
      `    step time totals ${seconds(stepTime)} against ${seconds(totalWork)} of test time; ` +
        'worker-scoped fixture setup is stepped but unbilled to any test'
    );
    lines.push('');

    if (this.#operations.size > 0) {
      lines.push(`  Slowest operations (of ${this.#operations.size}), by total exclusive time:`);
      const operations = [...this.#operations.entries()].sort((a, b) => b[1].exclusive - a[1].exclusive);
      for (const [key, stat] of operations.slice(0, SLOWEST_OPERATIONS_TO_PRINT)) {
        lines.push(
          `    ${seconds(stat.exclusive).padStart(9)}  ${String(stat.count).padStart(6)} calls  ` +
            `avg ${seconds(stat.exclusive / stat.count).padStart(7)}  ${key}`
        );
      }
      lines.push('');
    }

    if (this.#hooks.size > 0) {
      lines.push(`  Slowest hooks (of ${this.#hooks.size}), by total exclusive time:`);
      const hooks = [...this.#hooks.entries()].sort((a, b) => b[1].exclusive - a[1].exclusive);
      for (const [key, stat] of hooks.slice(0, SLOWEST_HOOKS_TO_PRINT)) {
        lines.push(
          `    ${seconds(stat.exclusive).padStart(9)}  ${String(stat.count).padStart(4)} runs  ` +
            `avg ${seconds(stat.exclusive / stat.count).padStart(7)}  ${key}`
        );
      }
      lines.push('');
    }

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
