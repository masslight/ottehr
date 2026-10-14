// Runs a fetch plan (a list of FHIR searches, some scoped to an earlier step's results) and hands the
// resources back with per-step timings. It knows nothing about any report — the report code runs on
// these resources in the browser sandbox. Shared by the direct `adhoc-fetch-plan` zambda and the
// Task path (`adhoc-report` → `sub-adhoc-report`), which has no 27 s http_auth ceiling.
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { FhirResource } from 'fhir/r4b';
import {
  bulkWindowCount,
  FETCH_PLAN_LIMITS,
  FetchPlan,
  FetchPlanParameters,
  FetchStep,
  FetchStepDensity,
  FetchStepParam,
  FetchStepStats,
  pagedWindowCount,
  resolveParamTemplates,
  scopedBulkBatchSize,
  scopedStepValues,
  stepIsDateBounded,
  toElementName,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import {
  dateWindows,
  DAY_MS,
  dedupeResources,
  halveList,
  halveWindow,
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
  const days = Math.max(1, rangeMs / DAY_MS);
  // The step's density: what an earlier run saved, else counted now with one row-less request (a report's first run).
  let recordsPerDay = hint?.recordsPerDay;
  let counts = 0;
  const density = async (): Promise<number | undefined> => {
    if (dated && recordsPerDay === undefined) {
      counts += 1;
      try {
        recordsPerDay = (await countMatches(oystehr, limit, step.resourceType, params)) / days;
      } catch (error) {
        // Only a sizing aid: without it the step runs as one window, and the search itself reports a real failure.
        captureException(error, { extra: { stepId: step.id, resourceType: step.resourceType, params } });
        console.warn(`[adhoc-fetch-plan] step ${step.id}: count failed, running unsized: ${String(error)}`);
      }
    }
    return recordsPerDay;
  };
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
  const searchBulk = async (): Promise<FhirResource[]> =>
    searchWindows(bulkWindowCount(await density(), days), (window) => {
      bulkJobs += 1;
      return limit(() =>
        searchAsyncBulk(oystehr, step.resourceType as FhirResource['resourceType'], resolveParams(window))
      );
    });

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

    if (step.mode === 'bulk') {
      await probeSearch(oystehr, limit, step.resourceType, params);
      return finish(await searchBulk(), { mode: 'bulk', requests: 1 + counts + bulkJobs });
    }

    // The cap is per window: a window past it means the density is not what the hint said, or there was no hint.
    const cap = step.mode === 'normal' ? FETCH_PLAN_LIMITS.maxResourcesPerStep : FETCH_PLAN_LIMITS.autoBulkThreshold;
    let pages = 0;
    let hitCap = false;
    const resources = await searchWindows(pagedWindowCount(await density(), days), async (window) => {
      const paged = await searchPaged(oystehr, limit, step.resourceType, resolveParams(window), cap);
      pages += paged.requests;
      hitCap ||= paged.hitCap;
      return paged.resources;
    });
    if (hitCap) {
      if (step.mode === 'normal') {
        throw new Error(
          `more than ${cap} resources; narrow the search or set mode "bulk" (the paged search stopped at the cap)`
        );
      }
      // auto: the paged attempt counts toward the timing — that is the real cost of not knowing the volume.
      return finish(await searchBulk(), { mode: 'bulk', requests: counts + pages + bulkJobs });
    }
    return finish(resources, { mode: 'normal', requests: counts + pages });
  } catch (error) {
    captureException(error, { extra: { stepId: step.id, resourceType: step.resourceType, params } });
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[adhoc-fetch-plan] step ${step.id} FAILED ms=${Date.now() - startedAt} message=${message}`);
    return finish([], { mode: step.mode === 'bulk' ? 'bulk' : 'normal', requests: 0, error: message });
  }
}

// How many resources the step's own search matches, without rows: `_count=0&_total=accurate` (never `_summary=count`,
// which Oystehr answers 1 for an empty type). Includes are left out — they are not what the windows are sized on.
async function countMatches(
  oystehr: Oystehr,
  limit: Limiter,
  resourceType: string,
  params: FetchStepParam[]
): Promise<number> {
  const bundle = await limit(() =>
    oystehr.fhir.search<FhirResource>({
      resourceType: resourceType as FhirResource['resourceType'],
      params: [
        ...params.filter((p) => !/^_(rev)?include|^_elements$/.test(p.name)),
        { name: '_count', value: '0' },
        { name: '_total', value: 'accurate' },
      ],
    })
  );
  return bundle.total ?? 0;
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

// Batches of ids, paged or as bulk jobs, searched side by side under the run's limit; a batch that fills the bulk
// cap or that the server cannot finish is halved (halveList) and retried, so `requests` counts what actually ran.
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
  const bulk = step.mode === 'bulk' || values.length > FETCH_PLAN_LIMITS.scopedBulkThreshold;
  const batchSize = bulk ? scopedBulkBatchSize(hint?.recordsPerId) : FETCH_PLAN_LIMITS.scopedBatchSize;
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
