import { useMemo } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import {
  getAppointmentAccessibilityData,
  GetAppointmentAccessibilityDataResult,
} from '../utils/appointment-accessibility.helper';
import { useAppointmentAccessibilityOverride } from './appointment-accessibility-override';

export const useGetAppointmentAccessibility = (): GetAppointmentAccessibilityDataResult => {
  const { locationVirtual, encounter, appointment } = useAppointmentData();
  const user = useEvolveUser();
  // Set only by a page that has no appointment in the store and therefore cannot let this hook derive
  // the lock — an empty store answers `false`, i.e. EDITABLE, for a visit that may well be signed.
  const override = useAppointmentAccessibilityOverride();

  return useMemo(() => {
    const derived = getAppointmentAccessibilityData({ locationVirtual, encounter, appointment, user });
    if (override?.isAppointmentReadOnly === undefined) return derived;
    return { ...derived, isAppointmentReadOnly: override.isAppointmentReadOnly };
  }, [locationVirtual, encounter, appointment, user, override?.isAppointmentReadOnly]);
};
