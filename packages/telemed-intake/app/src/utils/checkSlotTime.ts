import { DateTime } from 'luxon';
import { NavigateFunction } from 'react-router-dom';
import { IntakeFlowPageRoute } from 'src/App';

export const isSlotTimePassed = (selectedSlot: string | undefined, visitType: string | undefined): boolean => {
  if (visitType === 'now') {
    return false;
  }
  if (!selectedSlot) return false;
  const slotDateTime = DateTime.fromISO(selectedSlot);
  console.log('slotDateTime', slotDateTime);
  const now = DateTime.now();
  console.log('now', now);
  return slotDateTime < now;
};

export const handleClosePastTimeErrorDialog = (
  setIsPastTimeErrorDialogOpen: (value: boolean) => void,
  navigate: NavigateFunction,
  visitType: string | undefined,
  visitService: string | undefined,
  scheduleType: string | undefined,
  slug: string | undefined,
): void => {
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
