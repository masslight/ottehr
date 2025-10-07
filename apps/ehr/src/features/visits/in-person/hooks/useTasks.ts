import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Task as FhirTask } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useApiClients } from 'src/hooks/useAppClients';
import { codeableConcept, getCoding, TASK_CATEGORY_IDENTIFIER, TASK_INPUT_SYSTEM, TASK_TYPE_SYSTEM } from 'utils';

const GET_TASKS_KEY = 'get-tasks';
const GO_TO_LAB_TEST = 'Go to Lab Test';

const STUB_TASK: FhirTask = {
  resourceType: 'Task',
  id: '12345',
  intent: 'unknown',
  status: 'requested',
  groupIdentifier: {
    system: TASK_CATEGORY_IDENTIFIER,
    value: 'in-house-labs',
  },
  code: codeableConcept('collect-sample', TASK_TYPE_SYSTEM),
  authoredOn: DateTime.now().toISO(),
  input: [
    {
      type: codeableConcept('title', TASK_INPUT_SYSTEM),
      valueString: 'Task title',
    },
    {
      type: codeableConcept('subtitle', TASK_INPUT_SYSTEM),
      valueString: 'Task subtitle',
    },
    {
      type: codeableConcept('appointmentId', TASK_INPUT_SYSTEM),
      valueString: 'stubAppointmentId',
    },
    {
      type: codeableConcept('orderId', TASK_INPUT_SYSTEM),
      valueString: 'stubOrderId',
    },
    {
      type: codeableConcept('alert', TASK_INPUT_SYSTEM),
      valueString: 'ALERT!',
    },
  ],
};

export interface Task {
  id: string;
  category: string;
  createdDate: string;
  title: string;
  subtitle: string;
  status: string;
  action?: {
    name: string;
    link: string;
  };
  assignee?: {
    id: string;
    name: string;
    date: string;
  };
  alert?: string;
}

export interface AssignTaskRequest {
  taskId: string;
  assignee: {
    reference: string;
    name: string;
  };
}

export interface UnassignTaskRequest {
  taskId: string;
}

export const useGetTasks = (): UseQueryResult<Task[], Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    queryKey: [GET_TASKS_KEY],
    queryFn: async () => {
      if (!oystehr) throw new Error('oystehr not defined');
      /*const tasks = (
        await oystehr.fhir.search<FhirTask>({
          resourceType: 'Task',
          params: [
            {
              name: '_tag',
              value: 'task',
            },
          ],
        })
      ).unbundle();*/
      const tasks = [STUB_TASK];
      return tasks.map(fhirTaskToTask);
    },
    enabled: oystehr != null,
    retry: 2,
    staleTime: 10 * 1000,
  });
};

export const useAssignTask = (): UseMutationResult<void, Error, AssignTaskRequest> => {
  const { oystehr } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignTaskRequest) => {
      if (!oystehr) throw new Error('oystehr not defined');
      await oystehr.fhir.patch<FhirTask>({
        resourceType: 'Task',
        id: input.taskId,
        operations: [
          {
            op: 'replace',
            path: 'owner',
            value: {
              reference: input.assignee.reference,
              display: input.assignee.name,
            },
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_TASKS_KEY],
        exact: false,
      });
    },
  });
};

export const useUnassignTask = (): UseMutationResult<void, Error, UnassignTaskRequest> => {
  const { oystehr } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UnassignTaskRequest) => {
      if (!oystehr) throw new Error('oystehr not defined');
      await oystehr.fhir.patch<FhirTask>({
        resourceType: 'Task',
        id: input.taskId,
        operations: [
          {
            op: 'remove',
            path: 'owner',
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_TASKS_KEY],
        exact: false,
      });
    },
  });
};

function fhirTaskToTask(task: FhirTask): Task {
  const category = task.groupIdentifier?.value ?? '';
  const type = getCoding(task.code, TASK_TYPE_SYSTEM)?.code ?? '';
  const appointmentId = getInput('appointmentId', task);
  const orderId = getInput('orderId', task);
  let action: any = undefined;
  if (category === 'external-labs') {
    if (type === 'collect-sample' || type === 'review-results') {
      action = {
        name: GO_TO_LAB_TEST,
        link: `/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`,
      };
    }
    if (type === 'match-unsolicited') {
      action = {
        name: 'Match',
        link: `/unsolicited-results/${getInput('diagnosticReportId', task)}/match`,
      };
    }
    if (type === 'review-unsolicited') {
      action = {
        name: GO_TO_LAB_TEST,
        link: `/in-person/${appointmentId}/external-lab-orders`,
      };
    }
  }
  if (category === 'in-house-labs') {
    action = {
      name: GO_TO_LAB_TEST,
      link: `/in-person/${appointmentId}/in-house-lab-orders/${orderId}/order-details`,
    };
  }
  return {
    id: task.id ?? '',
    category: category,
    createdDate: task.authoredOn ?? '',
    title: getInput('title', task) ?? '',
    subtitle: getInput('subtitle', task) ?? '',
    status: task.status,
    action: action,
    assignee: task.owner
      ? {
          id: task.owner?.id ?? '',
          name: task.owner?.display ?? '',
          date: task.lastModified ?? '',
        }
      : undefined,
    alert: getInput('alert', task) ?? '',
  };
}

function getInput(code: string, task: FhirTask): string | undefined {
  return task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === code)?.valueString;
}
