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
  // The paged / bulk boundary of an `auto` step: a date-bounded step whose density hint expects more primary resources
  // than this runs as bulk jobs from the start; a paged window that passes it (no hint, or the density drifted) is
  // redone as bulk. Measured 2026-10-14: a page costs 0.1–1 s on synth and several times that on a busy practice, a bulk
  // job ~2.7 s fixed plus the download — so bulk pays off from a handful of pages up.
  autoBulkThreshold: 5_000,
  pageSize: 1_000,
  // Ids per scoped batch (paged or bulk) without a density hint — the search is a POST, so no url limit. Measured on
  // synth 2026-10-14: 2,697 Encounters by appointment id in batches of 100 / 250 / 500 / 1,000 took 5.2 / 3.3 / 2.4 /
  // 1.7 s, all complete; 1,000 Patients by _id likewise. But on a busy practice (2026-10-14, read-only) an
  // Observation search for 1,000 encounter ids hit Oystehr's 14 s request timeout (504) on its first page, while 250
  // and 500 ids answered each page comfortably; 250 leaves headroom for busier practices.
  scopedBatchSize: 250,
  // Searches in flight at once across a whole plan run — its steps, date windows and scoped batches together.
  maxConcurrentRequests: 8,
  // The most ids one pre-sized bulk batch may carry (the search is a POST, so the limit is the server's, not the url's).
  scopedBulkBatchMax: 1_000,
} as const;

/**
 * Primary resources a pre-sized bulk job aims for. Jobs run side by side (up to maxConcurrentRequests), so smaller
 * windows finish sooner: on a busy practice (2026-10-14, read-only) a year of Conditions ran twice as fast in 4 windows
 * as in one job and nearly four times as fast in 8; a year of QuestionnaireResponses (hundreds of MB) about five times
 * as fast in 12 windows as in 2. A year there is also skewed — one half-year window held almost nothing and the other
 * filled the cap — so a window a third of the 30,000 cap also keeps most windows under it. 10,000 keeps the standard
 * visit plan at a busy practice at about a dozen jobs, inside REQUEST_BUDGET; smaller is faster still.
 */
export const ASYNC_BULK_TARGET = 10_000;

/** Primary resources a paged date window aims for: a few pages each, run side by side, and still paged when the density doubles. */
export const PAGED_WINDOW_TARGET = FETCH_PLAN_LIMITS.autoBulkThreshold / 2;

/** The density a step showed on an earlier run: primary resources per day of range, or per scoped id. */
export const FetchStepDensitySchema = z.object({
  recordsPerDay: z.number().nonnegative().optional(),
  recordsPerId: z.number().nonnegative().optional(),
  /** For a scoped step: ids fed in per primary resource of its source step (one per visit for Encounters, a few in all for Locations). */
  idsPerSourceRecord: z.number().nonnegative().optional(),
  /** Resources returned per primary resource, the _include / _revinclude rows counted (3.6 for visits with their patient, location and encounters). */
  rowsPerRecord: z.number().positive().optional(),
});
export type FetchStepDensity = z.infer<typeof FetchStepDensitySchema>;

const windowCount = (recordsPerDay: number | undefined, days: number, target: number): number =>
  recordsPerDay ? Math.max(1, Math.ceil((recordsPerDay * days) / target)) : 1;

/**
 * Rows (the step's own resources plus what its _include / _revinclude bring) one date-window bulk job aims for. A job
 * costs ~2.7 s fixed plus its rows, and up to 8 run side by side, so windows that are too short pay the fixed cost
 * over and over and windows that are too long run slow single jobs toward Oystehr's 30 s query limit. Measured on
 * a year of a busy practice's visits: trimmed Appointments ran four times as fast in quarterly windows (~5,000 rows a
 * job) as in weekly ones; with patient + encounters (over three rows a visit) 14-day windows (~4,000 rows a job) beat
 * both weekly and 30–91-day windows by about a third.
 */
export const BULK_JOB_ROWS = 5_000;

/** With nothing measured yet (no hint and no count), the longest window one job covers. */
export const BULK_WINDOW_FALLBACK_DAYS = 7;

/** A first guess at rowsPerRecord before a run has measured it: one row for the resource and one per include. */
export const includeRowsEstimate = (params: { name: string }[]): number =>
  1 + params.filter((p) => /^_(rev)?include(:|$)/.test(p.name)).length;

