// A dataset's opt-in layers are declared once here: each layer carries its display metadata
// (label/description/default) alongside its Zod field schema. Everything else — UI checkbox options,
// the endpoint's include<Layer> input flags, the fetch flag map, the prompt's `availableLayers`, and
// the row/response schema — derives from this single map, so a layer's id never drifts across files.
import { z } from 'zod';
import { DateRange, DateRangeSchema } from '../query/date-range';
import { AdHocLayer } from '../query/layers';

/** One opt-in layer: its Zod field schema plus the metadata shown to the user and the LLM. */
export interface AdHocLayerDef {
  label: string;
  description: string;
  default?: boolean;
  schema: z.ZodObject<z.ZodRawShape>;
}
export type AdHocLayerMap = Record<string, AdHocLayerDef>;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const includeKey = (id: string): string => `include${cap(id)}`;

type Capitalized<S extends string> = S extends `${infer H}${infer T}` ? `${Uppercase<H>}${T}` : S;
/** The include<Layer> boolean flags an endpoint's input carries, one per layer id. */
export type LayerIncludeFlags<L extends AdHocLayerMap> = {
  [K in keyof L & string as `include${Capitalized<K>}`]?: boolean;
};

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
/** Every layer's fields, each optional (a layer's columns are present only when it was loaded). */
export type LayerRowFields<L extends AdHocLayerMap> = UnionToIntersection<
  { [K in keyof L]: Partial<z.infer<L[K]['schema']>> }[keyof L]
>;

/** The endpoint input: the date window + the derived include<Layer> flags. */
export type DatasetInput<L extends AdHocLayerMap> = { dateRange: DateRange } & LayerIncludeFlags<L>;

/** Runtime input schema (dateRange + one optional boolean per layer), typed from the layer map. */
export function datasetInputSchema<L extends AdHocLayerMap>(layers: L): z.ZodType<DatasetInput<L>> {
  const shape: z.ZodRawShape = { dateRange: DateRangeSchema };
  for (const id of Object.keys(layers)) shape[includeKey(id)] = z.boolean().optional();
  return z.object(shape) as unknown as z.ZodType<DatasetInput<L>>;
}

/** The response row schema: base columns + every layer's fields (each optional). Validates the
 *  endpoint response and, via `LayerRowFields`, types the mapped rows. */
export function datasetRowSchema(base: z.ZodObject<z.ZodRawShape>, layers: AdHocLayerMap): z.ZodObject<z.ZodRawShape> {
  return Object.values(layers).reduce((acc, def) => acc.merge(def.schema.partial()), base);
}

/** id → Zod object, for the LLM-schema serializer. */
export function layerSchemas(layers: AdHocLayerMap): Record<string, z.ZodObject<z.ZodRawShape>> {
  return Object.fromEntries(Object.entries(layers).map(([id, def]) => [id, def.schema]));
}

/** The selectable-layer metadata for the page checkboxes (and, filtered, the prompt's availableLayers). */
export function layerOptions(layers: AdHocLayerMap): AdHocLayer[] {
  return Object.entries(layers).map(([id, def]) => ({
    id,
    label: def.label,
    description: def.description,
    default: def.default ?? false,
  }));
}

/** The include<Layer> flags for a {layerId: boolean} selection — every layer present (true/false).
 *  Typed as the layer map's flags so `{ dateRange, ...layerIncludeFlags(...) }` is the endpoint input. */
export function layerIncludeFlags<L extends AdHocLayerMap>(
  layers: L,
  selected: Record<string, boolean> = {}
): LayerIncludeFlags<L> {
  return Object.fromEntries(Object.keys(layers).map((id) => [includeKey(id), !!selected[id]])) as LayerIncludeFlags<L>;
}

/** The layers NOT in the current selection — the ones a report may still ask the app to load. */
export function unloadedLayers(
  layers: AdHocLayerMap,
  selected: Record<string, boolean> = {}
): { id: string; label: string; description: string }[] {
  return Object.entries(layers)
    .filter(([id]) => !selected[id])
    .map(([id, def]) => ({ id, label: def.label, description: def.description }));
}
