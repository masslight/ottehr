import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  cancelOutreachTask,
  CancelOutreachTaskInput,
  getOutreachConfig,
  listOutreachTasks,
  ListOutreachTasksInput,
  ListOutreachTasksResponse,
  OutreachConfigResponse,
  retryOutreachTask,
  RetryOutreachTaskInput,
  saveOutreachConfig,
  SaveOutreachConfigInput,
} from './scheduled-outreach-config.api';

const OUTREACH_CONFIG_QUERY_KEY = ['scheduled-outreach-config'];

export const useGetOutreachConfigQuery = (): UseQueryResult<OutreachConfigResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: OUTREACH_CONFIG_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return getOutreachConfig(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });
};

export const useSaveOutreachConfigMutation = (): UseMutationResult<
  OutreachConfigResponse,
  Error,
  SaveOutreachConfigInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['save-scheduled-outreach-config'],
    mutationFn: async (data: SaveOutreachConfigInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return saveOutreachConfig(oystehrZambda, data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(OUTREACH_CONFIG_QUERY_KEY, data);
    },
  });
};

const OUTREACH_TASKS_QUERY_KEY = ['outreach-tasks'];

export const useListOutreachTasksQuery = (
  params?: ListOutreachTasksInput
): UseQueryResult<ListOutreachTasksResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [
      ...OUTREACH_TASKS_QUERY_KEY,
      params?.status,
      params?.actionType,
      params?.medium,
      params?.triggerEvent,
      params?.patientSearch,
      params?.dueDateFrom,
      params?.dueDateTo,
      params?.createdFrom,
      params?.createdTo,
      params?.pageSize,
      params?.offset,
    ],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return listOutreachTasks(oystehrZambda, params);
    },
    enabled: !!oystehrZambda,
  });
};

export const useCancelOutreachTaskMutation = (): UseMutationResult<
  { success: boolean; taskId: string },
  Error,
  CancelOutreachTaskInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['cancel-outreach-task'],
    mutationFn: async (data: CancelOutreachTaskInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return cancelOutreachTask(oystehrZambda, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OUTREACH_TASKS_QUERY_KEY });
    },
  });
};

export const useRetryOutreachTaskMutation = (): UseMutationResult<
  { success: boolean; taskId: string },
  Error,
  RetryOutreachTaskInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['retry-outreach-task'],
    mutationFn: async (data: RetryOutreachTaskInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return retryOutreachTask(oystehrZambda, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OUTREACH_TASKS_QUERY_KEY });
    },
  });
};
