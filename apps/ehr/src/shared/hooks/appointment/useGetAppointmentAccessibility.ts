import { useMemo } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useAppFlags } from '../../contexts/useAppFlags';
import { useAppointmentData } from './appointment.store';
import {
  getAppointmentAccessibilityData,
  GetAppointmentAccessibilityDataResult,
} from './appointment-accessibility.helper';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { locationVirtual, encounter, appointment } = useAppointmentData();
  const user = useEvolveUser();
  const featureFlags = useAppFlags();

  return useMemo(
    () => getAppointmentAccessibilityData({ locationVirtual, encounter, appointment, user, featureFlags }),
    [locationVirtual, encounter, appointment, user, featureFlags]
  );
};
