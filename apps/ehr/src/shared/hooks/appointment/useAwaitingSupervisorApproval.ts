import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { getVisitStatus } from 'utils';
import { useAppointmentData } from './appointment.store';

export const useAwaitingSupervisorApproval = (): boolean => {
  const { appointment, encounter } = useAppointmentData();

  if (!appointment || !encounter) {
    return false;
  }

  return (
    getVisitStatus(appointment, encounter, FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED) === 'awaiting supervisor approval'
  );
};
