// Labels every diagnosis miss in a run with its cause and the layer that would fix it (guard, ranking,
// prompt, terminology search). Retrieval causes are told apart by rerunning the ICD-10 search.
//
// PHI: reads gitignored harvested cases and results; prints code displays, never narrative text.
//
// Usage:
//   npx env-cmd -f packages/zambdas/.env/zambda-secrets-local.json \
//     npx tsx tools/easy-chart-eval/diagnose-dx.ts [resultsDir]

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Oystehr from '@oystehr/sdk';
import { DiagnosisItem, GoldData } from './gold-types';
import { apiUrls, mintToken } from './token';

function codeLaterality(codeDisplay: string): 'left' | 'right' | 'bilateral' | undefined {
  const display = codeDisplay.toLowerCase();
  if (/\bbilateral\b/.test(display)) return 'bilateral';
  if (/\bleft\b/.test(display)) return 'left';
  if (/\bright\b/.test(display)) return 'right';
  return undefined;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, 'harvested-cases');
const SEARCH_LIMIT = 20;

/** How the charted code relates to gold. One label per charted diagnosis, plus one for each gold miss. */
type Cause =
  | 'exact'
  | 'laterality'
  | 'wastebasket'
  | 'wrong-sibling'
  | 'wrong-concept'
  | 'retrieval-gap'
  | 'off-target'
  | 'escalation'
  | 'no-gold-in-scope'
  | 'missed';

const EXPLANATION: Record<Cause, string> = {
  exact: 'charted code equals gold',
  laterality: 'code asserts a side gold contradicts or the narrative never states — GUARD (codeLaterality)',
  wastebasket: '"Other/unspecified" catch-all charted while gold names a specific site — GUARD',
  'wrong-sibling': "gold was IN the search results for the model's own wording — RANKING in resolveIcd10Row",
  'wrong-concept': "gold unreachable from the model's wording but reachable from its own — MODEL/PROMPT",
  'retrieval-gap': 'gold unreachable even from its own display — TERMINOLOGY SEARCH',
  'off-target': 'charted a condition gold does not have at all — over-charting, separate question',
  escalation:
    'same condition as a gold item by wording, but a more severe/different code — the PROMPT FORBIDS THIS BY NAME',
  'no-gold-in-scope': 'gold has no scorable diagnosis for this case, so nothing here is a model error',
  missed: 'gold code with nothing charted in its category',
};

interface Finding {
  caseId: string;
  cause: Cause;
  chartedCode?: string;
  chartedDisplay?: string;
  goldCode?: string;
  goldDisplay?: string;
  /** Where gold sat in the search for the charted display; -1 when absent from the top N. */
  goldRank?: number;
  detail?: string;
}

const norm = (code: string | undefined): string => (code ?? '').toUpperCase().replace(/[.\s]/g, '');

/** Sides the narrative states, after stripping fillers like "all right", "right?" and "right now". */
function narrativeLaterality(narrative: string): Set<'left' | 'right' | 'bilateral'> {
  const cleaned = narrative
    .toLowerCase()
    .replace(/\ball\s+right\b/g, ' ')
    .replace(/\balright\b/g, ' ')
    .replace(/\bthat'?s\s+right\b/g, ' ')
    .replace(/\bright\s+(now|away|there|here|then|about|back)\b/g, ' ')
    .replace(/\bright\s*\?/g, ' ');
  const found = new Set<'left' | 'right' | 'bilateral'>();
  if (/\b(bilateral|both\s+(ears|eyes|sides|knees|feet|hands|arms|legs))\b/.test(cleaned)) found.add('bilateral');
  if (/\bleft\b/.test(cleaned)) found.add('left');
  if (/\bright\b/.test(cleaned)) found.add('right');
  return found;
}

/** Scaffolding words common to ICD displays, ignored when checking two codes for a shared condition. */
const STOP_WORDS = new Set([
  'other',
  'specified',
  'unspecified',
  'acute',
  'chronic',
  'left',
  'right',
  'bilateral',
  'and',
  'of',
  'the',
  'with',
  'without',
  'not',
  'elsewhere',
  'classified',
  'initial',
  'encounter',
  'disorder',
  'disorders',
  'disease',
  'pain',
  'site',
  'sites',
  'part',
]);

function clinicalWords(display: string): Set<string> {
  // String overlap only: related conditions that share no word (e.g. UTI vs pyelonephritis) land in
  // off-target, so escalations are undercounted.
  return new Set(
    display
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 4 && !STOP_WORDS.has(word))
  );
}

