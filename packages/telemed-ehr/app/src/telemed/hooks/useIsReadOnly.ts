import { useEffect } from 'react';
import { useAppointmentStore } from '../state';
import { useGetAppointmentAccessibility } from './useGetAppointmentAccessibility';

export const useIsReadOnly = (): void => {
  const appointmentAccessibility = useGetAppointmentAccessibility();

  useEffect(() => {
    useAppointmentStore.setState({
      isReadOnly: appointmentAccessibility.isAppointmentReadOnly,
    });
  }, [appointmentAccessibility.isAppointmentReadOnly]);
};
