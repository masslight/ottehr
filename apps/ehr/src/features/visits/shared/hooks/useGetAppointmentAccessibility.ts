import { useMemo } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { useAppFlags } from '../stores/contexts/useAppFlags';
import {
  getAppointmentAccessibilityData,
  GetAppointmentAccessibilityDataResult,
} from '../utils/appointment-accessibility.helper';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { locationVirtual, encounter, appointment } = useAppointmentData();
  const user = useEvolveUser();
  const featureFlags = useAppFlags();

  return useMemo(
    () => getAppointmentAccessibilityData({ locationVirtual, encounter, appointment, user, featureFlags }),
    [locationVirtual, encounter, appointment, user, featureFlags]
  );
};
