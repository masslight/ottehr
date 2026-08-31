/**
 * Manual test script for the ai-suggestion-notes zambda — missing-hpi type only.
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Usage:
 *   npx tsx scripts/test-hpi-suggestions.ts [--env local]
 */

import * as fs from 'fs';
import * as path from 'path';
import { AISuggestionNotes, AISuggestionNotesInput } from 'utils';
import { getToken } from './shared';
import { TEST_SCENARIOS, TestScenario } from './test-hpi-suggestions-config';

const RUNS_PER_SCENARIO = 1;
const ZAMBDA_URL = 'http://localhost:3000/local/zambda/ai-suggestion-notes/execute';

const HPI_SCENARIOS = TEST_SCENARIOS;

// ── Config ────────────────────────────────────────────────────────────────────

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const jsonOutFlag = process.argv.indexOf('--json-out');
const jsonOutPath = jsonOutFlag !== -1 ? process.argv[jsonOutFlag + 1] : null;
const envFilePath = path.resolve(__dirname, '../../packages/zambdas/.env', `zambda-secrets-${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

// ── Zambda call ───────────────────────────────────────────────────────────────

async function callAISuggestionNotes(token: string, input: AISuggestionNotesInput): Promise<AISuggestionNotes> {
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
  const wrapper = (await response.json()) as { status: number; output: AISuggestionNotes };
  if (wrapper.status !== 200) {
    throw new Error(`Zambda returned status ${wrapper.status}: ${JSON.stringify(wrapper.output)}`);
  }
  return wrapper.output;
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface TestResult {
  run: number;
  passed: boolean;
  suggestions: string[];
  error?: string;
}

function checkSuggestions(suggestions: string[], scenario: TestScenario): boolean {
  if (scenario.expectEmpty) return suggestions.length === 0;
  const combined = suggestions.join(' ').toLowerCase();
  return scenario.expectContains.every((phrase) => combined.includes(phrase.toLowerCase()));
}

async function runScenario(token: string, scenario: TestScenario): Promise<TestResult[]> {
  const { label, input, expectContains, expectEmpty } = scenario;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scenario: ${label} (${RUNS_PER_SCENARIO} runs)`);
  if (expectEmpty) {
    console.log('Expecting: empty suggestions');
  } else {
    console.log(`Expecting one of: ${expectContains.map((s) => `"${s}"`).join(', ')}`);
  }
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
    let passed = false;
    let suggestions: string[] = [];
    let error: string | undefined;

    try {
      const output = await callAISuggestionNotes(token, input);
      suggestions = output.suggestions;
      passed = checkSuggestions(suggestions, scenario);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const icon = passed ? '✓' : '✗';
    const suggestionText = suggestions.length ? suggestions.join(' | ') : '(none)';
    let line = `  Run ${run}: ${icon}  ${suggestionText}`;
    if (error) line += `  ERROR: ${error}`;
    console.log(line);

    results.push({ run, passed, suggestions, error });
  }

  const passCount = results.filter((r) => r.passed).length;
  console.log(`\n  Result: ${passCount}/${RUNS_PER_SCENARIO} passed`);

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('HPI Suggestions – Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Zambda URL:  ${ZAMBDA_URL}`);

  console.log('\nAuthenticating...');
  const token = await getToken(envConfig);
  console.log('Authenticated.');

  const allResults: TestResult[] = [];
  for (const scenario of HPI_SCENARIOS) {
    const results = await runScenario(token, scenario);
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
        suite: 'hpi-suggestions',
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
