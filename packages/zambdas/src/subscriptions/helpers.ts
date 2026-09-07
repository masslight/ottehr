import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Task, TaskOutput } from 'fhir/r4b';
import { sanitizeStringForFhirCode } from 'utils/lib/fhir/helpers';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, RcmTaskCodings } from 'utils/lib/types/errors';
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

export async function updateTaskStatusAndOutput(
  oystehr: Oystehr,
  task: Task,
  status: Task['status'],
  newOutput?: TaskOutput[]
): Promise<void> {
  const patchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: status,
    },
  ];
  if (newOutput) {
    patchOperations.push({
      op: task.output ? 'replace' : 'add',
      path: '/output',
      value: newOutput,
    });
  }
  await oystehr.fhir.patch({
    resourceType: 'Task',
    id: task.id!,
    operations: patchOperations,
  });
}

export function addErrorToTaskOutput(task: Task, error: string): Task {
  const taskCopy = { ...task };
  if (!taskCopy.output) taskCopy.output = [];
  const taskError = RcmTaskCodings.sendInvoiceOutputError;

  taskCopy.output?.push({
    type: taskError,
    valueString: error,
  });
  return taskCopy;
}
