// Zod schemas for what the model returns, applied after `parseModelJson`.
//
// The envelope (`actions[]`, `suggestions[]`, `lines[]`) must be right or the attempt fails and escalates.
// Items are parsed one by one and leniently: Gemini decodes against a schema, but the Anthropic fallback
// does not, so a field can arrive as the wrong type, padded, or wrapped in quotes. A value that cannot be
// used is dropped, so the required-field gate reports it, and one bad item never fails the whole answer.

import { ActionField } from 'utils/lib/easy-chart/actions';
import { REVIEW_CATEGORIES } from 'utils/lib/easy-chart/api';
import { z } from 'zod';

const QUOTE_PAIRS: Record<string, string> = { '"': '"', "'": "'", '`': '`', '“': '”', '‘': '’' };

/** Trim, and drop one pair of quotes wrapped around the whole value ("\"Penicillin\"" → "Penicillin"). */
export function cleanModelText(value: string): string {
  const text = value.trim();
  const close = QUOTE_PAIRS[text[0]];
  if (text.length >= 2 && close && text.endsWith(close)) {
    const inner = text.slice(1, -1);
    if (!inner.includes(text[0]) && !inner.includes(close)) return inner.trim();
  }
  return text;
}

const text = z.string().transform(cleanModelText).optional().catch(undefined);

const flag = z
  .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
  .optional()
  .catch(undefined);

const terms = z
  .union([z.array(z.unknown()), z.string()])
  .transform((value) =>
    (Array.isArray(value) ? value : [value])
      .filter((term): term is string => typeof term === 'string')
      .map(cleanModelText)
      .filter(Boolean)
  )
  .optional()
  .catch(undefined);

/** Numeric fields travel as strings (schema.ts, trap 1); `coerceNumericFields` restores them. */
const numeric = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .optional()
  .catch(undefined);

const actionFields = {
  kind: z.string().transform((kind) => cleanModelText(kind).toLowerCase()),
  display: text,
  searchTerms: terms,
  code: text,
  isPrimary: flag,
  field: text,
  newText: z.string().optional().catch(undefined),
  text: text,
  finding: text,
  strength: text,
  doseForm: text,
  dispositionType: text,
  followUpInDays: numeric,
  message: text,
  sourceText: text,
} satisfies Record<ActionField, z.ZodTypeAny>;

/**
 * One action as the model sent it. Undeclared fields pass through so the guards can salvage a code the
 * model put in the wrong field before stripping them.
 */
export const ModelActionSchema = z.object(actionFields).passthrough();

export const PlanModelResponseSchema = z.object({ actions: z.array(z.unknown()) });

export const ReviewModelResponseSchema = z.object({ suggestions: z.array(z.unknown()) });

export const ModelSuggestionSchema = z.object({
  category: z.enum(REVIEW_CATEGORIES),
  question: z.string().transform(cleanModelText).pipe(z.string().min(1)),
  rationale: text,
  highlight: text,
  partial: flag,
  partialNote: text,
  actions: z.array(z.unknown()).catch([]),
});

export const NarrativeModelResponseSchema = z.object({
  lines: z.array(
    z.object({
      text: z.string(),
      sourceTexts: z
        .array(z.unknown())
        .catch([])
        .transform((sources) =>
          sources
            .filter((source): source is string => typeof source === 'string')
            .map(cleanModelText)
            .filter(Boolean)
        ),
    })
  ),
});
