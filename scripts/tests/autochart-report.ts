/**
 * A per-case report of what the plan predicted, for people, as one HTML page — from a fresh run of the plan
 * and narrative endpoints, or re-rendered from a saved run. The plan suite writes the same page with
 * `--report out.html`; this script is for a report without the suite's checks and repeats.
 *
 *   npx tsx scripts/tests/autochart-report.ts --env local --url http://localhost:3010 --out report.html
 *     [--cases id1,id2] [--corpus top:10] [--concurrency 3] [--skip-narrative] [--skip-judge] [--judge-model <name>]
 *   npx tsx scripts/tests/autochart-report.ts --env local --from report.html.json --out report.html
 *
 * The raw run (every plan response, the narrative lines, the judge's verdicts) is saved beside the page as
 * `<out>.json`, and `--from` re-renders the page from it without calling the AI again (a missing judge verdict
 * is filled in unless --skip-judge). The renderer is autochart-report-html.ts.
 */

import * as fs from 'fs';
import type { ChartNarrativeResponse, ChartPlanResponse } from 'utils/lib/easy-chart/api';
import { AutochartCase } from './autochart-case-file';
import { buildReport, geminiFromArgs, judgeActions, RawCase, renderPage } from './autochart-report-html';
import { createCaseEncounter, mapWithConcurrency, parseSuiteArgs } from './autochart-shared';
import { callZambda, getToken } from './shared';

const args = parseSuiteArgs(process.argv);
const outAt = process.argv.indexOf('--out');
const outPath = outAt !== -1 ? process.argv[outAt + 1] : 'autochart-report.html';
const skipNarrative = process.argv.includes('--skip-narrative');
const fromAt = process.argv.indexOf('--from');
const fromPath = fromAt !== -1 ? process.argv[fromAt + 1] : undefined;
const skipJudge = process.argv.includes('--skip-judge');
const gemini = geminiFromArgs(args.envConfig, process.argv);

async function fetchRaw(token: string, c: AutochartCase): Promise<RawCase> {
  const raw: RawCase = { id: c.id, actions: [], refusals: [], models: [], narrative: [] };
  const encounter = await createCaseEncounter(token, args.envConfig, c);
  try {
    const plan = await callZambda<ChartPlanResponse>('easy-chart-plan', token, {
      incremental: false,
      narrative: c.transcript,
      encounterId: encounter.encounterId,
    });
    raw.actions = plan.actions;
    raw.refusals = plan.rejected.map((r) => ({ kind: r.kind, display: r.display, reason: r.reason }));
    raw.models = [...new Set(plan.usage.map((u) => u.model))];
    if (!skipNarrative) {
      const narrative = await callZambda<ChartNarrativeResponse>('easy-chart-narrative', token, {
        transcript: c.transcript,
        encounterId: encounter.encounterId,
      });
      raw.narrative = narrative.lines;
    }
    if (!skipJudge) raw.judge = await judgeActions(c.transcript, raw.actions, gemini);
  } catch (error) {
    raw.error = error instanceof Error ? error.message : String(error);
  } finally {
    await encounter.cleanup().catch((error) => console.warn(`  [${c.id}] cleanup failed: ${error}`));
  }
  return raw;
}

async function main(): Promise<void> {
  let raws: RawCase[];
  if (fromPath) {
    raws = JSON.parse(fs.readFileSync(fromPath, 'utf8')) as RawCase[];
    console.log(`Autochart report: re-rendering ${raws.length} case(s) from ${fromPath}`);
    const byId = new Map(args.cases.map((c) => [c.id, c]));
    let judgedNow = 0;
    for (const raw of raws) {
      const c = byId.get(raw.id);
      if (skipJudge || raw.judge || !c) continue;
      raw.judge = await judgeActions(c.transcript, raw.actions, gemini);
      judgedNow += 1;
    }
    if (judgedNow) {
      fs.writeFileSync(fromPath, JSON.stringify(raws, null, 2));
      console.log(`  judged ${judgedNow} case(s) and saved the verdicts to ${fromPath}`);
    }
  } else {
    const token = await getToken(args.envConfig);
    console.log(`Autochart report: ${args.cases.length} case(s), concurrency ${args.concurrency}`);
    raws = await mapWithConcurrency(args.cases, args.concurrency, async (c) => {
      const raw = await fetchRaw(token, c);
      console.log(
        `  ${c.id}: ${raw.actions.length} actions, ${raw.refusals.length} refused${
          raw.judge
            ? `, judge supported ${raw.judge.filter((j) => j.verdict === 'supported').length}/${raw.judge.length}`
            : ''
        }${raw.error ? ` — ERROR ${raw.error}` : ''}`
      );
      return raw;
    });
    fs.writeFileSync(`${outPath}.json`, JSON.stringify(raws, null, 2));
  }
  const byId = new Map(raws.map((r) => [r.id, r]));
  const reports = args.cases.filter((c) => byId.has(c.id)).map((c) => buildReport(c, byId.get(c.id)!));
  fs.writeFileSync(outPath, renderPage(reports));
  console.log(`wrote ${outPath}${fromPath ? '' : ` and ${outPath}.json`}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
