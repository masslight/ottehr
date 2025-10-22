import { SearchParam } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Task as FhirTask } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  getCoding,
  getExtension,
  IN_HOUSE_LAB_TASK,
  LAB_ORDER_TASK,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  TASK_CATEGORY_IDENTIFIER,
  TASK_INPUT_SYSTEM,
  TASK_LOCATION_SYSTEM,
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
}: TasksSearchParams): UseQueryResult<{ tasks: Task[]; total: number }, Error> => {
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
      const bundle = await oystehr.fhir.search<FhirTask>({
        resourceType: 'Task',
        params,
      });
      const tasks = bundle.unbundle().map(fhirTaskToTask);
      return {
        tasks,
        total: bundle.total ?? -1,
      };
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
              extension: [
                {
                  url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
                  valueDateTime: DateTime.now().toISO(),
                },
              ],
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
            value: 'ready',
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
  let action: any = undefined;
  let title = getInput('title', task) ?? '';
  let subtitle = getInput('subtitle', task) ?? '';
  if (category === LAB_ORDER_TASK.category) {
    const code = getCoding(task.code, LAB_ORDER_TASK.system)?.code ?? '';
    const testName = getInput(LAB_ORDER_TASK.input.testName, task);
    const patientName = getInput(LAB_ORDER_TASK.input.patientName, task);
    const appointmentId = getInput(LAB_ORDER_TASK.input.appointmentId, task);
    const orderId = task.basedOn?.[0]?.reference?.split('/')?.[1];
    const providerName = getInput(LAB_ORDER_TASK.input.providerName, task);
    const orderDate = getInput(LAB_ORDER_TASK.input.orderDate, task);
    subtitle = `Ordered by ${providerName} on ${
      orderDate ? DateTime.fromISO(orderDate).toFormat('MM/dd/yyyy HH:mm a') : ''
    }`;
    if (code === LAB_ORDER_TASK.code.collectSample) {
      title = `Collect sample for “${testName}” for ${patientName}`;
      action = {
        name: GO_TO_LAB_TEST,
        link: `/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`,
      };
    }
    if (code === LAB_ORDER_TASK.code.reviewResults) {
      title = `Review results for “${testName}” for ${patientName}`;
      action = {
        name: GO_TO_LAB_TEST,
        link: `/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`,
      };
    }
    /*if (code === LAB_ORDER_TASK.code.preSubmission || LAB_ORDER_TASK.code.reviewFinalResult) {
      action = {
        name: GO_TO_LAB_TEST,
        link: `/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`,
      };
    }
    if (code === LAB_ORDER_TASK.code.matchUnsolicitedResult) {
      action = {
        name: 'Match',
        link: `/unsolicited-results/${getInput('diagnosticReportId', task)}/match`,
      };
    }*/
    /*if (code === LAB_ORDER_TASK.code.reviewFinalResult) {
      action = {
        name: GO_TO_LAB_TEST,
        link: `/in-person/${appointmentId}/external-lab-orders`,
      };
    }*/
  }
  if (category === IN_HOUSE_LAB_TASK.category) {
    const code = getCoding(task.code, IN_HOUSE_LAB_TASK.system)?.code ?? '';
    const testName = getInput(IN_HOUSE_LAB_TASK.input.testName, task);
    const patientName = getInput(IN_HOUSE_LAB_TASK.input.patientName, task);
    const providerName = getInput(IN_HOUSE_LAB_TASK.input.providerName, task);
    const orderDate = getInput(IN_HOUSE_LAB_TASK.input.orderDate, task);
    const appointmentId = getInput(IN_HOUSE_LAB_TASK.input.appointmentId, task);
    subtitle = `Ordered by ${providerName} on ${
      orderDate ? DateTime.fromISO(orderDate).toFormat('MM/dd/yyyy HH:mm a') : ''
    }`;
    if (code === IN_HOUSE_LAB_TASK.code.collectSampleTask) {
      title = `Collect sample for “${testName}” for ${patientName}`;
    }
    if (code === IN_HOUSE_LAB_TASK.code.inputResultsTask) {
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
          date: getExtension(task.owner, TASK_ASSIGNED_DATE_TIME_EXTENSION_URL)?.valueDateTime ?? '',
        }
      : undefined,
    alert: getInput('alert', task) ?? '',
  };
}

function getInput(code: string, task: FhirTask): string | undefined {
  return task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === code)?.valueString;
}
