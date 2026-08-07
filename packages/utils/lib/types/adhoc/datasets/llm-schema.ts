// The LLM-facing schema and its derivation from the Zod row schemas.
//
// Each endpoint's Zod schema is the single source of truth: it validates the response, derives the
// TS row type, and is serialized here for the generation prompt. The model sees field names, types,
// descriptions, and — as a field's `values` — either a closed vocabulary (z.enum members) OR, for a
// small whitelist of code/label fields, the distinct values present in the fetched rows (see
// sampleDomains). That per-field opt-in domain is the only path by which real values reach the
// model; no field outside the whitelist is sampled, and full rows never leave the client.
import { z } from 'zod';

/** One serialized field as the model sees it. `values` is a closed vocabulary (z.enum members) or a
 *  whitelisted, sampled code/label domain — see the module header and sampleDomains. */
export const LlmFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'string[]']),
  description: z.string(),
  /** True when the value may be null for some rows. */
  nullable: z.boolean().optional(),
  /** Closed vocabulary (z.enum members); for 'string[]' — the allowed element values. */
  values: z.array(z.string()).optional(),
});
export type LlmFieldSchema = z.infer<typeof LlmFieldSchema>;

/** Pointer to another opt-in layer the report could request (id + human text). */
export const LlmAvailableLayerSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});
export type LlmAvailableLayer = z.infer<typeof LlmAvailableLayerSchema>;

/** The full descriptor handed to the model — column metadata only, no rows. */
export const LlmDatasetSchemaSchema = z.object({
  datasetId: z.string(),
  label: z.string(),
  description: z.string(),
  rowCount: z.number(),
  fields: z.array(LlmFieldSchema),
  /** Layers that EXIST but are NOT loaded — the generator names their ids in `needsLayers`. */
  availableLayers: z.array(LlmAvailableLayerSchema).optional(),
  /** Other datasets the user could switch to, when the active one can't carry a concept. */
  otherDatasets: z.array(z.object({ label: z.string(), description: z.string() })).optional(),
});
export type LlmDatasetSchema = z.infer<typeof LlmDatasetSchemaSchema>;

/** Untyped row as handed to the sandboxed iframe; generated code references fields by name. */
export type AdHocRow = Record<string, unknown>;

// --- Zod → LLM field serialization -------------------------------------------------------------

const unwrap = (schema: z.ZodTypeAny): { inner: z.ZodTypeAny; nullable: boolean; description: string } => {
  let s = schema;
  let nullable = false;
  let description = s.description ?? '';
  // Unwrap optional/nullable/default wrappers, keeping the outermost description found.
  for (;;) {
    if (s instanceof z.ZodNullable) {
      nullable = true;
      s = s.unwrap();
    } else if (s instanceof z.ZodOptional) {
      s = s.unwrap();
    } else if (s instanceof z.ZodDefault) {
      s = s._def.innerType;
    } else {
      break;
    }
    if (!description && s.description) description = s.description;
  }
  return { inner: s, nullable, description };
};

const enumValues = (s: z.ZodTypeAny): string[] | undefined =>
  s instanceof z.ZodEnum ? [...(s._def.values as string[])] : undefined;

// A field's `values` come from one of two sources, in priority order:
//   1. z.enum members — a closed vocabulary declared in code (constant every run, not data).
//   2. a per-field opt-in domain sampled from the fetched rows (see sampleDomains) — distinct values
//      present, for whitelisted code/display fields only; the single place real values reach the
//      LLM, gated per field (the whitelist) and capped.
// `domains` maps a field name to its sampled distinct values; a field absent from it gets none.

/** Serialize one field of a Zod row object. Throws on a shape the ad-hoc schemas don't use, so a
 *  new unsupported field type is a loud failure in tests, not a silent schema gap. */
