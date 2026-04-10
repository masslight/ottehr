/**
 * Model invocation helpers that mirror the production AI pipeline.
 *
 * These call the same models with the same prompts as the production code,
 * so we can evaluate output quality end-to-end.
 *
 * The Gemini path uses the Vertex AI REST endpoint directly, matching
 * the production invokeChatbotVertexAI() in packages/zambdas/src/shared/ai.ts.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { getHpiExtractionPrompt, HPI_SUGGESTION_PROMPT } from './prompts.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ExtractionResult {
  raw: string;
  parsed: Record<string, unknown>;
}

export interface HpiSuggestionResult {
  raw: string;
  parsed: { suggestions: string[] };
}

// ── Gemini via Vertex AI (production default for extraction) ─────────────────

/**
 * Calls Gemini via the Vertex AI REST endpoint, mirroring invokeChatbotVertexAI()
 * from packages/zambdas/src/shared/ai.ts.
 */
async function invokeGeminiVertexAI(text: string): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID is required to run Gemini extraction tests');
  if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY is required to run Gemini extraction tests');

  const response = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          temperature: 0,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vertex AI request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.candidates[0].content.parts[0].text;
}

// ── Claude (alternative model for extraction) ───────────────────────────────

let claudeClient: ChatAnthropic | null = null;

function getClaudeClient(): ChatAnthropic {
  if (!claudeClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required to run Claude extraction tests');
    claudeClient = new ChatAnthropic({
      model: 'claude-haiku-4-5-20251001',
      anthropicApiKey: apiKey,
      temperature: 0,
    });
  }
  return claudeClient;
}

// ── Extraction (HPI chatbot + ambient scribe) ───────────────────────────────

/**
 * Calls the extraction model with the production prompt and a transcript.
 * Returns both the raw string response and the parsed JSON.
 */
export async function runExtraction(
  transcript: string,
  patientInfo: string,
  fields: string,
  model: 'gemini' | 'claude' = 'gemini'
): Promise<ExtractionResult> {
  const prompt = getHpiExtractionPrompt(patientInfo, fields) + '\n' + transcript;

  let raw: string;
  if (model === 'gemini') {
    raw = await invokeGeminiVertexAI(prompt);
  } else {
    const response = await getClaudeClient().invoke([{ role: 'user', content: prompt }]);
    raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      parsed = JSON.parse(match[1].trim());
    } else {
      throw new Error(`Failed to parse AI response as JSON: ${raw.slice(0, 200)}...`);
    }
  }

  return { raw, parsed };
}

// ── HPI suggestion ──────────────────────────────────────────────────────────

/**
 * Calls the AI model with the HPI suggestion prompt, mirroring the
 * ai-suggestion-notes zambda for the 'missing-hpi' type.
 */
export async function runHpiSuggestion(
  hpiText: string,
  model: 'gemini' | 'claude' = 'gemini'
): Promise<HpiSuggestionResult> {
  const prompt = HPI_SUGGESTION_PROMPT + `\nHPI: ${hpiText}`;

  let raw: string;
  if (model === 'gemini') {
    raw = await invokeGeminiVertexAI(prompt);
  } else {
    const response = await getClaudeClient().invoke([{ role: 'user', content: prompt }]);
    raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  }

  let parsed: { suggestions: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      parsed = JSON.parse(match[1].trim());
    } else {
      throw new Error(`Failed to parse HPI suggestion response as JSON: ${raw.slice(0, 200)}...`);
    }
  }

  return { raw, parsed };
}
