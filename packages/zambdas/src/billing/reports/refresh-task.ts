import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { EXPORT_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import {
  REFRESH_REPORT_KIND_CODE,
  REFRESH_REPORT_TASK_CODE,
  RefreshReportKind,
} from 'utils/lib/types/data/billing/billing.constants';

// a refresh untouched for this long is assumed dead (hard-killed worker) and no longer blocks
const STALE_REFRESH_MINUTES = 30;

export const refreshTaskKindOf = (task: Task): string | undefined =>
  task.input?.find((input) => input.type?.coding?.some((coding) => coding.code === REFRESH_REPORT_KIND_CODE))
    ?.valueString;

export async function findActiveRefreshTask(oystehr: Oystehr, kind: RefreshReportKind): Promise<Task | undefined> {
  const bundle = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: 'code', value: `${EXPORT_TASK_SYSTEM}|${REFRESH_REPORT_TASK_CODE}` },
      { name: 'status', value: 'requested,in-progress' },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '20' },
    ],
  });
  const staleBefore = DateTime.now().minus({ minutes: STALE_REFRESH_MINUTES }).toUTC().toISO() ?? '';
  return bundle
    .unbundle()
    .find((task) => refreshTaskKindOf(task) === kind && (task.meta?.lastUpdated ?? '') > staleBefore);
}

// Queues an async report refresh; idempotent while one is already running for the kind.
// Returns the already-active or newly created task so callers can report live progress.
export async function kickOffRefreshTask(oystehr: Oystehr, kind: RefreshReportKind): Promise<Task> {
  const active = await findActiveRefreshTask(oystehr, kind);
  if (active) return active;
  return oystehr.fhir.create<Task>({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    businessStatus: { text: 'queued' },
    code: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_TASK_CODE }] },
    input: [
      {
        type: { coding: [{ system: EXPORT_TASK_SYSTEM, code: REFRESH_REPORT_KIND_CODE }] },
        valueString: kind,
      },
    ],
  });
}

// Worker-side phase reporting; failures are swallowed because progress is cosmetic.
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
