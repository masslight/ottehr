// Harvested-corpus runner: real transcripts through the real endpoint and the real executor, scored
// against what the clinician actually charted.
//
// PHI: case and result files contain production clinical text and must stay gitignored; check with
// `git check-ignore -v tools/easy-chart-eval/harvested-cases/case001.json` before committing.
//
// Usage:
//   npx tsx tools/easy-chart-eval/run-harvested.ts --token "$TOKEN"
//   npx tsx tools/easy-chart-eval/run-harvested.ts --cases case001,case019      # subset / retries
//   npx tsx tools/easy-chart-eval/run-harvested.ts --limit 5                    # smoke test
//   npx tsx tools/easy-chart-eval/run-harvested.ts --quality OK                  # only screened-good cases
//   npx tsx tools/easy-chart-eval/run-harvested.ts --rescore                    # no model calls
//
// A full run takes hours and uses real model tokens. Re-run failed cases with --cases: results land in the
// same directory and the summary is rebuilt from every score file present.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NoteTextField } from 'utils/lib/easy-chart/actions';
import {
  ChartPlanRequest,
  ChartPlanResponse,
  ChartReviewRequest,
  ChartReviewResponse,
  EscalationInfo,
  PatientStatus,
  PlannedAction,
} from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { buildChartSnapshot } from '../../apps/ehr/src/features/easy-chart/executor/chartSnapshot';
import { runPlan } from '../../apps/ehr/src/features/easy-chart/executor/runPlan';
import { GoldData } from './gold-types';
import { buildEvalContext } from './harness';
import type { SimFinalState } from './score-harvested';
import {
  aggregateScores,
  CaseScore,
  EvalTokenUsage,
  formatCaseLine,
  formatSummary,
  scoreCase,
} from './score-harvested';
import { foldStepsIntoState } from './sim-state';
import { simStateToChartData } from './sim-to-chart';
import { mintToken } from './token';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, 'harvested-cases');

interface HarvestedCase {
  caseId: string;
  transcript: string;
  gold: GoldData;
  meta?: { patientStatus?: string };
}

/**
 * New vs established: the harvested status if present, else the gold E&M code's family. The family is
 * context the provider had before coding; the scored level (the last digit) is not revealed.
 */
function resolvePatientStatus(evalCase: HarvestedCase): PatientStatus | undefined {
  const harvested = evalCase.meta?.patientStatus;
  if (harvested === 'new' || harvested === 'established') return harvested;
  const code = evalCase.gold.billing?.emCode?.code ?? '';
  if (/^9920\d$/.test(code)) return 'new';
  if (/^9921\d$/.test(code)) return 'established';
  return undefined;
}

interface Options {
  url: string;
  token: string;
  outDir: string;
  only?: string[];
  /** Only cases whose `quality.verdict` (stamped by case-quality.ts) is one of these. */
  quality?: string[];
  limit?: number;
  rescore: boolean;
  /** Skip the review pass, to isolate a planner change. */
  skipReview: boolean;
  /** Cases run at once. Too high and the model starts timing out. */
  concurrency: number;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const rescore = argv.includes('--rescore');
  const token = get('--token') ?? process.env.EASY_CHART_EVAL_TOKEN ?? '';
  const only = get('--cases')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const quality = get('--quality')
    ?.split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  const limit = get('--limit') ? Number(get('--limit')) : undefined;
  return {
    url: get('--url') ?? process.env.EASY_CHART_EVAL_URL ?? 'http://localhost:3000',
    token,
    outDir: get('--out') ?? join(HERE, 'harvested-results'),
    only,
    quality,
    limit,
    rescore,
    skipReview: argv.includes('--no-review'),
    concurrency: Math.max(1, Number(get('--concurrency') ?? 1) || 1),
  };
}

function loadCases(options: Options): HarvestedCase[] {
  if (!existsSync(CASES_DIR)) {
    throw new Error(`No corpus at ${CASES_DIR}. It is PHI and is never committed — unzip it there first.`);
  }
  let files = readdirSync(CASES_DIR)
    .filter((name) => /^case\d+\.json$/.test(name))
    .sort();
  if (options.only) files = files.filter((name) => options.only!.includes(name.replace('.json', '')));
  if (options.quality) {
    const before = files.length;
    files = files.filter((name) => {
      const q = (JSON.parse(readFileSync(join(CASES_DIR, name), 'utf8')) as { quality?: { verdict?: string } }).quality;
      // An unstamped case is excluded: the filter guarantees a known corpus.
      return q?.verdict !== undefined && options.quality!.includes(q.verdict);
    });
    console.log(
      `--quality ${options.quality.join(',')}: ${
        files.length
      } of ${before} cases (run case-quality.ts --stamp if this is 0)`
    );
  }
  // `--limit 0` means no cases, not no limit.
  if (options.limit !== undefined) files = files.slice(0, options.limit);
  return files.map((name) => JSON.parse(readFileSync(join(CASES_DIR, name), 'utf8')) as HarvestedCase);
}

