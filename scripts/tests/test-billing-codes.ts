/**
 * Manual test script for the recommend-billing-codes zambda, and the source of the "Billing Codes"
 * card on the AI accuracy dashboard (run nightly by the CI repo's workflow with --json-out).
 *
 * The zambda answers from the local rules engine for every procedure type a coding family covers,
 * so this suite only uses the types that still go to the model — see test-billing-codes-config.ts.
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Usage:
 *   npx tsx scripts/tests/test-billing-codes.ts [--env local] [--json-out results.json]
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeOutcomeKind, EvaluationResult, ProcedureFactsInput } from 'utils/lib/procedure-coding/model.types';
import { getToken } from './shared';
import { ScenarioChecks, TEST_SCENARIOS } from './test-billing-codes-config';

// One sample per scenario per night, as in the other suites. The model is not deterministic, but
// the dashboard already samples it repeatedly — once every night — so a scenario the model only
// sometimes gets right shows up as a line that moves between runs rather than a flat one.
const RUNS_PER_SCENARIO = 1;
const ZAMBDA_URL = 'http://localhost:3000/local/zambda/recommend-billing-codes/execute';

// ── Config ────────────────────────────────────────────────────────────────────

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const jsonOutFlag = process.argv.indexOf('--json-out');
const jsonOutPath = jsonOutFlag !== -1 ? process.argv[jsonOutFlag + 1] : null;
const envFilePath = path.resolve(__dirname, '../../packages/zambdas/.env', `zambda-secrets-${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

// ── Zambda call ───────────────────────────────────────────────────────────────

async function callBillingCodes(token: string, input: ProcedureFactsInput): Promise<EvaluationResult> {
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
  const wrapper = (await response.json()) as { status: number; output: EvaluationResult };
  if (wrapper.status !== 200) {
    throw new Error(`Zambda returned status ${wrapper.status}: ${JSON.stringify(wrapper.output)}`);
  }
  return wrapper.output;
}

/** The zambda returns a full evaluation; the model's answers arrive as the suggestions outcome. */
function suggestedCodes(evaluation: EvaluationResult): string[] {
  return evaluation.outcome.kind === CodeOutcomeKind.Suggestions
    ? evaluation.outcome.suggestions.map((suggestion) => suggestion.code)
    : [];
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface TestResult {
  run: number;
  passed: boolean;
  suggestedCodes: string[];
  error?: string;
}

async function runScenario(
  token: string,
  label: string,
  input: ProcedureFactsInput,
  checks: ScenarioChecks
): Promise<TestResult[]> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scenario: ${label} (${RUNS_PER_SCENARIO} runs)`);
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
    let passed = false;
    let codes: string[] = [];
    let error: string | undefined;

    try {
      const output = await callBillingCodes(token, input);
      codes = suggestedCodes(output);
      // A rules answer here means the scenario picked a procedure type the engine now covers, so
      // the run measures the engine rather than the model. Report it instead of silently passing.
      if (output.source !== 'ai') {
        error = `Answered by the rules engine, not AI — move this scenario to an uncovered procedure type`;
      } else {
        const wanted = checks.expectAnyCodes ? codes.some((code) => checks.expectAnyCodes!.includes(code)) : true;
        const clean = checks.expectNoneOfCodes ? !codes.some((code) => checks.expectNoneOfCodes!.includes(code)) : true;
        passed = wanted && clean;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const icon = passed ? '✓' : '✗';
    const codeList = codes.length ? codes.join(', ') : '(none)';
    let line = `  Run ${run}: ${icon}  (expected ${checks.expected}): ${codeList}`;
    if (error) line += `  ERROR: ${error}`;
    console.log(line);

    results.push({ run, passed, suggestedCodes: codes, error });
  }

  const passCount = results.filter((r) => r.passed).length;
  console.log(`\n  Result: ${passCount}/${RUNS_PER_SCENARIO} passed`);

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Billing Codes – AI Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Zambda URL:  ${ZAMBDA_URL}`);

  console.log('\nAuthenticating...');
  const token = await getToken(envConfig);
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
