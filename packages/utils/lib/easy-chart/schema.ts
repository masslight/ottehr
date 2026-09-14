// LLM response schemas, serialized from the action registry's Zod shapes, plus the guards that make
// them safe.
//
// SHAPE. One branch per action kind, discriminated on `kind`: `actions[]` items are an `anyOf` over the
// kinds the surface offers, each branch carrying exactly that kind's fields and its own `required` list.
// So the decoder cannot emit an add-diagnosis without a display, cannot put `strength` on a diagnosis,
// and is never offered a field the kind has no use for — which is what produced trap 3 below under the
// earlier ONE-FLAT-SHAPE design (every field optional on every kind). That design was chosen because
// constrained decoding was observed to handle `anyOf` poorly; this one is the measurement of the
// alternative, against the same harvested corpus.
//
// TRAP 1 — THE DIGIT LOOP. Vertex/Gemini structured output uses constrained decoding, and a JSON
// number has no closing token. When the model emits a numeric field, the digit run can self-reinforce
// at temperature 0 and run to the output cap: in one measured planner run 31% of calls died at
// MAX_TOKENS this way. So EVERY numeric field is declared with `guardedNumber()` — a string on the wire
// — and the numeric contract is restored right after parse by coerceNumericFields(). The serializer
// below REFUSES a bare z.number(), so the trap is a build error rather than a test.
//
// TRAP 3 — THE STRING LOOP. A JSON string has a closing token, but constrained decoding at temperature 0
// is under no obligation to emit it, and a repeated phrase self-reinforces the same way. Captured from a
// review call, 49,210 characters of `(primary) (primary) (primary)…` on an add-diagnosis `text` — a
// field the kind had no use for, offered by the flat shape. A cap makes such a loop terminate inside a
// valid string instead of destroying the response, so every string in the registry is capped (CAP in
// registry.ts) and the serializer REFUSES an uncapped one.
//
// FIELD ORDER is part of the cached prompt payload. Branches follow ACTION_KINDS and properties follow
// ACTION_FIELDS; do not reorder for cosmetics.

import { z } from 'zod';
import { ACTION_FIELDS, ActionField, ActionKind, Surface } from './actions';
import { CAP, capabilitiesForSurface, capabilityOf, NUMERIC_FIELDS, requiredFields, unwrapForWire } from './registry';

export { NUMERIC_FIELDS };

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
 * Zod → the JSON-schema fragment Vertex sees. Hand-rolled on purpose: it handles exactly the constructs
 * the registry may use, and it refuses the two that produced traps 1 and 3.
 */
export function toWire(schema: z.ZodTypeAny, path = '$'): JsonSchema {
  const s = unwrapForWire(schema);
  if (s instanceof z.ZodEnum) return { type: 'string', enum: [...(s._def.values as string[])] };
  if (s instanceof z.ZodString) {
    const max = s._def.checks.find((c) => c.kind === 'max') as { value: number } | undefined;
    if (!max) throw new Error(`${path}: every wire string must be capped (trap 3) — add .max(CAP.…)`);
    return { type: 'string', maxLength: max.value };
  }
  if (s instanceof z.ZodBoolean) return { type: 'boolean' };
  if (s instanceof z.ZodNumber) {
    throw new Error(`${path}: a JSON number has no closing token (trap 1) — declare it with guardedNumber()`);
  }
  if (s instanceof z.ZodArray) return { type: 'array', items: toWire(s.element, `${path}[]`) };
  if (s instanceof z.ZodObject) {
    const shape = s.shape as z.ZodRawShape;
    const properties: Record<string, JsonSchema> = {};
    for (const [key, value] of Object.entries(shape)) properties[key] = toWire(value, `${path}.${key}`);
    const required = Object.keys(shape).filter((key) => !shape[key].isOptional());
    return { type: 'object', properties, required };
  }
  throw new Error(`${path}: unsupported wire type ${s.constructor.name}`);
}

const SOURCE_TEXT_WIRE = z.string().max(CAP.sentence);

/**
 * Fields a surface REQUIRES on a kind beyond the shape's own required list.
 *
 * review / add-diagnosis / isPrimary: the diagnosis-swap card is a remove+add pair and the add has to
 * restate the removed diagnosis's primary status, or the swap leaves the note with no primary at all —
 * billing-invalid. Asking for it in prose is what produced the `(primary) (primary)…` string loop of
 * trap 3: the model expressed primacy as text because the boolean was optional. Demanding the boolean
 * gives it the right place to put the answer. On the plan surface the whole-plan invariant handles a
 * missing primary instead.
 */
const REQUIRED_ON_SURFACE: Partial<Record<Surface, Partial<Record<ActionKind, readonly ActionField[]>>>> = {
  review: { 'add-diagnosis': ['isPrimary'] },
};

/** One `anyOf` branch: the kind's own fields in ACTION_FIELDS order, kind first, sourceText last. */
function actionBranch(kind: ActionKind, surface: Surface): JsonSchema {
  const wire = toWire(capabilityOf(kind).shape, kind) as { properties: Record<string, JsonSchema> };
  const properties: Record<string, JsonSchema> = { kind: { type: 'string', enum: [kind] } };
  for (const field of ACTION_FIELDS) if (wire.properties[field]) properties[field] = wire.properties[field];
  properties.sourceText = toWire(SOURCE_TEXT_WIRE);
  const required = [...new Set(['kind', ...requiredFields(kind), ...(REQUIRED_ON_SURFACE[surface]?.[kind] ?? [])])];
  return { type: 'object', properties, required };
}

/**
 * The structured-output schema for one surface: `actions[]`, each item one of the branches for the
 * kinds that surface offers. Pinned by tests: branch set ≡ capabilitiesForSurface, branch properties ≡
 * allowedFields(kind), no number anywhere, every string capped.
 */
export function buildResponseSchema(surface: Surface): JsonSchema {
  const branches = capabilitiesForSurface(surface).map((kind) => actionBranch(kind, surface));
  return {
    type: 'object',
    properties: { actions: { type: 'array', items: { anyOf: branches } } },
    required: ['actions'],
  };
}

const STRING = (maxLength: number): JsonSchema => ({ type: 'string', maxLength });

/**
 * The review surface returns suggestion CARDS rather than bare actions: each carries its own
 * actions[] (so accepting one needs no new charting logic) plus the question the provider reads and
 * the reasoning behind it.
 */
export function buildReviewResponseSchema(): JsonSchema {
  const actionSchema = (buildResponseSchema('review').properties as Record<string, JsonSchema>).actions;
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

/** The `anyOf` branches of a surface schema, keyed by kind — for tests and tooling. */
export function actionBranchesOf(
  schema: JsonSchema
): Record<string, { properties: Record<string, JsonSchema>; required: string[] }> {
  const items = ((schema.properties as Record<string, JsonSchema>).actions as { items: { anyOf: JsonSchema[] } }).items;
  return Object.fromEntries(
    items.anyOf.map((branch) => {
      const b = branch as { properties: Record<string, JsonSchema>; required: string[] };
      return [(b.properties.kind as { enum: string[] }).enum[0], b];
    })
  );
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
