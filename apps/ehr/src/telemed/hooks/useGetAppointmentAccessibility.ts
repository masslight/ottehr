import { useMemo } from 'react';
import { useFeatureFlags } from '../../features/css-module/context/featureFlags';
import useEvolveUser from '../../hooks/useEvolveUser';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore } from '../state';
import { getAppointmentAccessibilityData, GetAppointmentAccessibilityDataResult } from '../utils';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { locationVirtual, encounter, appointment } = getSelectors(useAppointmentStore, [
    'locationVirtual',
    'encounter',
    'appointment',
  ]);
  const user = useEvolveUser();
  const featureFlags = useFeatureFlags();

  return useMemo(
    () => getAppointmentAccessibilityData({ locationVirtual, encounter, appointment, user, featureFlags }),
    [locationVirtual, encounter, appointment, user, featureFlags]
  );
};
