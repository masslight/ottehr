/**
 * Autochart acceptance test: transcript → easy-chart-plan actions, on the recordings in autochart-cases/
 * (expectations derived from their signed charts plus what was said and never charted; `--dump-expectations`
 * prints them; autochart-tests.md explains how the cases were made and how the checks score). The source of the "Autochart Plan" card on the AI accuracy
 * dashboard when the CI repo's nightly workflow runs it with --json-out.
 *
 * Only the AI boundary is measured: the plan endpoint's actions after its guards, which is what the
 * recommendations panel maps into rows. What happens after the provider clicks Chart (the executor, the
 * chart writes) is deterministic and covered by unit tests, not here.
 *
 * Three calls per case, all against a real (throwaway) encounter for the case's patient:
 *   1. the recording path: the transcript is the plan's narrative — the checks on the dashboard;
 *   2. the typed-narrative path: the generated narrative is the plan's narrative, no transcript — reported,
 *      so a narrative that loses what the planner needs shows up next to the transcript path;
 *   3. the corrections path, for cases with `edits`: the generated narrative is edited the way a provider
 *      would and sent as providerEdits — the plan must follow the correction.
 *
 * The model is not deterministic (thinking is on): the same prompt has produced between 28 and 38 actions
 * across calls. `--repeat N` runs the recording path N times per case and reports each check's pass count,
 * so a check that passes in some runs and not others reads as flaky rather than as a regression. With
 * repeats the dashboard's `total` is checks × N and `passed` the sum, i.e. the line is the mean pass rate.
 *
 * A failed check prints what the plan charted of the same kind instead, where each ROS or exam finding
 * would resolve in the product's catalogues (`→ key`), what the guards refused, and, for a medication, the
 * instruction or note it landed in as text — enough to tell a model miss from a matcher gap or a refusal.
 *
 * Requires the local zambda server (default port 3000, or --url http://localhost:3010):
 *   cd packages/zambdas && npx tsx src/local-server/index.ts -- secrets=.env/zambda-secrets-local.json
 *
 * Usage:
 *   npx tsx scripts/tests/test-autochart-plan.ts [--env local] [--url http://localhost:3010] [--report out.html]
 *     [--json-out results.json] [--cases id1,id2] [--concurrency 2] [--repeat 1]
 *     [--skip-narrative-paths] [--verbose]
 */

import * as fs from 'fs';
import type { ChartNarrativeResponse, ChartPlanResponse } from 'utils/lib/easy-chart/api';
import { AutochartCase } from './autochart-case-file';
import { buildReport, geminiFromArgs, judgeActions, RawCase, renderPage } from './autochart-report-html';
import {
  actionMatches,
  Check,
  checkPlan,
  createCaseEncounter,
  describeExpectation,
  describeTally,
  foldChecks,
  FoldedCheck,
  mapWithConcurrency,
  parseSuiteArgs,
  printChecks,
  printFolded,
  Refusal,
  SCORED_TAGS,
  summarizeAction,
  tally,
  tallyByTag,
  unscoredExtras,
} from './autochart-shared';
import { callZambda, getToken } from './shared';

const args = parseSuiteArgs(process.argv);
const skipNarrativePaths = process.argv.includes('--skip-narrative-paths');
const dumpExpectations = process.argv.includes('--dump-expectations');
const reportAt = process.argv.indexOf('--report');
const reportPath = reportAt !== -1 ? process.argv[reportAt + 1] : undefined;
const skipJudge = process.argv.includes('--skip-judge');
const repeatFlag = process.argv.indexOf('--repeat');
const repeats = Math.max(1, Number(repeatFlag !== -1 ? process.argv[repeatFlag + 1] : 1) || 1);

interface PathResult {
  checks: Check[];
  extras: string[];
  actionCount: number;
  refusals: Refusal[];
  /** Every action, compactly, so a failed check can be read without re-running the case. */
  actions: string[];
  /** Which model answered and whether the call escalated to the backup — a different measurement. */
  models: string[];
  escalated: boolean;
}

interface EditResult {
  label: string;
  status: 'checked' | 'skipped';
  checks: Check[];
}

interface CaseResult {
  id: string;
  label: string;
  /** The recording path, once per repeat. */
  transcriptRuns: PathResult[];
  fromNarrative?: PathResult;
  edits: EditResult[];
  /** The first transcript run and the narrative lines, raw, for `--report`. */
  raw?: RawCase;
  error?: string;
}

