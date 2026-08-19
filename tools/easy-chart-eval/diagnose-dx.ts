// Step 3 of the localisation procedure, automated: label every diagnosis miss with its CAUSE.
//
// WHY THIS EXISTS. A recall of .121 on diagnoses says nothing about what to fix. Behind that one number
// the harvested corpus hides at least four unrelated defects, and they need opposite fixes:
//
//   the model asserted a side the narrative never mentions   → a guard, and a patient-safety issue
//   the model charted an "Other specified…" wastebasket       → a guard
//   the model picked the wrong sibling from a list that       → ranking in resolveIcd10Row
//     already contained the right row
//   the model named the wrong condition entirely              → the prompt, or the model
//
// The discriminator is the SAME terminology search the guard already runs. If the gold code comes back
// when we search the model's own wording, then retrieval could reach it and the model's choice is what
// went wrong. If it does not come back, we search gold's own wording: found means the model named the
// wrong concept, not found means retrieval cannot produce that code at all. That is a mechanical test,
// so it belongs in the harness rather than in somebody's terminal history.
//
// PHI. Reads harvested cases and writes into a results directory; both are gitignored. It prints code
// displays (clinical, not identifying) and never narrative text — only which side words were detected.
//
// Usage:
//   npx env-cmd -f packages/zambdas/.env/zambda-secrets-local.json \
//     npx tsx tools/easy-chart-eval/diagnose-dx.ts [resultsDir]

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Oystehr from '@oystehr/sdk';
import { codeLaterality } from 'utils/lib/easy-chart/codes';
import { DiagnosisItem, GoldData } from './gold-types';
import { apiUrls, mintToken } from './token';

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

/**
 * Sides the narrative actually states. "All right", "right?" and "right now" are speech fillers, not
 * anatomy — and they are the reason a naive /\bright\b/ over the transcript would have APPROVED the one
 * laterality error in the corpus instead of catching it.
 */
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

/**
 * Clinical words shared between two code descriptions, ignoring the scaffolding that appears in almost
 * every ICD display. Two codes that share a word like "otitis" or "pyelonephritis" are about the same
 * organ and problem even when they sit in different categories — which is precisely the case the review
 * prompt's "NEVER ESCALATE A STATED DIAGNOSIS" rule is written for.
 */
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
  // KNOWN LIMIT: string overlap only. It catches "mastitis" vs "mastitis" and "lower back" vs "back",
  // but not UTI → pyelonephritis, which is the very pair the review prompt uses as its example — those
  // two displays share no word. Catching that class needs a curated relation table, the way
  // ETIOLOGY_QUALIFIER_EVIDENCE is curated; until then such a case lands in off-target and is undercounted.
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
      state: { diagnoses: { display: string; code?: string; removed?: boolean }[] };
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
    const charted = result.state.diagnoses.filter((dx) => !dx.removed);
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
        // Split what a single "off-target" bucket would hide. A case whose gold has no scorable diagnosis
        // gives the model nothing to be wrong about, and counting it as a model error is how a harness
        // manufactures a defect. A charted code that names the SAME condition as a gold item but from a
        // different category is the escalation the prompt forbids, and belongs in its own bucket.
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

      // Laterality first: it is the only cause here that puts the wrong side of a body in a record, and
      // it hides inside "same category" where a specificity metric would forgive it.
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
    // "exact" and "missed" are counters; the rest are the work list, so they are worth reading line by line.
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
  // The point of the whole tool: which LAYER each miss belongs to.
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