/** How many date windows a bulk step runs in: each job near BULK_JOB_ROWS rows; weekly when nothing is known. */
export const bulkWindowCount = (recordsPerDay: number | undefined, days: number, rowsPerRecord = 1): number =>
  recordsPerDay === undefined
    ? Math.max(1, Math.ceil(days / BULK_WINDOW_FALLBACK_DAYS))
    : Math.max(1, Math.ceil((recordsPerDay * days * rowsPerRecord) / BULK_JOB_ROWS));

/** How many date windows a paged step runs in, so each stays a short paged search; one without a hint. */
export const pagedWindowCount = (recordsPerDay: number | undefined, days: number): number =>
  windowCount(recordsPerDay, days, PAGED_WINDOW_TARGET);

/** How many ids a scoped bulk batch carries, so each job lands near the target; the plain batch size without a hint. */
export const scopedBulkBatchSize = (recordsPerId: number | undefined): number =>
  recordsPerId
    ? Math.min(FETCH_PLAN_LIMITS.scopedBulkBatchMax, Math.max(1, Math.floor(ASYNC_BULK_TARGET / recordsPerId)))
    : FETCH_PLAN_LIMITS.scopedBatchSize;

/** How many ids a paged scoped batch carries, so each batch is about one page (batches run side by side, pages do not). */
export const scopedPagedBatchSize = (recordsPerId: number | undefined): number =>
  recordsPerId
    ? Math.min(FETCH_PLAN_LIMITS.scopedBatchSize, Math.max(1, Math.floor(FETCH_PLAN_LIMITS.pageSize / recordsPerId)))
    : FETCH_PLAN_LIMITS.scopedBatchSize;

/** Primary resources a date-bounded step is expected to return over `days` of range, from its density hint; unknown without one. */
export const expectedStepRecords = (hint: FetchStepDensity | undefined, days: number): number | undefined =>
  hint?.recordsPerDay === undefined ? undefined : hint.recordsPerDay * days;

/**
 * Whether a plain (unscoped) step runs as bulk jobs from the start: mode "bulk", or "auto" when its hint expects more
 * than the paged threshold. An "auto" step with no hint pages first — one page — and goes bulk only on a next link.
 */
export const stepRunsBulk = (mode: 'auto' | 'normal' | 'bulk', expected: number | undefined): boolean =>
  mode === 'bulk' || (mode === 'auto' && expected !== undefined && expected > FETCH_PLAN_LIMITS.autoBulkThreshold);

/**
 * HTTP round trips a report should stay under. A year of visits at a busy practice by date is 53 weekly bulk jobs
 * (BULK_WINDOW_MAX_DAYS), 8 at a time, while the same records by lists of ids were three to four times as many jobs
 * a step.
 */
export const REQUEST_BUDGET = 60;

export interface StepRequestEstimate {
  id: string;
  /** Round trips the next run should take; none when there is nothing to go on. */
  requests?: number;
  /** Primary resources expected, which size the scoped steps fed from this one. */
  records?: number;
  /** How the number came about, or why there is none. */
  how: string;
  /** Paged batches of a scoped id list: many round trips but cheap ones (a fraction of a second each, 8 at a time). */
  scopedPaged?: boolean;
}

/**
 * The requests each step should take on a run over `days`, from the densities an earlier run saved, sized the way the
 * runner sizes them: a date-bounded step as paged windows or pre-sized bulk jobs (each under the cap, so no split is
 * expected), a scoped step as id batches — its ids being its source step's expected records times the ids each
 * yielded last time (one each when that was not measured). A step with no hint, or fed by one, estimates nothing.
 */
