import { ReactElement, ReactNode } from 'react';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import useEvolveUser from 'src/hooks/useEvolveUser';

/**
 * Mounts its children once the mock visit and signed-in user have loaded, the way a dialog is only
 * ever opened on an already-loaded visit page. Needed by dialogs that read the visit once, at mount
 * (e.g. react-hook-form defaultValues).
 */
export const VisitReady = ({ children }: { children: ReactNode }): ReactElement | null => {
  const { patient, encounter } = useAppointmentData();
  const user = useEvolveUser();
  return patient && encounter?.id && user?.profileResource ? <>{children}</> : null;
};
