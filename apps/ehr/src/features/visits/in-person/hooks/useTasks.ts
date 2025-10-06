import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Task as FhirTask } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import { getCoding, TASK_INPUT_SYSTEM } from 'utils';

const GET_TASKS_KEY = 'get-tasks';

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
      const tasks = (
        await oystehr.fhir.search<FhirTask>({
          resourceType: 'Task',
          params: [
            {
              name: '_tag',
              value: 'todo',
            },
            // todo filter by status ?
          ],
        })
      ).unbundle();
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
  return {
    id: task.id ?? '',
    category: task.groupIdentifier?.value ?? '',
    createdDate: task.authoredOn ?? '',
    title: task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === 'title')?.valueString ?? '',
    subtitle:
      task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === 'subtitle')?.valueString ?? '',
    status: task.status,
    action: {
      name:
        task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === 'action-name')?.valueString ??
        '',
      link:
        task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === 'action-link')?.valueString ??
        '',
    },
    assignee: {
      id: task.owner?.id ?? '',
      name: task.owner?.display ?? '',
      date: task.lastModified ?? '',
    },
    alert: task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === 'alert')?.valueString ?? '',
  };
}
