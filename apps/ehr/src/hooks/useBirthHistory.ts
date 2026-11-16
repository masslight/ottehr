import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { getBirthHistory, saveBirthHistory } from 'src/api/api';
import { BirthHistory, BirthHistoryOutput } from 'utils/lib/types/api/birth-history.types';
import { useApiClients } from './useAppClients';

const queryKeyFor = (patientId?: string): unknown[] => ['birth-history', patientId];

/** The patient's birth history (saved once per patient, so every visit reads the same record). */
export const useBirthHistory = (patientId?: string): UseQueryResult<BirthHistoryOutput, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: queryKeyFor(patientId),
    queryFn: () => getBirthHistory(oystehrZambda!, { patientId: patientId! }),
    enabled: Boolean(patientId) && Boolean(oystehrZambda),
  });
};

export const useSaveBirthHistory = (patientId?: string): UseMutationResult<BirthHistoryOutput, Error, BirthHistory> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (birthHistory: BirthHistory) =>
      saveBirthHistory(oystehrZambda!, { patientId: patientId!, birthHistory }),
    onSuccess: (output) => queryClient.setQueryData(queryKeyFor(patientId), output),
  });
};
