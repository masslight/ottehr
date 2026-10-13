// Render profiling: wraps the fetched resources in recording proxies so that, after a render, the
// studio knows which fields the report code actually read per resource type and per fetch step —
// the input for trimming each search to `_elements` — and which of those fields are mostly blank
// (the redesign's "mostly-blank check", ~80% threshold).
import type { FhirResource } from 'fhir/r4b';

export interface TypeProfile {
  /** Resources of this type across all steps. */
  count: number;
  /** Top-level elements read. */
  fields: string[];
  /** Full dot paths read (arrays flattened), capped. */
  paths: string[];
  /** Field → fraction of resources where it is blank, for fields read AND blank on more than the threshold. */
  blank: Record<string, number>;
}

export interface RenderProfile {
  byType: Record<string, TypeProfile>;
  /** Step id → resourceType → top-level elements read (for _elements). */
  byStep: Record<string, Record<string, string[]>>;
  blankThreshold: number;
}

const BLANK_THRESHOLD = 0.8;
const MAX_PATHS = 200;
const ALWAYS_PRESENT = new Set(['resourceType', 'id', 'meta']);

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

export function createProfiler(
  resources: Record<string, FhirResource[]>,
  enabled: boolean
): { resources: Record<string, FhirResource[]>; result: () => RenderProfile } {
  const paths = new Map<string, Set<string>>(); // type → paths
  const stepFields = new Map<string, Map<string, Set<string>>>(); // step → type → fields
  const proxies = new WeakMap<object, unknown>();

  const record = (type: string, step: string, path: string): void => {
    let set = paths.get(type);
    if (!set) paths.set(type, (set = new Set()));
    if (set.size < MAX_PATHS) set.add(path);
    const top = path.split('.')[0];
    let byType = stepFields.get(step);
    if (!byType) stepFields.set(step, (byType = new Map()));
    let fields = byType.get(type);
    if (!fields) byType.set(type, (fields = new Set()));
    fields.add(top);
  };

  const wrap = (value: unknown, type: string, step: string, prefix: string): unknown => {
    if (typeof value !== 'object' || value === null) return value;
    const cached = proxies.get(value);
    if (cached) return cached;
    const proxy = new Proxy(value as Record<string | symbol, unknown>, {
      get(target, prop, receiver) {
        const raw = Reflect.get(target, prop, receiver);
        if (typeof prop === 'symbol') return raw;
        if (Array.isArray(target)) {
          // Array indices and methods are not fields; elements keep the array's path.
          return typeof raw === 'function' ? raw : wrap(raw, type, step, prefix);
        }
        if (typeof raw === 'function') return raw;
        const path = prefix ? `${prefix}.${prop}` : prop;
        record(type, step, path);
        return wrap(raw, type, step, path);
      },
    });
    proxies.set(value, proxy);
    return proxy;
  };

  if (!enabled) {
    return {
      resources,
      result: () => ({ byType: {}, byStep: {}, blankThreshold: BLANK_THRESHOLD }),
    };
  }

  const wrapped: Record<string, FhirResource[]> = {};
  for (const [step, list] of Object.entries(resources)) {
    wrapped[step] = (list ?? []).map((resource) => wrap(resource, resource.resourceType, step, '') as FhirResource);
  }

  const result = (): RenderProfile => {
    const byType: Record<string, TypeProfile> = {};
    const rawByType = new Map<string, FhirResource[]>();
    for (const list of Object.values(resources)) {
      for (const resource of list ?? []) {
        const bucket = rawByType.get(resource.resourceType);
        if (bucket) bucket.push(resource);
        else rawByType.set(resource.resourceType, [resource]);
      }
    }
    for (const [type, pathSet] of paths) {
      const raw = rawByType.get(type) ?? [];
      const fields = Array.from(new Set(Array.from(pathSet).map((p) => p.split('.')[0]))).sort();
      const blank: Record<string, number> = {};
      for (const field of fields) {
        if (ALWAYS_PRESENT.has(field) || raw.length === 0) continue;
        const blankCount = raw.filter((r) => isBlank((r as unknown as Record<string, unknown>)[field])).length;
        const fraction = blankCount / raw.length;
        if (fraction > BLANK_THRESHOLD) blank[field] = Math.round(fraction * 100) / 100;
      }
      byType[type] = { count: raw.length, fields, paths: Array.from(pathSet).sort(), blank };
    }
    const byStep: Record<string, Record<string, string[]>> = {};
    for (const [step, types] of stepFields) {
      byStep[step] = {};
      for (const [type, fields] of types) byStep[step][type] = Array.from(fields).sort();
    }
    return { byType, byStep, blankThreshold: BLANK_THRESHOLD };
  };

  return { resources: wrapped, result };
}
