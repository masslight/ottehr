// Transcript → narrative generation: the one model call behind the easy-chart-narrative endpoint and
// the recording pipeline's pre-generation (shared/ai.ts).
//
// The model returns provider-voice lines, each with the transcript snippets it claims to have drawn
// from. Those claims are VERIFIED here with the same loose matcher the planner's provenance guard uses
// (quoteOccursInNarrative), and a snippet that is not really in the transcript is dropped. A line left
// with no verified snippet is "unbacked" — the UI flags it — so this filter IS the hallucination check
// and must never be loosened to make the numbers look better.
//
// IMPORT DIRECTION: shared/ai.ts imports this module, so it may import ONLY ./model.ts and utils. Anything
// that reaches back into shared/ai.ts (directly or through shared/auth, shared/helpers, …) is a cycle.
//
// PHI: line text and snippets are the visit. Log counts only.

import { ChartNarrativeResponse, NarrativeLine } from 'utils/lib/easy-chart/api';
import { buildNarrativePrompt } from 'utils/lib/easy-chart/narrative-prompt';
import { closestPassage, quoteOccursInNarrative } from 'utils/lib/easy-chart/provenance';
import { CAP } from 'utils/lib/easy-chart/registry';
import { toWire } from 'utils/lib/easy-chart/schema';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { callModelForJson } from './model';

/** The prompt asks for 5–35; anything past this is a runaway, not a long visit. */
export const MAX_NARRATIVE_LINES = 60;

/** What the model is asked to return. Every string capped (schema.ts, trap 3). */
const NARRATIVE_RESPONSE = z.object({
  lines: z.array(
    z.object({
      text: z.string().max(CAP.sentence),
      sourceTexts: z.array(z.string().max(CAP.sentence)),
    })
  ),
});

interface RawNarrativeLine {
  text: string;
  sourceTexts: string[];
}

/**
 * The validator callModelForJson runs on the parsed body. Strict where a mistake would break the
 * contract (`lines` must be an array, `text` a string) and forgiving where it would not: a missing or
 * malformed `sourceTexts` is coerced to [], which the verification step below renders as "unbacked"
 * rather than as a failed call.
 */
function validateNarrativeResponse(raw: unknown): RawNarrativeLine[] {
  const lines = (raw as { lines?: unknown })?.lines;
  if (!Array.isArray(lines)) throw new Error('response has no lines array');
  return lines.map((line) => {
    const text = (line as { text?: unknown })?.text;
    if (typeof text !== 'string') throw new Error('a line has no text');
    const sourceTexts = (line as { sourceTexts?: unknown })?.sourceTexts;
    return {
      text,
      sourceTexts: Array.isArray(sourceTexts) ? sourceTexts.filter((s): s is string => typeof s === 'string') : [],
    };
  });
}

/**
 * Generate the narrative for one transcript. Throws when every model attempt failed — the caller decides
 * whether that is fatal (the endpoint) or best-effort (the recording pipeline).
 */
export async function generateNarrative(
  transcript: string,
  secrets: Secrets | null,
  logPrefix: string
): Promise<ChartNarrativeResponse> {
  const prompt = buildNarrativePrompt(transcript);
  console.log(`[${logPrefix}] narrative prompt ${prompt.length} chars, transcript ${transcript.length} chars`);

  const { parsed, usage, escalation } = await callModelForJson(
    prompt,
    toWire(NARRATIVE_RESPONSE),
    secrets,
    logPrefix,
    validateNarrativeResponse
  );

  let snippets = 0;
  let dropped = 0;
  let approximated = 0;
  const lines: NarrativeLine[] = [];
  for (const raw of parsed) {
    const text = raw.text.trim();
    if (!text) continue;
    if (lines.length >= MAX_NARRATIVE_LINES) break;
    // Verified against the transcript with the planner's own matcher, then de-duplicated: the model
    // often cites the same phrase twice for one line, and a duplicate would highlight nothing new.
    const sources = [...new Set(raw.sourceTexts.map((s) => s.trim()).filter(Boolean))].filter((s) => {
      snippets += 1;
      if (quoteOccursInNarrative(s, transcript)) return true;
      dropped += 1;
      return false;
    });
    if (sources.length > 0) {
      lines.push({ text, sources });
      continue;
    }
    // Nothing verified verbatim. The model usually still pointed at the right place and paraphrased it, so
    // find the transcript stretch closest to what it claimed (or, failing that, to the line itself) and
    // carry it along: the line stays unbacked, but the provider sees what was actually said.
    const approximate = [...raw.sourceTexts.map((s) => s.trim()).filter(Boolean), text]
      .map((candidate) => closestPassage(transcript, candidate))
      .filter((hit): hit is { text: string; score: number } => hit !== undefined)
      .sort((a, b) => b.score - a.score)[0];
    if (approximate) approximated += 1;
    lines.push({ text, sources, ...(approximate ? { approximateSource: approximate.text } : {}) });
  }

  const backed = lines.filter((line) => line.sources.length > 0).length;
  console.log(
    `[${logPrefix}] narrative lines=${lines.length} backed=${backed} approximated=${approximated} snippets=${snippets} dropped=${dropped} ` +
      `escalated=${escalation.escalated} attempts=${escalation.attempts}`
  );

  return { lines, usage, escalation };
}
