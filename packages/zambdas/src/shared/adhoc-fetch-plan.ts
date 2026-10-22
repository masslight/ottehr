// Runs a fetch plan (a list of FHIR searches, some scoped to an earlier step's results) and hands the
// resources back with per-step timings. It knows nothing about any report — the report code runs on
// these resources in the browser sandbox. Shared by the direct `adhoc-fetch-plan` zambda and the
// Task path (`adhoc-report` → `sub-adhoc-report`), which has no 27 s http_auth ceiling.
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { FhirResource } from 'fhir/r4b';
import {
  ASYNC_BULK_TARGET,
  bulkWindowCount,
  expectedStepRecords,
  FETCH_PLAN_LIMITS,
  FetchPlan,
  FetchPlanParameters,
  FetchStep,
  FetchStepDensity,
  FetchStepParam,
  FetchStepStats,
  includeRowsEstimate,
  pagedWindowCount,
  resolveParamTemplates,
  scopedBulkBatchSize,
  scopedPagedBatchSize,
  scopedStepValues,
  stepIsDateBounded,
  stepRunsBulk,
  toElementName,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import {
  dateWindows,
  DAY_MS,
  dedupeResources,
  halveList,
  halveWindow,
  isSearchRejectedError,
  isSearchTooHeavyError,
  searchAsyncBulk,
  searchSplittingOnCap,
  SplitRetryOptions,
} from './adhoc-report';
import { fetchAllPages } from './fhir';

export interface FetchPlanResult {
  resources: Record<string, FhirResource[]>;
  stats: FetchStepStats[];
  totalMs: number;
}

export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

/** Runs at most `max` of the functions given to it at once; the rest wait their turn in order. */
export function createLimiter(max: number): Limiter {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (fn) => {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await fn();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

export async function runFetchPlan(
  oystehr: Oystehr,
  plan: FetchPlan,
  dateRange: DateRange | undefined,
  parameters: FetchPlanParameters | undefined,
  hints?: Record<string, FetchStepDensity>
): Promise<FetchPlanResult> {
  const startedAt = Date.now();
  const resourcesByStep = new Map<string, FhirResource[]>();
  const statsByStep = new Map<string, FetchStepStats>();
  // One ceiling on searches in flight for the whole run: steps, date windows and scoped batches share it.
  const limit = createLimiter(FETCH_PLAN_LIMITS.maxConcurrentRequests);

  // Steps that depend on nothing run together; a scoped step runs once its source step has finished.
  for (const level of planLevels(plan)) {
    await Promise.all(
      level.map(async (step) => {
        const { resources, stats } = await runStep(
          oystehr,
          limit,
          step,
          dateRange,
          parameters,
          resourcesByStep,
          statsByStep,
          hints?.[step.id]
        );
        resourcesByStep.set(step.id, resources);
        statsByStep.set(step.id, stats);
      })
    );
  }

  const resources = Object.fromEntries(plan.steps.map((step) => [step.id, resourcesByStep.get(step.id) ?? []]));
  const stats = plan.steps.map((step) => statsByStep.get(step.id)!);
  const totalMs = Date.now() - startedAt;

  console.log(
    `[adhoc-fetch-plan] steps=${plan.steps.length} ms=${totalMs} ` +
      `perStep=${JSON.stringify(stats.map(({ id, ms, count, mode, error }) => ({ id, ms, count, mode, error })))}`
  );

  return { resources, stats, totalMs };
}

function planLevels(plan: FetchPlan): FetchStep[][] {
  const levelOf = new Map<string, number>();
  for (const step of plan.steps) {
    levelOf.set(step.id, step.from ? (levelOf.get(step.from.step) ?? 0) + 1 : 0);
  }
  const levels: FetchStep[][] = [];
  for (const step of plan.steps) {
    const level = levelOf.get(step.id)!;
    (levels[level] ??= []).push(step);
  }
  return levels.filter(Boolean);
}

async function runStep(
  oystehr: Oystehr,
  limit: Limiter,
  step: FetchStep,
  dateRange: DateRange | undefined,
  parameters: FetchPlanParameters | undefined,
  resourcesByStep: Map<string, FhirResource[]>,
  statsByStep: Map<string, FetchStepStats>,
  hint?: FetchStepDensity
): Promise<{ resources: FhirResource[]; stats: FetchStepStats }> {
  const startedAt = Date.now();
  const resolveParams = (window = dateRange): FetchStepParam[] => {
    const resolved = step.params.map((p) => ({
      name: p.name,
      value: resolveParamTemplates(p.value, window, parameters),
    }));
    if (step.elements?.length) {
      const elements = new Set(['id', ...step.elements.map(toElementName)]);
      resolved.push({ name: '_elements', value: Array.from(elements).join(',') });
    }
    return resolved;
  };
  const params = resolveParams();
  const dated = dateRange !== undefined && stepIsDateBounded(step);
  const halveDated = (w: DateRange | undefined): [DateRange, DateRange] | undefined =>
    dated ? halveWindow(w!) : undefined;
  // A window (or an id batch) the server cannot finish is halved and retried, a few times; one day (one id) is the floor.
  const splitOptions = (floor: string | undefined): SplitRetryOptions => ({
    splitOn: isSearchTooHeavyError,
    label: step.resourceType,
    floor,
  });
  const windowSplit = splitOptions(dated ? 'a single day' : undefined);
  const rangeMs = dated ? Date.parse(dateRange.end) - Date.parse(dateRange.start) : 0;
  // The step's density: the hint of an earlier run, or (auto, date-bounded, no hint) a count taken before fetching.
  let density = hint;
  let expected = dated ? expectedStepRecords(density, rangeMs / DAY_MS) : undefined;
  let counts = 0;
  // The run's date range in as many windows as the density hint of an earlier run calls for (one without it), searched
  // side by side under the run's limit, each halved whenever the server cannot finish it (or its bulk job fills the cap).
  // A step whose params do not bound both ends of the range runs as one window that cannot be halved.
  const searchWindows = async (
    count: number,
    searchWindow: (window: DateRange | undefined) => Promise<FhirResource[]>
  ): Promise<FhirResource[]> => {
    const windows = dated ? dateWindows(dateRange, Math.ceil(rangeMs / count)) : [dateRange];
    const parts = await Promise.all(
      windows.map((window) => searchSplittingOnCap(window, searchWindow, halveDated, windowSplit))
    );
    return parts.flat();
  };
  let bulkJobs = 0;
  const bulkJob = (jobParams: FetchStepParam[]): Promise<FhirResource[]> => {
    bulkJobs += 1;
    return limit(() => searchAsyncBulk(oystehr, step.resourceType as FhirResource['resourceType'], jobParams));
  };
  // A step with no date range of its own (all patients, all coverages…) is one job that cannot be halved, so past the
  // 30,000 a job returns it failed (every patient of a busy practice). In bulk it is cut by _lastUpdated
  // instead: every resource has exactly one, so the windows partition the set, and a window that fills the cap is
  // halved like a date window. The floor predates any Oystehr project.
  const unbounded = !dated && !step.from && !params.some((p) => p.name === '_lastUpdated');
  let unboundedTotal: number | undefined;
  // the sizing count, while it has not answered yet (see below)
  let pendingCount: Promise<number | undefined> | undefined;
  const applyTotal = (total: number): void => {
    if (dated) {
      density = { recordsPerDay: total / (rangeMs / DAY_MS) };
      expected = expectedStepRecords(density, rangeMs / DAY_MS);
    } else {
      // no range to spread it over: the total decides paged vs bulk, and the bulk cut reuses it
      expected = total;
      unboundedTotal = total;
    }
  };
  const searchBulkByLastUpdated = async (): Promise<FhirResource[]> => {
    const total =
      unboundedTotal ?? (await countMatches(oystehr, limit, step.resourceType, params).catch(() => undefined));
    const updated = { start: LAST_UPDATED_FLOOR, end: new Date().toISOString() };
    const span = Date.parse(updated.end) - Date.parse(updated.start);
    // Many starting windows: the count fitting below skips the empty years and halves the busy months in fewer rounds
    // (at a busy practice most patients sit in a few recent months).
    const windows = dateWindows(
      updated,
      Math.ceil(span / Math.max(UNBOUNDED_START_WINDOWS, Math.ceil((total ?? 0) / ASYNC_BULK_TARGET)))
    );
    const withUpdated = (w: DateRange): FetchStepParam[] => [
      ...params,
      { name: '_lastUpdated', value: `ge${w.start}` },
      { name: '_lastUpdated', value: `le${w.end}` },
    ];
    // Matches pile up in recent months, so even windows are lopsided: count each and halve the ones over the target
    // before any job runs (a count is 0.5–2 s; a job that fills the cap is 5–11 s thrown away).
    const fitTarget = Math.min(ASYNC_BULK_TARGET, Number(params.find((p) => p.name === '_count')?.value) || Infinity);
    const fitted = async (w: DateRange, depth = 0): Promise<DateRange[]> => {
      const n = await countMatches(oystehr, limit, step.resourceType, withUpdated(w)).catch(() => undefined);
      if (n === undefined) return [w];
      if (n === 0) return [];
      const halves = n > fitTarget && depth < 6 ? halveWindow(w) : undefined;
      if (!halves) return [w];
      return (await Promise.all(halves.map((h) => fitted(h, depth + 1)))).flat();
    };
    const sized = (await Promise.all(windows.map((w) => fitted(w)))).flat();
    const parts = await Promise.all(
      sized.map((w) => searchSplittingOnCap(w, (x) => bulkJob(withUpdated(x)), halveWindow, windowSplit))
    );
    return parts.flat();
  };
  const searchBulk = (): Promise<FhirResource[]> =>
    unbounded
      ? searchBulkByLastUpdated()
      : searchWindows(
          bulkWindowCount(
            density?.recordsPerDay,
            rangeMs / DAY_MS,
            density?.rowsPerRecord ?? includeRowsEstimate(step.params)
          ),
          (window) => bulkJob(resolveParams(window))
        );

  const finish = (
    resources: FhirResource[],
    partial: Pick<FetchStepStats, 'mode' | 'requests'> & Partial<FetchStepStats>
  ): { resources: FhirResource[]; stats: FetchStepStats } => {
    const deduped = dedupeResources(resources);
    const byType: Record<string, number> = {};
    for (const r of deduped) byType[r.resourceType] = (byType[r.resourceType] ?? 0) + 1;
    return {
      resources: deduped,
      stats: {
        id: step.id,
        resourceType: step.resourceType,
        ms: Date.now() - startedAt,
        count: deduped.length,
        byType,
        bytes: JSON.stringify(deduped).length,
        params,
        ...partial,
      },
    };
  };

  try {
    if (step.from) {
      const sourceStats = statsByStep.get(step.from.step);
      if (sourceStats?.error) {
        return finish([], { mode: 'skipped', requests: 0, error: `source step "${step.from.step}" failed` });
      }
      const source = resourcesByStep.get(step.from.step) ?? [];
      const values = scopedStepValues(source, step.from);
      if (values.length === 0) return finish([], { mode: 'normal', requests: 0, scopedValues: 0 });
      const [scoped, partial] = await runScoped(
        oystehr,
        limit,
        step,
        params,
        values,
        splitOptions('a single id'),
        hint
      );
      return finish(scoped, { ...partial, scopedValues: values.length });
    }

    // A count-only step (_summary=count): one search, the server's total, no resources — for a report that counts.
    if (params.some((p) => p.name === '_summary' && p.value === 'count')) {
      return finish([], {
        mode: 'normal',
        requests: 1,
        total: (await countMatches(oystehr, limit, step.resourceType, params)) ?? 0,
      });
    }

    // "auto", date-bounded, no hint: count the matches first (cheap even for 60 days of a busy practice's visits or
    // vitals) and size the step from that, instead of reading a first page to find out (several times the count for
    // visits with their includes). A count the server refuses leaves the step to the first page as before.
    // Not for a short range: there the count cost more than it saved (a day or a week of visits at a busy practice ran
    // two to three times slower count-first) — the first page tells enough.
    // nor for one patient's records (flowsheets): small, and the count added about a third to each step
    const forOnePatient = step.params.some((p) => /\{\{\s*patientId\s*\}\}/.test(p.value));
    const worthCounting =
      (unbounded && !forOnePatient) || (dated && !forOnePatient && rangeMs > COUNT_MIN_RANGE_DAYS * DAY_MS);
    if (step.mode === 'auto' && worthCounting && expected === undefined) {
      // A cold count can be slow (a year of Tasks or Communications at a busy practice ran ten times longer cold than
      // once cached), so sizing waits SIZING_COUNT_WAIT_MS at most and otherwise goes on unsized (weekly windows).
      pendingCount = countMatches(oystehr, limit, step.resourceType, params).catch(() => undefined);
      const total = await Promise.race([pendingCount, waitMs(SIZING_COUNT_WAIT_MS)]);
      if (total !== undefined) {
        pendingCount = undefined;
        counts = 1;
        applyTotal(total);
      }
    }

    // Mode "bulk", or "auto" when the density expects a large step: one job per bulk window, nothing paged first.
    if (stepRunsBulk(step.mode, expected)) {
      // the count already tried the search on the server; otherwise a one-row probe does
      if (!counts) await probeSearch(oystehr, limit, step.resourceType, params);
      return finish(await searchBulk(), { mode: 'bulk', requests: 1 + bulkJobs });
    }

    // The cap is per window. "normal" pages to the step maximum and fails past it. "auto" with a hint pages windows
    // sized to a few pages each and goes bulk only when one passes the threshold (the density drifted). "auto" with no
    // hint reads ONE page: a next link means the volume is unknown, and finishing in bulk costs less than paging on
    // (a page at a busy practice can cost more than a bulk job's fixed overhead) — the old cap of autoBulkThreshold
    // paged five times before giving up on a year of a busy practice's visits.
    // One patient's records are paged on to the bulk threshold before going bulk: they are rarely past it, and a
    // patient with over a thousand documents fetched four times faster paged than as bulk jobs after one page.
    const cap =
      step.mode === 'normal'
        ? FETCH_PLAN_LIMITS.maxResourcesPerStep
        : expected === undefined && !forOnePatient
        ? FETCH_PLAN_LIMITS.pageSize
        : FETCH_PLAN_LIMITS.autoBulkThreshold;
    let pages = 0;
    let hitCap = false;
    const resources = await searchWindows(
      pagedWindowCount(density?.recordsPerDay, rangeMs / DAY_MS),
      async (window) => {
        const paged = await searchPaged(oystehr, limit, step.resourceType, resolveParams(window), cap);
        pages += paged.requests;
        hitCap ||= paged.hitCap;
        return paged.resources;
      }
    );
    if (hitCap) {
      if (step.mode === 'normal') {
        throw new Error(
          `more than ${cap} resources; narrow the search or set mode "bulk" (the paged search stopped at the cap)`
        );
      }
      // A count that missed its wait has had the first page's time since: size the bulk jobs from it if it is in now
      // (a cold year of diagnoses at a busy practice ran four times as long in weekly jobs as the same search sized
      // from a count).
      if (pendingCount) {
        const late = await Promise.race([pendingCount, waitMs(SIZING_COUNT_WAIT_MS)]);
        if (late !== undefined) {
          counts = 1;
          applyTotal(late);
        }
      }
      // auto: the paged attempt counts toward the timing — that is the real cost of not knowing the volume.
      return finish(await searchBulk(), { mode: 'bulk', requests: counts + pages + bulkJobs });
    }
    return finish(resources, { mode: 'normal', requests: counts + pages });
  } catch (error) {
    captureException(error, { extra: { stepId: step.id, resourceType: step.resourceType, params } });
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[adhoc-fetch-plan] step ${step.id} FAILED ms=${Date.now() - startedAt} message=${message}`);
    // A search the server refused as written is flagged so the planner can be asked to fix the plan; a search
    // it could not finish (split to the floor, the bulk cap, a timeout) is not the plan's fault and is not.
    return finish([], {
      mode: step.mode === 'bulk' ? 'bulk' : 'normal',
      requests: 0,
      error: message,
      ...(isSearchRejectedError(error) ? { rejected: true } : {}),
    });
  }
}

const waitMs = (ms: number): Promise<undefined> => new Promise((resolve) => setTimeout(() => resolve(undefined), ms));

/** Date ranges this short are sized by their first page, not a count. */
const COUNT_MIN_RANGE_DAYS = 14;

/** How long a step waits for the count that sizes it before going on unsized. */
const SIZING_COUNT_WAIT_MS = 5_000;

/** The earliest _lastUpdated an unbounded step is cut from (before any Oystehr project existed). */
const LAST_UPDATED_FLOOR = '2020-01-01T00:00:00.000Z';
const UNBOUNDED_START_WINDOWS = 16;

// The step's primary matches, counted by the server: its filters only (no _include / _revinclude / _elements / paging),
// with an accurate total — without it Oystehr stops counting at 1,001.
async function countMatches(
  oystehr: Oystehr,
  limit: Limiter,
  resourceType: string,
  params: FetchStepParam[]
): Promise<number | undefined> {
  const filters = params.filter(
    (p) => !/^_(include|revinclude|elements|sort|count|offset|summary|total)(:|$)/.test(p.name)
  );
  const bundle = await limit(() =>
    oystehr.fhir.search<FhirResource>({
      resourceType: resourceType as FhirResource['resourceType'],
      params: [...filters, { name: '_summary', value: 'count' }, { name: '_total', value: 'accurate' }],
    })
  );
  // undefined when the server gives no total: unknown, never "none" (callers then fetch rather than skip)
  return bundle.total;
}

// A bulk job reports a bad search only as "job answered status 400"; the same search as a one-row
// normal search fails with the server's own message (e.g. which _include is invalid), so run that first.
async function probeSearch(
  oystehr: Oystehr,
  limit: Limiter,
  resourceType: string,
  params: FetchStepParam[]
): Promise<void> {
  await limit(() =>
    oystehr.fhir.search<FhirResource>({
      resourceType: resourceType as FhirResource['resourceType'],
      params: [...params, { name: '_count', value: '1' }],
    })
  );
}

async function searchPaged(
  oystehr: Oystehr,
  limit: Limiter,
  resourceType: string,
  params: FetchStepParam[],
  maxItems: number
): Promise<{ resources: FhirResource[]; requests: number; hitCap: boolean }> {
  const resources: FhirResource[] = [];
  let requests = 0;
  let lastHadNext = false;
  await fetchAllPages(
    async (offset, count) => {
      requests += 1;
      const bundle = await limit(() =>
        oystehr.fhir.search<FhirResource>({
          resourceType: resourceType as FhirResource['resourceType'],
          params: [
            ...params,
            { name: '_count', value: count.toString() },
            { name: '_offset', value: offset.toString() },
          ],
        })
      );
      resources.push(...bundle.unbundle());
      lastHadNext = bundle.link?.some((link) => link.relation === 'next') ?? false;
      return bundle;
    },
    FETCH_PLAN_LIMITS.pageSize,
    { maxItems }
  );
  return { resources, requests, hitCap: lastHadNext && resources.length >= maxItems };
}

// Batches of ids, paged (mode auto / normal) or as bulk jobs (mode bulk), searched side by side under the run's limit;
// a batch that fills the bulk cap or that the server cannot finish is halved (halveList) and retried, so `requests`
// counts what actually ran. A long id list is never bulk on its own: 27 batches of 100 took 3.5–4.6 s paged against
// 18.7 s as jobs on synth, and a year of a busy practice's visits by id was a couple of hundred jobs — such a step
// should be fetched by date instead, not fanned out faster.
async function runScoped(
  oystehr: Oystehr,
  limit: Limiter,
  step: FetchStep,
  params: FetchStepParam[],
  values: string[],
  splitOptions: SplitRetryOptions,
  hint?: FetchStepDensity
): Promise<[FhirResource[], Pick<FetchStepStats, 'mode' | 'requests'>]> {
  const paramName = step.from!.param;
  const bulk = step.mode === 'bulk';
  const batchSize = bulk ? scopedBulkBatchSize(hint?.recordsPerId) : scopedPagedBatchSize(hint?.recordsPerId);
  const batches: string[][] = [];
  for (let i = 0; i < values.length; i += batchSize) batches.push(values.slice(i, i + batchSize));
  const batchParams = (batch: string[]): FetchStepParam[] => [{ name: paramName, value: batch.join(',') }, ...params];

  let requests = 0;
  if (bulk) {
    await probeSearch(oystehr, limit, step.resourceType, batchParams(batches[0]));
    requests += 1;
  }
  const searchBatch = async (batch: string[]): Promise<FhirResource[]> => {
    if (bulk) {
      requests += 1;
      return limit(() =>
        searchAsyncBulk(oystehr, step.resourceType as FhirResource['resourceType'], batchParams(batch))
      );
    }
    const paged = await searchPaged(
      oystehr,
      limit,
      step.resourceType,
      batchParams(batch),
      FETCH_PLAN_LIMITS.maxResourcesPerStep
    );
    requests += paged.requests;
    return paged.resources;
  };

  const parts = await Promise.all(
    batches.map((batch) => searchSplittingOnCap(batch, searchBatch, halveList, splitOptions))
  );
  return [parts.flat(), { mode: bulk ? 'bulk' : 'normal', requests }];
}
