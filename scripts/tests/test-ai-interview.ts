/**
 * Test for createResourcesFromAiInterview.
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Creates a test appointment via zambdas to get a real encounter ID, then calls
 * createResourcesFromAiInterview directly with a transcript, fetches the
 * resulting FHIR Observations, and uses Gemini to evaluate accuracy per category.
 *
 * Usage:
 *   npx tsx scripts/tests/test-ai-interview.ts [--env local]
 */

import { Observation } from 'fhir/r4b';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import * as path from 'path';
import { createOystehrClient } from 'utils';
import { createResourcesFromAiInterview } from '../../packages/zambdas/src/shared/ai';
import {
  callGemini,
  createTestAppointment,
  deleteTestResources,
  getToken,
  TEST_PATIENT_DOB,
  TEST_PATIENT_SEX,
} from './shared';
import { CategoryCheck, TEST_SCENARIO } from './test-ai-interview-config';

const AI_OBSERVATION_TAG_SYSTEM = 'https://fhir.zapehr.com/r4/StructureDefinitions/ai-observation';

// ── Config ────────────────────────────────────────────────────────────────────

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const jsonOutFlag = process.argv.indexOf('--json-out');
const jsonOutPath = jsonOutFlag !== -1 ? process.argv[jsonOutFlag + 1] : null;
const envFilePath = path.resolve(__dirname, '../../packages/zambdas/.env', `zambda-secrets-${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

// ── Evaluation ────────────────────────────────────────────────────────────────

interface CategoryResult {
  label: string;
  passed: boolean;
  reason: string;
}

async function evaluateCategories(
  transcript: string,
  extractedSummary: string,
  categoryChecks: CategoryCheck[],
  patientDetails: string
): Promise<CategoryResult[]> {
  const categoryList = categoryChecks.map((c) => `- ${c.label}: ${c.expected}`).join('\n');

  const prompt = `You are evaluating an AI medical intake system. Given a patient conversation transcript and the clinical data extracted from it, evaluate each clinical category for accuracy and completeness.

The AI was given the following patient details from the medical record before seeing the transcript:
${patientDetails}

Conversation transcript:
${transcript}

Extracted clinical data:
${extractedSummary}

Evaluate each of the following categories and determine whether the extracted data accurately captures the expected information:
${categoryList}

Return one result per category in the same order.`;

  const schema = {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            passed: { type: 'boolean' },
            reason: { type: 'string' },
          },
          required: ['label', 'passed', 'reason'],
        },
      },
    },
    required: ['categories'],
  };

  const text = await callGemini(prompt, envConfig.GOOGLE_CLOUD_PROJECT_ID, envConfig.GOOGLE_CLOUD_API_KEY, schema);
  const parsed = JSON.parse(text) as { categories: CategoryResult[] };
  return parsed.categories;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('AI Interview – Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Scenario:    ${TEST_SCENARIO.label}`);

  console.log('\nAuthenticating...');
  const token = await getToken(envConfig);
  console.log('Authenticated.');

  console.log('\nCreating test appointment...');
  const { encounterId, resourceIds } = await createTestAppointment(token, envConfig, 'AiInterview');
  console.log(`  Encounter ID: ${encounterId}`);

  const patientAge = Math.floor(DateTime.now().diff(DateTime.fromISO(TEST_PATIENT_DOB), 'years').years);
  const patientDetails = `Age: ${patientAge} year old, Sex: ${TEST_PATIENT_SEX}`;

  let categoryResults: CategoryResult[] = [];
  let createdResourceIds: string[] = [];

  try {
    const oystehr = createOystehrClient(token, envConfig.FHIR_API, envConfig.PROJECT_API);

    console.log('\nCalling createResourcesFromAiInterview...');
    const result = await createResourcesFromAiInterview(
      oystehr,
      encounterId,
      TEST_SCENARIO.transcript,
      null,
      undefined,
      null,
      null,
      envConfig
    );
    createdResourceIds = result
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(`  Created ${createdResourceIds.length} resource(s).`);

    // Fetch AI observations for this encounter
    const allObservations = (
      await oystehr.fhir.search<Observation>({
        resourceType: 'Observation',
        params: [{ name: 'encounter', value: encounterId }],
      })
    ).unbundle() as Observation[];

    const aiObservations = allObservations.filter((r) =>
      r.meta?.tag?.some((t) => t.system === AI_OBSERVATION_TAG_SYSTEM)
    );

    if (aiObservations.length === 0) throw new Error('No AI observations were created');

    console.log(`\n  Extracted ${aiObservations.length} AI observation(s):`);
    aiObservations.forEach((o) => console.log(`    [${o.code?.text}] ${o.valueString}`));

    const extractedSummary = aiObservations
      .filter((o) => o.valueString)
      .map((o) => `${o.code?.text}: "${o.valueString}"`)
      .join('\n');

    console.log('\nEvaluating with Gemini...');
    categoryResults = await evaluateCategories(
      TEST_SCENARIO.transcript,
      extractedSummary,
      TEST_SCENARIO.categoryChecks,
      patientDetails
    );

    console.log('');
    categoryResults.forEach((r) => {
      const icon = r.passed ? '✓' : '✗';
      console.log(`  ${icon} ${r.label}`);
      console.log(`      ${r.reason}`);
    });
  } finally {
    console.log('\nCleaning up test resources...');
    await deleteTestResources(token, envConfig, [...resourceIds, ...createdResourceIds]);
    console.log('Done.');
  }

  const passedCount = categoryResults.filter((r) => r.passed).length;
  const totalCount = categoryResults.length;
  const allPassed = passedCount === totalCount;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Overall: ${allPassed ? '✓ PASSED' : '✗ FAILED'}  (${passedCount}/${totalCount} categories)`);
  console.log('═'.repeat(60));

  if (jsonOutPath) {
    fs.writeFileSync(
      jsonOutPath,
      JSON.stringify({
        suite: 'ai-interview',
        timestamp: new Date().toISOString(),
        passed: passedCount,
        total: totalCount,
      })
    );
  }

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
