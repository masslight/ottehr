/**
 * Manual test script for the ai-suggestion-notes zambda.
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Usage:
 *   npx tsx scripts/test-ai-suggestion-note.ts [--env local]
 */

import * as fs from 'fs';
import * as path from 'path';
import { AISuggestionNotes, AISuggestionNotesInput } from 'utils';
import { TEST_SCENARIOS } from './test-ai-suggestion-note-config';

const RUNS_PER_SCENARIO = 2;
const ZAMBDA_URL = 'http://localhost:3000/local/zambda/ai-suggestion-notes/execute';

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

function checkSuggestions(suggestions: string[], expectContains: string[]): boolean {
  const combined = suggestions.join(' ').toLowerCase();
  return expectContains.some((phrase) => combined.includes(phrase.toLowerCase()));
}

async function runScenario(
  token: string,
  label: string,
  input: AISuggestionNotesInput,
  expectContains: string[]
): Promise<TestResult[]> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scenario: ${label} (${RUNS_PER_SCENARIO} runs)`);
  console.log(`Expecting one of: ${expectContains.map((s) => `"${s}"`).join(', ')}`);
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
    let passed = false;
    let suggestions: string[] = [];
    let error: string | undefined;

    try {
      const output = await callAISuggestionNotes(token, input);
      suggestions = output.suggestions;
      passed = checkSuggestions(suggestions, expectContains);
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
  console.log('AI Suggestion Notes – Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Zambda URL:  ${ZAMBDA_URL}`);

  console.log('\nAuthenticating...');
  const token = await getToken();
  console.log('Authenticated.');

  const allResults: TestResult[] = [];
  for (const scenario of TEST_SCENARIOS) {
    const results = await runScenario(token, scenario.label, scenario.input, scenario.expectContains);
    allResults.push(...results);
  }

  const totalPassed = allResults.filter((r) => r.passed).length;
  const totalRuns = allResults.length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Overall:  ${totalPassed}/${totalRuns} passed`);
  console.log('═'.repeat(60));

  if (totalPassed < totalRuns) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