const isWastebasket = (display: string): boolean => /^other\b|\bother specified\b|\bunspecified\b/i.test(display);

async function main(): Promise<void> {
  const resultsDir = process.argv[2] ?? join(HERE, 'harvested-results');
  if (!existsSync(resultsDir)) throw new Error(`no results at ${resultsDir}`);

  const { projectApiUrl, fhirApiUrl } = apiUrls();
  const oystehr = new Oystehr({ accessToken: await mintToken(), services: { projectApiUrl, fhirApiUrl } });

  // One cache for the whole run: the same displays recur across cases, and each lookup is a network call.
  const searchCache = new Map<string, { code: string; display: string }[]>();
  const search = async (query: string): Promise<{ code: string; display: string }[]> => {
    const key = query.toLowerCase();
    const cached = searchCache.get(key);
    if (cached) return cached;
    let hits: { code: string; display: string }[] = [];
    try {
      hits = (await oystehr.terminology.searchIcd10({ query, searchType: 'description', limit: SEARCH_LIMIT })).codes;
    } catch {
      // Terminology being unreachable must read as "unknown", never as "the model was right".
      console.error(`  ICD-10 lookup failed for a display; that miss is reported as retrieval-gap`);
    }
    searchCache.set(key, hits);
    return hits;
  };

  const findings: Finding[] = [];
  const caseIds = readdirSync(resultsDir)
    .filter((name) => name.endsWith('.result.json'))
    .map((name) => name.replace('.result.json', ''))
    .sort();

  for (const caseId of caseIds) {
    const casePath = join(CASES_DIR, `${caseId}.json`);
    if (!existsSync(casePath)) continue;
    const evalCase = JSON.parse(readFileSync(casePath, 'utf8')) as { transcript: string; gold: GoldData };
    const result = JSON.parse(readFileSync(join(resultsDir, `${caseId}.result.json`), 'utf8')) as {
      state: { diagnoses: { display: string; code?: string }[] };
    };

    // The same scope the scorer uses: lab-order diagnoses are context, and an unvoiced gold item is not
    // derivable from the transcript, so neither belongs in a recall denominator.
    const gold = evalCase.gold.assessment.diagnoses.filter(
      (item) => !item.fromLabOrder && (item as DiagnosisItem & { voiced?: boolean }).voiced !== false
    );
    const goldByCode = new Map(gold.map((item) => [item.codeNormalized, item]));
    const goldByCategory = new Map<string, DiagnosisItem>();
    for (const item of gold)
      if (!goldByCategory.has(item.codeNormalized.slice(0, 3)))
        goldByCategory.set(item.codeNormalized.slice(0, 3), item);
    const sides = narrativeLaterality(evalCase.transcript);
    const charted = result.state.diagnoses;
    const claimedGold = new Set<string>();

    for (const dx of charted) {
      const code = norm(dx.code);
      const base: Finding = { caseId, cause: 'exact', chartedCode: dx.code, chartedDisplay: dx.display };

      if (goldByCode.has(code)) {
        claimedGold.add(code);
        findings.push({ ...base, cause: 'exact', goldCode: goldByCode.get(code)!.code });
        continue;
      }

      const sibling = goldByCategory.get(code.slice(0, 3));
      if (!sibling) {
        // Not every out-of-category code is off-target: with no scorable gold there is nothing to be wrong
        // about, and a code naming the same condition as a gold item is an escalation.
        if (gold.length === 0) {
          findings.push({ ...base, cause: 'no-gold-in-scope' });
          continue;
        }
        const chartedWords = clinicalWords(dx.display);
        const sameCondition = gold.find((item) =>
          [...clinicalWords(item.display)].some((word) => chartedWords.has(word))
        );
        findings.push(
          sameCondition
            ? {
                ...base,
                cause: 'escalation',
                goldCode: sameCondition.code,
                goldDisplay: sameCondition.display,
                detail: 'same condition by wording, different code — check the narrative for who escalated it',
              }
            : { ...base, cause: 'off-target' }
        );
        continue;
      }
      claimedGold.add(sibling.codeNormalized);
      const withGold: Finding = { ...base, goldCode: sibling.code, goldDisplay: sibling.display };

      // Laterality first: a wrong side is a safety issue, and it hides inside same-category matches.
      const chartedSide = codeLaterality(dx.display);
      const goldSide = codeLaterality(sibling.display);
      if (chartedSide && ((goldSide && goldSide !== chartedSide) || !sides.has(chartedSide))) {
        findings.push({
          ...withGold,
          cause: 'laterality',
          detail: `code says ${chartedSide}; gold says ${goldSide ?? 'no side'}; narrative states ${
            sides.size ? [...sides].join('/') : 'no side at all'
          }`,
        });
        continue;
      }

      if (isWastebasket(dx.display) && !isWastebasket(sibling.display)) {
        findings.push({ ...withGold, cause: 'wastebasket' });
        continue;
      }

      // The discriminator: could retrieval have produced gold from what the model itself called it?
      const rank = (await search(dx.display)).findIndex((hit) => norm(hit.code) === sibling.codeNormalized);
      if (rank >= 0) {
        findings.push({ ...withGold, cause: 'wrong-sibling', goldRank: rank });
        continue;
      }
      const reachable = (await search(sibling.display)).some((hit) => norm(hit.code) === sibling.codeNormalized);
      findings.push({ ...withGold, cause: reachable ? 'wrong-concept' : 'retrieval-gap', goldRank: -1 });
    }

    for (const [code, item] of goldByCode) {
      if (!claimedGold.has(code))
        findings.push({ caseId, cause: 'missed', goldCode: item.code, goldDisplay: item.display });
    }
  }

  report(findings);
  writeFileSync(join(resultsDir, 'dx-causes.json'), JSON.stringify(findings, null, 2));
  console.log(`\nwritten: ${join(resultsDir, 'dx-causes.json')}`);
}

