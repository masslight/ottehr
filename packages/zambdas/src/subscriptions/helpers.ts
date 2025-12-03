import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';

interface PatchTaskStatusInput {
  task: Pick<Task, 'id'>;
  taskStatusToUpdate: Task['status'];
  statusReasonToUpdate?: string;
}

export const patchTaskStatus = async (input: PatchTaskStatusInput, oystehr: Oystehr): Promise<Task> => {
  const { task, taskStatusToUpdate, statusReasonToUpdate } = input;
  return oystehr.fhir.patch({
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
};
