/**
 * Runs the CDC CDSi "Healthy Childhood and Adult" test cases (test-data/cdsi-test-cases.json) through the engine.
 *
 * Every case is run; the per-group pass/fail counts are printed, and the set of failing case ids must equal
 * test-data/cdsi-known-failures.json so a regression (or an unexpected fix) fails the suite. Known failures are
 * never hidden: see README.md "CDSi test cases".
 *
 * The CDC cases for the seasonal groups (FLU, COVID-19, RSV) describe the 2025–26 season, so those groups run
 * against the CDC 4.64 seasonal antigen files under test-data/cdc-4.64/ instead of the shipped AIRA 26.1
 * (2026–27) data. Everything else runs on the shipped data.
 *
 * Print the report with:
 *   cd packages/utils && npx vitest run lib/immunization-forecast/cdsi-test-cases.test.ts --silent=false
 */
import { describe, expect, it } from 'vitest';
import { buildRulesData, getRulesData, RulesData } from './data/rules-data';
import { ageInYears } from './dates';
import { forecastImmunizations } from './engine';
import { AntigenRules } from './rules-types';
import cdcCovid from './test-data/cdc-4.64/antigens/covid-19.json';
import cdcInfluenza from './test-data/cdc-4.64/antigens/influenza.json';
import cdcRsv from './test-data/cdc-4.64/antigens/rsv.json';
import knownFailuresJson from './test-data/cdsi-known-failures.json';
import fixture from './test-data/cdsi-test-cases.json';
import { ImmunizationGroupId } from './types';

interface FixtureDose {
  date: string;
  cvx: string;
  name: string;
  status: string;
  reason?: string;
}

interface FixtureCase {
  id: string;
  name: string;
  dob: string;
  gender: string;
  assessmentDate: string;
  vaccineGroup: string;
  seriesStatus: string;
  doses: FixtureDose[];
  forecast?: { doseNumber?: number; earliest?: string; recommended?: string; pastDue?: string };
  forecastTestType?: string;
}

const GROUP_IDS: Record<string, ImmunizationGroupId> = {
  DTAP: 'dtap',
  POL: 'ipv',
  HPV: 'hpv',
  HIB: 'hib',
  'COVID-19': 'covid',
  PCV: 'pcv',
  HepB: 'hepb',
  MMR: 'mmr',
  VAR: 'var',
  ROTA: 'rota',
  MCV: 'menacwy',
  MENB: 'menb',
  ZOSTER: 'zoster',
  FLU: 'flu',
  HepA: 'hepa',
  RSV: 'rsv',
};

const SEASONAL_GROUPS = new Set(['FLU', 'COVID-19', 'RSV']);

const EVAL_STATUS: Record<string, string> = { Valid: 'valid', 'Not Valid': 'invalid', Extraneous: 'extraneous' };
const SERIES_STATUS: Record<string, string> = {
  Complete: 'Complete',
  'Not complete': 'Not Complete',
  'Aged out': 'Aged Out',
  'Not recommended': 'Not Recommended',
  Immune: 'Immune',
};

interface CaseResult {
  id: string;
  group: string;
  ok: boolean;
  problems: string[];
}

const shipped = getRulesData();

/** Shipped data with the three seasonal antigens replaced by the CDC 4.64 (2025–26 season) versions. */
const season2025Rules: RulesData = buildRulesData(shipped.manifest, shipped.schedule, [
  ...[...shipped.antigens.values()].filter((a) => !['Influenza', 'COVID-19', 'RSV'].includes(a.antigen)),
  cdcInfluenza as unknown as AntigenRules,
  cdcCovid as unknown as AntigenRules,
  cdcRsv as unknown as AntigenRules,
]);

function groupIdFor(c: FixtureCase): ImmunizationGroupId {
  const base = GROUP_IDS[c.vaccineGroup];
  const adult = ageInYears(c.dob, c.assessmentDate) >= 19;
  if (base === 'pcv' && adult) return 'pneumo-adult';
  if (base === 'rsv' && adult) return 'rsv-adult';
  return base;
}