export function estimatePlanRequests(
  plan: { steps: FetchStepInput[] },
  hints: Record<string, FetchStepDensity> | undefined,
  days: number
): StepRequestEstimate[] {
  const byId = new Map<string, StepRequestEstimate>();
  const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
  for (const step of plan.steps) {
    const { id } = step;
    const mode = step.mode ?? 'auto';
    const hint = hints?.[id];
    let estimate: StepRequestEstimate;
    if (step.from) {
      const source = byId.get(step.from.step)?.records;
      const perId = hint?.recordsPerId;
      if (source === undefined) estimate = { id, how: `fed by "${step.from.step}", whose size is unknown` };
      else if (perId === undefined) estimate = { id, how: 'no measurement yet' };
      else {
        const ids = source * (hint?.idsPerSourceRecord ?? 1);
        const records = perId * ids;
        if (mode === 'bulk') {
          const jobs = Math.ceil(ids / scopedBulkBatchSize(perId));
          estimate = { id, requests: 1 + jobs, records, how: `${fmt(ids)} ids in ${jobs} bulk job(s)` };
        } else {
          const batch = scopedPagedBatchSize(perId);
          const batches = Math.ceil(ids / batch);
          const pages = Math.max(1, Math.ceil((perId * batch) / FETCH_PLAN_LIMITS.pageSize));
          estimate = {
            id,
            requests: batches * pages,
            records,
            how: `${fmt(ids)} ids in ${batches} paged batch(es) of ${batch}`,
            scopedPaged: true,
          };
        }
      }
    } else if (stepIsDateBounded(step)) {
      const perDay = hint?.recordsPerDay;
      const records = expectedStepRecords(hint, days);
      if (perDay === undefined || records === undefined) {
        const jobs = bulkWindowCount(undefined, days);
        estimate =
          mode === 'bulk' ? { id, requests: 1 + jobs, how: `${jobs} bulk job(s)` } : { id, how: 'no measurement yet' };
      } else if (stepRunsBulk(mode, records)) {
        const jobs = bulkWindowCount(perDay, days, hint?.rowsPerRecord ?? includeRowsEstimate(step.params ?? []));
        estimate = { id, requests: 1 + jobs, records, how: `${fmt(records)} records in ${jobs} bulk job(s)` };
      } else {
        const windows = pagedWindowCount(perDay, days);
        const pages = windows * Math.max(1, Math.ceil(records / windows / FETCH_PLAN_LIMITS.pageSize));
        estimate = { id, requests: pages, records, how: `${fmt(records)} records in ${pages} page(s)` };
      }
    } else {
      estimate =
        mode === 'bulk'
          ? { id, requests: 2, how: 'one bulk job' }
          : { id, how: 'not bounded by the date range, size unknown' };
    }
    byId.set(id, estimate);
  }
  return Array.from(byId.values());
}

export const FetchStepParamSchema = z.object({
  name: z.string().min(1),
  // May contain {{start}} / {{end}} (ISO instants of the run's date range), {{startDate}} /
  // {{endDate}} (their yyyy-MM-dd days) and {{patientId}} (the run's patient parameter).
  value: z.string(),
});
export type FetchStepParam = z.infer<typeof FetchStepParamSchema>;

/** Run parameters a plan may reference as templates besides the date range. */
export const FetchPlanParametersSchema = z.object({
  patientId: z.string().min(1).optional(),
});
export type FetchPlanParameters = z.infer<typeof FetchPlanParametersSchema>;

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
  parameters: FetchPlanParametersSchema.optional(),
  /** Always answer inline, never through a Z3 file (the local server has no response-size limit). */
  inline: z.boolean().optional(),
  /** Gzip the Z3 file; the client decompresses it (DecompressionStream in the browser). */
  gzip: z.boolean().optional(),
  /** Step id → density an earlier run measured, to pre-size that step's windows and batches. */
  hints: z.record(FetchStepDensitySchema).optional(),
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
  /** For a count-only step (`_summary=count`): the server's total; the step returns no resources. */
  total: z.number().optional(),
  /** The search parameters as actually sent (templates resolved), for the Plan tab. */
  params: z.array(FetchStepParamSchema),
  error: z.string().optional(),
  /** The server refused the search as written (400 / 422: an unknown parameter, an invalid _include, an untyped chain) — the plan's fault, not the volume's. */
  rejected: z.boolean().optional(),
});
export type FetchStepStats = z.infer<typeof FetchStepStatsSchema>;

const REJECTED_SEARCH_PREFIX = 'The server rejected the search of ';

/** The error a run with rejected searches hands the model as its previous attempt, so it fixes the plan; undefined when none was rejected. */
export const rejectedStepsError = (stats: FetchStepStats[]): string | undefined => {
  const rejected = stats.filter((s) => s.rejected && s.error);
  if (!rejected.length) return undefined;
  return REJECTED_SEARCH_PREFIX + rejected.map((s) => `step "${s.id}" (${s.resourceType}): ${s.error}`).join('; ');
};

/** Whether a previous attempt's error is one rejectedStepsError wrote (the plan failed, not the code). */
export const isRejectedStepsError = (error: string): boolean => error.startsWith(REJECTED_SEARCH_PREFIX);

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
// Pure helpers shared by the zambda (executing) and the report builder (previewing / validating).
// ---------------------------------------------------------------------------------------------

