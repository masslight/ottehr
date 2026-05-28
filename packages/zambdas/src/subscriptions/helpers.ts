import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';

interface PatchTaskStatusInput {
  task: Pick<Task, 'id'>;
  taskStatusToUpdate: Task['status'];
  statusReasonToUpdate?: string;
  /**
   * Enable FHIR optimistic locking on the patch. When set, the request is sent
   * with `If-Match: W/"<versionId>"` (FHIR optimistic-locking format). If the
   * Task has been modified since the version provided — e.g. a concurrent
   * subscription delivery already claimed it — the server returns HTTP 412
   * Precondition Failed and {@link patchTaskStatus} throws
   * {@link TaskStatusPreconditionFailedError}.
   *
   * Note: JSON Patch `test` ops are not sufficient here — Oystehr applies
   * concurrent patches against snapshot state, so two racing callers can both
   * have their `test` op pass against the same unclaimed snapshot. If-Match
   * is the only check that's enforced atomically against committed state.
   */
  optimisticLockingVersionId?: string;
}

/**
 * Thrown by {@link patchTaskStatus} when an `optimisticLockingVersionId` was
 * provided but the Task had already been updated by another writer before
 * our PATCH committed (HTTP 412 Precondition Failed). Callers that opt into
 * optimistic locking should catch this specifically to distinguish "lost
 * the claim race" from a real error.
 */
export class TaskStatusPreconditionFailedError extends Error {
  readonly taskId: string;
  readonly attemptedVersionId: string;

  constructor(taskId: string, attemptedVersionId: string, cause?: unknown) {
    super(
      `Task/${taskId} optimistic lock failed: attempted versionId='${attemptedVersionId}' but the resource has been updated since`
    );
    this.name = 'TaskStatusPreconditionFailedError';
    this.taskId = taskId;
    this.attemptedVersionId = attemptedVersionId;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export const patchTaskStatus = async (input: PatchTaskStatusInput, oystehr: Oystehr): Promise<Task> => {
  const { task, taskStatusToUpdate, statusReasonToUpdate, optimisticLockingVersionId } = input;
  const taskId = task.id || '';

  try {
    return await oystehr.fhir.patch(
      {
        resourceType: 'Task',
        id: taskId,
        operations: [
          {
            op: 'replace',
            path: '/status',
            value: taskStatusToUpdate,
          },
          {
            op: 'add',
            path: '/statusReason',
            value: {
              coding: [
                {
                  system: 'status-reason',
                  code: statusReasonToUpdate || 'no reason given',
                },
              ],
            },
          },
        ],
      },
      optimisticLockingVersionId ? { optimisticLockingVersionId } : undefined
    );
  } catch (error) {
    // Surface the precondition-failed case as a typed error so callers can
    // distinguish "lost the claim race" from real errors. The SDK throws an
    // OystehrSdkError with code=412 when the If-Match check fails.
    if (optimisticLockingVersionId && isPreconditionFailed(error)) {
      throw new TaskStatusPreconditionFailedError(taskId, optimisticLockingVersionId, error);
    }
    throw error;
  }
};

const isPreconditionFailed = (error: unknown): boolean => {
  const code = (error as { code?: number; statusCode?: number; status?: number } | null)?.code;
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  const status = (error as { status?: number } | null)?.status;
  return code === 412 || statusCode === 412 || status === 412;
};