export function runCase(c: FixtureCase): CaseResult {
  const problems: string[] = [];
  const groupId = groupIdFor(c);
  if (!groupId) return { id: c.id, group: c.vaccineGroup, ok: false, problems: [`unknown group ${c.vaccineGroup}`] };
  const rules = SEASONAL_GROUPS.has(c.vaccineGroup) ? season2025Rules : shipped;
  const result = forecastImmunizations(
    {
      dob: c.dob,
      sex: c.gender === 'F' ? 'female' : c.gender === 'M' ? 'male' : 'unknown',
      asOf: c.assessmentDate,
      doses: c.doses.map((d, i) => ({ id: `d${i + 1}`, date: d.date, cvx: d.cvx, source: 'administered' as const })),
      groups: [groupId],
    },
    rules
  );
  const group = result.groups[0];
  if (!group) return { id: c.id, group: c.vaccineGroup, ok: false, problems: ['no group forecast'] };

  c.doses.forEach((d, i) => {
    const actual = group.doses.find((x) => x.id === `d${i + 1}`);
    const expected = EVAL_STATUS[d.status] ?? d.status;
    if (!actual) {
      // Test cases list doses of other vaccine groups too (e.g. a varicella dose in an MMR case); only doses
      // that map to this lane's antigens are expected in the lane.
      const antigens = rules.cvxMap.get(d.cvx.padStart(2, '0'))?.associations.map((a) => a.antigen) ?? [];
      const laneAntigens = laneAntigensFor(rules, groupId);
      if (antigens.some((a) => laneAntigens.includes(a)))
        problems.push(`dose ${i + 1}: missing (expected ${expected})`);
    } else if (actual.status !== expected) {
      problems.push(
        `dose ${i + 1} (${d.date} cvx ${d.cvx}): ${actual.status}${
          actual.reason ? ` (${actual.reason})` : ''
        } ≠ ${expected}${d.reason ? ` (${d.reason})` : ''}`
      );
    }
  });

  const expectedSeries = SERIES_STATUS[c.seriesStatus] ?? c.seriesStatus;
  if (group.seriesStatus !== expectedSeries) problems.push(`series: ${group.seriesStatus} ≠ ${expectedSeries}`);

  if (expectedSeries === 'Not Complete' && c.forecast) {
    const next = group.next;
    if (!next) problems.push('no next dose forecast');
    else {
      if (c.forecast.doseNumber !== undefined && next.n !== c.forecast.doseNumber)
        problems.push(`dose #: ${next.n} ≠ ${c.forecast.doseNumber}`);
      if (c.forecast.earliest && next.earliest !== c.forecast.earliest)
        problems.push(`earliest: ${next.earliest} ≠ ${c.forecast.earliest}`);
      if (c.forecast.recommended && next.recommended !== c.forecast.recommended)
        problems.push(`recommended: ${next.recommended} ≠ ${c.forecast.recommended}`);
      if (c.forecast.pastDue && next.pastDue !== c.forecast.pastDue)
        problems.push(`past due: ${next.pastDue} ≠ ${c.forecast.pastDue}`);
    }
  }
  return { id: c.id, group: c.vaccineGroup, ok: problems.length === 0, problems };
}

const LANE_VACCINE_GROUP: Record<ImmunizationGroupId, string> = {
  hepb: 'HepB',
  rota: 'Rotavirus',
  dtap: 'DTaP/Tdap/Td',
  hib: 'Hib',
  pcv: 'Pneumococcal',
  'pneumo-adult': 'Pneumococcal',
  ipv: 'Polio',
  rsv: 'RSV',
  'rsv-adult': 'RSV',
  flu: 'Influenza',
  covid: 'COVID-19',
  mmr: 'MMR',
  var: 'Varicella',
  hepa: 'HepA',
  hpv: 'HPV',
  menacwy: 'Meningococcal',
  menb: 'Meningococcal B',
  zoster: 'Zoster',
};

function laneAntigensFor(rules: RulesData, groupId: ImmunizationGroupId): string[] {
  return rules.vaccineGroupAntigens.get(LANE_VACCINE_GROUP[groupId]) ?? [];
}

const cases = (fixture as { cases: FixtureCase[] }).cases;
const knownFailures = (knownFailuresJson as { ids: string[] }).ids;

describe('CDSi healthy childhood and adult test cases', () => {
  const results = cases.map(runCase);

  it('reports pass/fail counts per vaccine group', () => {
    const byGroup = new Map<string, { pass: number; fail: number }>();
    for (const r of results) {
      const g = byGroup.get(r.group) ?? { pass: 0, fail: 0 };
      if (r.ok) g.pass++;
      else g.fail++;
      byGroup.set(r.group, g);
    }
    const lines = [...byGroup.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([g, c]) => `${g.padEnd(10)} ${String(c.pass).padStart(4)} pass ${String(c.fail).padStart(4)} fail`);
    const total = results.filter((r) => r.ok).length;
    const report = [`CDSi test cases: ${total}/${results.length} pass`, ...lines].join('\n');
    process.stdout.write(report + '\n');
    for (const r of results.filter((x) => !x.ok))
      process.stdout.write(`  FAIL ${r.id} [${r.group}]: ${r.problems.join('; ')}\n`);
    expect(total).toBeGreaterThan(0);
  });

  it('fails exactly the known failing cases (test-data/cdsi-known-failures.json)', () => {
    const failing = results
      .filter((r) => !r.ok)
      .map((r) => r.id)
      .sort();
    expect(failing).toEqual([...knownFailures].sort());
  });
});
