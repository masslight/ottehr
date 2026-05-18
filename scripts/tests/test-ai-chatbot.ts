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

import { QuestionnaireResponse } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { callGemini, callZambda, createTestAppointment, deleteTestResources, getToken } from './shared';
import { TEST_SCENARIO } from './test-ai-chatbot-config';

// ── Config ────────────────────────────────────────────────────────────────────

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const jsonOutFlag = process.argv.indexOf('--json-out');
const jsonOutPath = jsonOutFlag !== -1 ? process.argv[jsonOutFlag + 1] : null;
const envFilePath = path.resolve(__dirname, '../../packages/zambdas/.env', `zambda-secrets-${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

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

  const text = await callGemini(prompt, projectId, apiKey, {
    type: 'OBJECT',
    properties: {
      passed: { type: 'BOOLEAN' },
      reason: { type: 'STRING' },
    },
    required: ['passed', 'reason'],
  });

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
  const token = await getToken(envConfig);
  console.log('Authenticated.');

  const projectId: string = envConfig.GOOGLE_CLOUD_PROJECT_ID;
  const apiKey: string = envConfig.GOOGLE_CLOUD_API_KEY;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID not found in env config');
  if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY not found in env config');

  console.log('\nCreating test appointment...');
  const { appointmentId, resourceIds } = await createTestAppointment(token, envConfig, 'AiChatbot');
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
    await deleteTestResources(token, envConfig, resourceIds);
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
