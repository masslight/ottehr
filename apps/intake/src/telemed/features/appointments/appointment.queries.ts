import { DateTime } from 'luxon';
import { useMutation, useQuery } from 'react-query';
import { ZapEHRAPIClient } from 'ui-components';
import {
  BookableItemListResponse,
  GetBookableItemListParams,
  GetScheduleRequestParams,
  GetScheduleResponse,
  GetTelemedLocationsResponse,
  PatientInfo,
} from 'utils';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreateAppointmentMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      unconfirmedDateOfBirth,
      patientInfo,
      stateInfo,
    }: {
      apiClient: ZapEHRAPIClient;
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdateAppointmentMutation = () => {
  return useMutation({
    mutationFn: ({
      apiClient,
      appointmentID,
      patientInfo,
      stateInfo,
    }: {
      apiClient: ZapEHRAPIClient;
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCancelAppointmentMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentID,
      cancellationReason,
    }: {
      apiClient: ZapEHRAPIClient;
      appointmentID: string;
      cancellationReason: string;
    }) => {
      return apiClient.cancelAppointment({
        appointmentID,
        cancellationReason,
      });
    },
  });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetAppointments = (apiClient: ZapEHRAPIClient | null, enabled = true, patientId?: string) =>
  useQuery(
    ['appointments', patientId],
    () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return patientId ? apiClient.getAppointments({ patientId }) : apiClient.getAppointments();
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching appointments: ', err);
      },
      staleTime: 1000 * 60 * 5,
    }
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetVisitDetails = (apiClient: ZapEHRAPIClient | null, enabled = true, appointmentId?: string) =>
  useQuery(
    ['appointment', appointmentId],
    () => {
      if (apiClient && appointmentId) {
        return apiClient.getVisitDetails({ appointmentId });
      }
      throw new Error('API client not defined or appointmentID is not provided');
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching appointment: ', err);
      },
    }
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetTelemedStates = (
  apiClient: ZapEHRAPIClient | null,
  enabled = true,
  onSuccess?: (data: GetTelemedLocationsResponse) => void
) =>
  useQuery(
    ['telemed-states'],
    () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return apiClient.getTelemedStates();
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching telemed states: ', err);
      },
      onSuccess,
      staleTime: 1000 * 60 * 5,
    }
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetBookableItems = (
  apiClient: ZapEHRAPIClient | null,
  enabled = true,
  params: GetBookableItemListParams,
  onSuccess?: (data: BookableItemListResponse) => void
) =>
  useQuery(
    ['list-bookables', params],
    () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return apiClient.listBookables(params);
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching telemed states: ', err);
      },
      onSuccess,
      staleTime: 1000 * 60 * 5,
    }
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetSchedule = (
  apiClient: ZapEHRAPIClient | null,
  enabled = true,
  params: GetScheduleRequestParams,
  onSuccess?: (data: GetScheduleResponse) => void
) =>
  useQuery(
    ['get-schedule', params],
    async () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      const res = await apiClient.getSchedule(params);
      return res;
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching telemed states: ', err);
      },
      onSuccess,
      staleTime: 1000 * 60 * 5,
    }
  );
