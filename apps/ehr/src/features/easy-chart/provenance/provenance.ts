// Who wrote what, and on the strength of which words.
//
// This is the data behind the most important interaction in the feature: every AI-written row is
// tinted, explains itself on hover, and is click-correctable. Two states are visually distinct on
// purpose — an item SOURCED from something the provider said is blue, and an item the AI INFERRED is
// amber with an "inferred" badge. Amber vs blue is the whole point: it directs attention to what the
// model guessed rather than heard.
//
// Deliberately a pure store. No React, no fetching — the UI subscribes, and the tests do not need a
// rendered page.

export type ProvenanceOrigin = 'sourced' | 'inferred' | 'review' | 'template-default';

export interface ProvenanceRecord {
  origin: ProvenanceOrigin;
  /** The verbatim phrase this came from. Present only for `sourced`, and only when VERIFIED. */
  sourceText?: string;
  /** A guard's warning that the value was accepted but deserves a look. */
  caution?: string;
  /** The review pass's reasoning, shown on hover for an item it proposed. */
  reviewNote?: string;
  /** Which template supplied this, for a row that came from applying one. */
  templateName?: string;
  /** True once the provider has confirmed or corrected it. Clears the needs-review state. */
  reviewed?: boolean;
  /**
   * Per-field provenance for composite items. A procedure was dictated, but its field values may
   * have come from a template default — tracking only the item would claim the provider stated them.
   */
  fields?: Record<string, ProvenanceRecord>;
}

export interface ProvenanceState {
  /** resourceId → what we know about how that row got there. */
  byResourceId: Map<string, ProvenanceRecord>;
}

export const emptyProvenance = (): ProvenanceState => ({ byResourceId: new Map() });

export interface RecordInput {
  resourceIds: string[];
  sourceText?: string;
  caution?: string;
  reviewNote?: string;
  templateName?: string;
  lowConfidence?: boolean;
}

/**
 * Mark rows as AI-written.
 *
 * A row with a VERIFIED quote is `sourced`; anything else is `inferred`, including a bulk-run
 * auto-pick from several near-equal matches. Being honest here is the point — an empty sourceText is
 * the signal that tells a provider to look closely, so filling it in from a guess defeats it.
 */
export function recordAiAuthorship(state: ProvenanceState, input: RecordInput): ProvenanceState {
  const byResourceId = new Map(state.byResourceId);
  const quote = input.sourceText?.trim();
  const origin: ProvenanceOrigin = input.templateName
    ? 'template-default'
    : quote && !input.lowConfidence
    ? 'sourced'
    : 'inferred';

  for (const id of input.resourceIds) {
    byResourceId.set(id, {
      origin,
      ...(quote ? { sourceText: quote } : {}),
      ...(input.caution ? { caution: input.caution } : {}),
      ...(input.reviewNote ? { reviewNote: input.reviewNote } : {}),
      ...(input.templateName ? { templateName: input.templateName } : {}),
    });
  }
  return { byResourceId };
}

/** Mark an item reviewed without changing it — the per-item "looks right" affordance. */
export function markReviewed(state: ProvenanceState, resourceIds: string[]): ProvenanceState {
  const byResourceId = new Map(state.byResourceId);
  for (const id of resourceIds) {
    const record = byResourceId.get(id);
    if (record) byResourceId.set(id, { ...record, reviewed: true });
  }
  return { byResourceId };
}

/** "Confirm all" in the readiness banner. */
export function markAllReviewed(state: ProvenanceState): ProvenanceState {
  return markReviewed(state, [...state.byResourceId.keys()]);
}

/**
 * The provider hand-edited this row, so the AI's authorship flag for it is CLEARED. The note must
 * reflect who really wrote what; leaving the mark would attribute the provider's own words to the
 * assistant. Also used when a row is deleted, so the map does not grow stale ids.
 */
export function clearAuthorship(state: ProvenanceState, resourceIds: string[]): ProvenanceState {
  const byResourceId = new Map(state.byResourceId);
  for (const id of resourceIds) byResourceId.delete(id);
  return { byResourceId };
}

/** Per-field provenance for a composite item (a procedure and its template-default field values). */
export function recordFieldAuthorship(
  state: ProvenanceState,
  resourceId: string,
  fields: Record<string, ProvenanceRecord>
): ProvenanceState {
  const byResourceId = new Map(state.byResourceId);
  const existing = byResourceId.get(resourceId) ?? { origin: 'inferred' as ProvenanceOrigin };
  byResourceId.set(resourceId, { ...existing, fields: { ...existing.fields, ...fields } });
  return { byResourceId };
}

/**
 * Mark ONE field of a composite item reviewed. A procedure's `complications` and `timeSpent` are
 * separate assertions from the procedure itself, so they are confirmed separately; the item's own
 * record stays until every field it carries has been seen.
 */
export function markProcedureFieldReviewed(state: ProvenanceState, resourceId: string, field: string): ProvenanceState {
  const record = state.byResourceId.get(resourceId);
  if (!record?.fields?.[field]) return state;
  const byResourceId = new Map(state.byResourceId);
  byResourceId.set(resourceId, {
    ...record,
    fields: { ...record.fields, [field]: { ...record.fields[field], reviewed: true } },
  });
  return { byResourceId };
}

export const isAiAuthored = (state: ProvenanceState, resourceId: string): boolean => state.byResourceId.has(resourceId);

/** Rows the provider has not yet confirmed. Drives the "N items need review" banner. */
export function needsReview(state: ProvenanceState): string[] {
  return [...state.byResourceId.entries()].filter(([, record]) => !record.reviewed).map(([id]) => id);
}

/**
 * The hover text for a row: the verbatim quote it came from, the review pass's reasoning, or an
 * honest statement that nothing in the visit said it.
 *
 * This is also the answer to "why did you code it that way?". Route that question HERE, never to the
 * model: a model asked to justify a past decision produces a plausible reason whether or not it was
 * the real one, and in a medical record that is worse than no answer.
 */
export function explainProvenance(record: ProvenanceRecord | undefined): string {
  if (!record) return 'Entered by you.';
  const parts: string[] = [];
  switch (record.origin) {
    case 'sourced':
      parts.push(record.sourceText ? `Charted from: “${record.sourceText}”` : 'Charted from the visit.');
      break;
    case 'inferred':
      parts.push('Inferred — nothing in the visit stated it directly.');
      break;
    case 'review':
      parts.push('Proposed by the review pass.');
      break;
    case 'template-default':
      parts.push(
        record.templateName ? `Template default (${record.templateName}) — verify.` : 'Template default — verify.'
      );
      break;
  }
  if (record.reviewNote) parts.push(record.reviewNote);
  if (record.caution) parts.push(record.caution);
  return parts.join(' ');
}
