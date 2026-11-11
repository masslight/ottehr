import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  AdministerImmunizationOrderRequest,
  CancelImmunizationOrderRequest,
  CancelImmunizationOrderResponse,
  CreateUpdateImmunizationOrderRequest,
  CreateUpdateImmunizationOrderResponse,
  GetImmunizationForecastRequest,
  GetImmunizationForecastResponse,
  GetImmunizationOrdersRequest,
  GetImmunizationOrdersResponse,
  GetPatientImmunizationsResponse,
  GetVaccinesResponse,
  RecordOutsideImmunizationRequest,
  RecordOutsideImmunizationResponse,
  Vaccine,
} from 'utils/lib/types/data/immunization/types';
import { invalidateChartSections } from '../../shared/hooks/chartSectionCache';

const GET_IMMUNIZATION_ORDERS_KEY = 'get-immunization-orders';
const GET_VACCINES_KEY = 'get-vaccines';

export const useCreateUpdateImmunizationOrder = (): UseMutationResult<
  CreateUpdateImmunizationOrderResponse,
  Error,
  CreateUpdateImmunizationOrderRequest
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUpdateImmunizationOrderRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'create-update-immunization-order',
      });
      return chooseJson(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_IMMUNIZATION_ORDERS_KEY],
        exact: false,
      });
    },
  });
};

export const useAdministerImmunizationOrder = (): UseMutationResult<
  CreateUpdateImmunizationOrderResponse,
  Error,
  AdministerImmunizationOrderRequest
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdministerImmunizationOrderRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'administer-immunization-order',
      });
      return chooseJson(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_IMMUNIZATION_ORDERS_KEY],
        exact: false,
      });
    },
  });
};

export const useGetImmunizationOrders = (
  input: GetImmunizationOrdersRequest
): UseQueryResult<GetImmunizationOrdersResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_IMMUNIZATION_ORDERS_KEY, input],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'get-immunization-orders',
      });
      return chooseJson(response);
    },
    enabled: oystehrZambda && Boolean(input.orderId || input.patientId || input.encounterIds),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCancelImmunizationOrder = (
  encounterId: string | undefined
): UseMutationResult<CancelImmunizationOrderResponse, Error, CancelImmunizationOrderRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelImmunizationOrderRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'cancel-immunization-order',
      });
      return chooseJson<CancelImmunizationOrderResponse>(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_IMMUNIZATION_ORDERS_KEY],
        exact: false,
      });
      await invalidateChartSections(queryClient, encounterId, ['assessment']);
    },
  });
};

export const useGetVaccines = (): UseQueryResult<Vaccine[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_VACCINES_KEY],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        id: 'get-vaccines',
      });
      return (chooseJson(response) as GetVaccinesResponse).vaccines;
    },
    enabled: oystehrZambda != null,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

const GET_PATIENT_IMMUNIZATIONS_KEY = 'get-patient-immunizations';

/** The patient's Immunization records: doses given here and outside, and the per-vaccine marks. */
export const useGetPatientImmunizations = (
  patientId: string | undefined
): UseQueryResult<GetPatientImmunizationsResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_PATIENT_IMMUNIZATIONS_KEY, patientId],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({ patientId, id: 'get-patient-immunizations' });
      return chooseJson(response);
    },
    enabled: oystehrZambda != null && Boolean(patientId),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

const GET_IMMUNIZATION_FORECAST_KEY = 'get-immunization-forecast';

/** The engine's forecast for the patient as of the visit, run on the server; refreshed with the records. */
export const useGetImmunizationForecast = (
  input: Partial<GetImmunizationForecastRequest>
): UseQueryResult<GetImmunizationForecastResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_IMMUNIZATION_FORECAST_KEY, input.patientId, input.encounterId],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({ ...input, id: 'get-immunization-forecast' });
      return chooseJson(response);
    },
    enabled: oystehrZambda != null && Boolean(input.patientId),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

/** Saves a dose administered externally straight into the patient's history. */
export const useRecordOutsideImmunization = (): UseMutationResult<
  RecordOutsideImmunizationResponse,
  Error,
  RecordOutsideImmunizationRequest
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordOutsideImmunizationRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({ ...input, id: 'record-outside-immunization' });
      return chooseJson(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [GET_PATIENT_IMMUNIZATIONS_KEY], exact: false });
      await queryClient.invalidateQueries({ queryKey: [GET_IMMUNIZATION_FORECAST_KEY], exact: false });
    },
  });
};
