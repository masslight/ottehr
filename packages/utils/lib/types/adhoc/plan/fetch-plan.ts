// The fetch plan: the AI-written list of FHIR searches a report needs, run by the thin generic
// `adhoc-fetch-plan` zambda. Report code then runs on the fetched resources directly (no dataset /
// row-building step) — see documents/adhoc-report-redesign-design.html.
import { z } from 'zod';
import { DateRangeSchema } from '../query/date-range';
import { ADHOC_DATA_MAP_RESOURCE_TYPES } from './data-map';

export const FETCH_PLAN_VERSION = 1;

/** Hard limits the zambda enforces regardless of what a plan asks for. */
export const FETCH_PLAN_LIMITS = {
  maxSteps: 12,
  maxResourcesPerStep: 50_000,
  maxTotalBytes: 60 * 1024 * 1024,
  // A normal (paged) search gives up and falls back to bulk past this many resources in `auto` mode.
  autoBulkThreshold: 5_000,
  pageSize: 1_000,
  scopedBatchSize: 100,
  scopedBatchConcurrency: 4,
  // Above this many scoped values the batches go through the async-bulk path instead of paged searches.
  scopedBulkThreshold: 2_000,
} as const;

export const FetchStepParamSchema = z.object({
  name: z.string().min(1),
  // May contain {{start}} / {{end}} (ISO instants of the run's date range) and {{startDate}} /
  // {{endDate}} (their yyyy-MM-dd days).
  value: z.string(),
});
export type FetchStepParam = z.infer<typeof FetchStepParamSchema>;

/** A scoped step: its search values come from resources an earlier step fetched. */
export const FetchStepFromSchema = z.object({
  /** The earlier step's id. */
  step: z.string().min(1),
  /** Dot path into each source resource, arrays flattened: "participant.individual.reference",
   *  "diagnosis.condition.reference", "subject.reference", "id". */
  path: z.string().min(1),
  /** The search parameter the values are passed to, comma-joined in batches: "_id", "encounter", "patient". */
  param: z.string().min(1),
  /** When the path yields references ("Practitioner/abc"), keep only those of this type. For `_id`
   *  the "Type/" prefix is stripped; for reference params ("encounter") the full reference is kept. */
  keepType: z.string().optional(),
});
export type FetchStepFrom = z.infer<typeof FetchStepFromSchema>;

export const FetchStepSchema = z.object({
  /** The key the report code reads the results under: resources.<id>. */
  id: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'step id must be an identifier'),
  resourceType: z.string().min(1),
  description: z.string().optional(),
  params: z.array(FetchStepParamSchema).default([]),
  from: FetchStepFromSchema.optional(),
  /** auto: paged search, falling back to async-bulk past the threshold. */
  mode: z.enum(['auto', 'normal', 'bulk']).default('auto'),
  /** Top-level elements to request (_elements). id/resourceType/meta always come back. */
  elements: z.array(z.string().min(1)).optional(),
});
export type FetchStep = z.infer<typeof FetchStepSchema>;
export type FetchStepInput = z.input<typeof FetchStepSchema>;

export const FetchPlanSchema = z
  .object({
    version: z.literal(FETCH_PLAN_VERSION),
    steps: z.array(FetchStepSchema).min(1).max(FETCH_PLAN_LIMITS.maxSteps),
  })
  .superRefine((plan, ctx) => {
    const ids = new Set<string>();
    plan.steps.forEach((step, i) => {
      if (ids.has(step.id))
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: `duplicate step id "${step.id}"` });
      ids.add(step.id);
      if (!(ADHOC_DATA_MAP_RESOURCE_TYPES as readonly string[]).includes(step.resourceType)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'resourceType'],
          message: `"${step.resourceType}" is not described in the data map, so it cannot be read`,
        });
      }
      if (step.from) {
        const sourceIndex = plan.steps.findIndex((s) => s.id === step.from!.step);
        if (sourceIndex < 0 || sourceIndex >= i) {
          ctx.addIssue({
            code: 'custom',
            path: ['steps', i, 'from', 'step'],
            message: `"from.step" must name an EARLIER step (got "${step.from.step}")`,
          });
        }
      }
      for (const param of step.params) {
        // _revinclude=Type:param names the type that gets fetched; it must be readable too.
        if (param.name.startsWith('_revinclude')) {
          const type = param.value.split(':')[0];
          if (!(ADHOC_DATA_MAP_RESOURCE_TYPES as readonly string[]).includes(type)) {
            ctx.addIssue({
              code: 'custom',
              path: ['steps', i, 'params'],
              message: `_revinclude "${param.value}" fetches "${type}", which is not described in the data map`,
            });
          }
        }
      }
    });
  });
