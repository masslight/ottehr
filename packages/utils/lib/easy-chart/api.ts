// Wire types for the Easy Chart endpoints.

import { RawAction, Surface } from './actions';

/**
 * Per-call model accounting. Returned by EVERY model call, because an LLM feature without per-call
 * accounting produces a surprise invoice.
 *
 * `cacheReadTokens` is the figure that matters most for cost: it is the only way to tell that prompt
 * caching is actually working. A cache read of zero across a whole session means the static-prefix
 * ordering broke and every call is being billed in full.
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

/** Why an attempt failed, as a coarse category. Counts only — never narrative text. */
export type ModelFailureReason =
  | 'timeout'
  | 'empty-response'
  | 'truncated'
  | 'unparseable'
  | 'rejected-by-validation'
  | 'error';

/**
 * Did the primary model fail, how many attempts were made, and why. This is how you learn that the
 * cheap model is failing 30% of the time instead of discovering it in a bill.
 */
export interface EscalationInfo {
  attempts: number;
  escalated: boolean;
  failures: ModelFailureReason[];
}

/**
 * A deterministic trigger that forced the model to address something (e.g. "the narrative mentions
 * follow-up but no disposition is charted"). Report BOTH whether the trigger fired and whether the
 * model then complied — without the pair you cannot distinguish "the guard never fired" from "the
 * guard fired and the model ignored it", which are opposite bugs with the same symptom.
 */
export interface TriggerReport {
  trigger: string;
  fired: boolean;
  complied: boolean;
}

/** One turn of the conversation, summarised for the model. See Phase 5.7b. */
export interface ConversationTurn {
  role: 'provider' | 'assistant';
  /** Provider turns are quoted VERBATIM — what the provider said is evidence. */
  text?: string;
  /** Assistant turns are summarised: one line per action. What it DID is already in the chart state. */
  charted?: string[];
  skipped?: string[];
}

export interface ChartPlanRequest {
  /** The provider's dictation, paste, transcript or typed request. */
  narrative: string;
  /**
   * Current free-text note fields, so the model can edit in place rather than overwrite.
   *
   * CLINICAL names, not storage keys — what a provider calls the field. The CC↔HPI storage swap is
   * applied by `chartKeyForNoteField` on the way in and out of chart data; nothing on the wire and
   * nothing in a prompt ever sees the swapped form.
   */
  noteContext?: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    mechanismOfInjury?: string;
    medicalDecision?: string;
  };
  /** A summary of what is already on the chart, so the model neither duplicates nor invents removals. */
  chartState?: string;
  /** Exam findings already checked, so remove-exam-finding can name them exactly. */
  chartedExamFindings?: string[];
  /** Practice template titles the model may apply. */
  templateTitles?: string[];
  /**
   * Used to read the REAL patient age and sex from the chart and to verify the caller may touch this
   * encounter. Ambient recordings contain cross-talk about other patients; demographics are never
   * inferred from the narrative.
   */
  encounterId?: string;
  /**
   * True when the note is already written and this narrative only adds to it.
   * A non-empty `chartState` does NOT imply this: a first dictation for a patient whose history came
   * from intake paperwork has a non-empty chart state and still needs the full pass.
   */
  incremental?: boolean;
  /** Bounded rolling window of prior turns. Never contains a transcript. */
  history?: ConversationTurn[];
  /** See CallerPatientStatus. Used only when the chart lookup yields nothing. */
  patientStatus?: CallerPatientStatus;
}

/** An action after every server guard has run. */
export interface PlannedAction extends RawAction {
  /**
   * The verbatim phrase justifying the action, present only when it was VERIFIED against the
   * narrative. Absent means the model inferred it, and the UI marks it so.
   */
  sourceText?: string;
  /** Set when a guard accepted the action but the provider should look at it. */
  caution?: string;
  /** Set when a guard could not establish a value and the provider must supply it. */
  needsProvider?: boolean;
}

/** An action a guard rejected outright, reported so the step is never a silent no-op. */
export interface RejectedAction {
  kind: string;
  display?: string;
  reason: string;
}

export interface ChartPlanResponse {
  actions: PlannedAction[];
  /** Actions the server refused, each with an honest reason the UI shows as "skipped because…". */
  rejected: RejectedAction[];
  usage: ModelUsage[];
  escalation: EscalationInfo;
  triggers: TriggerReport[];
}

export interface ReviewSuggestion {
  category: string;
  question: string;
  rationale?: string;
  highlight?: string;
  partial?: boolean;
  partialNote?: string;
  actions: PlannedAction[];
}

/**
 * New-vs-established, when the CALLER already knows it and the endpoint cannot look it up.
 *
 * The endpoint normally derives this from the chart, and that stays authoritative: demographics are read
 * from the record, never inferred from a narrative. This field is the narrow case where there is no
 * encounter to read — an eval corpus whose cases carry the status but only a hashed encounter id, for
 * PHI reasons. It is used ONLY when the chart lookup produced nothing, so a caller can never override
 * what the record says.
 *
 * It matters because the status decides the E&M code FAMILY: 9920x for a new patient, 9921x for an
 * established one. Without it the prompt falls back to the established family, which is wrong for every
 * new patient and shows up as a 100% E&M mismatch that looks like a model failure.
 */
export type CallerPatientStatus = 'new' | 'established';

export interface ChartReviewRequest extends Omit<ChartPlanRequest, 'incremental' | 'history'> {
  /** The note as written, which the review pass reads back against the narrative. */
  noteContext?: ChartPlanRequest['noteContext'];
}

export interface ChartReviewResponse {
  suggestions: ReviewSuggestion[];
  rejected: RejectedAction[];
  usage: ModelUsage[];
  escalation: EscalationInfo;
  triggers: TriggerReport[];
}

export const EASY_CHART_SURFACES: readonly Surface[] = ['plan', 'review'];
