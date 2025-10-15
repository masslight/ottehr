import { SearchParam } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Task as FhirTask } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  getCoding,
  IN_HOUSE_LAB_TASK,
  TASK_CATEGORY_IDENTIFIER,
  TASK_INPUT_SYSTEM,
  TASK_LOCATION_SYSTEM,
  TASK_TYPE_SYSTEM,
} from 'utils';

const GET_TASKS_KEY = 'get-tasks';
const GO_TO_LAB_TEST = 'Go to Lab Test';

export const TASKS_PAGE_SIZE = 20;

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

export interface TasksSearchParams {
  assignedTo?: string | null;
  category?: string | null;
  location?: string | null;
  status?: string | null;
  page?: number;
}

export interface AssignTaskRequest {
  taskId: string;
  assignee: {
    id: string;
    name: string;
  };
}

export interface UnassignTaskRequest {
  taskId: string;
}

export const useGetTasks = ({
  assignedTo,
  category,
  location,
  status,
  page,
}: TasksSearchParams): UseQueryResult<Task[], Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    queryKey: [GET_TASKS_KEY, assignedTo, category, location, status, page],
    queryFn: async () => {
      if (!oystehr) throw new Error('oystehr not defined');
      const params: SearchParam[] = [
        {
          name: '_tag',
          value: 'task',
        },
        {
          name: '_sort',
          value: '-authored-on',
        },
        {
          name: '_count',
          value: TASKS_PAGE_SIZE,
        },
      ];
      if (page) {
        params.push({
          name: '_offset',
          value: page * TASKS_PAGE_SIZE,
        });
      }
      if (assignedTo) {
        params.push({
          name: 'owner',
          value: 'Practitioner/' + assignedTo,
        });
      }
      if (category) {
        params.push({
          name: 'group-identifier',
          value: TASK_CATEGORY_IDENTIFIER + '|' + category,
        });
      }
      if (location) {
        params.push({
          name: '_tag',
          value: TASK_LOCATION_SYSTEM + '|' + location,
        });
      }
      if (status) {
        params.push({
          name: 'status',
          value: status,
        });
      }
      const tasks = (
        await oystehr.fhir.search<FhirTask>({
          resourceType: 'Task',
          params,
        })
      ).unbundle();
      return tasks.map(fhirTaskToTask);
    },
    enabled: oystehr != null,
    retry: 2,
    staleTime: 5 * 1000,
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
            op: 'add',
            path: '/owner',
            value: {
              reference: 'Practitioner/' + input.assignee.id,
              display: input.assignee.name,
            },
          },
          {
            op: 'replace',
            path: '/status',
            value: 'in-progress',
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
            path: '/owner',
          },
          {
            op: 'replace',
            path: '/status',
            value: 'requested',
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
  let title = getInput('title', task) ?? '';
  let subtitle = getInput('subtitle', task) ?? '';
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
  if (category === IN_HOUSE_LAB_TASK.category) {
    const testName = getInput(IN_HOUSE_LAB_TASK.input.testName, task);
    const patientName = getInput(IN_HOUSE_LAB_TASK.input.patientName, task);
    const providerName = getInput(IN_HOUSE_LAB_TASK.input.providerName, task);
    const orderDate = getInput(IN_HOUSE_LAB_TASK.input.orderDate, task);
    subtitle = `Ordered by ${providerName} on ${
      orderDate ? DateTime.fromISO(orderDate).toFormat('MM/dd/yyyy HH:mm a') : ''
    }`;
    if (type === IN_HOUSE_LAB_TASK.type.collectSample) {
      title = `Collect sample for “${testName}” for ${patientName}`;
    }
    if (type === IN_HOUSE_LAB_TASK.type.enterResults) {
      title = `Perform test & enter results for “${testName}” for ${patientName}`;
    }
    action = {
      name: GO_TO_LAB_TEST,
      link: `/in-person/${appointmentId}/in-house-lab-orders/${task.basedOn?.[0]?.reference?.split(
        '/'
      )?.[1]}/order-details`,
    };
  }
  return {
    id: task.id ?? '',
    category: category,
    createdDate: task.authoredOn ?? '',
    title: title,
    subtitle: subtitle,
    status: task.status,
    action: action,
    assignee: task.owner
      ? {
          id: task.owner?.reference?.split('/')?.[1] ?? '',
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
