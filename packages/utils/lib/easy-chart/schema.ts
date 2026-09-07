// LLM response schemas, generated from the action registry, plus the two guards that make them safe.
//
// TRAP 1 — THE DIGIT LOOP. Vertex/Gemini structured output uses constrained decoding, and a JSON
// number has no closing token. When the model emits a numeric field on an action where it is
// meaningless (e.g. `"value": 0.` on add-diagnosis), the digit run self-reinforces at temperature 0
// and runs to the output cap. In one measured planner run 31% of calls died at MAX_TOKENS this way.
// So EVERY numeric field is declared as `{ type: 'string' }` and the numeric contract is restored
// right after parse by coerceNumericFields(). NUMERIC_FIELDS lives next to the schema so the guard
// and its undo cannot drift, and a test asserts no schema field is ever `type: 'number'`.
//
// TRAP 2 — ONE FLAT ACTION SHAPE. Every action shares one flat property set, all optional except
// `kind`. A discriminated `anyOf` schema would be cleaner and would structurally prevent trap 1, but
// constrained decoding handles `anyOf` poorly. If you want to revisit that, measure it — do not
// assume it works.
//
// FIELD ORDER is part of the cached prompt payload. It follows ACTION_FIELDS and must stay stable;
// do not reorder for cosmetics.

import { ACTION_FIELDS, ActionField, PLANNABLE_DISPOSITION_TYPES, Surface } from './actions';
import { capabilitiesForSurface, fieldsForSurface } from './registry';

/**
 * Fields whose real contract is numeric but which are declared as strings in every response schema.
 * Restored immediately after parse. Keep in sync with the schema below — the schema test pins it.
 */
export const NUMERIC_FIELDS = ['value', 'systolic', 'diastolic', 'followUpInDays'] as const;

/**
 * Restore the numeric contract for the digit-loop-guarded fields. A finite parse replaces the
 * string; an empty or non-numeric one is DELETED, which is exactly the same as the model having
 * omitted the field — a half-parsed `"value": "about 5"` must never reach a chart write.
 */
export function coerceNumericFields(obj: Record<string, unknown>, fields: readonly string[] = NUMERIC_FIELDS): void {
  for (const field of fields) {
    const v = obj[field];
    if (typeof v !== 'string') continue;
    const n = v.trim() === '' ? NaN : Number(v);
    if (Number.isFinite(n)) obj[field] = n;
    else delete obj[field];
  }
}

type JsonSchema = Record<string, unknown>;

/**
 * TRAP 3 — THE STRING LOOP, and why every string field below is length-capped.
 *
 * The digit-loop guard (trap 1) turns numeric fields into strings because a JSON number has no closing
 * token. A JSON *string* has one — the quote — but constrained decoding at temperature 0 is under no
 * obligation to emit it, and the same self-reinforcement happens with a repeated phrase. Captured from
 * a review call, 49,210 characters, `text` on an `add-diagnosis`:
 *
 *     "text": "Acute otitis externa, unspecified ear (primary diagnosis updated ...). (primary)
 *              (primary) (primary) (primary) ... "          ← ~5,000 times, to the output cap
 *
 * Two conditions produced it and both matter. The flat action shape (trap 2) offers `text` on
 * `add-diagnosis`, which has no use for it — the guard strips it, but only after a parse that never
 * happens. And `(primary)` is a token lifted straight from our own chart-state format, which check 2
 * then tells the model to "restate". Once it started, nothing in the schema could stop it: MAX_TOKENS,
 * a thrown attempt, a retry, and 18% of review calls ended on the backup model.
 *
 * A cap makes the loop terminate inside a valid string instead of destroying the response. The numbers
 * are per field and deliberately generous — roughly 4x the longest real value seen — so a cap can only
 * ever bite a runaway, never a legitimate value. `newText` is the outlier because it carries a whole
 * rewritten note field.
 */
const CAP = {
  /** Catalogue display / search text: a long one is "Allergic contact dermatitis due to drugs…". */
  display: 300,
  /** A code, a field name, a unit, a dose form — all short tokens. */
  token: 60,
  /** One clinical sentence: a disposition, a provider note, an exam comment. */
  sentence: 800,
  /** A whole rewritten note field. An MDM runs to a few thousand characters. */
  noteField: 8000,
} as const;

const STRING = (maxLength: number): JsonSchema => ({ type: 'string', maxLength });
const STRING_ARRAY: JsonSchema = { type: 'array', items: { type: 'string', maxLength: CAP.display } };

/**
 * The per-field schema fragments. Everything numeric is a string on purpose — see the digit-loop
 * note at the top of this file. Do not "fix" these to `number`. Every string is capped — see trap 3.
 */
