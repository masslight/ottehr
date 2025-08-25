import { useMemo } from 'react';
import { useFeatureFlags } from '../../features/css-module/context/featureFlags';
import useEvolveUser from '../../hooks/useEvolveUser';
import { useAppointmentData } from '../state';
import { getAppointmentAccessibilityData, GetAppointmentAccessibilityDataResult } from '../utils';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { locationVirtual, encounter, appointment } = useAppointmentData();
  const user = useEvolveUser();
  const featureFlags = useFeatureFlags();

  return useMemo(
    () => getAppointmentAccessibilityData({ locationVirtual, encounter, appointment, user, featureFlags }),
    [locationVirtual, encounter, appointment, user, featureFlags]
  );
};
