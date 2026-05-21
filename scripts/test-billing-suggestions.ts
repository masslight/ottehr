/**
 * Manual test script for the recommend-billing-suggestions zambda.
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Usage:
 *   npx tsx scripts/test-billing-suggestions.ts [--env local]
 */

import * as fs from 'fs';
import * as path from 'path';
import { BillingSuggestionInput, BillingSuggestionOutput } from 'utils';
import { ScenarioChecks, TEST_SCENARIOS } from './test-billing-suggestions-config';

const RUNS_PER_SCENARIO = 1;
const ZAMBDA_URL = 'http://localhost:3000/local/zambda/recommend-billing-suggestions/execute';

// ── Config ────────────────────────────────────────────────────────────────────

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const envFilePath = path.resolve(__dirname, '../packages/zambdas/.env', `${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const response = await fetch(envConfig.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: envConfig.AUTH0_CLIENT,
      client_secret: envConfig.AUTH0_SECRET,
      audience: envConfig.AUTH0_AUDIENCE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Auth0 token request failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// ── Zambda call ───────────────────────────────────────────────────────────────

async function callBillingSuggestions(token: string, visit: BillingSuggestionInput): Promise<BillingSuggestionOutput> {
  const response = await fetch(ZAMBDA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(visit),
  });
  if (!response.ok) {
    throw new Error(`Zambda call failed: ${response.status} ${await response.text()}`);
  }
  const wrapper = (await response.json()) as { status: number; output: BillingSuggestionOutput };
  if (wrapper.status !== 200) {
    throw new Error(`Zambda returned status ${wrapper.status}: ${JSON.stringify(wrapper.output)}`);
  }
  return wrapper.output;
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface TestResult {
  run: number;
  icdScore: number; // 0–100
  cptScore: number; // 0–100, or 100 when no CPT check configured
  emPassed: boolean;
  passed: boolean;
  suggestedIcdCodes: string[];
  suggestedCptCodes: string[];
  suggestedEmCodes: string[];
  error?: string;
}

function scoreCheck(
  suggestedCodes: string[],
  expectedSlots: (string | string[])[],
  matchCode: (suggested: string, expected: string) => boolean = (s, e) => s === e
): number {
  if (expectedSlots.length === 0) return 100;
  const matched = expectedSlots.filter((slot) => {
    const expected = Array.isArray(slot) ? slot : [slot];
    return expected.some((exp) => suggestedCodes.some((sug) => matchCode(sug, exp)));
  }).length;
  return Math.round((matched / expectedSlots.length) * 100);
}

function icdMatches(suggested: string, expected: string): boolean {
  if (suggested === expected) return true;
  return suggested.split('.')[0] === expected.split('.')[0];
}

async function runScenario(
  token: string,
  label: string,
  visit: BillingSuggestionInput,
  checks: ScenarioChecks
): Promise<TestResult[]> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scenario: ${label} (${RUNS_PER_SCENARIO} runs)`);
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
    let icdScore = 0;
    let cptScore = 100; // default when no CPT check configured
    let emPassed = false;
    let suggestedIcdCodes: string[] = [];
    let suggestedCptCodes: string[] = [];
    let suggestedEmCodes: string[] = [];
    let error: string | undefined;

    try {
      const output = await callBillingSuggestions(token, visit);
      suggestedIcdCodes = output.icdCodes.map((c) => c.code);
      suggestedCptCodes = output.cptCodes.map((c) => c.code);
      suggestedEmCodes = output.emCode.map((c) => c.code);

      icdScore = scoreCheck(suggestedIcdCodes, checks.icd.codes, icdMatches);
      if (checks.cpt) {
        cptScore = scoreCheck(suggestedCptCodes, checks.cpt.codes);
      }
      emPassed = suggestedEmCodes.includes(checks.em.code);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const passed = icdScore === 100 && cptScore === 100 && emPassed;
    const icon = passed ? '✓' : '✗';
    const icdIcon = icdScore === 100 ? '✓' : icdScore > 0 ? '~' : '✗';
    const cptIcon = cptScore === 100 ? '✓' : cptScore > 0 ? '~' : '✗';
    const emIcon = emPassed ? '✓' : '✗';
    const icdList = suggestedIcdCodes.length ? suggestedIcdCodes.join(', ') : '(none)';
    const cptList = suggestedCptCodes.length ? suggestedCptCodes.join(', ') : '(none)';
    const emList = suggestedEmCodes.length ? suggestedEmCodes.join(', ') : '(none)';

    let line = `  Run ${run}: ${icon}  ICD ${icdIcon} (${icdScore}%, expected ${checks.icd.expected}): ${icdList}`;
    if (checks.cpt) {
      line += `  |  CPT ${cptIcon} (${cptScore}%, expected ${checks.cpt.expected}): ${cptList}`;
    }
    line += `  |  E&M ${emIcon} (expected ${checks.em.code}): ${emList}`;
    if (error) line += `  ERROR: ${error}`;
    console.log(line);

    results.push({
      run,
      icdScore,
      cptScore,
      emPassed,
      passed,
      suggestedIcdCodes,
      suggestedCptCodes,
      suggestedEmCodes,
      error,
    });
  }

  const passCount = results.filter((r) => r.passed).length;
  const avgIcdScore = Math.round(results.reduce((sum, r) => sum + r.icdScore, 0) / results.length);
  const avgCptScore = checks.cpt ? Math.round(results.reduce((sum, r) => sum + r.cptScore, 0) / results.length) : null;
  const emPassCount = results.filter((r) => r.emPassed).length;

  let summary = `\n  Result: ${passCount}/${RUNS_PER_SCENARIO} fully correct  (ICD avg: ${avgIcdScore}%`;
  if (avgCptScore !== null) {
    summary += `, CPT avg: ${avgCptScore}%`;
  }
  summary += `, E&M: ${emPassCount}/${RUNS_PER_SCENARIO})`;
  console.log(summary);

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Billing Suggestions – Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Zambda URL:  ${ZAMBDA_URL}`);

  console.log('\nAuthenticating...');
  const token = await getToken();
  console.log('Authenticated.');

  const allResults: TestResult[] = [];
  for (const scenario of TEST_SCENARIOS) {
    const results = await runScenario(token, scenario.label, scenario.visit, scenario.checks);
    allResults.push(...results);
  }

  const totalPassed = allResults.filter((r) => r.passed).length;
  const totalRuns = allResults.length;
  const overallAvgIcd = Math.round(allResults.reduce((sum, r) => sum + r.icdScore, 0) / totalRuns);
  const overallAvgCpt = Math.round(allResults.reduce((sum, r) => sum + r.cptScore, 0) / totalRuns);
  const totalEmPassed = allResults.filter((r) => r.emPassed).length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Overall:  ${totalPassed}/${totalRuns} fully correct`);
  console.log(`  ICD-10: ${overallAvgIcd}% avg score`);
  console.log(`  CPT:    ${overallAvgCpt}% avg score`);
  console.log(`  E&M:    ${totalEmPassed}/${totalRuns} passed`);
  console.log('═'.repeat(60));

  if (totalPassed < totalRuns) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