export type FetchPlan = z.infer<typeof FetchPlanSchema>;
export type FetchPlanInput = z.input<typeof FetchPlanSchema>;

export const RunFetchPlanInputSchema = z.object({
  plan: FetchPlanSchema,
  dateRange: DateRangeSchema.optional(),
  /** Always answer inline, never through a Z3 file (the local server has no response-size limit). */
  inline: z.boolean().optional(),
});
export type RunFetchPlanInput = z.infer<typeof RunFetchPlanInputSchema>;

export const FetchStepStatsSchema = z.object({
  id: z.string(),
  resourceType: z.string(),
  ms: z.number(),
  /** Resources returned, included ones too. */
  count: z.number(),
  /** Count per resourceType (an _include / _revinclude brings other types along). */
  byType: z.record(z.number()),
  bytes: z.number(),
  mode: z.enum(['normal', 'bulk', 'skipped']),
  /** HTTP round trips: pages, batches or bulk jobs. */
  requests: z.number(),
  /** For a scoped step: how many distinct values were fed in. */
  scopedValues: z.number().optional(),
  /** The search parameters as actually sent (templates resolved), for the Plan tab. */
  params: z.array(FetchStepParamSchema),
  error: z.string().optional(),
});
export type FetchStepStats = z.infer<typeof FetchStepStatsSchema>;

export const RunFetchPlanOutputSchema = z.object({
  /** Step id → resources. Present when inline. */
  resources: z.record(z.array(z.any())).optional(),
  /** Pre-signed Z3 url of the same JSON when the result was too large to inline. */
  downloadUrl: z.string().optional(),
  stats: z.array(FetchStepStatsSchema),
  totalMs: z.number(),
  totalBytes: z.number(),
  dateRange: DateRangeSchema.optional(),
});
export type RunFetchPlanOutput = z.infer<typeof RunFetchPlanOutputSchema>;

// ---------------------------------------------------------------------------------------------
// Pure helpers shared by the zambda (executing) and the studio (previewing / validating).
// ---------------------------------------------------------------------------------------------

/** Resolve {{start}} / {{end}} / {{startDate}} / {{endDate}} in a param value. */
export function resolveParamTemplates(value: string, dateRange?: { start: string; end: string }): string {
  if (!value.includes('{{')) return value;
  if (!dateRange) throw new Error(`"${value}" needs a date range, but the run has none`);
  return value
    .replace(/\{\{\s*start\s*\}\}/g, dateRange.start)
    .replace(/\{\{\s*end\s*\}\}/g, dateRange.end)
    .replace(/\{\{\s*startDate\s*\}\}/g, dateRange.start.slice(0, 10))
    .replace(/\{\{\s*endDate\s*\}\}/g, dateRange.end.slice(0, 10));
}

/** Values at a dot path across resources, arrays flattened, undefined/null dropped, deduped. */
export function extractPathValues(resources: unknown[], path: string): string[] {
  const segments = path.split('.').filter(Boolean);
  const out = new Set<string>();
  const walk = (node: unknown, depth: number): void => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth);
      return;
    }
    if (depth === segments.length) {
      if (typeof node === 'string' || typeof node === 'number') out.add(String(node));
      return;
    }
    if (typeof node === 'object') walk((node as Record<string, unknown>)[segments[depth]], depth + 1);
  };
  for (const resource of resources) walk(resource, 0);
  return Array.from(out);
}

/** Turn extracted values into search values for a scoped step. */
export function scopedSearchValues(values: string[], from: FetchStepFrom): string[] {
  const out = new Set<string>();
  for (const value of values) {
    const slash = value.indexOf('/');
    const isReference = slash > 0 && slash < value.length - 1;
    if (from.keepType && isReference && !value.startsWith(`${from.keepType}/`)) continue;
    if (from.param === '_id') out.add(isReference ? value.slice(slash + 1) : value);
    // A bare id fed to a reference parameter ("encounter") is made a full reference when the type is known.
    else if (!isReference && from.keepType) out.add(`${from.keepType}/${value}`);
    else out.add(value);
  }
  return Array.from(out);
}
