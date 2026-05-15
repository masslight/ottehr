/**
 * Manual test script for the recommend-billing-codes zambda.
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Usage:
 *   npx tsx scripts/test-billing-codes.ts [--env local]
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProcedureDetail, ProcedureSuggestion } from 'utils';
import { ScenarioChecks, TEST_SCENARIOS } from './test-billing-codes-config';

const RUNS_PER_SCENARIO = 1;
const ZAMBDA_URL = 'http://localhost:3000/local/zambda/recommend-billing-codes/execute';

// ── Config ────────────────────────────────────────────────────────────────────

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const jsonOutFlag = process.argv.indexOf('--json-out');
const jsonOutPath = jsonOutFlag !== -1 ? process.argv[jsonOutFlag + 1] : null;
const envFilePath = path.resolve(__dirname, '../packages/zambdas/.env', `zambda-secrets-${env}.json`);
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

async function callBillingCodes(token: string, input: ProcedureDetail): Promise<ProcedureSuggestion[]> {
  const response = await fetch(ZAMBDA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Zambda call failed: ${response.status} ${await response.text()}`);
  }
  const wrapper = (await response.json()) as { status: number; output: ProcedureSuggestion[] };
  if (wrapper.status !== 200) {
    throw new Error(`Zambda returned status ${wrapper.status}: ${JSON.stringify(wrapper.output)}`);
  }
  return wrapper.output;
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface TestResult {
  run: number;
  passed: boolean;
  suggestedCodes: string[];
  error?: string;
}

function checkCodes(suggestions: ProcedureSuggestion[], expectAnyCodes: string[]): boolean {
  return suggestions.some((s) => expectAnyCodes.includes(s.code));
}

async function runScenario(
  token: string,
  label: string,
  input: ProcedureDetail,
  checks: ScenarioChecks
): Promise<TestResult[]> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scenario: ${label} (${RUNS_PER_SCENARIO} runs)`);
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
    let passed = false;
    let suggestedCodes: string[] = [];
    let error: string | undefined;

    try {
      const output = await callBillingCodes(token, input);
      suggestedCodes = output.map((s) => s.code);
      passed = checkCodes(output, checks.expectAnyCodes);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const icon = passed ? '✓' : '✗';
    const codeList = suggestedCodes.length ? suggestedCodes.join(', ') : '(none)';
    let line = `  Run ${run}: ${icon}  (expected ${checks.expected}): ${codeList}`;
    if (error) line += `  ERROR: ${error}`;
    console.log(line);

    results.push({ run, passed, suggestedCodes, error });
  }

  const passCount = results.filter((r) => r.passed).length;
  console.log(`\n  Result: ${passCount}/${RUNS_PER_SCENARIO} passed`);

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Billing Codes – Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Zambda URL:  ${ZAMBDA_URL}`);

  console.log('\nAuthenticating...');
  const token = await getToken();
  console.log('Authenticated.');

  const allResults: TestResult[] = [];
  for (const scenario of TEST_SCENARIOS) {
    const results = await runScenario(token, scenario.label, scenario.input, scenario.checks);
    allResults.push(...results);
  }

  const totalPassed = allResults.filter((r) => r.passed).length;
  const totalRuns = allResults.length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Overall:  ${totalPassed}/${totalRuns} passed`);
  console.log('═'.repeat(60));

  if (jsonOutPath) {
    fs.writeFileSync(
      jsonOutPath,
      JSON.stringify({
        suite: 'billing-codes',
        timestamp: new Date().toISOString(),
        passed: totalPassed,
        total: totalRuns,
      })
    );
  }

  if (totalPassed < totalRuns) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
