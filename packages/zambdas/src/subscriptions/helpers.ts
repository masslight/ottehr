import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils';

interface PatchTaskStatusInput {
  task: Pick<Task, 'id'>;
  taskStatusToUpdate: Task['status'];
  statusReasonToUpdate?: string;
}

export const patchTaskStatus = async (input: PatchTaskStatusInput, oystehr: Oystehr): Promise<Task> => {
  const { task, taskStatusToUpdate, statusReasonToUpdate } = input;
  try {
    return await oystehr.fhir.patch({
      resourceType: 'Task',
      id: task.id || '',
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
    });
  } catch (error) {
    // convert 4xx FHIR validation failures to APIErrors
    if (error instanceof Oystehr.OystehrFHIRError && error.code >= 400 && error.code <= 499) {
      throw {
        ...INVALID_INPUT_ERROR(error.message),
        statusCode: error.code,
      };
    }
    throw error;
  }
};
