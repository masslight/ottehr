import { DateTime } from 'luxon';
import { useMutation, useQuery } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';
import { useAppointmentStore } from './appointment.store';
import { PatientInfo } from 'ottehr-utils';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreateAppointmentMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      unconfirmedDateOfBirth,
      patientInfo,
    }: {
      apiClient: ZapEHRAPIClient;
      unconfirmedDateOfBirth?: boolean;
      patientInfo: PatientInfo;
    }) => {
      // const appointment = AppointmentStore.getState();
      const appointment = useAppointmentStore.getState();

      return apiClient.createAppointment({
        // slot: intakeCommon.visitType === VisitType.WalkIn ? undefined : appointment.appointmentSlot,
        patient: patientInfo,
        timezone: DateTime.now().zoneName,
        locationID: appointment.locationID,
        providerID: appointment.providerID,
        groupID: appointment.groupID,
        slot: appointment.visitType === 'prebook' ? appointment.selectedSlot : undefined,
        scheduleType: appointment.scheduleType,
        visitType: appointment.visitType,
        visitService: appointment.visitService,
        ...(unconfirmedDateOfBirth && { unconfirmedDateOfBirth: String(unconfirmedDateOfBirth) }),
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
    }: {
      apiClient: ZapEHRAPIClient;
      patientInfo: PatientInfo;
      appointmentID: string;
    }) => {
      return apiClient.updateAppointment({
        appointmentId: appointmentID,
        patient: patientInfo,
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
      appointmentType,
    }: {
      apiClient: ZapEHRAPIClient;
      appointmentID: string;
      cancellationReason: string;
      appointmentType: 'telemed' | 'in-person';
    }) => {
      if (appointmentType === 'telemed') {
        return apiClient.cancelTelemedAppointment({
          appointmentID,
          cancellationReason,
        });
      } else if (appointmentType === 'in-person') {
        return apiClient.cancelInPersonAppointment({
          appointmentID,
          cancellationReason,
        });
      } else {
        throw new Error('Invalid appointment type');
      }
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
    },
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetSchedule = (apiClient: ZapEHRAPIClient | null, scheduleType: string, slug: string, enabled = true) =>
  useQuery(
    ['schedule'],
    async () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      let response;
      try {
        response = await apiClient.getSchedule({ scheduleType, slug });
      } catch (error: any) {
        if (error.message === 'Schedule is not found') {
          return undefined;
        }
        throw error;
      }
      return response;
    },
    {
      enabled,
      onError: (error: any) => {
        console.error('Error getting a schedule: ', error);
      },
      retry: (failureCount) => {
        return failureCount < 3;
      },
    },
  );
