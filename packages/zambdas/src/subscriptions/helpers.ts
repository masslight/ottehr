import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, sanitizeStringForFhirCode } from 'utils';

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
