import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Task, TaskOutput } from 'fhir/r4b';
import { RcmTaskCodings } from 'utils/lib/fhir';
import { patchWithOptimisticLock, sanitizeStringForFhirCode } from 'utils/lib/fhir/helpers';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../shared/types/common';
import { safeJsonParse } from '../shared/validation';

interface PatchTaskStatusInput {
  task: Pick<Task, 'id'>;
  taskStatusToUpdate: Task['status'];
  statusReasonToUpdate?: string;
}

export const patchTaskStatus = async (input: PatchTaskStatusInput, oystehr: Oystehr): Promise<Task> => {
  const { task, taskStatusToUpdate, statusReasonToUpdate } = input;
  if (!task.id) {
    throw INVALID_INPUT_ERROR('Task ID is required to patch task status');
  }
  const trimmedReason = statusReasonToUpdate?.trim();
  return oystehr.fhir.patch({
    resourceType: 'Task',
    id: task.id,
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
              code: trimmedReason ? sanitizeStringForFhirCode(trimmedReason) : 'no-reason-given',
            },
          ],
          text: trimmedReason || 'no reason given',
        },
      },
    ],
  });
};

export function getTaskAndSecretsFromInput(
  input: ZambdaInput
): { task: Task; taskId: string } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const inputRes = safeJsonParse(input.body);

  if (inputRes.resourceType !== 'Task') {
    throw new Error(`resource parsed should be a Task but was a ${inputRes.resourceType}`);
  }

  const task = inputRes as Task;
  const taskId = task.id;
  if (!taskId) throw new Error('Task id is not found in the input task');

  return {
    task,
    taskId,
    secrets: input.secrets,
  };
}

/**
 * Re-reads the current stored Task, appends `outputToAppend` entries to whatever output is
 * already there, and patches status + output under an optimistic lock. Basing the add/replace
 * decision and the merged output array on the freshly fetched resource avoids two failure modes
 * that arise when the subscription payload is stale:
 *   (a) overwriting newer output entries written by a concurrent update, and
 *   (b) a 422 "bad path" if the payload's idea of whether /output exists is wrong.
 */
export async function updateTaskStatusAndOutput(
  oystehr: Oystehr,
  task: Pick<Task, 'id'>,
  status: Task['status'],
  outputToAppend?: TaskOutput[]
): Promise<void> {
  const currentTask = (await oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! })) as Task & { id: string };

  await patchWithOptimisticLock(oystehr, currentTask, (freshTask): Operation[] => {
    const patchOperations: Operation[] = [{ op: 'replace', path: '/status', value: status }];

    if (outputToAppend?.length) {
      const merged = [...(freshTask.output ?? []), ...outputToAppend];
      patchOperations.push({ op: freshTask.output ? 'replace' : 'add', path: '/output', value: merged });
    }

    return patchOperations;
  });
}

export function addErrorToInvoicingTaskOutput(error: string): TaskOutput {
  return { type: RcmTaskCodings.sendInvoiceOutputError, valueString: error };
}