const draftOf = (narrative: ChartNarrativeResponse): string =>
  narrative.lines
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join(' ');

/** One retry after a short pause: a nightly sample lost to a DNS blip measures nothing. */
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    console.warn(`  call failed, retrying once: ${error instanceof Error ? error.message.slice(0, 120) : error}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return call();
  }
}

async function plan(token: string, body: Record<string, unknown>): Promise<ChartPlanResponse> {
  return withRetry(() => callZambda<ChartPlanResponse>('easy-chart-plan', token, { incremental: false, ...body }));
}

function evaluate(c: AutochartCase, response: ChartPlanResponse): PathResult {
  const refusals: Refusal[] = response.rejected.map((r) => ({ kind: r.kind, display: r.display, reason: r.reason }));
  return {
    checks: checkPlan(c, response.actions, refusals),
    extras: unscoredExtras(c, response.actions),
    actionCount: response.actions.length,
    refusals,
    actions: response.actions.map(summarizeAction),
    models: [...new Set(response.usage.map((u) => u.model))],
    escalated: response.escalation.escalated,
  };
}

async function runCase(token: string, c: AutochartCase): Promise<CaseResult> {
  const result: CaseResult = { id: c.id, label: c.label, transcriptRuns: [], edits: [] };
  const encounter = await createCaseEncounter(token, args.envConfig, c);
  try {
    for (let run = 0; run < repeats; run++) {
      const transcriptPlan = await plan(token, { narrative: c.transcript, encounterId: encounter.encounterId });
      const evaluated = evaluate(c, transcriptPlan);
      result.transcriptRuns.push(evaluated);
      if (run === 0) {
        result.raw = {
          id: c.id,
          actions: transcriptPlan.actions,
          refusals: evaluated.refusals,
          models: evaluated.models,
          narrative: [],
        };
      }
    }

    if (!skipNarrativePaths) {
      const narrative = await withRetry(() =>
        callZambda<ChartNarrativeResponse>('easy-chart-narrative', token, {
          transcript: c.transcript,
          encounterId: encounter.encounterId,
        })
      );
      const draft = draftOf(narrative);
      if (result.raw) result.raw.narrative = narrative.lines;

      const narrativePlan = await plan(token, { narrative: draft, encounterId: encounter.encounterId });
      result.fromNarrative = evaluate(c, narrativePlan);

      for (const edit of c.edits) {
        if (!edit.find.test(draft)) {
          result.edits.push({ label: edit.label, status: 'skipped', checks: [] });
          continue;
        }
        const edited = draft.replace(edit.find, edit.replace);
        const editedPlan = await plan(token, {
          narrative: c.transcript,
          encounterId: encounter.encounterId,
          providerEdits: { draft, edited },
        });
        const medications = editedPlan.actions
          .filter((a) => a.kind === 'add-medication')
          .map((a) => summarizeAction(a))
          .join(' | ');
        const checks: Check[] = [
          ...edit.expected.map(
            (e): Check => ({
              label: `after edit, expects ${describeExpectation(e)}`,
              passed: editedPlan.actions.some((a) => actionMatches(a, e)),
              tag: 'said',
              detail: `medications charted: ${medications || 'none'}`,
            })
          ),
          ...edit.forbidden.map(
            (e): Check => ({
              label: `after edit, must not chart ${describeExpectation(e)}`,
              passed: !editedPlan.actions.some((a) => actionMatches(a, e)),
              tag: 'forbidden',
            })
          ),
        ];
        result.edits.push({ label: edit.label, status: 'checked', checks });
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    await encounter.cleanup().catch((error) => console.warn(`  [${c.id}] cleanup failed: ${error}`));
  }
  return result;
}

/** Per-check pass counts across the repeats of the recording path, in the checks' order. */
const foldRepeats = (runs: PathResult[]): FoldedCheck[] => foldChecks(runs.map((run) => run.checks));

const describeModels = (run: PathResult): string => `${run.models.join('+')}${run.escalated ? ', ESCALATED' : ''}`;

function printCase(result: CaseResult): void {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${result.id}: ${result.label}`);
  console.log('─'.repeat(72));
  if (result.error) console.log(`  ERROR: ${result.error}`);
  if (result.transcriptRuns.length === 0) return;

  const folded = foldRepeats(result.transcriptRuns);
  const shapes = result.transcriptRuns.map(
    (r) => `${r.actionCount} actions, ${r.refusals.length} refused, ${describeModels(r)}`
  );
  const allRuns = result.transcriptRuns.flatMap((r) => r.checks);
  console.log(
    `  transcript path:  ${describeTally(allRuns)} over ${result.transcriptRuns.length} run(s)  (${shapes.join(' / ')})`
  );
  printFolded(folded);
  const extras = [...new Set(result.transcriptRuns.flatMap((r) => r.extras))];
  if (extras.length) console.log(`    not scored (ros/exam not in the chart, class-named drugs): ${extras.join('; ')}`);
  if (args.verbose) {
    result.transcriptRuns.forEach((run, i) => {
      console.log(`    run ${i + 1} actions:\n      ${run.actions.join('\n      ')}`);
      if (run.refusals.length) {
        console.log(
          `    run ${i + 1} refused: ${run.refusals
            .map((r) => `${r.kind} ${r.display ?? ''}: ${r.reason}`)
            .join(' | ')}`
        );
      }
    });
  }
  if (result.fromNarrative) {
    console.log(
      `  narrative path:   ${describeTally(result.fromNarrative.checks)}  (${
        result.fromNarrative.actionCount
      } actions, ${describeModels(result.fromNarrative)})`
    );
    printChecks(result.fromNarrative.checks);
  }
  for (const edit of result.edits) {
    if (edit.status === 'skipped') {
      console.log(`  edit "${edit.label}": skipped (the generated narrative did not contain the phrase to edit)`);
      continue;
    }
    const et = tally(edit.checks);
    console.log(`  edit "${edit.label}": ${et.passed}/${et.total}`);
    printChecks(edit.checks);
  }
}

