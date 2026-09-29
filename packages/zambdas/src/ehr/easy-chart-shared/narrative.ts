// Transcript → provider-voice narrative, shared by the easy-chart-narrative endpoint and the recording
// pipeline in shared/ai.ts. Each line's claimed transcript snippets are verified with the planner's own
// quote matcher; a line left with none is shown to the provider as unbacked.
//
// shared/ai.ts imports this module, so it may import only ./model, ./model-output and utils.

import { ChartNarrativeResponse, NarrativeLine } from 'utils/lib/easy-chart/api';
import { buildNarrativePrompt } from 'utils/lib/easy-chart/narrative-prompt';
import { closestPassage, quoteOccursInNarrative } from 'utils/lib/easy-chart/provenance';
import { CAP } from 'utils/lib/easy-chart/registry';
import { toWire } from 'utils/lib/easy-chart/schema';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { callModelForJson } from './model';
import { NarrativeModelResponseSchema } from './model-output';

/** The prompt asks for 5–35 lines; anything past this is a runaway, not a long visit. */
export const MAX_NARRATIVE_LINES = 60;

const NARRATIVE_WIRE_SCHEMA = toWire(
  z.object({
    lines: z.array(
      z.object({
        text: z.string().max(CAP.sentence),
        sourceTexts: z.array(z.string().max(CAP.sentence)),
      })
    ),
  })
);

/** Throws when every model attempt failed or `signal` aborted it; the caller decides whether that is fatal. */
export async function generateNarrative(
  transcript: string,
  secrets: Secrets | null,
  logPrefix: string,
  signal?: AbortSignal
): Promise<ChartNarrativeResponse> {
  const prompt = buildNarrativePrompt(transcript);
  console.log(`[${logPrefix}] narrative prompt ${prompt.length} chars, transcript ${transcript.length} chars`);

  const { parsed, usage, escalation } = await callModelForJson({
    prompt,
    wireSchema: NARRATIVE_WIRE_SCHEMA,
    responseSchema: NarrativeModelResponseSchema,
    secrets,
    logPrefix,
    signal,
  });

  let snippets = 0;
  let dropped = 0;
  let approximated = 0;
  const lines: NarrativeLine[] = [];
  for (const raw of parsed.lines) {
    const text = raw.text.trim();
    if (!text) continue;
    if (lines.length >= MAX_NARRATIVE_LINES) break;
    const claimed = [...new Set(raw.sourceTexts)];
    const sources = claimed.filter((s) => {
      snippets += 1;
      if (quoteOccursInNarrative(s, transcript)) return true;
      dropped += 1;
      return false;
    });
    if (sources.length > 0) {
      lines.push({ text, sources });
      continue;
    }
    // The model usually paraphrased the right place: carry the closest transcript passage so the
    // provider sees what was actually said.
    const approximate = [...claimed, text]
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