const PATIENT_ID_TEMPLATE = /\{\{\s*patientId\s*\}\}/;

/** Resolve {{start}} / {{end}} / {{startDate}} / {{endDate}} / {{patientId}} in a param value. */
export function resolveParamTemplates(
  value: string,
  dateRange?: { start: string; end: string },
  parameters?: FetchPlanParameters
): string {
  if (!value.includes('{{')) return value;
  if (PATIENT_ID_TEMPLATE.test(value)) {
    if (!parameters?.patientId) throw new Error(`"${value}" needs a patient id, but the run has none`);
    value = value.replace(new RegExp(PATIENT_ID_TEMPLATE, 'g'), parameters.patientId);
    if (!value.includes('{{')) return value;
  }
  if (!dateRange) throw new Error(`"${value}" needs a date range, but the run has none`);
  return value
    .replace(/\{\{\s*start\s*\}\}/g, dateRange.start)
    .replace(/\{\{\s*end\s*\}\}/g, dateRange.end)
    .replace(/\{\{\s*startDate\s*\}\}/g, dateRange.start.slice(0, 10))
    .replace(/\{\{\s*endDate\s*\}\}/g, dateRange.end.slice(0, 10));
}

/** Whether a step's params bound both ends of the run's date range ({{start}}/{{startDate}} and {{end}}/{{endDate}}), so it can be searched window by window. */
export const stepIsDateBounded = (step: { params?: FetchStepParam[] }): boolean =>
  ['start', 'end'].every((bound) =>
    (step.params ?? []).some((p) => new RegExp(`\\{\\{\\s*${bound}(Date)?\\s*\\}\\}`).test(p.value))
  );

/** Whether any step of the plan uses the {{patientId}} template (a per-patient report). */
export const planNeedsPatient = (plan: { steps: { params?: FetchStepParam[] }[] }): boolean =>
  plan.steps.some((step) => (step.params ?? []).some((p) => PATIENT_ID_TEMPLATE.test(p.value)));

const DATE_TEMPLATE = /\{\{\s*(start|end|startDate|endDate)\s*\}\}/;

/** Whether any step of the plan uses the date-range templates, so the run needs (and the user may change) a date range. */
export const planUsesDateRange = (plan: { steps: { params?: FetchStepParam[] }[] }): boolean =>
  plan.steps.some((step) => (step.params ?? []).some((p) => DATE_TEMPLATE.test(p.value)));

// FHIR choice-type elements of the data-map resources: the JSON key carries the type (valueQuantity,
// effectiveDateTime) but `_elements` wants the base name (value, effective) — the typed key silently
// drops the field. Top-level only; nested choices (dosage.dose[x]) never appear in `_elements`.
const CHOICE_TYPE_ELEMENTS = [
  'value',
  'effective',
  'onset',
  'abatement',
  'performed',
  'occurrence',
  'medication',
  'deceased',
  'multipleBirth',
  'reported',
];

/** The `_elements` name of a top-level field as the report code reads it: valueQuantity → value. */
export function toElementName(key: string): string {
  const base = CHOICE_TYPE_ELEMENTS.find(
    (b) => key.length > b.length && key.startsWith(b) && /[A-Z]/.test(key[b.length])
  );
  return base ?? key;
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

/**
 * The search values a scoped step feeds its param, from the source step's resources. `keepType` filters
 * references by their type; for a bare-value path such as "id" it filters the SOURCE RESOURCES by type
 * instead, so `path "id", keepType "Encounter"` over a mixed visits step yields the Encounter ids only.
 */
export function scopedStepValues(source: { resourceType?: string }[], from: FetchStepFrom): string[] {
  const out = new Set<string>();
  for (const resource of source) {
    const values = extractPathValues([resource], from.path);
    const bare = values.filter((v) => !/^[A-Za-z]+\/[^/]+$/.test(v));
    if (bare.length && from.keepType && resource.resourceType !== from.keepType) continue;
    // A bare id fed to a reference parameter without keepType takes the source resource's own type: "based-on" can
    // point to several types, and the server rejects a bare id there ("Logical Id may refer to more than one type").
    const typed =
      bare.length && !from.keepType && from.param !== '_id' && resource.resourceType
        ? { ...from, keepType: resource.resourceType }
        : from;
    for (const value of scopedSearchValues(values, typed)) out.add(value);
  }
  return Array.from(out);
}