const FIELD_SCHEMAS: Record<ActionField, JsonSchema> = {
  kind: STRING(CAP.token), // replaced per surface with the enum of that surface's kinds
  display: STRING(CAP.display),
  searchTerms: STRING_ARRAY,
  code: STRING(CAP.token),
  isPrimary: { type: 'boolean' },
  field: STRING(CAP.token),
  newText: STRING(CAP.noteField),
  text: STRING(CAP.sentence),
  finding: { type: 'string', enum: ['reports', 'denies'] },
  value: STRING(CAP.token), // digit-loop guard
  unit: STRING(CAP.token),
  systolic: STRING(CAP.token), // digit-loop guard
  diastolic: STRING(CAP.token), // digit-loop guard
  strength: STRING(CAP.token),
  doseForm: STRING(CAP.token),
  dispositionType: { type: 'string', enum: [...PLANNABLE_DISPOSITION_TYPES] },
  followUpInDays: STRING(CAP.token), // digit-loop guard
  procedureMatch: STRING(CAP.display),
  updates: {
    type: 'array',
    items: {
      type: 'object',
      properties: { field: STRING(CAP.token), value: STRING(CAP.sentence) },
      required: ['field', 'value'],
    },
  },
  message: STRING(CAP.sentence),
  sourceText: STRING(CAP.sentence),
};

/**
 * The structured-output schema for one surface. Kind enum ≡ the capabilities that surface offers;
 * declared properties ≡ the registry's field list for that surface. Both pinned by tests.
 */
export function buildResponseSchema(surface: Surface): JsonSchema {
  const fields = new Set(fieldsForSurface(surface));
  const properties: Record<string, JsonSchema> = {};

  // Iterate ACTION_FIELDS, not the set, so property order is deterministic across builds — the
  // serialized schema is part of the cached prompt prefix.
  for (const field of ACTION_FIELDS) {
    if (!fields.has(field)) continue;
    properties[field] =
      field === 'kind' ? { type: 'string', enum: capabilitiesForSurface(surface) } : FIELD_SCHEMAS[field];
  }

  return {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties,
          required: ['kind'],
        },
      },
    },
    required: ['actions'],
  };
}

/**
 * The review surface returns suggestion CARDS rather than bare actions: each carries its own
 * actions[] (so accepting one needs no new charting logic) plus the question the provider reads and
 * the reasoning behind it.
 */
export function buildReviewResponseSchema(): JsonSchema {
  const actionSchema = (buildResponseSchema('review').properties as Record<string, JsonSchema>).actions as JsonSchema;
  // `isPrimary` is REQUIRED on this surface, not merely allowed.
  //
  // The diagnosis-swap card is a remove+add pair and the add has to restate the removed diagnosis's
  // primary status, or the swap leaves the note with no primary at all — billing-invalid. Asking for it
  // in prose is what produced the `(primary) (primary) (primary)…` string loop in trap 3: the model
  // expressed primacy as text because the boolean was optional. Demanding the boolean gives it the
  // right place to put the answer. One flat action shape serves every kind here, so the requirement is
  // global — the prompt tells the model to set false where it is meaningless, and everything except
  // add-diagnosis ignores it. The dabrams implementation requires it for exactly this reason.
  const items = (actionSchema as { items?: Record<string, unknown> }).items;
  if (items) items.required = ['kind', 'isPrimary'];
  return {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: [
                'med-name',
                'diagnosis',
                'pertinent-negative',
                'em-level',
                'secondary-dx',
                'med-reconcile',
                'disposition',
                'cpt',
                'coherence',
                'dropped-commitment',
              ],
            },
            // Capped for the same reason the action fields are — see trap 3. A card's prose is a
            // question and a one-line reason, never a paragraph.
            question: STRING(CAP.sentence),
            rationale: STRING(CAP.sentence),
            highlight: STRING(CAP.display),
            partial: { type: 'boolean' },
            partialNote: STRING(CAP.sentence),
            actions: actionSchema,
          },
          required: ['category', 'question', 'actions'],
        },
      },
    },
    required: ['suggestions'],
  };
}

/**
 * Walks a generated schema and reports any field declared as a JSON number. Used by the schema test;
 * exported because the eval judge's hand-written schema needs the same check.
 */
export function findNumberTypedFields(schema: unknown, path = '$'): string[] {
  if (schema == null || typeof schema !== 'object') return [];
  const node = schema as Record<string, unknown>;
  const found: string[] = [];
  if (node.type === 'number' || node.type === 'integer') found.push(path);
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object') found.push(...findNumberTypedFields(value, `${path}.${key}`));
  }
  return found;
}
