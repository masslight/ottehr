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
import {
  ChartPlanRequest,
  ChartPlanResponse,
  ChartReviewRequest,
  ChartReviewResponse,
  EscalationInfo,
} from 'utils/lib/easy-chart/api';
import { PLAN_STAGES, PlannedAction, PlanStage } from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { overwritesWrittenNoteField } from 'utils/lib/easy-chart/note-fields';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';
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
import { foldProcedureWritesIntoState, foldStepsIntoState } from './sim-state';
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
 * New-vs-established for the E&M family selector, from the best source the case file has.
 *
 * `meta.patientStatus` is the real thing: derived against the live project at harvest time from the
 * patient's prior finished encounters, exactly as production does. It is missing on 17 of the 40
 * harvested cases — not because those patients are genuinely unknown, but because this repo has no
 * harvest/backfill tooling, so those cases were never backfilled.
 *
 * Nothing can recover it offline. The corpus stores no FHIR ids at all, only an opaque `encounterHash`
 * (deliberately — see HARVESTED.md), and the harness runs headless against a simulated chart, so there
 * are no prior encounters for the endpoint to count even in principle.
 *
 * So fall back to the family of the GOLD E&M code. This is chart context, not gold leakage: the family
 * follows from registration and visit history, which the provider could see before coding anything, and
 * it reveals nothing about the LEVEL — the last digit, which is the whole of what this metric scores.
 * Without it the prompt falls back to the established family, 16 of those 17 gold codes are new-patient
 * codes, and the headline E&M number mostly measures that fallback rather than the model. The
 * per-case score file records which source was used, so the report can split the two.
 */
function resolvePatientStatus(evalCase: HarvestedCase): 'new' | 'established' | undefined {
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
  limit?: number;
  rescore: boolean;
  /** Skip the second look — useful for isolating a planner change without paying for review. */
  skipReview: boolean;
  /** Replace the single monolithic plan call with the per-section stage graph. */
  stages: boolean;
  /**
   * Stages to run AFTER the monolith instead of instead of it — the hybrid.
   *
   * A third configuration worth measuring on its own: the monolith keeps the sections it is good at and
   * one dedicated call takes the section it is not. The additive pilot that measured this by accident
   * scored better than either the monolith or the full graph, which is a result and not a methodology
   * error — it just answers a different question than "does the graph replace the monolith".
   */
  addStages: PlanStage[];
  /**
   * How many cases to run at once. Default 1, because that is what every previous run did and a
   * baseline should not change its meaning when a flag gains a default. Raise it to shorten a run; too
   * high and the model starts timing out, which costs more than it saves.
   */
  concurrency: number;
  /**
   * The practice's procedure quick-picks, fetched once at startup.
   *
   * Undefined when the fetch failed — which the catalogue reports as UNAVAILABLE rather than empty, so a
   * broken fetch cannot be mistaken for a practice that configured none.
   */
  quickPicks?: ProcedureQuickPickData[];
}

/**
 * The practice's procedure quick-picks, from the same zambda the app calls.
 *
 * Fetched ONCE per run rather than per case: it is practice configuration, it does not change between
 * cases, and forty identical calls would just be slower.
 */
