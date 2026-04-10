/**
 * Model invocation helpers that mirror the production AI pipeline.
 *
 * The model under test is configured via the EXTRACTION_MODEL env var.
 * Format: "provider:model-name"
 *   - gemini:gemini-3.1-flash-lite-preview  (production default)
 *   - claude:claude-haiku-4-5-20251001
 *   - claude:claude-opus-4-20250514
 *
 * Gemini models use the Vertex AI REST endpoint (requires GOOGLE_CLOUD_PROJECT_ID
 * and GOOGLE_CLOUD_API_KEY), matching production invokeChatbotVertexAI().
 * Claude models use the Anthropic API (requires ANTHROPIC_API_KEY).
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

// ── Model config from env ───────────────────────────────────────────────────

const DEFAULT_MODEL = 'gemini:gemini-3.1-flash-lite-preview';

interface ModelConfig {
  provider: 'gemini' | 'claude';
  modelName: string;
}

export function getModelConfig(envOverride?: string): ModelConfig {
  const raw = envOverride ?? process.env.EXTRACTION_MODEL ?? DEFAULT_MODEL;
  const colonIdx = raw.indexOf(':');
  if (colonIdx === -1) {
    throw new Error(
      `Invalid EXTRACTION_MODEL format "${raw}". Expected "provider:model-name" ` +
        '(e.g. "gemini:gemini-3.1-flash-lite-preview" or "claude:claude-opus-4-20250514")'
    );
  }
  const provider = raw.slice(0, colonIdx) as ModelConfig['provider'];
  const modelName = raw.slice(colonIdx + 1);

  if (provider !== 'gemini' && provider !== 'claude') {
    throw new Error(`Unknown provider "${provider}". Supported: gemini, claude`);
  }

  return { provider, modelName };
}

// ── Gemini via Vertex AI ────────────────────────────────────────────────────

async function invokeGeminiVertexAI(text: string, modelName: string): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID is required for Gemini models');
  if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY is required for Gemini models');

  const response = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${modelName}:generateContent?key=${apiKey}`,
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

// ── Claude via Anthropic API ────────────────────────────────────────────────

const claudeClients = new Map<string, ChatAnthropic>();

function getClaudeClient(modelName: string): ChatAnthropic {
  let client = claudeClients.get(modelName);
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Claude models');
    client = new ChatAnthropic({
      model: modelName,
      anthropicApiKey: apiKey,
      temperature: 0,
    });
    claudeClients.set(modelName, client);
  }
  return client;
}

// ── Invoke any model ────────────────────────────────────────────────────────

async function invokeModel(text: string, config: ModelConfig): Promise<string> {
  if (config.provider === 'gemini') {
    return invokeGeminiVertexAI(text, config.modelName);
  }

  const response = await getClaudeClient(config.modelName).invoke([{ role: 'user', content: text }]);
  return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    throw new Error(`Failed to parse AI response as JSON: ${raw.slice(0, 200)}...`);
  }
}

// ── Extraction (HPI chatbot + ambient scribe) ───────────────────────────────

/**
 * Calls the extraction model with the production prompt and a transcript.
 * Uses EXTRACTION_MODEL env var to determine the model, or accepts an override.
 */
export async function runExtraction(
  transcript: string,
  patientInfo: string,
  fields: string,
  modelOverride?: string
): Promise<ExtractionResult> {
  const config = getModelConfig(modelOverride);
  const prompt = getHpiExtractionPrompt(patientInfo, fields) + '\n' + transcript;
  const raw = await invokeModel(prompt, config);
  const parsed = parseJsonResponse(raw);
  return { raw, parsed };
}

// ── HPI suggestion ──────────────────────────────────────────────────────────

/**
 * Calls the AI model with the HPI suggestion prompt.
 * Uses EXTRACTION_MODEL env var to determine the model, or accepts an override.
 */
export async function runHpiSuggestion(hpiText: string, modelOverride?: string): Promise<HpiSuggestionResult> {
  const config = getModelConfig(modelOverride);
  const prompt = HPI_SUGGESTION_PROMPT + `\nHPI: ${hpiText}`;
  const raw = await invokeModel(prompt, config);
  const parsed = parseJsonResponse(raw) as { suggestions: string[] };
  return { raw, parsed };
}