/** Prints what each case expects — derived from its signed chart plus what was said — and exits. For review. */
function printExpectations(): void {
  for (const c of args.cases) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(
      `${c.id}: ${c.label}  [${c.sourceCase}, ${c.status}, DOB ${c.dateOfBirth}, ${c.transcript.length} chars]`
    );
    console.log('─'.repeat(72));
    for (const note of c.notes) console.log(`  note: ${note}`);
    const groups: Record<string, string[]> = { voiced: [], said: [], unvoiced: [], context: [] };
    for (const t of [...c.expected, ...c.context]) {
      groups[t.tag].push(
        `${describeExpectation(t.expectation)}${t.label ? `  «${t.label}»` : ''}  [${t.from}]${
          t.note ? `  — ${t.note}` : ''
        }`
      );
    }
    for (const tag of ['voiced', 'said', 'unvoiced', 'context']) {
      console.log(`  ${tag} (${groups[tag].length}):`);
      for (const line of groups[tag]) console.log(`    ${line}`);
    }
    if (c.droppedFromGold.length) {
      console.log(`  dropped from gold (${c.droppedFromGold.length}):`);
      for (const d of c.droppedFromGold) console.log(`    ${d.label}  — ${d.reason}`);
    }
    console.log(`  allowed (${c.allowed.length}):`);
    for (const e of c.allowed) console.log(`    ${describeExpectation(e)}`);
    const chartFacts = c.facts.filter((f) => f.tag === 'voiced');
    console.log(
      `  narrative facts from the chart (${chartFacts.length}): ${chartFacts.map((f) => f.pattern).join(' ')}`
    );
    console.log(`  narrative facts from the file (${c.narrativeFacts.length}): ${c.narrativeFacts.join(' ')}`);
    for (const e of c.edits) {
      const forbidden = e.forbidden.length ? `; must not chart ${e.forbidden.map(describeExpectation).join(', ')}` : '';
      console.log(
        `  edit "${e.label}": ${e.find} → "${e.replace}"; expects ${e.expected
          .map(describeExpectation)
          .join(', ')}${forbidden}`
      );
    }
  }
}

/**
 * The per-case HTML page (autochart-report-html.ts) for this run: the first transcript run of every case, the
 * narrative lines when the narrative paths ran, and the judge's verdicts unless --skip-judge. The raw run is
 * saved beside it as `<report>.json`, which autochart-report.ts --from re-renders without the AI.
 */
