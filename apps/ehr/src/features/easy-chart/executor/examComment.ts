// Where a dictated exam finding goes when no checkbox can hold it: the free-text comment of the card it
// most likely belongs to. Shared by the executor, which writes it, and the panel, which shows it before
// apply, so the two always name the same card.

import { buildExamCommentFields, ExamLeaf, inferExamSectionKey } from 'utils/lib/config-helpers/exam-leaves';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';

/** Where a finding goes when its anatomy cannot be placed. */
const COMMENT_FALLBACK_SECTION = 'general';

interface ExamCommentTarget {
  sectionKey: string;
  /** The card's title as the exam tab shows it ("Ears"). */
  sectionLabel: string;
  /** The comment observation's field. */
  field: string;
}

/**
 * The card whose comment a finding would be filed in, from the wording and the model's synonyms, or
 * undefined when the exam has no comment field at all. What cannot be placed goes to the general card.
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

/** The comparison form of a comment: case, punctuation and spacing do not make a second finding. */
export const normalizeExamComment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
