import { useMemo } from 'react';
import { getAppointmentAccessibilityData, GetAppointmentAccessibilityDataResult } from '../utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore } from '../state';
import useOttehrUser from '../../hooks/useOttehrUser';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { location, encounter, appointment } = getSelectors(useAppointmentStore, [
    'location',
    'encounter',
    'appointment',
  ]);
  const user = useOttehrUser();

  return useMemo(
    () => getAppointmentAccessibilityData({ location, encounter, appointment, user }),
    [location, encounter, appointment, user]
  );
};
