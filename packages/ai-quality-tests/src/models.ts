/**
 * Model invocation helpers that mirror the production AI pipeline.
 *
 * These call the same models with the same prompts as the production code,
 * so we can evaluate output quality end-to-end.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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

// ── Gemini (production default for extraction) ──────────────────────────────

let geminiClient: ChatGoogleGenerativeAI | null = null;

function getGeminiClient(): ChatGoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY is required to run extraction tests');
    geminiClient = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-lite',
      apiKey,
      temperature: 0,
    });
  }
  return geminiClient;
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
    const response = await getGeminiClient().invoke([{ role: 'user', content: prompt }]);
    raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
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
    const response = await getGeminiClient().invoke([{ role: 'user', content: prompt }]);
    raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
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
