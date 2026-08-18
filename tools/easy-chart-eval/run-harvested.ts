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
import { ChartPlanRequest, ChartPlanResponse } from 'utils/lib/easy-chart/api';
import { runPlan } from '../../apps/ehr/src/features/easy-chart/executor/runPlan';
import { GoldData } from './gold-types';
import { buildEvalContext } from './harness';
import { aggregateScores, CaseScore, formatCaseLine, formatSummary, scoreCase } from './score-harvested';
import { foldStepsIntoState } from './sim-state';

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
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const rescore = argv.includes('--rescore');
  const token = get('--token') ?? process.env.EASY_CHART_EVAL_TOKEN ?? '';
  if (!token && !rescore) {
    throw new Error('A bearer token is required: pass --token or set EASY_CHART_EVAL_TOKEN');
  }
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

async function plan(options: Options, request: ChartPlanRequest): Promise<ChartPlanResponse> {
  const response = await fetch(`${options.url}/local/zambda/easy-chart-plan/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`easy-chart-plan returned ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as ChartPlanResponse;
}

async function runOne(options: Options, evalCase: HarvestedCase): Promise<CaseScore> {
  // The transcript is the ONLY model input, and the case starts from an empty chart: that is what the
  // provider's own first pass had, so anything else would flatter the score.
  const response = await plan(options, { narrative: evalCase.transcript, incremental: false });

  const { context } = buildEvalContext();
  const { steps } = await runPlan(response.actions, context);
  const state = foldStepsIntoState(steps, 'planner');

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
  return score;
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
        const score = await runOne(options, evalCase);
        scores.push(score);
        console.log(formatCaseLine(score));
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
