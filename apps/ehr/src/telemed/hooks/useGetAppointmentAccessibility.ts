import { useMemo } from 'react';
import { getAppointmentAccessibilityData, GetAppointmentAccessibilityDataResult } from '../utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore } from '../state';
import useEvolveUser from '../../hooks/useEvolveUser';
import { useFeatureFlags } from '../../features/css-module/context/featureFlags';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { location, encounter, appointment } = getSelectors(useAppointmentStore, [
    'location',
    'encounter',
    'appointment',
  ]);
  const user = useEvolveUser();
  const featureFlags = useFeatureFlags();

  return useMemo(
    () => getAppointmentAccessibilityData({ location, encounter, appointment, user, featureFlags }),
    [location, encounter, appointment, user, featureFlags]
  );
};
