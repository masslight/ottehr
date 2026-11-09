// LLM response schemas, serialized from the registry's Zod shapes. One `anyOf` branch per action kind,
// so the decoder cannot put a field on a kind that does not declare it.
//
// Two constrained-decoding traps shape the serializer, and it refuses to build a schema that walks into
// either of them:
//   - trap 1: a JSON number has no closing token, so a digit run can loop to the output cap. Numbers
//     travel as strings (`guardedNumber`), and the server's registry-shape check turns them back into numbers.
//   - trap 2: an uncapped string can loop the same way, so every string carries a `maxLength`.
//
// Property order is part of the cached prompt payload: branches follow ACTION_KINDS, properties follow
// ACTION_FIELDS.

import { z } from 'zod';
import { ACTION_FIELDS, ACTION_KINDS, ActionKind } from './actions';
import { CAP, capabilityOf, requiredFields, unwrapForWire } from './registry';

type JsonSchema = Record<string, unknown>;

/** Zod to the JSON-schema subset Vertex accepts, limited to the constructs the registry uses. */
export function toWire(schema: z.ZodTypeAny, path = '$'): JsonSchema {
  const s = unwrapForWire(schema);
  if (s instanceof z.ZodEnum) return { type: 'string', enum: [...(s._def.values as string[])] };
  if (s instanceof z.ZodString) {
    const max = s._def.checks.find((c) => c.kind === 'max') as { value: number } | undefined;
    if (!max) throw new Error(`${path}: every wire string must be capped (trap 2) — add .max(CAP.…)`);
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

function actionBranch(kind: ActionKind): JsonSchema {
  const wire = toWire(capabilityOf(kind).shape, kind) as { properties: Record<string, JsonSchema> };
  const properties: Record<string, JsonSchema> = { kind: { type: 'string', enum: [kind] } };
  for (const field of ACTION_FIELDS) if (wire.properties[field]) properties[field] = wire.properties[field];
  properties.sourceText = toWire(SOURCE_TEXT_WIRE);
  return { type: 'object', properties, required: ['kind', ...requiredFields(kind)] };
}

/** The structured-output schema: `{ actions: [...] }`, one branch per action kind. */
export function buildResponseSchema(): JsonSchema {
  const branches = ACTION_KINDS.map(actionBranch);
  return {
    type: 'object',
    properties: { actions: { type: 'array', items: { anyOf: branches } } },
    required: ['actions'],
  };
}

/** The `anyOf` branches of the response schema, keyed by kind. */
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