const toLlmField = (name: string, schema: z.ZodTypeAny, domains: Record<string, string[]>): LlmFieldSchema => {
  const { inner, nullable, description } = unwrap(schema);
  const base = { name, description, ...(nullable ? { nullable: true } : {}) };
  const sampled = domains[name];
  if (inner instanceof z.ZodString) return { ...base, type: 'string', ...(sampled ? { values: sampled } : {}) };
  if (inner instanceof z.ZodNumber) return { ...base, type: 'number' };
  if (inner instanceof z.ZodBoolean) return { ...base, type: 'boolean' };
  if (inner instanceof z.ZodEnum) return { ...base, type: 'string', values: enumValues(inner) };
  if (inner instanceof z.ZodArray) {
    const element = unwrap(inner.element as z.ZodTypeAny).inner;
    const values = enumValues(element) ?? sampled;
    return { ...base, type: 'string[]', ...(values ? { values } : {}) };
  }
  throw new Error(`llm-schema: unsupported zod type for field "${name}"`);
};

/** Serialize a Zod row object's fields for the prompt, skipping `exclude` (internal row-only ids).
 *  `domains` supplies sampled value sets for whitelisted fields (empty = none). */
export function llmFieldsFromZodObject(
  object: z.ZodObject<z.ZodRawShape>,
  exclude: readonly string[] = [],
  domains: Record<string, string[]> = {}
): LlmFieldSchema[] {
  return Object.entries(object.shape)
    .filter(([name]) => !exclude.includes(name))
    .map(([name, fieldSchema]) => toLlmField(name, fieldSchema as z.ZodTypeAny, domains));
}

/** The prompt-facing field list for a dataset: base fields (minus internal ids) plus the fields of
 *  each SELECTED opt-in layer, in declaration order. `domains` carries any sampled value sets. */
export function llmFieldsForLayers(
  base: z.ZodObject<z.ZodRawShape>,
  layers: Record<string, z.ZodObject<z.ZodRawShape>>,
  selected: Record<string, boolean> = {},
  internalFields: readonly string[] = [],
  domains: Record<string, string[]> = {}
): LlmFieldSchema[] {
  return [
    ...llmFieldsFromZodObject(base, internalFields, domains),
    ...Object.entries(layers)
      .filter(([id]) => selected[id])
      .flatMap(([, layer]) => llmFieldsFromZodObject(layer, internalFields, domains)),
  ];
}

// Max distinct values a whitelisted field may disclose. Above this the field is too high-cardinality
// for its value set to be useful (or safe) — the domain is omitted and the model falls back to
// prefix/range/runtime matching.
export const MAX_DOMAIN_VALUES = 500;

// Max length of a single disclosed value. A whitelisted field is meant to hold LABELS (a status, a
// code display, an order name); anything longer is narrative text typed by a clinician — the kind of
// content that must never reach the model. One over-long value disqualifies the WHOLE field (a
// truncated or partial domain would misrepresent what is present), and the report falls back to
// discovering values from the rows at runtime, inside the sandbox.
export const MAX_DOMAIN_VALUE_LENGTH = 200;

/** Sample the distinct present values of each WHITELISTED field from the fetched rows — the one
 *  path by which real values reach the LLM, gated per field by `domainFields`. Strings and string
 *  arrays are supported. A field is omitted when its distinct count exceeds MAX_DOMAIN_VALUES (too
 *  high-cardinality to disclose) or when ANY value is longer than MAX_DOMAIN_VALUE_LENGTH (narrative
 *  text, not a label — see that constant). Values are sorted for a stable prompt. */
export function sampleDomains(
  rows: Array<Record<string, unknown>>,
  domainFields: readonly string[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const field of domainFields) {
    const distinct = new Set<string>();
    let disqualified = false;
    for (const row of rows) {
      const value = row[field];
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (item === null || item === undefined || item === '') continue;
        const text = String(item);
        // Fail closed: narrative content disqualifies the field rather than being disclosed.
        if (text.length > MAX_DOMAIN_VALUE_LENGTH) {
          disqualified = true;
          break;
        }
        distinct.add(text);
        if (distinct.size > MAX_DOMAIN_VALUES) {
          disqualified = true;
          break;
        }
      }
      if (disqualified) break;
    }
    if (!disqualified && distinct.size > 0) out[field] = [...distinct].sort();
  }
  return out;
}
