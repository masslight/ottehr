import { DateTime } from 'luxon';
import { getSelectors } from 'ottehr-utils';
import { NavigateFunction } from 'react-router-dom';
import { IntakeFlowPageRoute } from 'src/App';
import { useAppointmentStore } from 'src/features/appointments';

export const isSlotTimePassed = (): boolean => {
  const selectedSlot = getSelectors(useAppointmentStore, ['selectedSlot']) as string;
  if (!selectedSlot) return false;
  const slotDateTime = DateTime.fromISO(selectedSlot);
  const now = DateTime.now();
  return slotDateTime < now;
};

export const handleClosePastTimeErrorDialog = (
  setIsPastTimeErrorDialogOpen: (value: boolean) => void,
  navigate: NavigateFunction,
): void => {
  const { visitType, visitService, scheduleType, slug } = getSelectors(useAppointmentStore, [
    'visitType',
    'visitService',
    'scheduleType',
    'slug',
  ]);

  if (!visitService || !visitType || !scheduleType || !slug) {
    console.error('One or more required parameters are missing');
    navigate(IntakeFlowPageRoute.PatientPortal.path);
    return;
  }

  setIsPastTimeErrorDialogOpen(false);

  navigate(
    `${IntakeFlowPageRoute.Welcome.path
      .replace(':schedule-type', scheduleType)
      .replace(':slug', slug)
      .replace(':visit-service', visitService)
      .replace(':visit-type', visitType)}`,
  );
};
