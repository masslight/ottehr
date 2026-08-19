// Harvested-corpus runner: real transcripts through the real endpoint and the real executor, scored
// against what the clinician actually charted.
//
// PHI. Every case file and every result file contains production clinical text. `harvested-cases/` and
// the output directories are gitignored, and they must stay that way — verify with
// `git check-ignore -v tools/easy-chart-eval/harvested-cases/case001.json` before any commit.
//
// Usage:
//   npx tsx tools/easy-chart-eval/run-harvested.ts --token "$TOKEN"
//   npx tsx tools/easy-chart-eval/run-harvested.ts --cases case001,case019      # subset / retries
//   npx tsx tools/easy-chart-eval/run-harvested.ts --limit 5                    # smoke test
//   npx tsx tools/easy-chart-eval/run-harvested.ts --rescore                    # no model calls
//
// A full 191-case run takes hours and burns real model tokens. Expect ~10% of cases to fail on
// transient fetch errors: re-run just those with --cases, results interleave into the same directory,
// and the summary rebuilds from whatever score files are present.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChartPlanRequest, ChartPlanResponse, ChartReviewRequest, ChartReviewResponse } from 'utils/lib/easy-chart/api';
import { runPlan } from '../../apps/ehr/src/features/easy-chart/executor/runPlan';
import { GoldData } from './gold-types';
import { buildEvalContext } from './harness';
import type { SimFinalState } from './score-harvested';
import { aggregateScores, CaseScore, formatCaseLine, formatSummary, scoreCase } from './score-harvested';
import { foldStepsIntoState } from './sim-state';
import { mintToken } from './token';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, 'harvested-cases');

interface HarvestedCase {
  caseId: string;
  transcript: string;
  gold: GoldData;
}

interface Options {
  url: string;
  token: string;
  outDir: string;
  only?: string[];
  limit?: number;
  rescore: boolean;
  /** Skip the second look — useful for isolating a planner change without paying for review. */
  skipReview: boolean;
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
  const limit = get('--limit') ? Number(get('--limit')) : undefined;
  return {
    url: get('--url') ?? process.env.EASY_CHART_EVAL_URL ?? 'http://localhost:3000',
    token,
    outDir: get('--out') ?? join(HERE, 'harvested-results'),
    only,
    limit,
    rescore,
    skipReview: argv.includes('--no-review'),
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
  if (options.limit) files = files.slice(0, options.limit);
  return files.map((name) => JSON.parse(readFileSync(join(CASES_DIR, name), 'utf8')) as HarvestedCase);
}

/**
 * The local zambda server wraps a handler's result as `{ status, output }`; deployed zambdas return the
 * payload directly. Accept both, so the same runner works against either.
 */
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
  /** How many steps the plan had, for the per-case line. */
  planSteps: number;
  /** How many suggestions the review pass returned. */
  reviewSuggestions: number;
}

/**
 * Summarise the post-plan state for the review request, in the same shape the client sends.
 *
 * The review pass reads the note AS WRITTEN back against the narrative, so it must be told what the plan
 * just charted. Built from the folded state rather than from a live chart because the eval's writer is a
 * fake — nothing was actually persisted to read back.
 */