function report(findings: Finding[]): void {
  const order: Cause[] = [
    'exact',
    'laterality',
    'wastebasket',
    'wrong-sibling',
    'wrong-concept',
    'retrieval-gap',
    'escalation',
    'off-target',
    'no-gold-in-scope',
    'missed',
  ];
  for (const cause of order) {
    const rows = findings.filter((f) => f.cause === cause);
    if (rows.length === 0) continue;
    console.log(`\n── ${cause} (${rows.length}) — ${EXPLANATION[cause]}`);
    // Count-only causes; the rest are the work list and are listed line by line.
    if (cause === 'exact' || cause === 'missed' || cause === 'no-gold-in-scope') continue;
    for (const row of rows) {
      console.log(`   ${row.caseId}  ${row.chartedCode} "${row.chartedDisplay}"`);
      if (row.goldCode) console.log(`             gold ${row.goldCode} "${row.goldDisplay}"`);
      if (row.detail) console.log(`             ${row.detail}`);
      if (row.goldRank !== undefined && row.goldRank >= 0) {
        console.log(`             gold was at rank ${row.goldRank} of the search on the charted display`);
      }
    }
  }

  const counts = order.map((cause) => [cause, findings.filter((f) => f.cause === cause).length] as const);
  const chartedTotal = counts.filter(([cause]) => cause !== 'missed').reduce((sum, [, n]) => sum + n, 0);
  console.log(`\n${'='.repeat(72)}`);
  console.log(
    `charted diagnoses: ${chartedTotal} | gold never reached: ${findings.filter((f) => f.cause === 'missed').length}`
  );
  for (const [cause, n] of counts) if (n) console.log(`  ${cause.padEnd(18)} ${String(n).padStart(3)}`);
  const byLayer: [string, Cause[]][] = [
    ['guard (deterministic, no model change)', ['laterality', 'wastebasket']],
    ['ranking in resolveIcd10Row', ['wrong-sibling']],
    ['model / prompt', ['wrong-concept', 'escalation', 'off-target']],
    ['terminology search', ['retrieval-gap']],
  ];
  console.log('\nfixable where:');
  for (const [layer, causes] of byLayer) {
    const n = causes.reduce((sum, cause) => sum + findings.filter((f) => f.cause === cause).length, 0);
    console.log(`  ${String(n).padStart(3)}  ${layer}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
