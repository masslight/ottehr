import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Organization } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  createEmployer,
  CreateEmployerInput,
  listEmployers,
  updateEmployer,
  UpdateEmployerInput,
} from './employers.api';

export const useEmployersQuery = (): UseQueryResult<Organization[], Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['employers'],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return listEmployers(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });
};

export const useCreateEmployerMutation = (): UseMutationResult<Organization, Error, CreateEmployerInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['create-employer'],
    mutationFn: async (data: CreateEmployerInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return createEmployer(oystehrZambda, data);
    },
  });
};

export const useUpdateEmployerMutation = (): UseMutationResult<Organization, Error, UpdateEmployerInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['update-employer'],
    mutationFn: async (data: UpdateEmployerInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return updateEmployer(oystehrZambda, data);
    },
  });
};
