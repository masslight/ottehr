// Runs a fetch plan (a list of FHIR searches, some scoped to an earlier step's results) and hands the
// resources back with per-step timings. It knows nothing about any report — the report code runs on
// these resources in the browser sandbox. Shared by the direct `adhoc-fetch-plan` zambda and the
// Task path (`adhoc-report` → `sub-adhoc-report`), which has no 27 s http_auth ceiling.
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { FhirResource } from 'fhir/r4b';
import {
  FETCH_PLAN_LIMITS,
  FetchPlan,
  FetchPlanParameters,
  FetchStep,
  FetchStepParam,
  FetchStepStats,
  resolveParamTemplates,
  scopedStepValues,
  toElementName,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { fetchScopedResources, searchAsyncBulk } from './adhoc-report';
import { fetchAllPages } from './fhir';

export interface FetchPlanResult {
  resources: Record<string, FhirResource[]>;
  stats: FetchStepStats[];
  totalMs: number;
}

export async function runFetchPlan(
  oystehr: Oystehr,
  plan: FetchPlan,
  dateRange: DateRange | undefined,
  parameters: FetchPlanParameters | undefined
): Promise<FetchPlanResult> {
  const startedAt = Date.now();
  const resourcesByStep = new Map<string, FhirResource[]>();
  const statsByStep = new Map<string, FetchStepStats>();

  // Steps that depend on nothing run together; a scoped step runs once its source step has finished.
  for (const level of planLevels(plan)) {
    await Promise.all(
      level.map(async (step) => {
        const { resources, stats } = await runStep(oystehr, step, dateRange, parameters, resourcesByStep, statsByStep);
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
  step: FetchStep,
  dateRange: DateRange | undefined,
  parameters: FetchPlanParameters | undefined,
  resourcesByStep: Map<string, FhirResource[]>,
  statsByStep: Map<string, FetchStepStats>
): Promise<{ resources: FhirResource[]; stats: FetchStepStats }> {
  const startedAt = Date.now();
  const params: FetchStepParam[] = step.params.map((p) => ({
    name: p.name,
    value: resolveParamTemplates(p.value, dateRange, parameters),
  }));
  if (step.elements?.length) {
    const elements = new Set(['id', ...step.elements.map(toElementName)]);
    params.push({ name: '_elements', value: Array.from(elements).join(',') });
  }

  const finish = (
    resources: FhirResource[],
    partial: Pick<FetchStepStats, 'mode' | 'requests'> & Partial<FetchStepStats>
  ): { resources: FhirResource[]; stats: FetchStepStats } => {
    const deduped = dedupe(resources);
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
      const [scoped, partial] = await runScoped(oystehr, step, params, values);
      return finish(scoped, { ...partial, scopedValues: values.length });
    }

    if (step.mode === 'bulk') {
      await probeSearch(oystehr, step.resourceType, params);
      return finish(await searchAsyncBulk(oystehr, step.resourceType as FhirResource['resourceType'], params), {
        mode: 'bulk',
        requests: 2,
      });
    }

    const cap = step.mode === 'normal' ? FETCH_PLAN_LIMITS.maxResourcesPerStep : FETCH_PLAN_LIMITS.autoBulkThreshold;
    const paged = await searchPaged(oystehr, step.resourceType, params, cap);
    if (paged.hitCap) {
      if (step.mode === 'normal') {
        throw new Error(
          `more than ${cap} resources; narrow the search or set mode "bulk" (the paged search stopped at the cap)`
        );
      }
      // auto: the paged attempt counts toward the timing — that is the real cost of not knowing the volume.
      return finish(await searchAsyncBulk(oystehr, step.resourceType as FhirResource['resourceType'], params), {
        mode: 'bulk',
        requests: paged.requests + 1,
      });
    }
    return finish(paged.resources, { mode: 'normal', requests: paged.requests });
  } catch (error) {
    captureException(error, { extra: { stepId: step.id, resourceType: step.resourceType, params } });
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[adhoc-fetch-plan] step ${step.id} FAILED ms=${Date.now() - startedAt} message=${message}`);
    return finish([], { mode: step.mode === 'bulk' ? 'bulk' : 'normal', requests: 0, error: message });
  }
}

// A bulk job reports a bad search only as "job answered status 400"; the same search as a one-row
// normal search fails with the server's own message (e.g. which _include is invalid), so run that first.
async function probeSearch(oystehr: Oystehr, resourceType: string, params: FetchStepParam[]): Promise<void> {
  await oystehr.fhir.search<FhirResource>({
    resourceType: resourceType as FhirResource['resourceType'],
    params: [...params, { name: '_count', value: '1' }],
  });
}

async function searchPaged(
  oystehr: Oystehr,
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
      const bundle = await oystehr.fhir.search<FhirResource>({
        resourceType: resourceType as FhirResource['resourceType'],
        params: [...params, { name: '_count', value: count.toString() }, { name: '_offset', value: offset.toString() }],
      });
      resources.push(...bundle.unbundle());
      lastHadNext = bundle.link?.some((link) => link.relation === 'next') ?? false;
      return bundle;
    },
    FETCH_PLAN_LIMITS.pageSize,
    { maxItems }
  );
  return { resources, requests, hitCap: lastHadNext && resources.length >= maxItems };
}

async function runScoped(
  oystehr: Oystehr,
  step: FetchStep,
  params: FetchStepParam[],
  values: string[]
): Promise<[FhirResource[], Pick<FetchStepStats, 'mode' | 'requests'>]> {
  const paramName = step.from!.param;
  const batches: string[][] = [];
  for (let i = 0; i < values.length; i += FETCH_PLAN_LIMITS.scopedBatchSize) {
    batches.push(values.slice(i, i + FETCH_PLAN_LIMITS.scopedBatchSize));
  }
  if (step.mode === 'bulk' || values.length > FETCH_PLAN_LIMITS.scopedBulkThreshold) {
    await probeSearch(oystehr, step.resourceType, [{ name: paramName, value: batches[0].join(',') }, ...params]);
    const resources = await fetchScopedResources<FhirResource>(
      oystehr,
      step.resourceType as FhirResource['resourceType'],
      paramName,
      values,
      params
    );
    return [resources, { mode: 'bulk', requests: batches.length + 1 }];
  }

  const resources: FhirResource[] = [];
  let requests = 0;
  for (let i = 0; i < batches.length; i += FETCH_PLAN_LIMITS.scopedBatchConcurrency) {
    const group = await Promise.all(
      batches
        .slice(i, i + FETCH_PLAN_LIMITS.scopedBatchConcurrency)
        .map((batch) =>
          searchPaged(
            oystehr,
            step.resourceType,
            [{ name: paramName, value: batch.join(',') }, ...params],
            FETCH_PLAN_LIMITS.maxResourcesPerStep
          )
        )
    );
    for (const page of group) {
      resources.push(...page.resources);
      requests += page.requests;
    }
  }
  return [resources, { mode: 'normal', requests }];
}

function dedupe(resources: FhirResource[]): FhirResource[] {
  const seen = new Set<string>();
  const out: FhirResource[] = [];
  for (const resource of resources) {
    const key = `${resource.resourceType}/${resource.id}`;
    if (resource.id && seen.has(key)) continue;
    if (resource.id) seen.add(key);
    out.push(resource);
  }
  return out;
}
