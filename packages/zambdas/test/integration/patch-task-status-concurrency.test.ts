import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { patchTaskStatus, TaskStatusPreconditionFailedError } from '../../src/subscriptions/helpers';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

/**
 * Regression coverage for OTR-2621.
 *
 * `patchTaskStatus` supports `optimisticLockingVersionId`, which sends the
 * FHIR `If-Match` header so the patch only commits if the Task is still at
 * the supplied version. Two concurrent callers trying to flip the same Task
 * to `in-progress` can't both win — only the one whose patch arrives while
 * the version still matches succeeds; the other gets HTTP 412 surfaced as a
 * {@link TaskStatusPreconditionFailedError}.
 *
 * This is the primitive `wrapTaskHandler.markTaskInProgress` now uses to
 * dedupe at-least-once subscription deliveries (e.g. duplicate invocations
 * of `sub-merge-patients` from a single Task event) — the root cause of the
 * flake on `merge-patients > should merge coverages from both patients into
 * the surviving PBILLACCT`.
 *
 * Note: JSON Patch `test` ops aren't sufficient — Oystehr evaluates them
 * against snapshot state, so two racing callers can both pass the same
 * `test` op against an unclaimed snapshot. If-Match is enforced against
 * committed state, which is what we need.
 */
describe('patchTaskStatus — atomic claim via optimisticLockingVersionId', () => {
  let oystehrAdmin: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/patch-task-status-concurrency.test.ts',
      M2MClientMockType.provider
    );
    oystehrAdmin = setup.oystehr;
    processId = setup.processId;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    // Tasks aren't reachable from cleanAppointmentGraph (it walks the
    // appointment graph), so delete each tracked Task explicitly first.
    for (const id of createdTaskIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'Task', id });
      } catch (e) {
        console.warn(`Failed to delete test Task/${id}:`, e);
      }
    }
    await cleanup();
  });

  const createTask = async (): Promise<Task> => {
    const created = await oystehrAdmin.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: 'requested',
          intent: 'order',
          code: {
            coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/test-task', code: 'concurrency-test' }],
          },
        },
        processId
      ) as Task
    );
    if (created.id) createdTaskIds.push(created.id);
    return created;
  };

  it('without optimisticLockingVersionId: both concurrent patches succeed (existing behavior preserved)', async () => {
    const task = await createTask();
    const [a, b] = await Promise.allSettled([
      patchTaskStatus(
        { task: { id: task.id! }, taskStatusToUpdate: 'in-progress', statusReasonToUpdate: 'a' },
        oystehrAdmin
      ),
      patchTaskStatus(
        { task: { id: task.id! }, taskStatusToUpdate: 'in-progress', statusReasonToUpdate: 'b' },
        oystehrAdmin
      ),
    ]);
    expect(a.status).toBe('fulfilled');
    expect(b.status).toBe('fulfilled');
  });

  it('with optimisticLockingVersionId: exactly one of two concurrent claims succeeds', async () => {
    const task = await createTask();
    const versionId = task.meta?.versionId;
    expect(versionId).toBeDefined();

    const [a, b] = await Promise.allSettled([
      patchTaskStatus(
        {
          task: { id: task.id! },
          taskStatusToUpdate: 'in-progress',
          statusReasonToUpdate: 'a',
          optimisticLockingVersionId: versionId,
        },
        oystehrAdmin
      ),
      patchTaskStatus(
        {
          task: { id: task.id! },
          taskStatusToUpdate: 'in-progress',
          statusReasonToUpdate: 'b',
          optimisticLockingVersionId: versionId,
        },
        oystehrAdmin
      ),
    ]);

    const fulfilled = [a, b].filter((r) => r.status === 'fulfilled');
    const rejected = [a, b].filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejection = rejected[0] as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(TaskStatusPreconditionFailedError);
    const err = rejection.reason as TaskStatusPreconditionFailedError;
    expect(err.taskId).toBe(task.id!);
    expect(err.attemptedVersionId).toBe(versionId);

    const final = await oystehrAdmin.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(final.status).toBe('in-progress');
  });

  it('with optimisticLockingVersionId: a sequential second claim against an already-claimed task rejects', async () => {
    const task = await createTask();
    const originalVersionId = task.meta?.versionId;
    expect(originalVersionId).toBeDefined();

    await patchTaskStatus(
      {
        task: { id: task.id! },
        taskStatusToUpdate: 'in-progress',
        statusReasonToUpdate: 'first',
        optimisticLockingVersionId: originalVersionId,
      },
      oystehrAdmin
    );

    // Second attempt against the now-stale original versionId.
    let caught: unknown = undefined;
    try {
      await patchTaskStatus(
        {
          task: { id: task.id! },
          taskStatusToUpdate: 'in-progress',
          statusReasonToUpdate: 'second',
          optimisticLockingVersionId: originalVersionId,
        },
        oystehrAdmin
      );
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(TaskStatusPreconditionFailedError);
    const err = caught as TaskStatusPreconditionFailedError;
    expect(err.attemptedVersionId).toBe(originalVersionId);
  });
});