async function fetchQuickPicks(options: Options): Promise<ProcedureQuickPickData[] | undefined> {
  try {
    const response = await fetch(`${options.url}/local/zambda/admin-get-quick-picks/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
      body: JSON.stringify({ category: 'procedure-quick-pick' }),
    });
    if (!response.ok) throw new Error(`admin-get-quick-picks returned ${response.status}`);
    const body = unwrap<{ quickPicks?: ProcedureQuickPickData[] }>(JSON.parse(await response.text()));
    return body.quickPicks ?? [];
  } catch (error) {
    // Not fatal — every other section still scores. Loud, because a silent fallback would make the
    // procedure and CPT sections quietly unmeasurable again, which is the state this replaced.
    console.error(`  could not fetch procedure quick-picks: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
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
    stages: argv.includes('--stages'),
    addStages: (get('--add-stages') ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name): name is PlanStage => PLAN_STAGES.includes(name as PlanStage)),
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
  /**
   * Wall clock per stage GROUP, in declared order.
   *
   * Per group and not per stage, because a group's stages are issued concurrently and the app waits for
   * the slowest — reporting their sum is what made staging look three times more expensive than it is.
   */
  stageTimings: { group: string; ms: number }[];
}

/**
 * What the endpoints need to describe the chart to the model, built from the simulated state.
 *
 * Goes through `simStateToChartData` and the PRODUCTION renderers rather than assembling prose here. The
 * hand-rolled version this replaces described seven section kinds and omitted exam findings, ROS, vitals,
 * procedures, radiology, labs, instructions, surgical history and hospitalizations — so the review pass was
 * told about a chart with no exam on it, and `chartedExamFindings` was never sent at all, which left the
 * server's removal guard rejecting every `remove-*` with "the chart is empty".
 */
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
  // The transcript is the ONLY model input, and the case starts from an empty chart: that is what the
  // provider's own first pass had, so anything else would flatter the score.
  // The corpus carries `meta.patientStatus` but NO encounterId (only a hash, deliberately — PHI
  // posture), so the endpoint has no encounter to read and cannot derive new-vs-established itself.
  // Passing it explicitly is what makes the E&M family measurable: without it the prompt falls back to
  // the ESTABLISHED family and every new-patient case mismatches, which reads as a model failure and is
  // not one. The endpoint still prefers the chart whenever it can look the status up.
  const patientStatus = resolvePatientStatus(evalCase);
  // THE MONOLITHIC PASS — skipped entirely in staged mode.
  //
  // Running the stages ON TOP of it, which the first pilot did, measures a configuration nobody would
  // ship: the stages would be finding only the remainder of a plan that had already charted the easy
  // wins, on a chart already richer than production's. `--stages` therefore REPLACES this call rather
  // than adding to it, so the run is the same sequence of calls the app would make.
  const response = options.stages
    ? ({ actions: [], rejected: [], usage: [], triggers: [] } as unknown as ChartPlanResponse)
    : await plan(options, {
        narrative: evalCase.transcript,
        incremental: false,
        ...(patientStatus ? { patientStatus } : {}),
      });

  // EVERY planner call, not just the first.
  //
  // Only `response.usage[0]` was recorded, which was right while a visit was one call and became wrong
  // the moment a stage was added: the stage's tokens landed nowhere, so the summary reported a staged
  // run as costing exactly what the single-call run cost. A change whose whole trade-off is "more calls
  // for more recall" cannot be judged against a cost figure that structurally cannot move.
  const plannerUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, thinkingTokens: 0, calls: 0 };
  /**
   * The REVIEW pass's own cost, which used to go unrecorded.
   *
   * `scoreCase` was handed `{ planner }` and nothing else, so every summary reported
   * `usage[review]: 0 calls, in 0` for runs where review had demonstrably run — its writes are visible
   * in the `final` scope. A run's headline cost was therefore short by one full LLM pass per case, and
   * "planner-only vs planner+review" was the one comparison the numbers could not support.
   */
  const reviewUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, thinkingTokens: 0, calls: 0 };
  let firstReviewUsage: ChartPlanResponse['usage'][number] | undefined;
  /** Per-GROUP wall clock, so a run can say where the time actually goes. */
  const stageTimings: { group: string; ms: number }[] = [];
  /**
   * Every action the run planned, whichever call produced it, tagged with the stage.
   *
   * The result file used to persist `response.actions` — the MONOLITH's. In staged mode there is no
   * monolith, so it recorded an empty array beside a chart holding ninety diagnoses, and reading it
   * suggested the stages had emitted nothing at all. A file that cannot say what was proposed cannot be
   * used to work out why a section regressed, which is the one thing it exists for.
   */
  const plannedActions: { stage: string; action: unknown }[] = [];
  const stageRejected: { stage: string; kind: string; display?: string; reason: string }[] = [];
  /** Provider and model of the first call that reported any — the monolith has none in staged mode. */
  let firstUsage: ChartPlanResponse['usage'][number] | undefined;
  const recordUsage = (entries: ChartPlanResponse['usage'] | undefined): void => {
    for (const entry of entries ?? []) {
      firstUsage ??= entry;
      plannerUsage.inputTokens += entry.inputTokens ?? 0;
      plannerUsage.outputTokens += entry.outputTokens ?? 0;
      plannerUsage.cacheReadTokens += entry.cacheReadTokens ?? 0;
      // Thinking tokens are BILLED and were being dropped, which understated every reasoning-model run.
      plannerUsage.thinkingTokens += entry.thinkingTokens ?? 0;
      plannerUsage.calls += 1;
    }
  };
  const recordReviewUsage = (entries: ChartPlanResponse['usage'] | undefined): void => {
    for (const entry of entries ?? []) {
      firstReviewUsage ??= entry;
      reviewUsage.inputTokens += entry.inputTokens ?? 0;
      reviewUsage.outputTokens += entry.outputTokens ?? 0;
      reviewUsage.cacheReadTokens += entry.cacheReadTokens ?? 0;
      reviewUsage.thinkingTokens += entry.thinkingTokens ?? 0;
      reviewUsage.calls += 1;
    }
  };
  recordUsage(response.usage);
  for (const action of response.actions ?? []) plannedActions.push({ stage: 'plan', action });

  const { context, writerLog } = buildEvalContext({ quickPicks: options.quickPicks });
  const planRun = await runPlan(response.actions, context);
  const state = foldStepsIntoState(planRun.steps, 'planner');
  // What a composite write charted beyond the step's own row — see foldProcedureWritesIntoState.
  foldProcedureWritesIntoState(writerLog, 'planner', state);

  // THE STAGES — the whole first pass in staged mode, folded into the planner scope because that is what
  // they are: the first pass, not a correction of it.
  //
  // THE GROUPS ARE THE GRAPH, and the harness runs them exactly as the app would. A group's stages are
  // mutually independent: none reads what another writes, so they are PLANNED CONCURRENTLY against the
  // same chart, and the group costs the wall-clock of its slowest member rather than the sum. Groups run
  // in sequence, and that sequence is the dependency order — `diagnoses` must see the exam, `orders` the
  // diagnoses, `coding` the medical decision making.
  //
  // Results are folded in DECLARED order, never in completion order. Two stages in one group can both
  // touch the same row — a template normal one removes and another re-adds — and folding by whichever
  // call returned first would make a run depend on network timing.
  const STAGE_GROUPS: readonly (readonly PlanStage[])[] = [
    ['template'],
    ['findings', 'history', 'story'],
    ['diagnoses'],
    ['orders'],
    ['plan-text'],
    ['coding'],
  ];

  // Full graph, or just the named stages on top of the monolith. Same code either way: the hybrid is
  // the graph with most of its groups removed, not a second mechanism.
  const groupsToRun = options.stages
    ? STAGE_GROUPS
    : STAGE_GROUPS.map((group) => group.filter((stage) => options.addStages.includes(stage))).filter(
        (group) => group.length > 0
      );

  if (groupsToRun.length > 0) {
    for (const group of groupsToRun) {
      // Every stage in the group sees the SAME chart — the one the previous group left. Snapshotting it
      // once, before any of them runs, is what makes concurrency safe here.
      const chartBefore = chartContextFrom(state);
      const snapshotBefore = buildChartSnapshot(simStateToChartData(state));

      const planned = await Promise.all(
        group.map(async (stage) => {
          const startedAt = Date.now();
          try {
            const stageResponse = await plan(options, {
              narrative: evalCase.transcript,
              stage,
              // NOT incremental. A stage is the FIRST pass over its own section, not an addendum to a
              // written note — and `incremental` says the opposite in as many words: "the note is
              // already written and this narrative only adds to it. Chart ONLY what is new." Setting it
              // here is the mistake the flag's own doc warns about, that a non-empty chart state does
              // not make a turn incremental; last time it cost the template, exam and E&M scaffolding.
              // It also flips a guard: on an incremental turn a new diagnosis may never usurp the
              // existing primary, so the stage could not correct a wrong template default even when it
              // spotted one.
              incremental: false,
              ...(patientStatus ? { patientStatus } : {}),
              // What the `template` stage applied, so the later stages can tell a template's defaults
              // apart from what the provider dictated — the chart state cannot, every row in it looks
              // the same regardless of who put it there.
              ...(state.templatesApplied.length > 0
                ? { appliedTemplate: state.templatesApplied[state.templatesApplied.length - 1] }
                : {}),
              ...chartBefore,
            });
            return { stage, stageResponse, ms: Date.now() - startedAt };
          } catch (error) {
            console.error(`  stage ${stage} failed: ${error instanceof Error ? error.message : String(error)}`);
            return { stage, stageResponse: undefined, ms: Date.now() - startedAt };
          }
        })
      );

      // The group's wall-clock is its SLOWEST member, which is what the app would wait; the sum is what a
      // sequential harness used to report and is the number that made staging look three times worse than
      // it is.
      stageTimings.push({ group: group.join('+'), ms: Math.max(...planned.map((entry) => entry.ms)) });

      for (const { stage, stageResponse } of planned) {
        if (!stageResponse) continue;
        recordUsage(stageResponse.usage);
        for (const action of stageResponse.actions ?? []) plannedActions.push({ stage, action });
        // A STAGE'S REFUSALS, saved beside the monolith's. Only `response.rejected` was written, so a
        // stage's guard rejections were invisible: when the hybrid's surviving remove-* count fell from
        // 30 to 11, nothing in the result files could say whether the guard had refused them or the
        // model had stopped emitting them — opposite conclusions about where a fix landed.
        for (const rejection of stageResponse.rejected ?? []) stageRejected.push({ stage, ...rejection });
        try {
          const stageRun = await runPlan(stageResponse.actions, { ...context, chart: snapshotBefore });
          foldStepsIntoState(stageRun.steps, 'planner', state);
          foldProcedureWritesIntoState(writerLog, 'planner', state);
        } catch (error) {
          console.error(`  stage ${stage} execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

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
  // Review's own refusals and triggers, saved beside the plan's. Only the PLAN's were written to the
  // result file, so every question about the second look — did a guard drop the replacement diagnosis,
  // did the disposition card exist at all — needed a re-run to answer.
  let reviewRejected: ChartReviewResponse['rejected'] = [];
  let reviewTriggers: ChartReviewResponse['triggers'] = [];
  let reviewEscalation: ChartReviewResponse['escalation'] | undefined;
  // The scorer has a whole aggregate bucket for this and it read "no data 20" until now: the endpoints
  // report the deterministic triggers, the runner simply never forwarded them. "The guard never fired"
  // and "the guard fired and the model ignored it" are opposite bugs with the same symptom, which is the
  // reason the pair is reported at all.
  let dispositionTrigger: { fired: boolean; matchedPattern?: string; modelProposed: boolean } | null = null;
  const readDispositionTrigger = (triggers: ChartPlanResponse['triggers'] | undefined): void => {
    const hit = triggers?.find((trigger) => trigger.trigger === 'disposition-language-without-disposition');
    // A LATER SURFACE OVERRIDES ONLY WHEN ITS OWN TRIGGER FIRED.
    //
    // Review's trigger fires only when the narrative states a disposition AND none is charted, i.e. when
    // the planner left one owed. So a review that reports `fired: false` is reporting that there was
    // nothing left to force — which must not erase the planner's "fired and charted it". Overwriting
    // unconditionally turned every visit the planner got right into a not-fired, and the pair exists
    // precisely to keep "the guard never fired" apart from "it fired and was ignored".
    if (!hit || (dispositionTrigger?.fired && !hit.fired)) return;
    // The PATTERN's label, not the trigger's name. Naming the trigger here collapsed the summary's
    // firedByPattern bucket to a single key, so it could report that some disposition language went
    // unaddressed but never which kind — and a missed referral, a missed ER instruction and a missed
    // follow-up interval are three different problems.
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
      // Same status the planner got: without it review renders "PATIENT STATUS: unknown" and re-codes
      // every new patient into the established E&M family.
      const reviewResponse = await review(options, {
        narrative: evalCase.transcript,
        ...(patientStatus ? { patientStatus } : {}),
        ...reviewContext,
      });
      reviewSuggestions = reviewResponse.suggestions.length;
      reviewRejected = reviewResponse.rejected;
      reviewTriggers = reviewResponse.triggers;
      reviewEscalation = reviewResponse.escalation;
      recordReviewUsage(reviewResponse.usage);
      // Review's view wins when its own trigger fired — the check belongs to the second look whenever
      // there was still a disposition owed. See readDispositionTrigger.
      readDispositionTrigger(reviewResponse.triggers);
      // MIRROR THE APP, or `final` measures a note nobody would ever have.
      //
      // A review `edit-note-text` aimed at a field that ALREADY HAS TEXT is not applied in the app — it
      // becomes a card the provider confirms (see PendingNoteEdit in useChartAssistant). Applying it here
      // would credit the harness with a rewrite the product does not perform. The written fields are
      // exactly the keys `reviewContext.noteContext` carries, since that builder drops empty ones.
      const written = reviewContext.noteContext ?? {};
      const reviewActions: PlannedAction[] = [];
      for (const action of reviewResponse.suggestions.flatMap((suggestion) => suggestion.actions ?? [])) {
        if (overwritesWrittenNoteField(action, written)) {
          state.pendingNoteEdits.push({ field: action.field, newText: action.newText ?? '', source: 'review' });
        } else {
          reviewActions.push(action);
        }
      }
      if (reviewActions.length > 0) {
        // Seeded with the chart AS THE WHOLE FIRST PASS LEFT IT: a review that corrects a diagnosis has
        // to resolve its removal against the row that was actually charted, not against the empty chart
        // the plan started from.
        //
        // Derived from `state`, NOT from `planRun.chart`. `planRun` is the MONOLITH only, so in staged
        // and hybrid mode every row a stage wrote was invisible here — review's removals resolved
        // against a chart missing the whole findings section, and `reclaimPrimaryOnSwap` could not see a
        // primary the `diagnoses` stage had set. `state` is the accumulated truth and is what each stage
        // group already snapshots from, so this is the same rule applied to the last consumer that was
        // not using it. It matters most in full `--stages` mode, where the diagnoses review corrects are
        // charted by a stage rather than by the monolith.
        //
        // Worth recording what this did NOT fix, because it looked like the obvious culprit: the hybrid's
        // removeTargetMissing 14 (against the monolith's 2) is unchanged by it. Those removals are all
        // the `findings` stage's own — see the polarity note in the README — not review resolving against
        // a stale chart.
        const reviewRun = await runPlan(reviewActions, {
          ...context,
          chart: buildChartSnapshot(simStateToChartData(state)),
        });
        foldStepsIntoState(reviewRun.steps, 'review', state);
      }
    } catch (error) {
      // A failed review must not lose the plan's score for this case — record and move on.
      console.error(`  review failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Provider and model come from the first call that REPORTED usage, not from the monolith's response:
  // in staged mode there is no monolith, and reading it there reported a visit as costing nothing.
  const first = firstUsage;
  const score = scoreCase(
    evalCase.caseId,
    evalCase.gold,
    state,
    {
      planner: first && {
        provider: first.provider === 'anthropic' ? 'claude' : 'gemini',
        model: first.model,
        inputTokens: plannerUsage.inputTokens,
        outputTokens: plannerUsage.outputTokens,
        cacheReadTokens: plannerUsage.cacheReadTokens,
        thinkingTokens: plannerUsage.thinkingTokens,
        calls: plannerUsage.calls,
        escalation: escalationRecord(response.escalation),
      },
      review: firstReviewUsage && {
        provider: firstReviewUsage.provider === 'anthropic' ? 'claude' : 'gemini',
        model: firstReviewUsage.model,
        inputTokens: reviewUsage.inputTokens,
        outputTokens: reviewUsage.outputTokens,
        cacheReadTokens: reviewUsage.cacheReadTokens,
        thinkingTokens: reviewUsage.thinkingTokens,
        calls: reviewUsage.calls,
        // Recorded for the same reason the planner's is, and it was simply missing: the summary read
        // "escalation[review]: no data" on every run, so how often the primary model failed on the
        // surface that WRITES INTO THE NOTE was the one thing the escalation bucket could not tell you.
        escalation: escalationRecord(reviewEscalation),
      },
    },
    dispositionTrigger
  );

  writeFileSync(
    join(options.outDir, `${evalCase.caseId}.result.json`),
    JSON.stringify(
      { actions: plannedActions, rejected: response.rejected, stageRejected, reviewRejected, reviewTriggers, state },
      null,
      2
    )
  );
  // `patientStatusSent` rides along beside the score, because E&M cannot be read without it, and
  // `patientStatusSource` beside that, because the two sources do not mean the same thing.
  //
  // The E&M code's FAMILY (99202-99205 new vs 99212-99215 established) follows from patient status, and
  // the prompt is told to default to the established family when the status is unknown. 17 of the 40
  // harvested cases carry no `meta.patientStatus`, so their family is taken from the gold code's own
  // family instead (see resolvePatientStatus). That is the right call for measuring the LEVEL, which is
  // what the metric is about, but it is not the same evidence as a harvested status — so the source is
  // recorded and the report splits the two rather than the reader having to.
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
  return { score, planSteps: planRun.steps.length, reviewSuggestions, stageTimings };
}

/**
 * Our `EscalationInfo` in the shape the scorer's escalation bucket reads.
 *
 * The two do not line up, and the mismatch was silent in the worst way: the scorer keys on
 * `primaryFailed` and `reason`, neither of which the runner set, so EVERY case fell through to the
 * "primary was fine" branch and `reasons` stayed empty — a run where the primary model failed on half
 * the corpus and escalated to the backup reported exactly the same escalation summary as a clean one.
 * Review was worse still: its `escalation` object came out empty and the phase was counted as no-data
 * on all 40 cases, so the surface that writes into the note could not report a failure at all.
 *
 * `escalated` means the primary was abandoned and the backup answered, which IS `primaryFailed`; the
 * first recorded failure is the reason worth bucketing (a second attempt that fails differently is
 * noise next to why the primary was given up on).
 */
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
  /** Every case's per-group wall clock, so the run can end with where the time went. */
  const allTimings: Record<string, number[]> = {};
  mkdirSync(options.outDir, { recursive: true });
  if (!options.token && !options.rescore) {
    options.token = await mintToken();
    console.log('Minted an M2M token from the environment.');
  }
  if (!options.rescore) {
    options.quickPicks = await fetchQuickPicks(options);
    console.log(`Procedure quick-picks: ${options.quickPicks?.length ?? 'unavailable'}`);
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
    // CASES RUN CONCURRENTLY. They are genuinely independent — one transcript, one simulated chart, one
    // score file each, and nothing shared but the read-only catalogues — so the only reason to serialise
    // them was that nobody had asked. A worker pool rather than Promise.all over all forty: the limit
    // exists to stay under the model's rate limit, and forty simultaneous plans is how a run turns into
    // a wall of 90-second timeouts that cost more than the serialisation ever did.
    //
    // Per-case OUTPUT stays whole: each case logs one line when it finishes, so lines interleave between
    // cases but never within one. The summary is rebuilt from the directory at the end and does not care
    // what order they landed in.
    const queue = [...cases];
    const worker = async (): Promise<void> => {
      for (;;) {
        const evalCase = queue.shift();
        if (!evalCase) return;
        try {
          const result = await runOne(options, evalCase);
          scores.push(result.score);
          for (const timing of result.stageTimings) {
            const bucket = (allTimings[timing.group] ??= []);
            bucket.push(timing.ms);
          }
          console.log(formatCaseLine(result.score, result.planSteps, result.reviewSuggestions));
        } catch (error) {
          // One case must not end a run that costs hours. Report it and continue; re-run it later with
          // --cases, and the summary picks up whatever landed.
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

  // WHERE THE TIME ACTUALLY GOES. Median as well as mean, because a handful of 90-second model timeouts
  // drags the mean somewhere no visit ever was — the mean answers "what did this run cost", the median
  // answers "what does a visit take", and only the second is a latency estimate for the product.
  const groups = Object.keys(allTimings);
  if (groups.length > 0) {
    console.log('\nstage wall clock (per case, model call only — the group is its SLOWEST member):');
    let medianTotal = 0;
    for (const group of groups) {
      const values = [...allTimings[group]].sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      medianTotal += median;
      console.log(
        `  ${group.padEnd(26)} median ${(median / 1000).toFixed(1).padStart(6)}s   mean ${(mean / 1000)
          .toFixed(1)
          .padStart(6)}s   max ${(values[values.length - 1] / 1000).toFixed(1).padStart(6)}s`
      );
    }
    console.log(`  ${'TOTAL (sum of medians)'.padEnd(26)} ${(medianTotal / 1000).toFixed(1).padStart(13)}s`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
