// Wire contract of the Easy Chart endpoints. Request types are inferred from the Zod schemas the
// zambdas validate against, so the client type and the server validation cannot drift apart.

import { z } from 'zod';
import { RawAction } from './actions';

/** A whole ambient transcript is a legitimate narrative; anything longer is not one visit. */
export const MAX_NARRATIVE_CHARS = 120_000;

const narrativeText = z
  .string()
  .max(MAX_NARRATIVE_CHARS)
  .refine((text) => text.trim() !== '', 'must not be blank');

const PatientStatusSchema = z.enum(['new', 'established']);
export type PatientStatus = z.infer<typeof PatientStatusSchema>;

export const ChartPlanRequestSchema = z.object({
  /** The transcript, or the narrative the provider typed when there is no transcript. */
  narrative: narrativeText,
  /** The chart, patient and access check are all read by this id. Only the eval harness omits it. */
  encounterId: z.string().min(1).optional(),
  /**
   * The generated narrative and the provider's edited version of it. The planner follows the provider's
   * changes over the transcript. Sent only when they differ.
   */
  providerEdits: z
    .object({ draft: z.string().max(MAX_NARRATIVE_CHARS), edited: z.string().max(MAX_NARRATIVE_CHARS) })
    .optional()
    .transform((edits) => (edits?.draft.trim() && edits.edited.trim() ? edits : undefined)),
  /** Used only when there is no encounter to read the status from (the eval harness). */
  patientStatus: PatientStatusSchema.optional(),
});
export type ChartPlanRequest = z.input<typeof ChartPlanRequestSchema>;

export const ChartNarrativeRequestSchema = z.object({
  transcript: narrativeText,
  encounterId: z.string().min(1).optional(),
  /** The transcript document the text came from; the narrative is stored on it for the next session. */
  documentId: z.string().min(1).optional(),
});
export type ChartNarrativeRequest = z.input<typeof ChartNarrativeRequestSchema>;

export const SaveTranscriptRequestSchema = z.object({
  transcript: narrativeText.transform((text) => text.trim()),
  encounterId: z.string().min(1),
  /** The transcript document being edited; omitted for a new transcript. */
  documentId: z.string().min(1).optional(),
});
export type SaveTranscriptRequest = z.input<typeof SaveTranscriptRequestSchema>;

export interface SaveTranscriptResponse {
  /** The transcript document written, so the client can select it once chart data refetches. */
  documentId: string;
}

/**
 * Per-model accounting, summed over the attempts of one call. Gemini's `inputTokens` already include
 * `cacheReadTokens` and it has no cache-write metric; Anthropic's exclude both. `outputTokens` exclude
 * `thinkingTokens`.
 */
export interface ModelUsage {
  provider: 'vertex' | 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  thinkingTokens: number;
  calls: number;
}

export type ModelFailureReason =
  | 'timeout'
  | 'empty-response'
  | 'truncated'
  | 'unparseable'
  | 'rejected-by-validation'
  | 'error';

export interface EscalationInfo {
  attempts: number;
  /** True when the primary model failed and the backup provider answered. */
  escalated: boolean;
  failures: ModelFailureReason[];
}

/**
 * A deterministic trigger (e.g. disposition language in the narrative) and whether the model complied.
 * Both halves are reported: "never fired" and "fired and ignored" have the same symptom otherwise.
 */
export interface TriggerReport {
  trigger: string;
  fired: boolean;
  complied: boolean;
  /** Which pattern of a trigger family fired. A label, never narrative text. */
  matchedPattern?: string;
}

/** An action after every server guard has run. */
export interface PlannedAction extends RawAction {
  /** Present only when the quote was verified; absent means the model inferred the action. */
  sourceText?: string;
  /** Which text `sourceText` was verified against. */
  sourceOrigin?: 'narrative' | 'edited-narrative' | 'chart';
  /** apply-template only: the practice template the server resolved the title to. */
  templateId?: string;
}

/** An action a guard refused, with a reason the provider reads. */
export interface RejectedAction {
  kind: string;
  display?: string;
  reason: string;
}

export interface ChartPlanResponse {
  actions: PlannedAction[];
  rejected: RejectedAction[];
  usage: ModelUsage[];
  escalation: EscalationInfo;
  triggers: TriggerReport[];
}

/** One provider-voice sentence of a generated narrative and the transcript snippets behind it. */
export interface NarrativeLine {
  text: string;
  /** Only snippets the server verified against the transcript; empty means the line is unbacked. */
  sources: string[];
  /** For an unbacked line: the closest stretch of the transcript, when one comes close. */
  approximateSource?: string;
}

export interface ChartNarrativeResponse {
  lines: NarrativeLine[];
  usage: ModelUsage[];
  escalation: EscalationInfo;
}
