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

const STRING: JsonSchema = { type: 'string' };
const STRING_ARRAY: JsonSchema = { type: 'array', items: { type: 'string' } };

/**
 * The per-field schema fragments. Everything numeric is a string on purpose — see the digit-loop
 * note at the top of this file. Do not "fix" these to `number`.
 */
const FIELD_SCHEMAS: Record<ActionField, JsonSchema> = {
  kind: STRING, // replaced per surface with the enum of that surface's kinds
  display: STRING,
  searchTerms: STRING_ARRAY,
  code: STRING,
  isPrimary: { type: 'boolean' },
  field: STRING,
  newText: STRING,
  text: STRING,
  finding: { type: 'string', enum: ['reports', 'denies'] },
  value: STRING, // digit-loop guard
  unit: STRING,
  systolic: STRING, // digit-loop guard
  diastolic: STRING, // digit-loop guard
  strength: STRING,
  doseForm: STRING,
  dispositionType: { type: 'string', enum: [...PLANNABLE_DISPOSITION_TYPES] },
  followUpInDays: STRING, // digit-loop guard
  procedureMatch: STRING,
  updates: {
    type: 'array',
    items: {
      type: 'object',
      properties: { field: STRING, value: STRING },
      required: ['field', 'value'],
    },
  },
  message: STRING,
  sourceText: STRING,
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
            question: STRING,
            rationale: STRING,
            highlight: STRING,
            partial: { type: 'boolean' },
            partialNote: STRING,
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
