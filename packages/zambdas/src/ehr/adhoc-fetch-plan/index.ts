// The thin generic fetch zambda of the ad hoc reporting redesign: runs a saved / proposed fetch plan
// (a list of FHIR searches, some scoped to an earlier step's results) and hands the resources back with
// per-step timings. It knows nothing about any report — the report code runs on these resources in the
// browser sandbox. Reuses the async-bulk machinery of today's dataset fetchers for large steps.
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource } from 'fhir/r4b';
import {
  extractPathValues,
  FETCH_PLAN_LIMITS,
  FetchPlan,
  FetchStep,
  FetchStepParam,
  FetchStepStats,
  resolveParamTemplates,
  RunFetchPlanOutput,
  RunFetchPlanOutputSchema,
  scopedSearchValues,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { AD_HOC_REPORT_VIEW_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { fetchScopedResources, searchAsyncBulk, uploadAdHocReportDataToZ3 } from '../../shared/adhoc-report';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'adhoc-fetch-plan';

// Lambda responses are capped at 6 MB; anything bigger goes through a Z3 file like today's reports.
const INLINE_RESPONSE_LIMIT_BYTES = 5 * 1024 * 1024;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { plan, dateRange, inline, secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_VIEW_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const startedAt = Date.now();
  const resourcesByStep = new Map<string, FhirResource[]>();
  const statsByStep = new Map<string, FetchStepStats>();

  // Steps that depend on nothing run together; a scoped step runs once its source step has finished.
  for (const level of planLevels(plan)) {
    await Promise.all(
      level.map(async (step) => {
        const { resources, stats } = await runStep(oystehr, step, dateRange, resourcesByStep, statsByStep);
        resourcesByStep.set(step.id, resources);
        statsByStep.set(step.id, stats);
      })
    );
  }

  const resources = Object.fromEntries(plan.steps.map((step) => [step.id, resourcesByStep.get(step.id) ?? []]));
  const stats = plan.steps.map((step) => statsByStep.get(step.id)!);
  const json = JSON.stringify(resources);
  const totalMs = Date.now() - startedAt;

  console.log(
    `[adhoc-fetch-plan] steps=${plan.steps.length} ms=${totalMs} bytes=${json.length} ` +
      `perStep=${JSON.stringify(stats.map(({ id, ms, count, mode, error }) => ({ id, ms, count, mode, error })))}`
  );

  const base = { stats, totalMs, totalBytes: json.length, dateRange };
  const output: RunFetchPlanOutput =
    inline || json.length <= INLINE_RESPONSE_LIMIT_BYTES
      ? { ...base, resources }
      : { ...base, downloadUrl: await uploadAdHocReportDataToZ3(oystehr, secrets, m2mToken, json) };

  return {
    statusCode: 200,
    body: JSON.stringify(validateOutputWithSchema(RunFetchPlanOutputSchema, output, ZAMBDA_NAME)),
  };
});

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
  resourcesByStep: Map<string, FhirResource[]>,
  statsByStep: Map<string, FetchStepStats>
): Promise<{ resources: FhirResource[]; stats: FetchStepStats }> {
  const startedAt = Date.now();
  const params: FetchStepParam[] = step.params.map((p) => ({
    name: p.name,
    value: resolveParamTemplates(p.value, dateRange),
  }));
  if (step.elements?.length) {
    params.push({ name: '_elements', value: Array.from(new Set(['id', ...step.elements])).join(',') });
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
      const values = scopedSearchValues(extractPathValues(source, step.from.path), step.from);
      if (values.length === 0) return finish([], { mode: 'normal', requests: 0, scopedValues: 0 });
      const [scoped, partial] = await runScoped(oystehr, step, params, values);
      return finish(scoped, { ...partial, scopedValues: values.length });
    }

    if (step.mode === 'bulk') {
      return finish(await searchAsyncBulk(oystehr, step.resourceType as FhirResource['resourceType'], params), {
        mode: 'bulk',
        requests: 1,
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
  if (step.mode === 'bulk' || values.length > FETCH_PLAN_LIMITS.scopedBulkThreshold) {
    const batches = Math.ceil(values.length / 100);
    const resources = await fetchScopedResources<FhirResource>(
      oystehr,
      step.resourceType as FhirResource['resourceType'],
      paramName,
      values,
      params
    );
    return [resources, { mode: 'bulk', requests: batches }];
  }

  const batches: string[][] = [];
  for (let i = 0; i < values.length; i += FETCH_PLAN_LIMITS.scopedBatchSize) {
    batches.push(values.slice(i, i + FETCH_PLAN_LIMITS.scopedBatchSize));
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
