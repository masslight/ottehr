import { useEffect, useState } from 'react';
import { useGetAppointments } from 'src/telemed/features/appointments/appointment.queries';
import { useAppointmentStore } from 'src/telemed/features/appointments/appointment.store';
import { useOystehrAPIClient } from 'src/telemed/utils/getOystehrAPI';
import { getSelectors } from 'utils/lib/store';
import { TelemedAppointmentInformationIntake } from 'utils/lib/types/data/telemed/appointments/appointments.types';

export const useAppointmentsData = ({ enabled = true }: { enabled?: boolean } = {}): {
  appointmentID: string | undefined;
  appointment: TelemedAppointmentInformationIntake | undefined;
  appointments: TelemedAppointmentInformationIntake[] | undefined;
  isAppointmentsFetching: boolean;
  refetchAppointments: () => Promise<unknown>;
} => {
  const apiClient = useOystehrAPIClient();
  const [appointment, setCurrentAppointment] = useState<TelemedAppointmentInformationIntake | undefined>();
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);

  const {
    data: { appointments } = {},
    isFetching: isAppointmentsFetching,
    refetch: refetchAppointments,
  } = useGetAppointments(apiClient, Boolean(apiClient && enabled));

  useEffect(() => {
    const appointment = appointments?.find?.((appointment) => {
      return appointment.id === appointmentID;
    });
    setCurrentAppointment(appointment);
  }, [appointments, appointmentID]);

  return {
    appointmentID,
    appointment,
    appointments,
    isAppointmentsFetching,
    refetchAppointments,
  };
};
