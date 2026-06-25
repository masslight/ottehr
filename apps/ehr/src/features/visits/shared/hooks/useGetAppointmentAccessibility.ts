import { useMemo } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import {
  getAppointmentAccessibilityData,
  GetAppointmentAccessibilityDataResult,
} from '../utils/appointment-accessibility.helper';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { locationVirtual, encounter, appointment } = useAppointmentData();
  const user = useEvolveUser();

  return useMemo(
    () => getAppointmentAccessibilityData({ locationVirtual, encounter, appointment, user }),
    [locationVirtual, encounter, appointment, user]
  );
};
