/**
 * Manual test script for the ai-interview-start and ai-interview-handle-answer zambdas.
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Creates a test appointment by calling create-slot and create-appointment zambdas,
 * runs the chatbot scenario, then deletes all created resources.
 *
 * Usage:
 *   npx tsx scripts/test-ai-chatbot.ts [--env local]
 */

import { Location, QuestionnaireResponse, Schedule, Slot } from 'fhir/r4b';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import * as path from 'path';
import { CreateAppointmentResponse, createOystehrClient, CreateSlotParams, ServiceMode } from 'utils';
import { TEST_SCENARIO } from './test-ai-chatbot-config';

const BASE_URL = 'http://localhost:3000/local/zambda';

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
  if (!response.ok) throw new Error(`Auth0 token request failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// ── Zambda call helper ────────────────────────────────────────────────────────

const OPEN_ZAMBDAS = new Set(['create-slot']);

async function callZambda<T>(name: string, token: string, body: object): Promise<T> {
  const endpoint = OPEN_ZAMBDAS.has(name) ? 'execute-public' : 'execute';
  const response = await fetch(`${BASE_URL}/${name}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${name} failed: ${response.status} ${await response.text()}`);
  const wrapper = (await response.json()) as { status: number; output: T };
  if (wrapper.status !== 200)
    throw new Error(`${name} returned status ${wrapper.status}: ${JSON.stringify(wrapper.output)}`);
  return wrapper.output;
}

// ── Appointment setup / teardown ──────────────────────────────────────────────

async function createTestAppointment(token: string): Promise<{ appointmentId: string; resourceIds: string[] }> {
  const oystehr = createOystehrClient(token, envConfig.FHIR_API, envConfig.PROJECT_API);

  const fhirResources = (
    await oystehr.fhir.search<Location | Schedule>({
      resourceType: 'Location',
      params: [
        { name: 'status', value: 'active' },
        { name: '_count', value: '20' },
        { name: '_revinclude', value: 'Schedule:actor:Location' },
      ],
    })
  ).unbundle();

  const schedule = fhirResources.find((r) => r.resourceType === 'Schedule') as Schedule | undefined;
  if (!schedule?.id) throw new Error('No active schedule found in FHIR');

  const slot = await callZambda<Slot>('create-slot', token, {
    scheduleId: schedule.id,
    startISO: DateTime.now().toISO(),
    lengthInMinutes: 15,
    serviceModality: ServiceMode['in-person'],
    walkin: true,
    serviceCategoryCode: 'urgent-care',
  } satisfies CreateSlotParams);

  const appt = await callZambda<CreateAppointmentResponse>('create-appointment', token, {
    slotId: slot.id!,
    patient: {
      newPatient: true,
      firstName: 'Test',
      lastName: 'AiChatbot',
      dateOfBirth: '1990-01-01',
      sex: 'female',
      email: 'test.aichatbot@example.com',
      reasonForVisit: 'Sore throat and fever',
    },
    language: 'en',
  });

  return {
    appointmentId: appt.appointmentId,
    resourceIds: [
      `Encounter/${appt.encounterId}`,
      `Appointment/${appt.appointmentId}`,
      `QuestionnaireResponse/${appt.questionnaireResponseId}`,
      `RelatedPerson/${appt.relatedPersonId}`,
      `Patient/${appt.fhirPatientId}`,
      `Slot/${slot.id}`,
    ],
  };
}

async function deleteTestResources(token: string, resourceIds: string[]): Promise<void> {
  const oystehr = createOystehrClient(token, envConfig.FHIR_API, envConfig.PROJECT_API);
  await Promise.allSettled(
    resourceIds.map((ref) => {
      const [resourceType, id] = ref.split('/');
      return oystehr.fhir.delete({ resourceType: resourceType as any, id });
    })
  );
}

// ── Chatbot helpers ───────────────────────────────────────────────────────────

function getLatestQuestion(qr: QuestionnaireResponse): string {
  const questionnaire = qr.contained?.[0] as { item?: { linkId: string; text?: string }[] };
  const items = questionnaire?.item ?? [];
  const sorted = [...items].sort((a, b) => parseInt(a.linkId) - parseInt(b.linkId));
  return sorted[sorted.length - 1]?.text ?? '';
}

function getNextLinkId(qr: QuestionnaireResponse): string {
  return String(qr.item?.length ?? 0);
}

function checkResponse(text: string, expectContains: string[]): { passed: boolean; missing: string[] } {
  const lower = text.toLowerCase();
  const missing = expectContains.filter((phrase) => !lower.includes(phrase.toLowerCase()));
  return { passed: missing.length === 0, missing };
}

// ── LLM evaluation ────────────────────────────────────────────────────────────

interface EvalResult {
  passed: boolean;
  reason: string;
}

async function evaluateWithLLM(
  conversationHistory: { role: 'patient' | 'ai'; text: string }[],
  projectId: string,
  apiKey: string
): Promise<EvalResult> {
  const historyText = conversationHistory
    .map((turn) => `${turn.role === 'patient' ? 'Patient' : 'AI'}: ${turn.text}`)
    .join('\n');

  const prompt = `You are evaluating an AI medical intake chatbot for an urgent care visit. Here is the full conversation:

${historyText}

Is the AI's last response a good medical intake response given the conversation so far?`;

  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            passed: { type: 'BOOLEAN' },
            reason: { type: 'STRING' },
          },
          required: ['passed', 'reason'],
        },
      },
    }),
  });

  if (!response.ok) throw new Error(`LLM eval failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    const parsed = JSON.parse(text) as { passed?: boolean; reason?: string };
    return { passed: parsed.passed ?? false, reason: parsed.reason ?? text };
  } catch {
    return { passed: false, reason: `Could not parse LLM response: ${text}` };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('AI Chatbot – Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Scenario:    ${TEST_SCENARIO.label}`);

  console.log('\nAuthenticating...');
  const token = await getToken();
  console.log('Authenticated.');

  const projectId: string = envConfig.GOOGLE_CLOUD_PROJECT_ID;
  const apiKey: string = envConfig.GOOGLE_CLOUD_API_KEY;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID not found in env config');
  if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY not found in env config');

  console.log('\nCreating test appointment...');
  const { appointmentId, resourceIds } = await createTestAppointment(token);
  console.log(`  Appointment ID: ${appointmentId}`);

  let checksPassed = 0;
  let checksTotal = 0;
  const conversationHistory: { role: 'patient' | 'ai'; text: string }[] = [];

  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('Starting interview...');

    let currentQr = await callZambda<QuestionnaireResponse>('ai-interview-start', token, { appointmentId });
    const qrId = currentQr.id!;

    const initialQuestion = getLatestQuestion(currentQr);
    console.log(`\n  AI: ${initialQuestion}`);
    conversationHistory.push({ role: 'ai', text: initialQuestion });

    const initialCheck = checkResponse(initialQuestion, TEST_SCENARIO.initialExpectContains);
    checksTotal++;
    if (initialCheck.passed) checksPassed++;
    console.log(`  ${initialCheck.passed ? '✓' : '✗'} Initial question check`);
    if (!initialCheck.passed) {
      console.log(`    Missing: ${initialCheck.missing.join(', ')}`);
    }

    for (let i = 0; i < TEST_SCENARIO.conversation.length; i++) {
      const turn = TEST_SCENARIO.conversation[i];
      const linkId = getNextLinkId(currentQr);

      console.log(`\n  You: ${turn.answer}`);
      conversationHistory.push({ role: 'patient', text: turn.answer });

      currentQr = await callZambda<QuestionnaireResponse>('ai-interview-handle-answer', token, {
        questionnaireResponseId: qrId,
        linkId,
        answer: turn.answer,
      });

      const aiResponse = getLatestQuestion(currentQr);
      console.log(`  AI: ${aiResponse}`);
      conversationHistory.push({ role: 'ai', text: aiResponse });

      const eval_ = await evaluateWithLLM(conversationHistory, projectId, apiKey);
      checksTotal++;
      if (eval_.passed) checksPassed++;
      console.log(`  ${eval_.passed ? '✓' : '✗'} Turn ${i + 1} LLM eval: ${eval_.reason}`);

      if (currentQr.status === 'completed') {
        console.log('\n  Interview completed.');
        break;
      }
    }
  } finally {
    console.log('\nCleaning up test resources...');
    await deleteTestResources(token, resourceIds);
    console.log('Done.');
  }

  const allPassed = checksPassed === checksTotal;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Overall: ${checksPassed}/${checksTotal} checks passed — ${allPassed ? 'PASSED' : 'FAILED'}`);
  console.log('═'.repeat(60));

  if (jsonOutPath) {
    fs.writeFileSync(
      jsonOutPath,
      JSON.stringify({
        suite: 'ai-chatbot',
        timestamp: new Date().toISOString(),
        passed: checksPassed,
        total: checksTotal,
      })
    );
  }

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
