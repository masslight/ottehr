import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { OystehrAPIClient } from 'ui-components';
import { useSuccessQuery } from 'utils';
import {
  BookableItemListResponse,
  GetBookableItemListParams,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetTelemedLocationsResponse,
  PatientInfo,
  PromiseReturnType,
} from 'utils';

export const useCreateAppointmentMutation = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['createAppointment']>>,
  Error,
  {
    apiClient: OystehrAPIClient;
    unconfirmedDateOfBirth?: string;
    patientInfo: PatientInfo;
    stateInfo: { locationState: string };
  }
> =>
  useMutation({
    mutationFn: ({
      apiClient,
      unconfirmedDateOfBirth,
      patientInfo,
      stateInfo,
    }: {
      apiClient: OystehrAPIClient;
      patientInfo: PatientInfo;
      unconfirmedDateOfBirth?: string;
      stateInfo: { locationState: string };
    }) => {
      return apiClient.createAppointment({
        // slot: intakeCommon.visitType === VisitType.WalkIn ? undefined : appointment.appointmentSlot,
        patient: patientInfo,
        timezone: DateTime.now().zoneName,
        locationState: stateInfo.locationState,
        unconfirmedDateOfBirth,
      });
    },
  });

export const useUpdateAppointmentMutation = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['updateAppointment']>>,
  Error,
  {
    apiClient: OystehrAPIClient;
    appointmentID: string;
    patientInfo: PatientInfo;
    stateInfo?: { locationState: string };
  }
> => {
  return useMutation({
    mutationFn: ({
      apiClient,
      appointmentID,
      patientInfo,
      stateInfo,
    }: {
      apiClient: OystehrAPIClient;
      patientInfo: PatientInfo;
      appointmentID: string;
      stateInfo?: { locationState: string };
    }) => {
      return apiClient.updateAppointment({
        appointmentId: appointmentID,
        patient: patientInfo,
        ...(stateInfo ? { locationState: stateInfo.locationState } : {}),
      });
    },
  });
};

export const useCancelAppointmentMutation = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['cancelAppointment']>>,
  Error,
  {
    apiClient: OystehrAPIClient;
    appointmentID: string;
    cancellationReason: string;
  }
> =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentID,
      cancellationReason,
    }: {
      apiClient: OystehrAPIClient;
      appointmentID: string;
      cancellationReason: string;
    }) => {
      return apiClient.cancelAppointment({
        appointmentID,
        cancellationReason,
      });
    },
  });

export const useGetAppointments = (
  apiClient: OystehrAPIClient | null,
  enabled = true,
  patientId?: string
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getAppointments']>>, Error> => {
  const queryResult = useQuery({
    queryKey: ['appointments', patientId],

    queryFn: () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return patientId ? apiClient.getAppointments({ patientId }) : apiClient.getAppointments();
    },

    enabled,
    staleTime: 1000 * 60 * 5,
  });

  return queryResult;
};

export const useGetVisitDetails = (
  apiClient: OystehrAPIClient | null,
  enabled = true,
  appointmentId?: string
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getVisitDetails']>>, Error> => {
  const queryResult = useQuery({
    queryKey: ['appointment', appointmentId],

    queryFn: () => {
      if (apiClient && appointmentId) {
        return apiClient.getVisitDetails({ appointmentId });
      }
      throw new Error('API client not defined or appointmentID is not provided');
    },

    enabled,
  });

  return queryResult;
};

export const useGetTelemedStates = (
  apiClient: OystehrAPIClient | null,
  enabled = true,
  onSuccess?: (data: GetTelemedLocationsResponse | null) => void
): UseQueryResult<GetTelemedLocationsResponse, Error> => {
  const queryResult = useQuery({
    queryKey: ['telemed-states'],

    queryFn: () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return apiClient.getTelemedStates();
    },

    enabled,
    staleTime: 1000 * 60 * 5,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetBookableItems = (
  apiClient: OystehrAPIClient | null,
  enabled = true,
  params: GetBookableItemListParams,
  onSuccess?: (data: BookableItemListResponse | null) => void
): UseQueryResult<BookableItemListResponse, Error> => {
  const queryResult = useQuery({
    queryKey: ['list-bookables', params],

    queryFn: () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return apiClient.listBookables(params);
    },

    enabled,
    staleTime: 1000 * 60 * 5,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetSchedule = (
  apiClient: OystehrAPIClient | null,
  enabled = true,
  params: GetScheduleRequestParams,
  onSuccess?: (data: GetScheduleResponse | null) => void
): UseQueryResult<GetScheduleResponse, Error> => {
  const queryResult = useQuery({
    queryKey: ['get-schedule', params],

    queryFn: async () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      const res = await apiClient.getSchedule(params);
      return res;
    },

    enabled,
    staleTime: 1000 * 60 * 5,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