/** The local zambda server wraps a result as `{ status, output }`; deployed zambdas do not. */
function unwrap<T>(body: unknown): T {
  const wrapper = body as { output?: T };
  return wrapper && typeof wrapper === 'object' && 'output' in wrapper ? (wrapper.output as T) : (body as T);
}

async function plan(options: Options, request: ChartPlanRequest): Promise<ChartPlanResponse> {
  const response = await fetch(`${options.url}/local/zambda/easy-chart-plan/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`easy-chart-plan returned ${response.status}: ${text.slice(0, 300)}`);
  return unwrap<ChartPlanResponse>(JSON.parse(text));
}

interface RunResult {
  score: CaseScore;
  planSteps: number;
  reviewSuggestions: number;
}

/** The chart fields the review endpoint needs, rendered from the simulated state by the production code. */
function chartContextFrom(state: SimFinalState): {
  chartState?: string;
  chartedExamFindings?: string[];
  noteContext?: Record<string, string>;
} {
  const chart = simStateToChartData(state);
  const examFindings = chartedExamFindingLabels(chart);
  return {
    chartState: buildChartStateSummary(chart),
    ...(examFindings.length > 0 ? { chartedExamFindings: examFindings } : {}),
    noteContext: buildNoteContextFromChart(chart),
  };
}

async function review(options: Options, request: ChartReviewRequest): Promise<ChartReviewResponse> {
  const response = await fetch(`${options.url}/local/zambda/easy-chart-review/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`easy-chart-review returned ${response.status}: ${text.slice(0, 300)}`);
  return unwrap<ChartReviewResponse>(JSON.parse(text));
}

