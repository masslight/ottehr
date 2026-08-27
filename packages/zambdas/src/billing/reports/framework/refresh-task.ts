import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { EXPORT_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import {
  REFRESH_REPORT_CACHE_KEY_CODE,
  REFRESH_REPORT_KIND_CODE,
  REFRESH_REPORT_PARAMS_CODE,
  REFRESH_REPORT_TASK_CODE,
  RefreshReportKind,
} from 'utils/lib/types/data/billing/billing.constants';

// a refresh untouched for this long is assumed dead and no longer blocks
const STALE_REFRESH_MINUTES = 30;

// the cache key doubles as a searchable Task identifier for dedupe and lookups
export const REFRESH_TASK_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report-refresh');
const identifierTokenOf = (cacheKey: string): string => `${REFRESH_TASK_IDENTIFIER_SYSTEM}|${cacheKey}`;

const taskInputValue = (task: Task, code: string): string | undefined =>
  task.input?.find(
    (input) => input.type?.coding?.some((coding) => coding.system === EXPORT_TASK_SYSTEM && coding.code === code)
  )?.valueString;

export const refreshTaskKind = (task: Task): string | undefined => taskInputValue(task, REFRESH_REPORT_KIND_CODE);
export const refreshTaskParamsJson = (task: Task): string | undefined =>
  taskInputValue(task, REFRESH_REPORT_PARAMS_CODE);
export const refreshTaskCacheKey = (task: Task): string | undefined =>
  taskInputValue(task, REFRESH_REPORT_CACHE_KEY_CODE);

async function searchRefreshTasksByCacheKey(
  oystehr: Oystehr,
  cacheKey: string,
  statuses: string,
  count: number
): Promise<Task[]> {
  const bundle = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: 'identifier', value: identifierTokenOf(cacheKey) },
      { name: 'status', value: statuses },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: String(count) },
    ],
  });
  return bundle.unbundle();
}

// instants, not ISO string comparison — servers may return offsets/non-normalized formats
const instantOf = (iso: string | undefined): number => (iso ? DateTime.fromISO(iso).toMillis() : 0);
const staleBeforeMillis = (): number => DateTime.now().minus({ minutes: STALE_REFRESH_MINUTES }).toMillis();

// the running (or queued) refresh for one cache key, if any; stale tasks don't count
export async function findActiveRefreshTask(oystehr: Oystehr, cacheKey: string): Promise<Task | undefined> {
  const tasks = await searchRefreshTasksByCacheKey(oystehr, cacheKey, 'requested,in-progress', 10);
  const staleBefore = staleBeforeMillis();
  return tasks.find((task) => instantOf(task.meta?.lastUpdated) > staleBefore);
}

// most recent failed refresh newer than the served cache
export async function findRecentFailedRefreshTask(
  oystehr: Oystehr,
  cacheKey: string,
  sinceISO: string
): Promise<Task | undefined> {
  const tasks = await searchRefreshTasksByCacheKey(oystehr, cacheKey, 'failed', 1);
  const since = instantOf(sinceISO);
  return tasks.find((task) => instantOf(task.meta?.lastUpdated) > since);
}

// Queues a refresh; idempotent per cache key — concurrent kickoffs resolve to one Task via
// FHIR conditional create on the identifier + active statuses.
export async function kickOffRefreshTask(
  oystehr: Oystehr,
  input: { kind: RefreshReportKind; params: unknown; cacheKey: string }
): Promise<Task> {
  const activeStatusTasks = await searchRefreshTasksByCacheKey(oystehr, input.cacheKey, 'requested,in-progress', 10);
  const staleBefore = staleBeforeMillis();
  const fresh = activeStatusTasks.find((task) => instantOf(task.meta?.lastUpdated) > staleBefore);
  if (fresh) return fresh;

  // stale leftovers would satisfy the conditional create forever; cancel them first
  for (const stale of activeStatusTasks) {
    try {
      await oystehr.fhir.patch({
        resourceType: 'Task',
        id: stale.id ?? '',
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: 'add', path: '/statusReason', value: { text: 'stale refresh superseded' } },
        ],
      });
    } catch (err) {
      console.warn(`Failed to cancel stale refresh Task/${stale.id}:`, (err as Error)?.message);
    }
  }

  const task: Task = {
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    businessStatus: { text: 'queued' },
    identifier: [{ system: REFRESH_TASK_IDENTIFIER_SYSTEM, value: input.cacheKey }],
    code: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_TASK_CODE }] },
    input: [
      {
        type: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_KIND_CODE }] },
        valueString: input.kind,
      },
      {
        type: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_PARAMS_CODE }] },
        valueString: JSON.stringify(input.params ?? {}),
      },
      {
        type: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_CACHE_KEY_CODE }] },
        valueString: input.cacheKey,
      },
    ],
  };

  try {
    // returns the existing task instead of creating a second when the criteria match
    return await oystehr.fhir.create<Task>(task, {
      ifNoneExist: [
        { name: 'identifier', value: identifierTokenOf(input.cacheKey) },
        { name: 'status', value: 'requested,in-progress' },
      ],
    });
  } catch (err) {
    // e.g. HTTP 412: multiple matches — someone else already queued one
    const existing = await findActiveRefreshTask(oystehr, input.cacheKey);
    if (existing) return existing;
    throw err;
  }
}

// worker-side phase reporting; failures are swallowed because progress is cosmetic
export async function updateRefreshTaskProgress(oystehr: Oystehr, taskId: string, progress: string): Promise<void> {
  try {
    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: taskId,
      operations: [{ op: 'add', path: '/businessStatus', value: { text: progress } }],
    });
  } catch (err) {
    console.warn(`Failed to update refresh progress on Task/${taskId}:`, (err as Error)?.message);
  }
}
