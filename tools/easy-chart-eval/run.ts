// Batch runner: every synthetic case through the real chart-plan endpoint, scored deterministically.
//
// A LOCAL TOOL, never a deployed endpoint. The LLM judge that will eventually score free text and
// semantics belongs here too — in the first implementation it shipped as a normal authenticated
// zambda, which means anyone holding a project token could spend model budget scoring arbitrary
// text.
//
// Usage:
//   npx tsx tools/easy-chart-eval/run.ts --url http://localhost:3000 --token "$TOKEN"
//   npx tsx tools/easy-chart-eval/run.ts --case case-07          # one case
//   npx tsx tools/easy-chart-eval/run.ts --out tools/easy-chart-eval/harvested-results
//
// The output directory is gitignored: results contain the generated note, which for a harvested case
// is PHI. The synthetic cases in ./cases are not, which is why they are committed.

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChartPlanRequest, ChartPlanResponse } from 'utils/lib/easy-chart/api';
import { EvalViolation, scorePlan, scoreProvenance } from 'utils/lib/easy-chart/eval-scorer';
import { quoteOccursInNarrative } from 'utils/lib/easy-chart/provenance';
import { EVAL_CASES } from './expectations';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Options {
  url: string;
  token: string;
  caseId?: string;
  outDir?: string;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const url = get('--url') ?? process.env.EASY_CHART_EVAL_URL ?? 'http://localhost:3000';
  const token = get('--token') ?? process.env.EASY_CHART_EVAL_TOKEN ?? '';
  if (!token) {
    throw new Error('A bearer token is required: pass --token or set EASY_CHART_EVAL_TOKEN');
  }
  return { url, token, caseId: get('--case'), outDir: get('--out') };
}

async function plan(options: Options, request: ChartPlanRequest): Promise<ChartPlanResponse> {
  const response = await fetch(`${options.url}/local/zambda/easy-chart-plan/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`easy-chart-plan returned ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as ChartPlanResponse;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const cases = options.caseId ? EVAL_CASES.filter((c) => c.id === options.caseId) : EVAL_CASES;
  if (cases.length === 0) throw new Error(`No case matched "${options.caseId}"`);

  let totalViolations = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReads = 0;
  let escalations = 0;

  for (const evalCase of cases) {
    const narrative = readFileSync(join(HERE, 'cases', `${evalCase.id}.txt`), 'utf8').trim();
    const response = await plan(options, { narrative });

    const score = scorePlan(response, evalCase);
    const violations: EvalViolation[] = [
      ...score.violations,
      ...scoreProvenance(response.actions, narrative, quoteOccursInNarrative),
    ];
    totalViolations += violations.length;

    for (const usage of response.usage) {
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCacheReads += usage.cacheReadTokens;
    }
    if (response.escalation.escalated) escalations += 1;

    const status = violations.length === 0 ? 'PASS' : `FAIL (${violations.length})`;
    console.log(`\n${evalCase.id} ${status} — ${evalCase.summary}`);
    console.log(
      `  actions=${score.stats.actions} rejected=${score.stats.rejected} diagnoses=${score.stats.diagnoses} ` +
        `vitals=${score.stats.vitals}`
    );
    for (const violation of violations) console.log(`  ✗ ${violation.rule}: ${violation.detail}`);
    for (const trigger of response.triggers) {
      if (trigger.fired && !trigger.complied) console.log(`  ⚠ trigger fired but ignored: ${trigger.trigger}`);
    }

    if (options.outDir) {
      await mkdir(options.outDir, { recursive: true });
      await writeFile(
        join(options.outDir, `${evalCase.id}.json`),
        JSON.stringify({ case: evalCase, response, violations }, null, 2)
      );
    }
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`${cases.length} cases · ${totalViolations} deterministic violations · ${escalations} escalations`);
  // A cache-read of zero across a whole run means the static-prefix ordering broke and every call is
  // being billed in full.
  console.log(
    `tokens: ${totalInputTokens} in (${totalCacheReads} from cache) / ${totalOutputTokens} out` +
      (totalCacheReads === 0 ? '  ← NO CACHE READS: check the static/variable prompt split' : '')
  );

  process.exitCode = totalViolations === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
