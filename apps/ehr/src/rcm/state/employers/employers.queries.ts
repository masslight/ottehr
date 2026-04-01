import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Organization } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  activateEmployer,
  createEmployer,
  CreateEmployerInput,
  deactivateEmployer,
  EmployerStatusInput,
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

export const useActivateEmployerMutation = (): UseMutationResult<Organization, Error, EmployerStatusInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['activate-employer'],
    mutationFn: async (data: EmployerStatusInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return activateEmployer(oystehrZambda, data);
    },
  });
};

export const useDeactivateEmployerMutation = (): UseMutationResult<Organization, Error, EmployerStatusInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['deactivate-employer'],
    mutationFn: async (data: EmployerStatusInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return deactivateEmployer(oystehrZambda, data);
    },
  });
};