async function runOne(options: Options, evalCase: HarvestedCase): Promise<RunResult> {
  // The transcript is the only input and the chart starts empty, as it did for the provider. The corpus
  // has no encounter id (PHI), so the patient status is passed explicitly.
  const patientStatus = resolvePatientStatus(evalCase);
  const response = await plan(options, {
    narrative: evalCase.transcript,
    ...(patientStatus ? { patientStatus } : {}),
  });

  const { context } = buildEvalContext();
  const planRun = await runPlan(response.actions, context);
  const state = foldStepsIntoState(planRun.steps, 'planner');

  // The review pass, folded into the same state with source 'review'. In the app review only proposes,
  // so `final` is the upper bound: the note if every suggestion were accepted.
  let reviewSuggestions = 0;
  let reviewRejected: ChartReviewResponse['rejected'] = [];
  let reviewTriggers: ChartReviewResponse['triggers'] = [];
  let reviewEscalation: ChartReviewResponse['escalation'] | undefined;
  let reviewUsage: ChartReviewResponse['usage'] = [];
  let dispositionTrigger: { fired: boolean; matchedPattern?: string; modelProposed: boolean } | null = null;
  const readDispositionTrigger = (triggers: ChartPlanResponse['triggers'] | undefined): void => {
    const hit = triggers?.find((trigger) => trigger.trigger === 'disposition-language-without-disposition');
    // Review's trigger fires only when a disposition is still owed, so its not-fired must not erase the
    // planner's fired-and-charted.
    if (!hit || (dispositionTrigger?.fired && !hit.fired)) return;
    dispositionTrigger = {
      fired: hit.fired,
      ...(hit.matchedPattern ? { matchedPattern: hit.matchedPattern } : {}),
      modelProposed: hit.complied,
    };
  };
  readDispositionTrigger(response.triggers);
  if (!options.skipReview) {
    try {
      const reviewContext = chartContextFrom(state);
      const reviewResponse = await review(options, {
        narrative: evalCase.transcript,
        ...(patientStatus ? { patientStatus } : {}),
        ...reviewContext,
      });
      reviewSuggestions = reviewResponse.suggestions.length;
      reviewRejected = reviewResponse.rejected;
      reviewTriggers = reviewResponse.triggers;
      reviewEscalation = reviewResponse.escalation;
      reviewUsage = reviewResponse.usage;
      readDispositionTrigger(reviewResponse.triggers);
      // A review rewrite of a note field that already has text is held for the provider to confirm, not
      // applied, so it is recorded as pending rather than scored as charted.
      const written = reviewContext.noteContext ?? {};
      const reviewActions: PlannedAction[] = [];
      for (const action of reviewResponse.suggestions.flatMap((suggestion) => suggestion.actions ?? [])) {
        if (action.kind === 'edit-note-text' && action.field && written[action.field]?.trim()) {
          state.pendingNoteEdits.push({
            field: action.field as NoteTextField,
            newText: action.newText ?? '',
            source: 'review',
          });
        } else {
          reviewActions.push(action);
        }
      }
      if (reviewActions.length > 0) {
        // Against the chart the first pass left, so a removal resolves against the row actually charted.
        const reviewRun = await runPlan(reviewActions, {
          ...context,
          chart: buildChartSnapshot(simStateToChartData(state)),
        });
        foldStepsIntoState(reviewRun.steps, 'review', state);
      }
    } catch (error) {
      // A failed review must not lose the plan's score for this case.
      console.error(`  review failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const score = scoreCase(
    evalCase.caseId,
    evalCase.gold,
    state,
    {
      planner: tokenUsage(response.usage, response.escalation),
      review: tokenUsage(reviewUsage, reviewEscalation),
    },
    dispositionTrigger
  );

  writeFileSync(
    join(options.outDir, `${evalCase.caseId}.result.json`),
    JSON.stringify(
      { actions: response.actions, rejected: response.rejected, reviewRejected, reviewTriggers, state },
      null,
      2
    )
  );
  writeFileSync(
    join(options.outDir, `${evalCase.caseId}.score.json`),
    JSON.stringify(
      {
        ...score,
        patientStatusSent: patientStatus ?? null,
        patientStatusSource: evalCase.meta?.patientStatus ? 'harvested' : patientStatus ? 'gold-family' : 'none',
      },
      null,
      2
    )
  );
  return { score, planSteps: planRun.steps.length, reviewSuggestions };
}

/** One surface's token usage, summed over its calls, in the scorer's shape. */
function tokenUsage(
  usage: ChartPlanResponse['usage'],
  escalation: EscalationInfo | undefined
): EvalTokenUsage | undefined {
  const first = usage[0];
  if (!first) return undefined;
  const sum = (field: 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'thinkingTokens'): number =>
    usage.reduce((total, entry) => total + (entry[field] ?? 0), 0);
  return {
    provider: first.provider === 'anthropic' ? 'claude' : 'gemini',
    model: first.model,
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    cacheReadTokens: sum('cacheReadTokens'),
    thinkingTokens: sum('thinkingTokens'),
    calls: usage.reduce((total, entry) => total + entry.calls, 0),
    escalation: escalationRecord(escalation),
  };
}

/** `EscalationInfo` in the scorer's shape: escalated means the primary failed; the first failure is the reason. */
function escalationRecord(info: EscalationInfo | undefined): EvalTokenUsage['escalation'] {
  if (!info) return undefined;
  return {
    escalated: info.escalated,
    attempts: info.attempts,
    primaryAttempts: info.attempts,
    primaryFailed: info.escalated,
    ...(info.failures?.length ? { reason: info.failures[0] } : {}),
  };
}

/**
 * Re-score a run from disk without model calls. The simulated chart comes from the result file; what
 * only the live run knew (usage, escalation, triggers, patient status) is carried over from the old score.
 */
function loadScores(outDir: string): CaseScore[] {
  return readdirSync(outDir)
    .filter((name) => name.endsWith('.score.json'))
    .sort()
    .map((name) => {
      const previous = JSON.parse(readFileSync(join(outDir, name), 'utf8')) as CaseScore & Record<string, unknown>;
      const resultPath = join(outDir, name.replace('.score.json', '.result.json'));
      const casePath = join(CASES_DIR, `${previous.caseId}.json`);
      if (!existsSync(resultPath) || !existsSync(casePath)) return previous;
      const { state } = JSON.parse(readFileSync(resultPath, 'utf8')) as { state?: SimFinalState };
      if (!state) return previous;
      const { gold } = JSON.parse(readFileSync(casePath, 'utf8')) as HarvestedCase;
      const rescored = {
        ...scoreCase(previous.caseId, gold, state, previous.usage, previous.dispositionTrigger ?? undefined),
        patientStatusSent: previous.patientStatusSent ?? null,
        patientStatusSource: previous.patientStatusSource ?? 'none',
      };
      writeFileSync(join(outDir, name), JSON.stringify(rescored, null, 2));
      return rescored;
    });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.outDir, { recursive: true });
  if (!options.token && !options.rescore) {
    options.token = await mintToken();
    console.log('Minted an M2M token from the environment.');
  }

  let scores: CaseScore[];
  if (options.rescore) {
    scores = loadScores(options.outDir);
    console.log(`Rescoring ${scores.length} existing case scores — no model calls.`);
  } else {
    const cases = loadCases(options);
    console.log(
      `${cases.length} cases → ${options.url}${options.concurrency > 1 ? ` (concurrency ${options.concurrency})` : ''}`
    );
    scores = [];
    // A worker pool: cases are independent, and the limit keeps the run under the model's rate limit.
    const queue = [...cases];
    const worker = async (): Promise<void> => {
      for (;;) {
        const evalCase = queue.shift();
        if (!evalCase) return;
        try {
          const result = await runOne(options, evalCase);
          scores.push(result.score);
          console.log(formatCaseLine(result.score, result.planSteps, result.reviewSuggestions));
        } catch (error) {
          // One case must not end a run that costs hours; re-run it later with --cases.
          console.error(`${evalCase.caseId}: FAILED — ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(options.concurrency, cases.length) }, worker));
    // Include earlier partial runs so an interleaved retry summarises the whole corpus.
    scores = loadScores(options.outDir);
  }

  if (scores.length === 0) {
    console.log('No scores to summarise.');
    return;
  }
  const summary = aggregateScores(scores);
  writeFileSync(join(options.outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(formatSummary(summary));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
