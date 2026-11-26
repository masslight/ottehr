import Oystehr from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { useApiClients } from './useAppClients';

export const useInvalidatingZambdaMutation = <Input, Output>(
  key: string,
  request: (oystehr: Oystehr, data: Input) => Promise<Output>,
  invalidateKey: string
): UseMutationResult<Output, Error, Input> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [key],
    mutationFn: async (data: Input) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return request(oystehrZambda, data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [invalidateKey] }),
  });
};