function reviewContextFrom(state: SimFinalState): { chartState?: string; noteContext?: Record<string, string> } {
  const lines: string[] = [];
  for (const dx of state.diagnoses.filter((d) => !d.removed)) {
    lines.push(`- Diagnosis: ${dx.display}${dx.isPrimary ? ' (primary)' : ''}${dx.code ? ` [${dx.code}]` : ''}`);
  }
  for (const item of state.allergies.filter((i) => !i.removed)) lines.push(`- Allergy: ${item.display}`);
  for (const item of state.conditions.filter((i) => !i.removed)) lines.push(`- Past medical history: ${item.display}`);
  for (const item of state.medications.filter((i) => !i.removed)) lines.push(`- Medication: ${item.display}`);
  for (const cpt of state.cptCodes.filter((c) => !c.removed)) lines.push(`- CPT: ${cpt.code ?? ''} ${cpt.display}`);
  const em = [...state.emEvents].reverse().find((e) => e.type === 'set');
  if (em) lines.push(`- E&M: ${em.code ?? ''} ${em.display ?? ''}`);
  if (state.disposition?.type) lines.push(`- Disposition: ${state.disposition.type}`);
  for (const lab of state.labsOrdered) lines.push(`- Lab ordered (${lab.kind}): ${lab.display}`);

  const noteContext: Record<string, string> = {};
  for (const [field, value] of Object.entries(state.noteText)) {
    if (value?.text?.trim()) noteContext[field] = value.text;
  }

  return {
    chartState: lines.length > 0 ? lines.join('\n') : undefined,
    noteContext: Object.keys(noteContext).length > 0 ? noteContext : undefined,
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
  // The transcript is the ONLY model input, and the case starts from an empty chart: that is what the
  // provider's own first pass had, so anything else would flatter the score.
  // The corpus carries `meta.patientStatus` but NO encounterId (only a hash, deliberately — PHI
  // posture), so the endpoint has no encounter to read and cannot derive new-vs-established itself.
  // Passing it explicitly is what makes the E&M family measurable: without it the prompt falls back to
  // the ESTABLISHED family and every new-patient case mismatches, which reads as a model failure and is
  // not one. The endpoint still prefers the chart whenever it can look the status up.
  const meta = (evalCase as { meta?: { patientStatus?: string } }).meta;
  const patientStatus =
    meta?.patientStatus === 'new' || meta?.patientStatus === 'established' ? meta.patientStatus : undefined;
  const response = await plan(options, {
    narrative: evalCase.transcript,
    incremental: false,
    ...(patientStatus ? { patientStatus } : {}),
  });

  const { context } = buildEvalContext();
  const planRun = await runPlan(response.actions, context);
  const state = foldStepsIntoState(planRun.steps, 'planner');

  // THE SECOND LOOK, folded into the SAME state with source 'review'.
  //
  // Why it must be here: the provider never sees the plan's output — they see the note AFTER review. A
  // score over the plan alone measures an intermediate state that nobody signs. The scorer's two scopes
  // then tell two different things: `planner` is what the first pass got right on its own, `final` is
  // what the note looks like once review has had its say, and the DELTA between them is the review's
  // value.
  //
  // Caveat worth knowing when reading `final`: in the app review output is a set of PROPOSALS the
  // provider accepts or ignores, so `final` is the UPPER BOUND — the note if every suggestion were
  // accepted. It is not a claim about what a given provider would keep.
  let reviewSuggestions = 0;
  if (!options.skipReview) {
    try {
      const reviewContext = reviewContextFrom(state);
      // Same status the planner got: without it review renders "PATIENT STATUS: unknown" and re-codes
      // every new patient into the established E&M family.
      const reviewResponse = await review(options, {
        narrative: evalCase.transcript,
        ...(patientStatus ? { patientStatus } : {}),
        ...reviewContext,
      });
      reviewSuggestions = reviewResponse.suggestions.length;
      const reviewActions = reviewResponse.suggestions.flatMap((suggestion) => suggestion.actions ?? []);
      if (reviewActions.length > 0) {
        // Seeded with the chart AS THE PLAN LEFT IT: a review that corrects a diagnosis has to resolve
        // its removal against the row the plan charted, not against the empty chart the plan started from.
        const reviewRun = await runPlan(reviewActions, { ...context, chart: planRun.chart });
        foldStepsIntoState(reviewRun.steps, 'review', state);
      }
    } catch (error) {
      // A failed review must not lose the plan's score for this case — record and move on.
      console.error(`  review failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const usage = response.usage?.[0];
  const score = scoreCase(evalCase.caseId, evalCase.gold, state, {
    planner: usage && {
      provider: usage.provider === 'anthropic' ? 'claude' : 'gemini',
      model: usage.model,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: usage.cacheReadTokens,
      escalation: { escalated: response.escalation?.escalated, attempts: response.escalation?.attempts },
    },
  });

  writeFileSync(
    join(options.outDir, `${evalCase.caseId}.result.json`),
    JSON.stringify({ actions: response.actions, rejected: response.rejected, state }, null, 2)
  );
  writeFileSync(join(options.outDir, `${evalCase.caseId}.score.json`), JSON.stringify(score, null, 2));
  return { score, planSteps: planRun.steps.length, reviewSuggestions };
}

/** Rebuild the summary from score files already on disk — no model calls, so a failed batch can be
 * summarised without paying for it twice. */
function loadScores(outDir: string): CaseScore[] {
  return readdirSync(outDir)
    .filter((name) => name.endsWith('.score.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(outDir, name), 'utf8')) as CaseScore);
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
    console.log(`${cases.length} cases → ${options.url}`);
    scores = [];
    for (const evalCase of cases) {
      try {
        const result = await runOne(options, evalCase);
        scores.push(result.score);
        console.log(formatCaseLine(result.score, result.planSteps, result.reviewSuggestions));
      } catch (error) {
        // One case must not end a run that costs hours. Report it and continue; re-run it later with
        // --cases, and the summary picks up whatever landed.
        console.error(`${evalCase.caseId}: FAILED — ${error instanceof Error ? error.message : String(error)}`);
      }
    }
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
