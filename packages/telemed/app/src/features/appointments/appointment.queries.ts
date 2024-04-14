import { useMutation } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';
import { useIntakeCommonStore } from '../common';
import { usePatientInfoStore } from '../patient-info';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreateAppointmentMutation = () =>
  useMutation({
    mutationFn: ({ apiClient }: { apiClient: ZapEHRAPIClient }) => {
      // const appointment = AppointmentStore.getState();
      const patientInfo = usePatientInfoStore.getState();
      const intakeCommon = useIntakeCommonStore.getState();

      return apiClient.createAppointment({
        // slot: intakeCommon.visitType === VisitType.WalkIn ? undefined : appointment.appointmentSlot,
        patient: patientInfo.patientInfo,
        locationState: intakeCommon.selectedLocationState,
      });
    },
  });
