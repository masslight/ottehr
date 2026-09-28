// LLM response schemas, serialized from the registry's Zod shapes. One `anyOf` branch per action kind,
// so the decoder cannot put a field on a kind that does not declare it.
//
// Two constrained-decoding traps shape the serializer, and it refuses to build a schema that walks into
// either of them:
//   - trap 1: a JSON number has no closing token, so a digit run can loop to the output cap. Numbers
//     travel as strings (`guardedNumber`) and are restored by `coerceNumericFields`.
//   - trap 3: an uncapped string can loop the same way, so every string carries a `maxLength`.
//
// Property order is part of the cached prompt payload: branches follow ACTION_KINDS, properties follow
// ACTION_FIELDS.

import { z } from 'zod';
import { ACTION_FIELDS, ActionField, ActionKind, Surface } from './actions';
import { REVIEW_CATEGORIES } from './api';
import { CAP, capabilitiesForSurface, capabilityOf, NUMERIC_FIELDS, requiredFields, unwrapForWire } from './registry';

export { NUMERIC_FIELDS };

/**
 * Restore the numeric contract of the guarded fields in place. A value that does not parse is deleted,
 * exactly as if the model had omitted it, so "about 5" never reaches a chart write.
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

/** Zod to the JSON-schema subset Vertex accepts, limited to the constructs the registry uses. */
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
 * Fields a surface requires beyond the shape's own list. Review's diagnosis swap must restate the
 * removed diagnosis's primary flag; while it was optional the model expressed it as text instead.
 */
const REQUIRED_ON_SURFACE: Partial<Record<Surface, Partial<Record<ActionKind, readonly ActionField[]>>>> = {
  review: { 'add-diagnosis': ['isPrimary'] },
};

function actionBranch(kind: ActionKind, surface: Surface): JsonSchema {
  const wire = toWire(capabilityOf(kind).shape, kind) as { properties: Record<string, JsonSchema> };
  const properties: Record<string, JsonSchema> = { kind: { type: 'string', enum: [kind] } };
  for (const field of ACTION_FIELDS) if (wire.properties[field]) properties[field] = wire.properties[field];
  properties.sourceText = toWire(SOURCE_TEXT_WIRE);
  const required = [...new Set(['kind', ...requiredFields(kind), ...(REQUIRED_ON_SURFACE[surface]?.[kind] ?? [])])];
  return { type: 'object', properties, required };
}

/** The structured-output schema for a surface: `{ actions: [...] }`, one branch per offered kind. */
export function buildResponseSchema(surface: Surface): JsonSchema {
  const branches = capabilitiesForSurface(surface).map((kind) => actionBranch(kind, surface));
  return {
    type: 'object',
    properties: { actions: { type: 'array', items: { anyOf: branches } } },
    required: ['actions'],
  };
}

const STRING = (maxLength: number): JsonSchema => ({ type: 'string', maxLength });

/** Review returns suggestion cards, each with the question the provider reads and its own actions. */
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
            category: { type: 'string', enum: [...REVIEW_CATEGORIES] },
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

/** The `anyOf` branches of a surface schema, keyed by kind. */
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

/** Paths of every field a schema declares as a JSON number (trap 1). */
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