async function writeReport(results: CaseResult[]): Promise<void> {
  const gemini = geminiFromArgs(args.envConfig, process.argv);
  const byId = new Map(args.cases.map((c) => [c.id, c]));
  const raws = results.filter((r) => r.raw).map((r) => r.raw!);
  if (!skipJudge) {
    await mapWithConcurrency(raws, args.concurrency, async (raw) => {
      const c = byId.get(raw.id);
      if (c) raw.judge = await judgeActions(c.transcript, raw.actions, gemini);
    });
  }
  const reports = raws.map((raw) => buildReport(byId.get(raw.id)!, raw));
  fs.writeFileSync(reportPath!, renderPage(reports));
  fs.writeFileSync(`${reportPath}.json`, JSON.stringify(raws, null, 2));
  console.log(`  Report: ${reportPath} (raw run beside it as ${reportPath}.json)`);
}

async function main(): Promise<void> {
  if (dumpExpectations) {
    printExpectations();
    return;
  }
  const token = await getToken(args.envConfig);
  console.log(`Autochart plan: ${args.cases.length} case(s), concurrency ${args.concurrency}, ${repeats} repeat(s)`);

  // Printed as each case completes, so a long run over the corpus leaves its trace even if it is cut short.
  const results = await mapWithConcurrency(args.cases, args.concurrency, async (c) => {
    const result = await runCase(token, c);
    printCase(result);
    return result;
  });

  const transcriptChecks = results.flatMap((r) => r.transcriptRuns.flatMap((run) => run.checks));
  const narrativeChecks = results.flatMap((r) => r.fromNarrative?.checks ?? []);
  const editChecks = results.flatMap((r) => r.edits.flatMap((e) => e.checks));
  const editsSkipped = results.flatMap((r) => r.edits).filter((e) => e.status === 'skipped').length;
  const errors = results.filter((r) => r.error).length;
  const flaky = results.flatMap((r) =>
    foldRepeats(r.transcriptRuns).filter((f) => SCORED_TAGS.includes(f.tag) && f.passes > 0 && f.passes < f.runs)
  );
  const all = tally(transcriptChecks);
  const byTag = tallyByTag(transcriptChecks);
  const fromNarrative = tally(narrativeChecks);
  const edits = tally(editChecks);

  console.log(`\n${'═'.repeat(72)}`);
  console.log(
    `  Transcript path: ${describeTally(transcriptChecks)} across ${results.length} cases × ${repeats} run(s)`
  );
  if (repeats > 1) console.log(`  Flaky checks (pass in some runs only): ${flaky.length}`);
  if (narrativeChecks.length) console.log(`  Narrative path:  ${describeTally(narrativeChecks)}`);
  if (editChecks.length || editsSkipped) {
    console.log(`  Provider edits:  ${edits.passed}/${edits.total} (${editsSkipped} skipped)`);
  }
  if (errors) console.log(`  Cases that errored: ${errors}`);
  console.log('═'.repeat(72));

  if (reportPath) await writeReport(results);

  if (args.jsonOutPath) {
    fs.writeFileSync(
      args.jsonOutPath,
      JSON.stringify(
        {
          suite: 'autochart-plan',
          timestamp: new Date().toISOString(),
          passed: all.passed,
          total: all.total,
          byTag,
          repeats,
          flaky: flaky.length,
          fromNarrative,
          edits: { ...edits, skipped: editsSkipped },
          cases: results.map((r) => ({
            id: r.id,
            error: r.error,
            transcript: foldRepeats(r.transcriptRuns)
              .filter((f) => f.passes < f.runs)
              .map((f) => `${f.label} (${f.passes}/${f.runs})${f.detail ? ` — ${f.detail}` : ''}`),
            transcriptRuns: r.transcriptRuns.map((run) => ({
              ...tally(run.checks),
              models: run.models,
              escalated: run.escalated,
              actions: run.actions,
              refusals: run.refusals,
              extras: run.extras,
            })),
            fromNarrative: r.fromNarrative && {
              ...tally(r.fromNarrative.checks),
              models: r.fromNarrative.models,
              escalated: r.fromNarrative.escalated,
              failed: r.fromNarrative.checks
                .filter((c) => !c.passed)
                .map((c) => `${c.label}${c.detail ? ` — ${c.detail}` : ''}`),
              actions: r.fromNarrative.actions,
              refusals: r.fromNarrative.refusals,
            },
            edits: r.edits.map((e) => ({ label: e.label, status: e.status, ...tally(e.checks) })),
          })),
        },
        null,
        2
      )
    );
  }

  if (all.passed < all.total || errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
