// Where a dictated exam finding goes when no checkbox can hold it: the free-text comment of the card
// it most likely belongs to.
//
// ONE implementation, read from two places. The executor's `writeExamComment` files the words here at
// apply time; the recommendations panel says WHERE they will be filed before the provider applies, and
// whether the card's note already carries them. Both have to agree on the card and on what counts as
// "already there", or the panel promises one thing and the chart does another.

import { buildExamCommentFields, ExamLeaf, inferExamSectionKey } from 'utils/lib/config-helpers/exam-leaves';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';

/** Words that carry no anatomy, so a comment made only of these has nothing to file it under. */
const COMMENT_FALLBACK_SECTION = 'general';

export interface ExamCommentTarget {
  sectionKey: string;
  /** The card's own title, as the exam tab heads it ("Ears"). */
  sectionLabel: string;
  /** The comment observation's field, the one `examObservations` are noted under. */
  field: string;
}

/**
 * The card whose comment a finding would be filed in, or undefined when the exam has no comment field
 * to put it in at all. The inference reads the wording AND the model's search terms — a synonym often
 * names the anatomy the display leaves out — and is deliberately conservative (see `inferExamSectionKey`):
 * anything it cannot place goes to the general card rather than to a guessed one.
 */
export function examCommentTarget(
  display: string,
  searchTerms: string[] | undefined,
  leaves: ExamLeaf[],
  examConfig: typeof DefaultExamComponentsConfig = DefaultExamComponentsConfig
): ExamCommentTarget | undefined {
  const commentFields = buildExamCommentFields(examConfig);
  const inferred = inferExamSectionKey(`${display} ${searchTerms?.join(' ') ?? ''}`, leaves);
  const sectionKey = inferred && commentFields[inferred] ? inferred : COMMENT_FALLBACK_SECTION;
  const field = commentFields[sectionKey];
  if (!field) return undefined;
  return { sectionKey, sectionLabel: examConfig[sectionKey]?.label ?? sectionKey, field };
}

/**
 * The comparison form of a comment, for telling whether a note already carries a finding: case,
 * punctuation and spacing are not differences a provider would call a second finding.
 */
export const normalizeExamComment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
